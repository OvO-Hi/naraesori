import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// ── [diag] route 가 실제로 어떤 키/설정으로 OpenAI 를 호출하는지 진단 ──────────────
// (curl 은 200 인데 route 만 429 → 키/조직/프로젝트/baseURL 이 다를 가능성)
const key = process.env.OPENAI_API_KEY ?? "";
console.log("[diag] transcribe key:", key.slice(0, 12) + "..." + key.slice(-4), "len", key.length);
console.log("[diag] OPENAI_BASE_URL:", process.env.OPENAI_BASE_URL);
console.log(
  "[diag] OPENAI_ORG/PROJECT:",
  process.env.OPENAI_ORGANIZATION,
  process.env.OPENAI_PROJECT,
  process.env.OPENAI_ORG_ID,
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const runtime = "nodejs";
export const maxDuration = 30;

// 데모 STT 모델. 한 줄만 바꾸면 교체 가능.
//   whisper-1: 전공용어를 더 자주 오인식 → RAG 교정 데모엔 오히려 유리
//   gpt-4o-transcribe: WER 더 좋음(정확도 우선이면 이쪽)
const STT_MODEL = "whisper-1";

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const form = await req.formData();
    const blob = form.get("audio");
    if (!(blob instanceof Blob)) {
      return NextResponse.json({ error: "no audio" }, { status: 400 });
    }
    const file = new File([blob], "chunk.wav", { type: "audio/wav" });
    const result = await openai.audio.transcriptions.create({
      file,
      model: STT_MODEL,
      language: "ko",
      response_format: "json",
      temperature: 0,
    });
    return NextResponse.json({
      text: result.text,
      latencyMs: Date.now() - started,
      model: STT_MODEL,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "transcribe failed";
    // OpenAI SDK 에러는 err.status(구버전은 err.response?.status)에 HTTP 상태코드가 담긴다.
    const e = err as { status?: number; response?: { status?: number; headers?: unknown } };
    const status = e?.status ?? e?.response?.status;

    if (status === 429) {
      // rate limit 은 500 으로 뭉개지 말고 429 그대로 + retry-after 헤더를 전달한다.
      console.error("transcribe rate limited (429):", message);

      // ── [diag] 어느 조직/프로젝트로 요청이 갔는지, 어떤 종류의 429 인지 확인 ──────
      const ed = err as { status?: number; code?: unknown; type?: unknown };
      console.log("[diag] 429 err.status:", ed?.status);
      console.log("[diag] 429 err.code:", ed?.code);
      console.log("[diag] 429 err.type:", ed?.type);
      console.log("[diag] 429 x-request-id:", readHeader(err, "x-request-id"));
      console.log("[diag] 429 openai-organization:", readHeader(err, "openai-organization"));
      console.log("[diag] 429 openai-project:", readHeader(err, "openai-project"));

      const headers: Record<string, string> = {};
      const retryAfter = readHeader(err, "retry-after");
      const retryAfterMs = readHeader(err, "retry-after-ms");
      if (retryAfter) headers["retry-after"] = retryAfter;
      if (retryAfterMs) headers["retry-after-ms"] = retryAfterMs;

      return NextResponse.json(
        { error: "rate_limited", message, latencyMs: Date.now() - started },
        { status: 429, headers },
      );
    }

    console.error("transcribe error:", message);
    return NextResponse.json(
      { error: "transcribe_failed", message, latencyMs: Date.now() - started },
      { status: 500 },
    );
  }
}

// OpenAI SDK 에러 객체에서 응답 헤더 한 개를 안전하게 읽는다.
// SDK 버전에 따라 err.headers 가 Headers 이거나 plain object 일 수 있어 둘 다 대응.
function readHeader(err: unknown, name: string): string | null {
  const h = (err as { headers?: unknown; response?: { headers?: unknown } })?.headers ??
    (err as { response?: { headers?: unknown } })?.response?.headers;
  if (!h) return null;
  if (typeof (h as Headers).get === "function") {
    return (h as Headers).get(name);
  }
  const rec = h as Record<string, string | undefined>;
  return rec[name] ?? rec[name.toLowerCase()] ?? null;
}
