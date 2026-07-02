// scripts/stt-eval/run.ts
//
// STT 3종(+OpenAI 내부 2종) 비교 평가 스크립트 — 발표 근거용 일회성 도구.
//
// 같은 음성 파일을 OpenAI(whisper-1, gpt-4o-transcribe) / Naver Clova CSR / Google STT v2 에
// 모두 보내서 받아쓴 결과를 나란히 비교하고, reference 정답이 있으면 WER을 계산한다.
//
// ⚠️ 이 스크립트는 Next.js 앱 코드(app/, lib/)를 전혀 건드리지 않는다. scripts/stt-eval/ 안에서만 동작.
//
// 핵심: lib/audio/chunker.ts 는 브라우저(Web Audio API) 전용이라 Node에서 못 쓴다.
//       대신 여기서는 ffmpeg로 chunker.ts와 "동일한" 포맷(16kHz / 모노 / 16bit PCM WAV)을
//       만들어서 세 벤더에 똑같이 먹인다(공정 비교).
//
// 실행: npm run stt:eval
//
// 사용법은 scripts/stt-eval/README.md 참고.

import * as fs from "node:fs";
import * as path from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import * as os from "node:os";
import * as dotenv from "dotenv";
import OpenAI from "openai";
import gspeech from "@google-cloud/speech"; // V2 사용 (V1 아님): gspeech.v2.SpeechClient

const execFileAsync = promisify(execFile);

// ──────────────────────────────────────────────────────────────────────────
// 0. 환경 설정 / 경로
// ──────────────────────────────────────────────────────────────────────────

const ROOT = process.cwd(); // npm script 로 실행하면 프로젝트 루트
// 키는 절대 하드코딩하지 않는다. .env.local 에서 로드.
dotenv.config({ path: path.join(ROOT, ".env.local") });

const EVAL_DIR = path.join(ROOT, "scripts", "stt-eval");
const INPUT_DIR = path.join(EVAL_DIR, "input");
const REFERENCE_DIR = path.join(EVAL_DIR, "reference");
const OUTPUT_DIR = path.join(EVAL_DIR, "output");

// chunker.ts 와 동일하게 맞추는 출력 포맷 (이게 공정 비교의 핵심)
const TARGET_RATE = 16000; // 16kHz
const TARGET_CHANNELS = 1; // 모노
// 16bit PCM little-endian = pcm_s16le

// Clova CSR 는 짧은 발화용. 60초 넘는 음원은 앞 60초만 잘라서 보낸다.
const CLOVA_MAX_SECONDS = 60;

const AUDIO_EXTS = new Set([".mp3", ".m4a", ".wav", ".flac", ".ogg", ".aac", ".mp4", ".webm"]);

// ──────────────────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────────────────

interface VendorResult {
  vendor: string; // 표시 이름
  transcript: string | null;
  latencyMs: number | null;
  wer: number | null;
  error?: string;
}

interface FileResult {
  file: string;
  durationSec: number | null;
  reference: string | null;
  vendors: VendorResult[];
}

// ──────────────────────────────────────────────────────────────────────────
// 1. 유틸: ffmpeg / ffprobe
// ──────────────────────────────────────────────────────────────────────────

function ensureFfmpeg(): void {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    console.error(
      "\n❌ ffmpeg 를 찾을 수 없습니다. 이 스크립트는 ffmpeg 로 오디오를 16kHz/모노/16bit WAV 로 변환합니다.\n" +
        "   macOS: brew install ffmpeg\n" +
        "   설치 후 다시 실행하세요.\n",
    );
    process.exit(1);
  }
}

async function probeDurationSec(file: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file,
    ]);
    const sec = parseFloat(stdout.trim());
    return Number.isFinite(sec) ? sec : null;
  } catch {
    return null;
  }
}

// chunker.ts 와 동일 포맷(16kHz/모노/16bit PCM WAV)으로 변환.
// maxSeconds 가 주어지면 앞부분만 잘라서 변환(Clova 60초 제한용).
async function toWav(input: string, outWav: string, maxSeconds?: number): Promise<void> {
  const args = ["-y", "-i", input];
  if (maxSeconds && maxSeconds > 0) {
    args.push("-t", String(maxSeconds));
  }
  args.push(
    "-ar",
    String(TARGET_RATE),
    "-ac",
    String(TARGET_CHANNELS),
    "-c:a",
    "pcm_s16le",
    outWav,
  );
  await execFileAsync("ffmpeg", args);
}

