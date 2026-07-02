"use client";

// components/naraesori/LiveScreen.tsx
// 화면 2 — 실시간 자막 스트림 + RAG 교정. 데모 핵심.
//
// 세 가지 모드:
//   · file   : 업로드한 음원 → chunker(8초) → /api/transcribe → /api/correct.
//   · live   : 마이크 준실시간 — 5초 조각 → /api/transcribe → /api/correct (whisper 파일 API 기반 준실시간).
//   · replay : public/demo/demo-lecture.json 을 원래 타이밍대로 재생(API 호출 없음, 폴백).
//
// 교정된 단어는 .correct-word(accent=Tuscan Sun 노랑)로 하이라이트.
// 실시간(file/live)이 429 등으로 실패하면 리플레이로 폴백(수동 토글 + 자동 제안).
//
// ⚠️ /api/* route, SpeakBar, chunker.ts 는 건드리지 않는다(호출/재사용만).

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Lecture } from "@/lib/mock-lectures";
import { chunkAudioFile } from "@/lib/audio/chunker";
import { startMicRecorder, type MicRecorderHandle } from "@/lib/audio/mic-recorder";
import {
  runTranscription,
  transcribeBlobWithRetry,
  correctText,
  dedupOverlap,
  type Change,
  type TranscriptCaption,
} from "@/lib/pipeline/transcribe-client";
import { SpeakBar } from "./SpeakBar";

// PDF 뷰어는 pdf.js(브라우저 전용) → SSR 끄고 동적 로드.
const PdfViewer = dynamic(() => import("./PdfViewer").then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-[40dvh] place-items-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">
      뷰어 불러오는 중…
    </div>
  ),
});

type Mode = "file" | "live" | "replay";

interface LiveCaption {
  id: number;
  original: string;
  corrected: string;
  changes: Change[];
  failed?: boolean;
}

interface ReplayCaption {
  index: number;
  startSec: number;
  endSec: number;
  original: string;
  corrected: string;
  changes: Change[];
}

const REPLAY_FIRST_DELAY_MS = 400;
const REPLAY_SPEED = 1;
const DEMO_URL = "/demo/demo-lecture.json";
const MIC_INTERVAL_MS = 5000; // 마이크 조각 길이(5초 → ~12 RPM, whisper 50 RPM 안전)

const MODE_LABELS: Record<Mode, string> = {
  file: "파일 재생",
  live: "실시간 마이크",
  replay: "리플레이",
};

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

// corrected 문장에서 changes 의 교정 단어를 accent 하이라이트로 렌더.
function renderCaption(c: LiveCaption) {
  if (!c.changes.length) return c.corrected;
  let nodes: React.ReactNode[] = [c.corrected];
  c.changes.forEach((ch, ci) => {
    if (!ch.to) return;
    nodes = nodes.flatMap((node) => {
      if (typeof node !== "string") return [node];
      const parts = node.split(ch.to);
      const out: React.ReactNode[] = [];
      parts.forEach((p, i) => {
        if (i > 0) {
          out.push(
            <span
              key={`${ci}-${i}`}
              className="correct-word inline-flex items-center gap-1"
              style={{ border: "1px solid var(--accent)" }}
              title={`원본: ${ch.from} → 교정: ${ch.to}`}
            >
              {ch.to}
              <span className="chip-honey rounded-full px-1.5 py-0 text-[10px] font-bold">
                원본 <s className="opacity-70">{ch.from}</s>
              </span>
            </span>,
          );
        }
        if (p) out.push(p);
      });
      return out;
    });
  });
  return nodes;
}

