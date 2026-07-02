// app/api/speak/route.ts
//
// 양방향 발화(TTS) API. 청각장애 학생이 입력한 질문 텍스트를 OpenAI TTS 로 음성 합성해
// 오디오 바이너리(audio/mpeg)로 반환한다. 브라우저가 이걸 강의실 스피커로 재생한다.
//
// ⚠️ JSON 이 아니라 오디오 바이트를 그대로 반환하는 route 다(에러일 때만 JSON).

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const runtime = "nodejs";
export const maxDuration = 30;

// TTS 모델/보이스. 바꾸기 쉽게 상수로 뺀다.
//   gpt-4o-mini-tts: 최신 TTS. 접근이 안 되면(권한/모델 미개방) "tts-1" 로 폴백하라.
const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_VOICE = "nova"; // 한국어도 무난. alloy/shimmer 등으로 교체 가능.

export async function POST(req: NextRequest) {
  // 입력 파싱/검증
  let text: unknown;
  try {
    const body = await req.json();
    text = body?.text;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "`text` (non-empty string) is required" }, { status: 400 });
  }

  try {
    const speech = await openai.audio.speech.create({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: text,
    });

    // 반환된 오디오를 그대로 바이너리로 스트리밍.
    const arrayBuffer = await speech.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(arrayBuffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "tts failed";
    console.error("speak error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