// ──────────────────────────────────────────────────────────────────────────
// 2. WER 계산
// ──────────────────────────────────────────────────────────────────────────
//
// WER = (S + D + I) / N , 단어(공백 토큰) 단위 편집거리 기반.
// 정규화: 양쪽 모두 소문자화 + 기본 구두점 제거 + 공백 정규화 후 공백 기준 토큰화.
// (WER 은 정규화에 민감하므로 무엇을 했는지 콘솔에 1줄 명시한다 — main() 에서 출력)

const NORMALIZATION_NOTE =
  "정규화: 소문자화 + 기본 구두점 제거([.,!?;:'\"…·~()\\[\\]{}<>「」『』]) + 공백 단일화, 그 후 공백 토큰화";

function normalizeForWer(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"…·~()\[\]{}<>「」『』]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length > 0);
}

// 단어 단위 Levenshtein 편집거리 → WER
function computeWer(reference: string, hypothesis: string): number {
  const ref = normalizeForWer(reference);
  const hyp = normalizeForWer(hypothesis);
  const n = ref.length;
  const m = hyp.length;
  if (n === 0) return m === 0 ? 0 : 1; // reference 가 비면 비교 불가 → 보수적으로 1(또는 0)

  // dp[i][j] = ref[0..i) 를 hyp[0..j) 로 만드는 최소 편집(S+D+I) 횟수
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i; // 삭제
  for (let j = 0; j <= m; j++) dp[0][j] = j; // 삽입
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (ref[i - 1] === hyp[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1, // 치환(S)
          dp[i - 1][j] + 1, // 삭제(D)
          dp[i][j - 1] + 1, // 삽입(I)
        );
      }
    }
  }
  return dp[n][m] / n;
}

// ──────────────────────────────────────────────────────────────────────────
// 3. 벤더 호출
// ──────────────────────────────────────────────────────────────────────────

// (a) OpenAI — model 별로 호출. file 은 변환된 wav 의 read stream.
async function transcribeOpenAI(wavPath: string, model: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY 가 .env.local 에 없습니다.");
  const client = new OpenAI({ apiKey });
  const res = await client.audio.transcriptions.create({
    file: fs.createReadStream(wavPath),
    model,
    language: "ko",
    response_format: "json",
    temperature: 0,
  });
  return (res as { text?: string }).text ?? "";
}

