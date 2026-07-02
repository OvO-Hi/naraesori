// scripts/build-demo-replay.ts
//
// 리플레이(폴백) 모드용 데모 JSON 빌더.
// 데모 음원을 ffmpeg 로 8초 청크(16kHz/모노/16bit WAV)로 분할한 뒤, 실행 중인 dev 서버의
// 실제 /api/transcribe + /api/correct 파이프라인을 한 번 돌려서
// 청크별 { startSec, endSec, original, corrected, changes } 를 public/demo/demo-lecture.json 으로 저장한다.
//
// 사용법:
//   1) 먼저 dev 서버를 띄운다:  npm run dev      (기본 http://localhost:3000)
//   2) npm run build:demo <오디오파일경로>
//      예: npm run build:demo "scripts/stt-eval/input/lecture.mp3"
//
//   포트가 3000이 아니면:  DEMO_BASE_URL=http://localhost:3001 npm run build:demo <경로>
//
// ⚠️ /api/* route, chunker.ts, LiveScreen 은 건드리지 않는다(HTTP 호출만).

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
// dedup 은 브라우저 파이프라인과 동일한 로직을 공용 모듈에서 재사용(일관성).
import { dedupOverlap } from "../lib/pipeline/transcribe-client";

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const BASE_URL = (process.env.DEMO_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
// chunker.ts 와 동일한 오버랩 청킹 파라미터(일관성 유지).
const CHUNK_SEC = 8;
const OVERLAP_SEC = 1.5;
const STEP_SEC = Math.max(0.1, CHUNK_SEC - OVERLAP_SEC);
const OUT_PATH = path.join(ROOT, "public", "demo", "demo-lecture.json");

// rate limit 방어(공용 클라이언트 모듈과 동일 개념: 간격 + 429 백오프)
const MIN_INTERVAL_MS = 1800;
const MAX_RETRIES = 4;
const BACKOFF_BASE_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ensureFfmpeg(): void {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    console.error("\n❌ ffmpeg 를 찾을 수 없습니다. macOS: brew install ffmpeg\n");
    process.exit(1);
  }
}

async function probeDurationSec(file: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", file,
    ]);
    const sec = parseFloat(stdout.trim());
    return Number.isFinite(sec) ? sec : 0;
  } catch {
    return 0;
  }
}

interface Seg {
  path: string;
  startSec: number;
  endSec: number;
}

// chunker.ts 와 동일한 "오버랩" 청킹: start 를 STEP_SEC 간격으로 전진시키며 각 [start, start+CHUNK_SEC]
// 구간을 16kHz/모노/16bit WAV 로 추출한다.
async function segmentOverlap(input: string, dir: string, durationSec: number): Promise<Seg[]> {
  const segs: Seg[] = [];
  const limit = durationSec > 0 ? durationSec : Number.POSITIVE_INFINITY;
  let i = 0;
  for (let start = 0; start < limit; start += STEP_SEC) {
    const end = durationSec > 0 ? Math.min(start + CHUNK_SEC, durationSec) : start + CHUNK_SEC;
    if (end - start < 0.05) break;
    const out = path.join(dir, `chunk_${String(i).padStart(3, "0")}.wav`);
    await execFileAsync("ffmpeg", [
      "-y", "-ss", String(start), "-t", String(CHUNK_SEC),
      "-i", input,
      "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
      out,
    ]);
    // 끝을 넘어가면 ffmpeg 가 빈/작은 파일을 만든다 → 종료.
    if (!fs.existsSync(out) || fs.statSync(out).size < 100) break;
    segs.push({
      path: out,
      startSec: Math.round(start * 100) / 100,
      endSec: Math.round(end * 100) / 100,
    });
    i++;
    if (durationSec > 0 && end >= durationSec) break;
  }
  return segs;
}

