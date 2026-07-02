// app/api/voice/clone/route.ts
//
// ElevenLabs 즉석 음성 복제(IVC) — 사용자 녹음을 받아 목소리를 등록하고 voice_id 를 돌려준다.
//
// ⚠️ /api/transcribe·correct·speak 는 건드리지 않는다. ElevenLabs 전용 신규 route.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY 가 .env.local 에 없습니다." }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid form body" }, { status: 400 });
  }

  const audio = form.get("audio");
  const name = (typeof form.get("name") === "string" ? (form.get("name") as string) : "") || "나래소리-사용자";
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "녹음 오디오(audio)가 필요합니다." }, { status: 400 });
  }

  // ElevenLabs 로 보낼 multipart 구성
  const t = (audio.type || "").toLowerCase();
  const filename = t.includes("wav")
    ? "sample.wav"
    : t.includes("mp3") || t.includes("mpeg")
      ? "sample.mp3"
      : t.includes("ogg")
        ? "sample.ogg"
        : "sample.webm";

  const el = new FormData();
  el.append("name", name);
  el.append("files", audio, filename);

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: el,
    });

    const raw = await res.text();

    if (!res.ok) {
      let detail: string = raw;
      try {
        const j = JSON.parse(raw);
        const d = j?.detail;
        detail = typeof d === "string" ? d : (d?.message ?? JSON.stringify(d ?? j));
      } catch {
        /* raw 그대로 */
      }
      const hint =
        res.status === 402
          ? " — 크레딧/구독 한도일 수 있어요(IVC는 유료 플랜 필요)."
          : res.status === 401
            ? " — API 키를 확인하세요."
            : "";
      return NextResponse.json(
        { error: `목소리 등록 실패 (HTTP ${res.status})${hint} ${detail}`.trim() },
        { status: 500 },
      );
    }

    const data = JSON.parse(raw) as { voice_id?: string };
    if (!data.voice_id) {
      return NextResponse.json({ error: "ElevenLabs 응답에 voice_id 가 없습니다." }, { status: 500 });
    }
    return NextResponse.json({ voiceId: data.voice_id, name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "목소리 등록 중 오류";
    console.error("voice/clone error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
