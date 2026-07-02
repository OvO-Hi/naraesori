// lib/pipeline/transcribe-client.ts
//
// 브라우저용 공용 STT 파이프라인. app/page.tsx(프로토타입)와 app/live(LiveScreen)가 함께 쓴다.
//
// - 청크 배열을 순차 전사(동시성 1)하며 rate limit 을 방어한다:
//     · 요청 시작 간 최소 간격(MIN_INTERVAL_MS)
//     · 429 시 지수 백오프 재시도(retry-after 헤더 우선)
// - 각 청크 자막을 /api/correct(RAG 교정)에 보내는 헬퍼(correctText)도 제공한다.
//
// ⚠️ /api/transcribe, /api/correct route 와 lib/audio/chunker.ts 는 건드리지 않는다(호출만).

import type { AudioChunk } from "@/lib/audio/chunker";

// ── Rate-limit 방어 파라미터 (whisper-1 Tier1 = 50 RPM, 버스트에 민감) ──────────
export const RATE_LIMIT = {
  MIN_INTERVAL_MS: 1800, // 청크 요청 시작 간 최소 간격
  MAX_RETRIES: 4, // 429 재시도 최대 횟수
  BACKOFF_BASE_MS: 2000, // 백오프 시작(2s)
  BACKOFF_FACTOR: 2, // 지수 배수 → 2s, 4s, 8s, 16s
} as const;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// 429(rate limit) 판정. route 가 rate limit 을 status 429 로 그대로 내려주므로 status 로 판정.
// (status 를 못 읽는 예외 상황 대비로 error === "rate_limited" 만 폴백)
export function isRateLimited(res: Response, data: { error?: unknown } | null): boolean {
  if (res.status === 429) return true;
  return data?.error === "rate_limited";
}

// 응답 헤더에 retry-after / retry-after-ms 가 있으면 그 값을(ms) 우선 사용. 없으면 null.
export function retryAfterMsFromHeaders(res: Response): number | null {
  const ms = res.headers.get("retry-after-ms");
  if (ms && !Number.isNaN(Number(ms))) return Number(ms);
  const ra = res.headers.get("retry-after");
  if (ra) {
    const secs = Number(ra);
    if (!Number.isNaN(secs)) return secs * 1000; // 초 단위 숫자
    const at = Date.parse(ra); // HTTP-date 형식
    if (!Number.isNaN(at)) return Math.max(0, at - Date.now());
  }
  return null;
}

// 청크 1회 전송 결과.
export type TranscribeAttempt =
  | { ok: true; text: string; latencyMs: number }
  | { ok: false; rateLimited: boolean; retryAfterMs: number | null; message: string };

// blob 의 MIME 에 맞는 파일명(확장자)을 준다 — whisper 가 포맷을 확장자로 판별한다.
// (파일 모드 wav 는 "chunk.wav", 라이브 마이크 webm 은 "chunk.webm" 등)
function filenameForBlob(blob: Blob): string {
  const t = (blob.type || "").toLowerCase();
  if (t.includes("webm")) return "chunk.webm";
  if (t.includes("ogg")) return "chunk.ogg";
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "chunk.mp4";
  if (t.includes("mpeg") || t.includes("mp3")) return "chunk.mp3";
  return "chunk.wav";
}

// 청크 1회 전송. 성공/실패(429 여부 포함)를 반환만 하고, 재시도/간격은 상위에서 제어.
export async function transcribeChunkOnce(blob: Blob): Promise<TranscribeAttempt> {
  const form = new FormData();
  form.append("audio", blob, filenameForBlob(blob));

  let res: Response;
  try {
    res = await fetch("/api/transcribe", { method: "POST", body: form });
  } catch {
    return { ok: false, rateLimited: false, retryAfterMs: null, message: "네트워크 오류" };
  }

  const data = await res.json().catch(() => null);

  if (!res.ok || !data || data.error) {
    const rateLimited = isRateLimited(res, data);
    return {
      ok: false,
      rateLimited,
      retryAfterMs: rateLimited ? retryAfterMsFromHeaders(res) : null,
      message: data?.error ?? `HTTP ${res.status}`,
    };
  }

  return { ok: true, text: data.text ?? "", latencyMs: data.latencyMs ?? 0 };
}

// 상위로 전달되는 청크별 결과.
export interface ChunkOutcome {
  index: number;
  chunk: AudioChunk;
  ok: boolean;
  text: string; // 성공 시 transcript, 실패 시 ""
  latencyMs: number;
  rateLimited: boolean; // 429 재시도 소진으로 실패한 경우 true
  message?: string; // 실패 사유
}

export interface RunTranscriptionOptions {
  signal?: AbortSignal;
  onStatus?: (msg: string | null) => void;
  onChunk?: (outcome: ChunkOutcome) => void | Promise<void>;
}