// 실행 중 dev 서버의 /api/transcribe 호출(429 백오프 포함).
async function transcribe(wavPath: string): Promise<string> {
  const buf = fs.readFileSync(wavPath);
  for (let attempt = 0; ; attempt++) {
    const form = new FormData();
    form.append("audio", new Blob([buf], { type: "audio/wav" }), "chunk.wav");
    const res = await fetch(`${BASE_URL}/api/transcribe`, { method: "POST", body: form });
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const wait = BACKOFF_BASE_MS * 2 ** attempt;
      console.log(`   [429] ${wait}ms 후 재시도 (${attempt + 1}/${MAX_RETRIES})`);
      await sleep(wait);
      continue;
    }
    const data = (await res.json().catch(() => null)) as { text?: string; error?: string } | null;
    if (!res.ok || !data || data.error) {
      throw new Error(`transcribe 실패 (HTTP ${res.status}): ${data?.error ?? ""}`);
    }
    return data.text ?? "";
  }
}

interface CorrectResp {
  original: string;
  corrected: string;
  changes: { from: string; to: string }[];
}

// /api/correct 호출. 실패해도 원문 유지(폴백).
async function correct(text: string): Promise<CorrectResp> {
  try {
    const res = await fetch(`${BASE_URL}/api/correct`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = (await res.json().catch(() => null)) as Partial<CorrectResp> | null;
    if (data && typeof data.corrected === "string") {
      return {
        original: data.original ?? text,
        corrected: data.corrected,
        changes: Array.isArray(data.changes) ? data.changes : [],
      };
    }
  } catch {
    /* 폴백 */
  }
  return { original: text, corrected: text, changes: [] };
}

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input) {
    console.error("사용법: npm run build:demo <오디오파일경로>   (dev 서버가 먼저 실행 중이어야 함)");
    process.exit(1);
  }
  if (!fs.existsSync(input)) {
    console.error(`❌ 파일이 없습니다: ${input}`);
    process.exit(1);
  }

  ensureFfmpeg();
  console.log(`데모 빌드 — 입력: ${input}`);
  console.log(`대상 서버: ${BASE_URL} (실행 중이어야 함)`);

  const durationSec = await probeDurationSec(input);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "demo-replay-"));
  const captions: Array<{
    index: number;
    startSec: number;
    endSec: number;
    original: string;
    corrected: string;
    changes: { from: string; to: string }[];
  }> = [];

  try {
    const segs = await segmentOverlap(input, tmp, durationSec);
    console.log(`청크 ${segs.length}개 (길이 ${CHUNK_SEC}s / 겹침 ${OVERLAP_SEC}s / 전진 ${STEP_SEC}s)`);

    let lastStart = 0;
    let prevRawOriginal = ""; // dedup 은 "직전 청크의 원본(raw) 꼬리" 기준으로 비교
    let prevRawCorrected = "";
    for (let i = 0; i < segs.length; i++) {
      const waitFor = MIN_INTERVAL_MS - (Date.now() - lastStart);
      if (lastStart > 0 && waitFor > 0) await sleep(waitFor);
      lastStart = Date.now();

      const text = await transcribe(segs[i].path);
      const c = await correct(text);
      // 오버랩 중복 제거(브라우저 push 와 동일 로직) — raw 직전 대비 비교 후 저장.
      const original = dedupOverlap(prevRawOriginal, c.original);
      const corrected = dedupOverlap(prevRawCorrected, c.corrected);
      prevRawOriginal = c.original;
      prevRawCorrected = c.corrected;

      captions.push({
        index: i,
        startSec: segs[i].startSec,
        endSec: segs[i].endSec,
        original,
        corrected,
        changes: c.changes,
      });
      const mark = c.changes.length ? ` (교정 ${c.changes.map((x) => `${x.from}→${x.to}`).join(", ")})` : "";
      console.log(`  [${i + 1}/${segs.length}] ${corrected.slice(0, 40)}…${mark}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  const payload = {
    meta: {
      source: path.basename(input),
      lecture: path.basename(input),
      chunkSec: CHUNK_SEC,
      durationSec: Math.round(durationSec * 10) / 10,
      generatedAt: new Date().toISOString(),
    },
    captions,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`\n✅ 저장: ${path.relative(ROOT, OUT_PATH)} (${captions.length}줄)`);
}

main().catch((err) => {
  console.error("\n❌ 실행 중 오류:", err instanceof Error ? err.message : err);
  process.exit(1);
});
