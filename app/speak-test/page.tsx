"use client";

// app/speak-test/page.tsx
//
// 양방향 발화(TTS) 테스트 페이지. textarea 에 질문을 입력하고 "발화" 를 누르면
// /api/speak 로 POST → 오디오 blob 을 받아 브라우저에서 재생한다.
// (디자인은 나중에 — 지금은 인라인 스타일로 최소한만)

import { useRef, useState } from "react";

const EXAMPLES = [
  "교수님, 방금 그 부분 다시 설명해주실 수 있나요?",
  "질문 있습니다.",
  "조금만 더 천천히 말씀해 주세요.",
];

export default function SpeakTestPage() {
  const [text, setText] = useState(EXAMPLES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이전 재생 오디오/URL 정리를 위해 보관.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  async function speak() {
    const value = text.trim();
    if (!value) {
      setError("질문을 입력하세요.");
      return;
    }
    setLoading(true);
    setError(null);

    // 이전 재생/URL 정리
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }

    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: value }),
      });

      if (!res.ok) {
        // 실패 시 서버는 JSON 에러를 준다.
        let msg = `발화 실패 (HTTP ${res.status})`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          /* JSON 아니면 기본 메시지 */
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      await audio.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : "발화 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: "0 16px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>양방향 발화 (TTS) 테스트</h1>
      <p style={{ color: "#666", fontSize: 14, marginTop: 0 }}>
        질문을 입력하면 음성으로 합성해 재생합니다.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="질문을 입력하세요…"
        style={{
          width: "100%",
          padding: 12,
          fontSize: 16,
          borderRadius: 8,
          border: "1px solid #ccc",
          boxSizing: "border-box",
          resize: "vertical",
        }}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setText(ex)}
            style={{
              padding: "6px 10px",
              fontSize: 13,
              borderRadius: 999,
              border: "1px solid #ccc",
              background: "#f5f5f5",
              cursor: "pointer",
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={speak}
        disabled={loading}
        style={{
          padding: "10px 20px",
          fontSize: 16,
          borderRadius: 8,
          border: "none",
          background: loading ? "#999" : "#2563eb",
          color: "#fff",
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "합성 중…" : "🔊 발화"}
      </button>

      {error && (
        <p style={{ color: "#c0392b", marginTop: 12, fontSize: 14 }}>⚠️ {error}</p>
      )}
    </main>
  );
}