// 청크 배열을 순차 전사(간격 + 429 지수 백오프). 각 청크 결과를 onChunk 로 전달한다.
export async function runTranscription(
  chunks: AudioChunk[],
  opts: RunTranscriptionOptions = {},
): Promise<void> {
  const { MIN_INTERVAL_MS, MAX_RETRIES, BACKOFF_BASE_MS, BACKOFF_FACTOR } = RATE_LIMIT;
  const status = opts.onStatus ?? (() => {});
  let lastStartAt = 0; // 직전 "요청 시작" 시각(재시도 포함) — 간격 제어용

  for (const chunk of chunks) {
    if (opts.signal?.aborted) return;

    // (1) 간격 제어: 직전 요청 시작 후 MIN_INTERVAL_MS 안 지났으면 대기.
    const waitFor = MIN_INTERVAL_MS - (Date.now() - lastStartAt);
    if (lastStartAt > 0 && waitFor > 0) {
      status(`전사 대기 중… (간격 조절 ${Math.ceil(waitFor / 100) / 10}s)`);
      await sleep(waitFor);
    }

    // (2) 전송 + 429 지수 백오프 재시도.
    let attempt = 0;
    for (;;) {
      if (opts.signal?.aborted) return;
      if (attempt === 0) status(null);
      lastStartAt = Date.now();
      const result = await transcribeChunkOnce(chunk.blob);

      if (result.ok) {
        await opts.onChunk?.({
          index: chunk.index,
          chunk,
          ok: true,
          text: result.text,
          latencyMs: result.latencyMs,
          rateLimited: false,
        });
        break;
      }

      if (result.rateLimited && attempt < MAX_RETRIES) {
        const backoff = result.retryAfterMs ?? BACKOFF_BASE_MS * BACKOFF_FACTOR ** attempt;
        attempt++;
        status(
          `전사 대기 중… (429 rate limit — ${Math.round(backoff / 1000)}s 후 재시도 ${attempt}/${MAX_RETRIES})`,
        );
        await sleep(backoff);
        continue;
      }

      // 429 아님(즉시 실패) 또는 재시도 소진.
      const why = result.rateLimited ? `429 재시도 ${MAX_RETRIES}회 초과` : result.message;
      await opts.onChunk?.({
        index: chunk.index,
        chunk,
        ok: false,
        text: "",
        latencyMs: 0,
        rateLimited: result.rateLimited,
        message: why,
      });
      break;
    }
  }

  status(null);
}

// ── 오버랩 중복 제거 ────────────────────────────────────────────────────────
// 오버랩 청킹 때문에 인접 청크 자막이 겹치는 머리/꼬리를 갖는다
// (예: "…함수를 짰어요" | "짰어요 이런 경우면…").
// 직전 자막 뒤쪽 maxOverlapChars 글자와 새 자막 앞부분에서 "가장 긴 공통 부분"을 찾아
// 새 자막에서 제거해 반환한다. 완벽하진 않아도 명백한 반복은 없앤다.
export function dedupOverlap(prevText: string, newText: string, maxOverlapChars = 20): string {
  const prev = (prevText ?? "").trimEnd();
  const next = (newText ?? "").trimStart();
  if (!prev || !next) return newText;

  const tail = prev.slice(-maxOverlapChars);
  const maxK = Math.min(tail.length, next.length);
  // 가장 긴 것부터: tail 의 접미사 k글자가 next 의 접두사와 같으면 그만큼 제거.
  for (let k = maxK; k >= 2; k--) {
    const suffix = tail.slice(tail.length - k);
    if (next.startsWith(suffix)) {
      return next.slice(k).trimStart();
    }
  }
  return newText;
}

// 단일 blob 전사 + 429 지수 백오프 재시도(라이브 마이크용).
// 간격 제어는 호출부(마이크 5초 주기)가 담당하므로 여기선 백오프만 재사용한다.
export async function transcribeBlobWithRetry(
  blob: Blob,
  opts: { signal?: AbortSignal; onStatus?: (msg: string | null) => void } = {},
): Promise<{ ok: boolean; text: string; rateLimited: boolean; message?: string }> {
  const { MAX_RETRIES, BACKOFF_BASE_MS, BACKOFF_FACTOR } = RATE_LIMIT;
  const status = opts.onStatus ?? (() => {});
  for (let attempt = 0; ; attempt++) {
    if (opts.signal?.aborted) return { ok: false, text: "", rateLimited: false, message: "aborted" };
    const r = await transcribeChunkOnce(blob);
    if (r.ok) {
      status(null);
      return { ok: true, text: r.text, rateLimited: false };
    }
    if (r.rateLimited && attempt < MAX_RETRIES) {
      const backoff = r.retryAfterMs ?? BACKOFF_BASE_MS * BACKOFF_FACTOR ** attempt;
      status(`429 rate limit — ${Math.round(backoff / 1000)}s 후 재시도 (${attempt + 1}/${MAX_RETRIES})`);
      await sleep(backoff);
      continue;
    }
    return {
      ok: false,
      text: "",
      rateLimited: r.rateLimited,
      message: r.rateLimited ? `429 재시도 ${MAX_RETRIES}회 초과` : r.message,
    };
  }
}

// ── RAG 교정 (/api/correct) ────────────────────────────────────────────────
export interface Change {
  from: string;
  to: string;
}

// 요약(강의 종료 후 정리자료)로 넘기는 자막 한 줄. original(원본 STT)/corrected(교정본)/changes.
export interface TranscriptCaption {
  original: string;
  corrected: string;
  changes: Change[];
}

export interface CorrectResult {
  original: string;
  corrected: string;
  changes: Change[];
  candidates: string[];
}

// 자막 한 줄을 /api/correct 로 교정. 실패해도 원문 유지로 폴백(데모 안정성).
export async function correctText(text: string, signal?: AbortSignal): Promise<CorrectResult> {
  try {
    const res = await fetch("/api/correct", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
    const data = await res.json().catch(() => null);
    // route 는 실패 시에도 { corrected: original, changes: [] } 를 준다 → 그대로 사용.
    if (data && typeof data.corrected === "string") {
      return {
        original: typeof data.original === "string" ? data.original : text,
        corrected: data.corrected,
        changes: Array.isArray(data.changes) ? data.changes : [],
        candidates: Array.isArray(data.candidates) ? data.candidates : [],
      };
    }
  } catch {
    // 네트워크/중단 등 → 폴백
  }
  return { original: text, corrected: text, changes: [], candidates: [] };
}
