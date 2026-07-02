// app/api/voice/speak/route.ts
//
// ElevenLabs TTS — 복제된 voiceId 로 텍스트를 발화(오디오 바이너리 반환).
// 폴백(OpenAI TTS / 브라우저 TTS)은 클라이언트(SpeakBar)가 처리한다.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL_ID = "eleven_multilingual_v2"; // 한국어 지원

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY 가 .env.local 에 없습니다." }, { status: 500 });
  }

  let body: { text?: unknown; voiceId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voiceId = typeof body.voiceId === "string" ? body.voiceId : "";
  if (!text) return NextResponse.json({ error: "`text` 가 필요합니다." }, { status: 400 });
  if (!voiceId) return NextResponse.json({ error: "`voiceId` 가 필요합니다." }, { status: 400 });

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text, model_id: MODEL_ID }),
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      let detail: string = raw;
      try {
        const j = JSON.parse(raw);
        const d = j?.detail;
        detail = typeof d === "string" ? d : (d?.message ?? JSON.stringify(d ?? j));
      } catch {
        /* raw 그대로 */
      }
      return NextResponse.json({ error: `ElevenLabs TTS 실패 (HTTP ${res.status}): ${detail}` }, { status: 500 });
    }

    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(buf.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ElevenLabs TTS 오류";
    console.error("voice/speak error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
