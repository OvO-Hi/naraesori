"use client";

// components/naraesori/VoiceEnroll.tsx
// 프로필 "내 목소리 등록" — 마이크로 1~2분 녹음 → ElevenLabs IVC(/api/voice/clone)로 복제 →
// voiceId 를 localStorage 'naraesori_voice_id' 에 저장. 등록되면 테스트 발화(/api/voice/speak) 가능.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Mic, Square, Play, RotateCcw, CheckCircle2 } from "lucide-react";

const VOICE_KEY = "naraesori_voice_id";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VoiceEnroll() {
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "recording" | "recorded">("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [registering, setRegistering] = useState(false);
  const [testing, setTesting] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoiceId(typeof window !== "undefined" ? localStorage.getItem(VOICE_KEY) : null);
    return () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : undefined;
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        blobRef.current = blob;
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(blob));
        setPhase("recorded");
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      recorderRef.current = mr;
      mr.start();
      setPhase("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      toast.error("마이크를 시작할 수 없어요. 브라우저 권한을 확인해 주세요.");
    }
  }

  function stopRec() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function resetRec() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    blobRef.current = null;
    setPhase("idle");
    setElapsed(0);
  }

  async function register() {
    if (!blobRef.current) return;
    setRegistering(true);
    try {
      const form = new FormData();
      form.append("audio", blobRef.current, "sample.webm");
      form.append("name", "나래소리-사용자");
      const res = await fetch("/api/voice/clone", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.voiceId) throw new Error(data?.error || `등록 실패 (HTTP ${res.status})`);
      localStorage.setItem(VOICE_KEY, data.voiceId);
      setVoiceId(data.voiceId);
      resetRec();
      toast.success("내 목소리가 등록되었어요.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "목소리 등록에 실패했어요.");
    } finally {
      setRegistering(false);
    }
  }

  async function testVoice() {
    if (!voiceId) return;
    setTesting(true);
    try {
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "안녕하세요, 제 목소리로 발화하는 테스트입니다.", voiceId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "테스트 실패");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      toast("등록된 목소리로 재생합니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "목소리 테스트에 실패했어요.");
    } finally {
      setTesting(false);
    }
  }

  function reRegister() {
    localStorage.removeItem(VOICE_KEY);
    setVoiceId(null);
    resetRec();
    toast("등록을 해제했어요. 다시 녹음해 등록할 수 있어요.");
  }

  return (
    <section className="card-elev-1 rounded-3xl border border-border bg-card p-6">
      <h2 className="text-lg font-bold text-foreground">내 목소리</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        1~2분 정도 또렷하게 말하면 이 목소리로 강의실에 발화할 수 있어요.
      </p>

      {voiceId ? (
        // ── 등록됨 ──
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2 rounded-2xl border border-leaf-soft bg-leaf-soft/40 p-3 text-sm font-semibold text-primary">
            <CheckCircle2 className="h-5 w-5" />
            내 목소리 등록됨
            <span className="ml-1 truncate font-mono text-xs font-normal text-muted-foreground">{voiceId}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={testVoice}
              disabled={testing}
              className="lift inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-95 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {testing ? "재생 중…" : "등록된 목소리로 테스트"}
            </button>
            <button
              onClick={reRegister}
              className="lift inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              <RotateCcw className="h-4 w-4" />
              재등록
            </button>
          </div>
        </div>
      ) : (
        // ── 미등록: 녹음 → 등록 ──
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {phase !== "recording" ? (
              <button
                onClick={startRec}
                className="lift inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-95"
              >
                <Mic className="h-4 w-4" />
                {phase === "recorded" ? "다시 녹음" : "녹음 시작"}
              </button>
            ) : (
              <button
                onClick={stopRec}
                className="lift inline-flex items-center gap-2 rounded-full bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground hover:opacity-95"
              >
                <Square className="h-4 w-4" />
                정지
              </button>
            )}
            {phase === "recording" && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-destructive">
                <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
                녹음 중 · {fmt(elapsed)}
              </span>
            )}
          </div>

          {phase === "recorded" && audioUrl && (
            <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
              <p className="text-xs text-muted-foreground">녹음 미리듣기</p>
              <audio controls src={audioUrl} className="w-full" />
              <button
                onClick={register}
                disabled={registering}
                className="lift inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-95 disabled:opacity-50"
              >
                {registering ? "등록 중…" : "목소리 등록"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
