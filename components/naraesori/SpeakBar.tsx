"use client";

// components/naraesori/SpeakBar.tsx
// 양방향 발화 — 청각장애 학생이 질문을 타이핑 → 음성 합성 → 강의실 스피커로 재생.
//
// 우선순위: (1) 내 목소리(ElevenLabs, /api/voice/speak) → (2) OpenAI TTS(/api/speak) → (3) 브라우저 TTS.
// 발표 안정성을 위해 앞 경로가 실패하면 자동으로 다음 폴백으로 넘어간다.
//
// ⚠️ /api/speak · /api/voice/speak route 는 건드리지 않는다(호출만).

import { useRef, useState } from "react";

const EXAMPLES = ["다시 설명해 주세요.", "질문 있습니다.", "조금만 천천히 말씀해 주세요."];
const VOICE_KEY = "naraesori_voice_id";

interface AskItem {
  id: number;
  text: string;
  time: string;
  via: "voice" | "tts" | "browser"; // 어느 경로로 발화됐는지
}

const VIA_LABEL: Record<AskItem["via"], string> = {
  voice: "내 목소리",
  tts: "기본 음성",
  browser: "브라우저 · 폴백",
};

function nowLabel(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function SpeakBar() {
  const [text, setText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [history, setHistory] = useState<AskItem[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const idRef = useRef(0);

  function cleanupAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }

  function stop() {
    cleanupAudio();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  function record(t: string, via: AskItem["via"]) {
    setHistory((prev) => [...prev, { id: idRef.current++, text: t, time: nowLabel(), via }]);
  }

  // 폴백: 브라우저 내장 TTS(ko-KR).
  function speakBrowser(t: string, reason: string) {
    console.warn("[SpeakBar] 서버 TTS 실패 → 브라우저 TTS 폴백:", reason);
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    record(t, "browser"); // 사용자가 보낸 질문은 기록(발화 시도)
    if (!synth) {
      console.error("[SpeakBar] 브라우저 TTS 미지원 — 발화 불가");
      setSpeaking(false);
      return;
    }
    synth.cancel();
    // 일부 환경(자동화/음성 미설치)은 voices 가 비어 onend 가 오지 않는다 → 상태만 정리.
    if (synth.getVoices().length === 0) {
      console.error("[SpeakBar] 사용 가능한 음성이 없어 소리 재생 불가(상태만 정리)");
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "ko-KR";
    u.rate = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.speak(u);
    // 안전장치: onend 가 오지 않는 브라우저 대비, 길이 비례 타임아웃 후 강제 해제.
    window.setTimeout(() => setSpeaking(false), Math.min(15000, 1500 + t.length * 120));
  }

  // 서버 TTS(엘라/오픈AI)에서 오디오 blob 을 받아 재생. 재생 시작에 성공하면 true.
  async function tryServerTTS(
    url: string,
    payload: Record<string, unknown>,
    t: string,
    via: AskItem["via"],
  ): Promise<boolean> {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return false;
      const ct = res.headers.get("content-type") || "";
      const blob = await res.blob();
      if (!ct.includes("audio") || blob.size === 0) return false;

      const u = URL.createObjectURL(blob);
      urlRef.current = u;
      const audio = new Audio(u);
      audioRef.current = audio;
      audio.onended = () => {
        cleanupAudio();
        setSpeaking(false);
      };
      audio.onerror = () => {
        cleanupAudio();
        setSpeaking(false);
      };
      await audio.play();
      record(t, via);
      return true;
    } catch {
      cleanupAudio();
      return false;
    }
  }

  // 발화 우선순위: (1) 내 목소리(ElevenLabs) → (2) OpenAI TTS → (3) 브라우저 TTS.
  async function speak(raw: string) {
    const t = raw.trim();
    if (!t || speaking) return; // 빈 텍스트 / 재생 중이면 무시
    stop(); // 이전 재생 정리
    setSpeaking(true);

    const voiceId = typeof window !== "undefined" ? localStorage.getItem(VOICE_KEY) : null;

    // (1) 내 목소리(ElevenLabs)
    if (voiceId) {
      if (await tryServerTTS("/api/voice/speak", { text: t, voiceId }, t, "voice")) return;
      console.warn("[SpeakBar] 내 목소리(ElevenLabs) 실패 → OpenAI TTS 폴백");
    }
    // (2) OpenAI TTS
    if (await tryServerTTS("/api/speak", { text: t }, t, "tts")) return;
    // (3) 브라우저 TTS(최종 폴백)
    speakBrowser(t, "서버 TTS 실패");
  }

  return (
    <div className="border-t border-border bg-background/70">
      {/* 내가 보낸 질문 기록 */}
      {history.length > 0 && (
        <ul className="max-h-28 space-y-1.5 overflow-y-auto px-3 pt-3 sm:px-4" aria-label="내가 보낸 질문">
          {history.map((h) => (
            <li key={h.id} className="chip-pop flex items-center justify-end gap-2 text-sm">
              <span className="rounded-2xl bg-primary px-3 py-1.5 font-medium text-primary-foreground">
                {h.text}
              </span>
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                {h.time}
                <span
                  className={
                    "ml-1 " +
                    (h.via === "voice"
                      ? "font-semibold text-primary"
                      : h.via === "browser"
                        ? "text-amber-600"
                        : "text-muted-foreground")
                  }
                >
                  · {VIA_LABEL[h.via]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* 예시 질문(같은 발화 경로 사용) */}
      <div className="flex flex-wrap gap-2 px-3 pt-3 sm:px-4">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => speak(ex)}
            disabled={speaking}
            className="lift rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = text;
          setText("");
          void speak(t);
        }}
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 p-3 sm:p-4"
        aria-label="질문 입력 후 음성으로 전달"
      >
        <label htmlFor="ask" className="sr-only">
          질문 입력
        </label>
        <input
          id="ask"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="질문을 입력하면 음성으로 강의실에 전달됩니다."
          className="min-w-0 rounded-full border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type={speaking ? "button" : "submit"}
          onClick={speaking ? stop : undefined}
          className={
            "lift inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-3 text-sm font-bold sm:px-5 " +
            (speaking
              ? "bg-accent text-accent-foreground"
              : "bg-primary text-primary-foreground hover:opacity-95")
          }
          aria-pressed={speaking}
        >
          {speaking ? (
            <>
              <span aria-hidden className="inline-flex items-center text-accent-foreground">
                {[0, 0.1, 0.2, 0.3, 0.4].map((d, i) => (
                  <span key={i} className="wave-bar" style={{ animationDelay: `${d}s` }} />
                ))}
              </span>
              <span>발화 중…</span>
            </>
          ) : (
            <>
              <span aria-hidden>🔊</span>
              <span>음성으로 말하기</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