export function LiveScreen({ lecture, onEnd, audioFile, pdfFile }: {
  lecture: Lecture;
  onEnd: (captions: TranscriptCaption[]) => void; // 강의 종료 시 누적 자막 전달(요약용)
  audioFile: File | null;
  pdfFile: File | null; // 강의자료 PDF (없으면 mock 슬라이드)
}) {
  const [mode, setMode] = useState<Mode>("file");
  const [captions, setCaptions] = useState<LiveCaption[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needAudio, setNeedAudio] = useState(false); // file 인데 파일 없음
  const [autoFellBack, setAutoFellBack] = useState(false);
  const [recording, setRecording] = useState(false); // 마이크 녹음 중
  const [micError, setMicError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 마이크 관련 refs
  const recorderRef = useRef<MicRecorderHandle | null>(null);
  const micAbortRef = useRef<AbortController | null>(null);
  const queueRef = useRef<Blob[]>([]);
  const processingRef = useRef(false);
  const micIdRef = useRef(0);
  const rateLimitFailRef = useRef(0);

  // 자막 누적 시 오버랩 중복 제거. 모든 모드가 이 push 를 거친다.
  const push = (c: LiveCaption) =>
    setCaptions((prev) => {
      if (c.failed) return [...prev, c];
      const last = [...prev].reverse().find((x) => !x.failed);
      const corrected = dedupOverlap(last?.corrected ?? "", c.corrected);
      return [...prev, { ...c, corrected }];
    });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [captions]);

  // ── file: 업로드 음원 → 청크 → 전사 → 교정 ────────────────────────────────
  async function runFile(signal: AbortSignal, file: File) {
    try {
      setStatus("음원 분석 중… (청크 분할)");
      const chunks = await chunkAudioFile(file, 8);
      if (signal.aborted) return;
      setTotal(chunks.length);

      let anySuccess = false;
      let rateLimited = false;

      await runTranscription(chunks, {
        signal,
        onStatus: (m) => !signal.aborted && setStatus(m),
        onChunk: async (o) => {
          if (signal.aborted) return;
          if (o.ok) {
            anySuccess = true;
            const cr = await correctText(o.text, signal);
            if (signal.aborted) return;
            push({ id: o.index, original: cr.original, corrected: cr.corrected, changes: cr.changes });
          } else {
            if (o.rateLimited) rateLimited = true;
            push({ id: o.index, original: "", corrected: `[전사 실패] ${o.message}`, changes: [], failed: true });
          }
        },
      });

      if (signal.aborted) return;
      setStatus(null);

      if (!anySuccess && rateLimited) {
        setAutoFellBack(true);
        setMode("replay");
      }
    } catch (err) {
      if (signal.aborted) return;
      setError(err instanceof Error ? err.message : "실시간 처리 오류");
      setAutoFellBack(true);
      setMode("replay");
    }
  }

  // ── replay: 저장된 JSON 을 startSec 간격대로 재생 ─────────────────────────
  async function runReplay(signal: AbortSignal) {
    try {
      setStatus("데모 데이터 로드 중…");
      const res = await fetch(DEMO_URL, { signal });
      if (!res.ok) throw new Error(`데모 데이터 로드 실패 (HTTP ${res.status})`);
      const data = await res.json();
      const caps: ReplayCaption[] = Array.isArray(data?.captions) ? data.captions : [];
      setTotal(caps.length);
      setStatus(null);

      let prevStart = 0;
      for (let i = 0; i < caps.length; i++) {
        const c = caps[i];
        const gapMs = i === 0 ? REPLAY_FIRST_DELAY_MS : Math.max(0, (c.startSec - prevStart) * 1000 / REPLAY_SPEED);
        prevStart = c.startSec;
        await wait(gapMs, signal);
        if (signal.aborted) return;
        push({ id: c.index ?? i, original: c.original, corrected: c.corrected, changes: c.changes ?? [] });
      }
    } catch (err) {
      if (!signal.aborted) setError(err instanceof Error ? err.message : "리플레이 오류");
    } finally {
      if (!signal.aborted) setStatus(null);
    }
  }

  // ── live(마이크): 5초 조각 큐를 순차 전사 → 교정 ──────────────────────────
  async function processQueue() {
    if (processingRef.current) return;
    processingRef.current = true;
    const signal = micAbortRef.current?.signal;
    try {
      while (queueRef.current.length > 0) {
        if (signal?.aborted) break;
        const blob = queueRef.current.shift()!;
        setStatus("전사 중…");
        const r = await transcribeBlobWithRetry(blob, {
          signal,
          onStatus: (m) => !signal?.aborted && setStatus(m ? `대기 중… (${m})` : "전사 중…"),
        });
        if (signal?.aborted) break;

        if (r.ok) {
          rateLimitFailRef.current = 0;
          const text = r.text.trim();
          if (text) {
            const cr = await correctText(text, signal);
            if (signal?.aborted) break;
            push({ id: micIdRef.current++, original: cr.original, corrected: cr.corrected, changes: cr.changes });
          }
          // 무음/빈 결과는 건너뜀
        } else {
          if (r.rateLimited) rateLimitFailRef.current += 1;
          push({ id: micIdRef.current++, original: "", corrected: `[전사 실패] ${r.message}`, changes: [], failed: true });
          // 연속 429 3회 이상 → 리플레이 자동 전환
          if (rateLimitFailRef.current >= 3) {
            stopMic();
            setAutoFellBack(true);
            setMode("replay");
            break;
          }
        }
        setStatus(null);
      }
    } finally {
      processingRef.current = false;
      if (!signal?.aborted) setStatus(null);
    }
  }

  async function startMic() {
    setMicError(null);
    setError(null);
    setCaptions([]);
    setAutoFellBack(false);
    micIdRef.current = 0;
    rateLimitFailRef.current = 0;
    queueRef.current = [];
    const ac = new AbortController();
    micAbortRef.current = ac;
    try {
      const rec = await startMicRecorder({
        intervalMs: MIC_INTERVAL_MS,
        onChunk: (blob) => {
          if (ac.signal.aborted) return;
          queueRef.current.push(blob);
          void processQueue();
        },
        onError: (err) => setMicError(err.message),
      });
      recorderRef.current = rec;
      setRecording(true);
      setStatus("🎤 마이크 준비 완료 — 말씀하시면 5초 단위로 자막이 나옵니다.");
    } catch (err) {
      setRecording(false);
      // 권한 거부/획득 실패
      setMicError(
        err instanceof Error
          ? `마이크를 시작할 수 없습니다: ${err.message}`
          : "마이크를 시작할 수 없습니다.",
      );
    }
  }

  function stopMic() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    micAbortRef.current?.abort();
    setRecording(false);
    setStatus(null);
  }

  // 파이프라인 시작(모드 분기 + 리셋). live(마이크)는 자동 시작하지 않고 버튼을 기다린다.
  async function startPipeline(signal: AbortSignal) {
    // 모드 전환 시 이전 마이크 정리
    recorderRef.current?.stop();
    recorderRef.current = null;
    micAbortRef.current?.abort();

    setCaptions([]);
    setError(null);
    setStatus(null);
    setNeedAudio(false);
    setMicError(null);
    setRecording(false);
    setTotal(0);

    if (mode === "replay") {
      await runReplay(signal);
    } else if (mode === "file") {
      if (!audioFile) setNeedAudio(true);
      else await runFile(signal, audioFile);
    }
    // mode === "live"(마이크): 사용자가 "마이크 시작"을 눌러야 시작.
  }

  useEffect(() => {
    const ac = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void startPipeline(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, audioFile]);

  // 언마운트 시 마이크 하드웨어 정리
  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      micAbortRef.current?.abort();
    };
  }, []);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setAutoFellBack(false);
    setMode(next);
  }

  // 강의 종료 → 마이크 정리 후, 누적된(성공) 자막을 요약용으로 넘긴다(모드 무관).
  function endLecture() {
    stopMic();
    const caps: TranscriptCaption[] = captions
      .filter((c) => !c.failed)
      .map(({ original, corrected, changes }) => ({ original, corrected, changes }));
    onEnd(caps);
  }

  const allChanges = captions.flatMap((c) => c.changes);
  const statusLabel =
    mode === "replay"
      ? "리플레이 재생 중"
      : mode === "live"
        ? recording
          ? "실시간 녹음 중"
          : "마이크 대기 중"
        : "파일 전사 중";

  return (
    <section>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">실시간 강의</p>
          <h1 className="mt-1 truncate text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl">
            {lecture.label}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* 모드 토글: 파일 재생 / 실시간 마이크 / 리플레이 */}
          <div role="group" aria-label="재생 모드" className="flex items-center overflow-hidden rounded-full border border-border bg-card text-sm font-semibold">
            {(["file", "live", "replay"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                aria-pressed={mode === m}
                className={
                  "px-3 py-1.5 transition-colors " +
                  (mode === m ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary")
                }
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
          <button
            onClick={endLecture}
            className="lift rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            강의 종료
          </button>
        </div>
      </div>

      {autoFellBack && (
        <div role="status" className="banner-in card-elev-1 mt-4 rounded-2xl border border-accent/70 bg-honey-soft px-4 py-3 text-sm font-semibold text-primary">
          ⚠️ 실시간 전사가 실패해 리플레이 모드로 전환했습니다.
        </div>
      )}

      {/* 2단: 왼쪽 PDF 강의자료 + 오른쪽 자막. 좁은 화면에선 세로로 쌓임(PDF 위, 자막 아래) */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* 왼쪽: PDF 뷰어 (PDF 없으면 mock 슬라이드) */}
        <div className="order-1">
          {pdfFile ? (
            <PdfViewer file={pdfFile} />
          ) : (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-sm font-bold text-foreground">강의자료</h2>
              <p className="mt-1 text-xs text-muted-foreground">PDF 없음 · 예시 슬라이드</p>
              <ul className="mt-3 space-y-2">
                {lecture.slides.map((s) => (
                  <li key={s.n}>
                    <div className="rounded-xl border border-border bg-background p-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-10 w-14 shrink-0 place-items-center rounded-md bg-secondary text-xs font-bold text-foreground" aria-hidden>
                          {s.n}
                        </span>
                        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{s.title}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 오른쪽: 실시간 자막 + SpeakBar, 그 아래 교정 기록 */}
        <div className="order-2 space-y-4">
          <div className="rounded-3xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <span aria-hidden className="recording-dot" />
                {statusLabel}
              </span>
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {captions.length}{total ? ` / ${total}` : ""} 줄
              </span>
            </div>

            {/* 마이크 모드 컨트롤 바 */}
            {mode === "live" && !micError && (
              <div className="flex items-center justify-center gap-3 border-b border-border bg-muted/30 px-5 py-3">
                {!recording ? (
                  <button
                    onClick={startMic}
                    className="lift rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-95"
                  >
                    🎤 마이크 시작
                  </button>
                ) : (
                  <>
                    <button
                      onClick={stopMic}
                      className="lift rounded-full bg-destructive px-5 py-2.5 text-sm font-bold text-destructive-foreground hover:opacity-95"
                    >
                      ⏹ 정지
                    </button>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-destructive">
                      <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
                      녹음 중
                    </span>
                  </>
                )}
              </div>
            )}

            <div
              ref={scrollRef}
              role="log"
              aria-live="polite"
              aria-label="실시간 자막"
              className="max-h-[52dvh] min-h-[40dvh] space-y-4 overflow-y-auto px-5 py-6"
            >
              {status && <p className="text-center text-sm text-amber-600">⏳ {status}</p>}
              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">{error}</p>
              )}

              {/* 마이크 권한 실패 안내 + 리플레이 제안 */}
              {mode === "live" && micError && (
                <div className="rounded-xl border border-dashed border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">
                  <p>{micError}</p>
                  <p className="mt-1 text-muted-foreground">마이크 권한을 허용하거나, 리플레이로 데모를 진행하세요.</p>
                  <button
                    onClick={() => switchMode("replay")}
                    className="lift mt-3 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                  >
                    리플레이로 전환
                  </button>
                </div>
              )}

              {/* 파일 모드인데 파일 없음 */}
              {needAudio && (
                <div className="rounded-xl border border-dashed border-border bg-muted/40 p-5 text-center text-sm text-muted-foreground">
                  <p>파일 재생 모드는 강의 음원 파일이 필요합니다.</p>
                  <p className="mt-1">시작 화면에서 오디오를 선택하거나, 실시간 마이크 / 리플레이로 전환하세요.</p>
                  <div className="mt-3 flex justify-center gap-2">
                    <button
                      onClick={() => switchMode("live")}
                      className="lift rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                    >
                      실시간 마이크
                    </button>
                    <button
                      onClick={() => switchMode("replay")}
                      className="lift rounded-full border border-border bg-card px-4 py-2 text-sm font-bold text-foreground hover:bg-secondary"
                    >
                      리플레이
                    </button>
                  </div>
                </div>
              )}

              {/* 마이크 대기(시작 전) 안내 */}
              {mode === "live" && !recording && !micError && captions.length === 0 && !status && (
                <p className="text-center text-sm text-muted-foreground">
                  “마이크 시작”을 누르고 말씀하시면 5초 단위로 자막이 나옵니다.
                </p>
              )}

              {mode !== "live" && !status && !needAudio && captions.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">곧 자막이 시작됩니다…</p>
              )}

              {captions.map((c, i) => {
                const isLast = i === captions.length - 1;
                return (
                  <p
                    key={c.id}
                    className={
                      "fade-up leading-relaxed transition-all duration-300 " +
                      (c.failed ? "text-red-600 " : "text-foreground ") +
                      (isLast && !c.failed ? "text-2xl font-bold sm:text-3xl" : "text-base opacity-80 sm:text-lg")
                    }
                  >
                    {c.failed ? c.corrected : renderCaption(c)}
                  </p>
                );
              })}
            </div>

            <SpeakBar />
          </div>

          {/* 교정 기록(실데이터) — 오른쪽 열 하단 */}
          <aside aria-label="교정 기록">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <span aria-hidden>✨</span> 교정 기록
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-foreground">
                {allChanges.length === 0 && (
                  <li className="text-muted-foreground">전공 용어 오인식이 교정되면 여기에 표시돼요.</li>
                )}
                {allChanges.map((ch, i) => (
                  <li key={i} className="summary-in flex items-center gap-2 rounded-xl bg-leaf-soft/40 p-3">
                    <s className="text-muted-foreground">{ch.from}</s>
                    <span aria-hidden className="text-primary">→</span>
                    <span className="font-semibold text-primary">{ch.to}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