// (b) Naver Clova CSR (REST) — wav raw 바이트를 octet-stream 으로 POST.
async function transcribeClova(wavPath: string): Promise<string> {
  const clientId = process.env.CLOVA_CLIENT_ID;
  const clientSecret = process.env.CLOVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("CLOVA_CLIENT_ID / CLOVA_CLIENT_SECRET 가 .env.local 에 없습니다.");
  }
  const body = fs.readFileSync(wavPath); // 변환된 wav 의 raw 바이트 그대로
  const res = await fetch("https://naveropenapi.apigw.ntruss.com/recog/v1/stt?lang=Kor", {
    method: "POST",
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
      "Content-Type": "application/octet-stream",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Clova 인증 실패 (HTTP ${res.status}) — CLOVA_CLIENT_ID / CLOVA_CLIENT_SECRET 키를 확인하세요. 응답: ${text}`,
      );
    }
    if (res.status === 429) {
      throw new Error(
        `Clova HTTP 429 — NAVER Cloud 콘솔에서 CSR(Speech Recognition) 서비스가 활성화/체크되어 있는지 확인하세요(요청 한도 또는 서비스 미신청). 응답: ${text}`,
      );
    }
    throw new Error(`Clova HTTP ${res.status}: ${text}`);
  }

  // ── 디버그: 파싱 전에 status + raw 응답 본문을 그대로 출력한다.
  //    (transcript 가 빈 문자열로만 나오는 원인 파악용. 응답 구조 확인 후 파싱 로직 조정 예정.)
  const rawBody = await res.text();
  console.log("[Clova] status:", res.status);
  console.log("[Clova] raw:", rawBody);

  // 응답이 JSON 이 아닐 수도 있으므로 JSON.parse 를 try/catch 로 감싼다.
  let json: { text?: string };
  try {
    json = JSON.parse(rawBody) as { text?: string };
  } catch (parseErr) {
    console.log("[Clova] JSON.parse 실패 — raw 텍스트를 그대로 사용합니다:", rawBody);
    console.log("[Clova] parse error:", parseErr instanceof Error ? parseErr.message : String(parseErr));
    return rawBody;
  }

  // 현재는 text 필드만 읽는다(파싱 로직은 아직 변경하지 않음 — 위 raw 로 응답 구조를 먼저 확인).
  return json.text ?? "";
}

// (c) Google Cloud Speech-to-Text V2 — recognizer "_" + autoDecodingConfig + base64 content.
async function transcribeGoogle(wavPath: string): Promise<string> {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) throw new Error("GOOGLE_CLOUD_PROJECT 가 .env.local 에 없습니다.");
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS (서비스 계정 JSON 경로) 가 .env.local 에 없습니다.");
  }

  // 인증은 GOOGLE_APPLICATION_CREDENTIALS 환경변수로 자동 처리됨.
  const client = new gspeech.v2.SpeechClient();
  const recognizer = `projects/${project}/locations/global/recognizers/_`;
  const content = fs.readFileSync(wavPath).toString("base64");

  const [response] = await client.recognize({
    recognizer,
    config: {
      autoDecodingConfig: {}, // wav 헤더 자동 인식
      languageCodes: ["ko-KR"],
      model: "long", // 강의용. 짧은 클립이면 "short" 도 가능.
    },
    content,
  });

  const transcript = (response.results ?? [])
    .map((r) => r.alternatives?.[0]?.transcript ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return transcript;
}

// 벤더 호출을 try/catch + latency 측정으로 감싸는 공통 래퍼.
// 한 벤더가 실패해도 전체가 죽지 않게, 실패는 결과의 error 로 기록한다.
async function runVendor(
  vendor: string,
  reference: string | null,
  fn: () => Promise<string>,
): Promise<VendorResult> {
  const started = process.hrtime.bigint();
  try {
    const transcript = await fn();
    const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
    const wer = reference != null ? computeWer(reference, transcript) : null;
    return { vendor, transcript, latencyMs: Math.round(latencyMs), wer };
  } catch (err) {
    const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
    return {
      vendor,
      transcript: null,
      latencyMs: Math.round(latencyMs),
      wer: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 4. 출력 포맷팅
// ──────────────────────────────────────────────────────────────────────────

function fmtLatency(ms: number | null): string {
  return ms == null ? "   -  " : `${String(ms).padStart(5)}ms`;
}

function fmtWer(wer: number | null): string {
  return wer == null ? "  -  " : wer.toFixed(3);
}

function printFileResult(r: FileResult): void {
  const dur = r.durationSec != null ? `${r.durationSec.toFixed(1)}s` : "?";
  console.log(`\n=== ${r.file} (길이 ${dur}) ===`);
  if (r.reference == null) {
    console.log("  (reference 없음 → WER 미계산)");
  }
  const labelWidth = Math.max(...r.vendors.map((v) => v.vendor.length));
  for (const v of r.vendors) {
    const label = v.vendor.padEnd(labelWidth);
    console.log(`  [${label}] latency ${fmtLatency(v.latencyMs)}  WER ${fmtWer(v.wer)}`);
    if (v.error) {
      console.log(`    ⚠️  error: ${v.error}`);
    } else {
      console.log(`    transcript: ${v.transcript ?? ""}`);
    }
  }
}

// 전체 음원 평균 WER/latency 요약표
function printSummary(results: FileResult[]): void {
  console.log("\n\n========== 전체 요약 (벤더별 평균) ==========");
  const vendorNames: string[] = [];
  for (const r of results) for (const v of r.vendors) if (!vendorNames.includes(v.vendor)) vendorNames.push(v.vendor);

  const labelWidth = Math.max(12, ...vendorNames.map((n) => n.length));
  console.log(
    `${"vendor".padEnd(labelWidth)}  ${"avg latency".padStart(12)}  ${"avg WER".padStart(8)}  ${"ok/total".padStart(9)}`,
  );
  console.log("-".repeat(labelWidth + 36));

  for (const name of vendorNames) {
    const entries = results.flatMap((r) => r.vendors.filter((v) => v.vendor === name));
    const ok = entries.filter((v) => v.error == null);
    const latencies = ok.map((v) => v.latencyMs).filter((x): x is number => x != null);
    const wers = ok.map((v) => v.wer).filter((x): x is number => x != null);
    const avgLat =
      latencies.length > 0 ? `${Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)}ms` : "-";
    const avgWer =
      wers.length > 0 ? (wers.reduce((a, b) => a + b, 0) / wers.length).toFixed(3) : "-";
    console.log(
      `${name.padEnd(labelWidth)}  ${avgLat.padStart(12)}  ${avgWer.padStart(8)}  ${`${ok.length}/${entries.length}`.padStart(9)}`,
    );
  }
  console.log("");
}

// ──────────────────────────────────────────────────────────────────────────
// 5. 메인
// ──────────────────────────────────────────────────────────────────────────

async function processFile(inputPath: string, tmpDir: string): Promise<FileResult> {
  const base = path.basename(inputPath);
  const stem = base.replace(path.extname(base), "");

  const durationSec = await probeDurationSec(inputPath);

  // reference 로드 (선택)
  const refPath = path.join(REFERENCE_DIR, `${stem}.txt`);
  let reference: string | null = null;
  if (fs.existsSync(refPath)) {
    reference = fs.readFileSync(refPath, "utf8").trim();
  }

  // 공통 wav (세 벤더 모두 이 동일 wav 를 입력으로 → 공정 비교)
  const wavPath = path.join(tmpDir, `${stem}.16k.wav`);
  await toWav(inputPath, wavPath);

  // Clova 전용 wav: 60초 넘으면 앞 60초만.
  let clovaWavPath = wavPath;
  if (durationSec != null && durationSec > CLOVA_MAX_SECONDS) {
    clovaWavPath = path.join(tmpDir, `${stem}.16k.clova60.wav`);
    await toWav(inputPath, clovaWavPath, CLOVA_MAX_SECONDS);
    console.log(
      `  ℹ️  ${base}: 길이 ${durationSec.toFixed(1)}s > ${CLOVA_MAX_SECONDS}s — Clova 에는 앞 ${CLOVA_MAX_SECONDS}s 만 전송합니다(CSR 짧은 발화 제한).`,
    );
  }

  const vendors: VendorResult[] = [];
  // OpenAI 2종 + Clova + Google. 각 벤더는 try/catch 래퍼로 격리.
  vendors.push(await runVendor("OpenAI whisper-1", reference, () => transcribeOpenAI(wavPath, "whisper-1")));
  vendors.push(
    await runVendor("OpenAI gpt-4o-transcribe", reference, () => transcribeOpenAI(wavPath, "gpt-4o-transcribe")),
  );
  vendors.push(await runVendor("Clova CSR", reference, () => transcribeClova(clovaWavPath)));
  vendors.push(await runVendor("Google STT v2", reference, () => transcribeGoogle(wavPath)));

  return { file: base, durationSec, reference, vendors };
}

async function main(): Promise<void> {
  ensureFfmpeg();

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ 입력 폴더가 없습니다: ${INPUT_DIR}`);
    process.exit(1);
  }

  const inputs = fs
    .readdirSync(INPUT_DIR)
    .filter((f) => AUDIO_EXTS.has(path.extname(f).toLowerCase()))
    .map((f) => path.join(INPUT_DIR, f))
    .sort();

  if (inputs.length === 0) {
    console.error(
      `❌ ${INPUT_DIR} 에 오디오 파일이 없습니다.\n` +
        `   비교할 음원(mp3/m4a/wav 등)을 input/ 에 넣고, 정답이 있으면 reference/<같은이름>.txt 로 두세요.`,
    );
    process.exit(1);
  }

  console.log(`STT 3종 비교 — 입력 ${inputs.length}개`);
  console.log(`출력 포맷(공정 비교): ${TARGET_RATE}Hz / ${TARGET_CHANNELS}ch / 16bit PCM WAV (lib/audio/chunker.ts 와 동일)`);
  console.log(NORMALIZATION_NOTE);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stt-eval-"));

  const results: FileResult[] = [];
  try {
    for (const input of inputs) {
      const r = await processFile(input, tmpDir);
      printFileResult(r);

      // 음원별 JSON 저장
      const outPath = path.join(OUTPUT_DIR, `${path.basename(input)}.result.json`);
      fs.writeFileSync(
        outPath,
        JSON.stringify(
          {
            file: r.file,
            durationSec: r.durationSec,
            hasReference: r.reference != null,
            normalization: NORMALIZATION_NOTE,
            audioFormat: { sampleRate: TARGET_RATE, channels: TARGET_CHANNELS, bitDepth: 16, codec: "pcm_s16le" },
            vendors: r.vendors,
          },
          null,
          2,
        ),
        "utf8",
      );
      console.log(`  💾 저장: ${path.relative(ROOT, outPath)}`);

      results.push(r);
    }
  } finally {
    // 임시 wav 정리
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  printSummary(results);
}

main().catch((err) => {
  console.error("\n❌ 실행 중 치명적 오류:", err);
  process.exit(1);
});
