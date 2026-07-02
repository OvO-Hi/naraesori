"use client";

// components/naraesori/SummaryScreen.tsx
// 화면 3 — 강의 종료 후 요약자료.
//   · 라이브 종료(captions 있음): /api/summarize 로 요약 생성(한 줄 요약/핵심/전공용어/정리본).
//     원본 자막 vs 정리본(중복 제거) 토글로 비교 가능.
//   · 히스토리 진입(captions 없음): 기존 mock 요약 표시.
//
// ⚠️ 실시간 화면의 자막 표시는 건드리지 않는다 — 중복 정리는 여기(정리본)에서만.

import { useEffect, useState } from "react";
import type { Lecture } from "@/lib/mock-lectures";
import { dedupOverlap, type TranscriptCaption } from "@/lib/pipeline/transcribe-client";

interface SummaryResult {
  oneLineSummary: string;
  keyPoints: string[];
  terms: { term: string; note: string }[];
  cleanedTranscript: string;
}

export function SummaryScreen({
  lecture,
  captions,
  onSave,
  onNew,
}: {
  lecture: Lecture;
  captions: TranscriptCaption[];
  onSave: () => void;
  onNew: () => void;
}) {
  const hasLive = captions.length > 0;
  const [toast, setToast] = useState(false);

  const save = () => {
    setToast(true);
    setTimeout(() => {
      setToast(false);
      onSave();
    }, 1100);
  };

  return (
    <section className="mx-auto max-w-3xl">
      {hasLive ? (
        <LiveSummaryContent lecture={lecture} captions={captions} />
      ) : (
        <MockSummaryContent lecture={lecture} />
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          onClick={save}
          className="lift rounded-2xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-md hover:opacity-95"
        >
          내 강의 기록에 저장
        </button>
        <button
          onClick={onNew}
          className="lift rounded-2xl border border-border bg-card px-6 py-4 text-base font-bold text-foreground hover:bg-secondary"
        >
          새 강의 시작
        </button>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fade-up fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg"
        >
          ✓ 저장되었습니다
        </div>
      )}
    </section>
  );
}

/* ── 라이브 요약(실제 API) ─────────────────────────────────────────────────── */
function LiveSummaryContent({ lecture, captions }: { lecture: Lecture; captions: TranscriptCaption[] }) {
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<"clean" | "original">("clean");

  // 원본 자막(raw original 이어붙임 — 오버랩 중복 그대로 보존)
  const originalTranscript = captions
    .map((c) => (c.original || c.corrected || "").trim())
    .filter(Boolean)
    .join(" ");

  // 교정된 전공용어(노랑 강조용)
  const correctedTerms = new Set<string>();
  captions.forEach((c) => c.changes.forEach((ch) => ch.to && correctedTerms.add(ch.to)));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/summarize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ captions, courseName: lecture.course }),
        });
        const data = (await res.json()) as Partial<SummaryResult> | null;
        if (!alive) return;
        if (res.ok && data && typeof data.cleanedTranscript === "string") {
          setSummary({
            oneLineSummary: data.oneLineSummary ?? "",
            keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints : [],
            terms: Array.isArray(data.terms) ? data.terms : [],
            cleanedTranscript: data.cleanedTranscript,
          });
        } else {
          throw new Error("bad response");
        }
      } catch {
        if (!alive) return;
        setFailed(true);
        // 클라이언트 폴백: 최소한 정리본(교정본 dedup) + 교정 용어는 보여준다.
        let cleaned = "";
        for (const c of captions) {
          const t = (c.corrected || c.original || "").trim();
          if (t) cleaned = cleaned ? `${cleaned} ${dedupOverlap(cleaned, t)}` : t;
        }
        setSummary({
          oneLineSummary: "",
          keyPoints: [],
          terms: [...correctedTerms].map((term) => ({ term, note: "" })),
          cleanedTranscript: cleaned,
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <span aria-hidden className="recording-dot" />
        <p className="text-lg font-semibold text-foreground">요약 생성 중…</p>
        <p className="text-sm text-muted-foreground">쌓인 자막 {captions.length}줄을 정리하고 있어요.</p>
      </div>
    );
  }

  const s = summary!;
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-muted-foreground">{lecture.date} · {lecture.course}</p>
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">강의가 끝났어요. 오늘 수업을 정리했습니다.</h1>
        <p className="mt-2 text-base text-muted-foreground">
          자막 {captions.length}줄 · 핵심 {s.keyPoints.length}개 · 전공용어 {s.terms.length}개
          {failed && " · (요약 생성 실패 — 정리본만 표시)"}
        </p>
      </div>

      <div className="card-elev-1 mt-8 rounded-3xl border border-border bg-card p-7 sm:p-9">
        {s.oneLineSummary && (
          <>
            <h2 className="eyebrow">한 줄 요약</h2>
            <p className="mt-3 text-xl font-semibold leading-relaxed tracking-[-0.01em] text-foreground sm:text-2xl">
              {s.oneLineSummary}
            </p>
          </>
        )}

        {s.keyPoints.length > 0 && (
          <>
            <h2 className="eyebrow mt-10">핵심 포인트</h2>
            <ol className="mt-4 space-y-3">
              {s.keyPoints.map((p, i) => (
                <li key={i} className="fade-up flex gap-3 rounded-2xl border border-border bg-background p-4" style={{ animationDelay: `${i * 80}ms` }}>
                  <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <p className="text-base leading-relaxed text-foreground">{p}</p>
                </li>
              ))}
            </ol>
          </>
        )}

        {s.terms.length > 0 && (
          <>
            <h2 className="eyebrow mt-10">전공 용어</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {s.terms.map((t, i) => {
                const isCorrected = correctedTerms.has(t.term);
                return (
                  <li
                    key={i}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    title={t.note}
                  >
                    <span
                      className={
                        isCorrected
                          ? "chip-honey rounded-md px-1.5 py-0.5 font-bold"
                          : "font-bold text-primary"
                      }
                    >
                      {t.term}
                    </span>
                    {t.note && <span className="ml-1 text-muted-foreground">— {t.note}</span>}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {/* 원본 자막 vs 정리본 토글 */}
        <div className="mt-10">
          <div role="tablist" aria-label="자막 보기" className="inline-flex items-center overflow-hidden rounded-full border border-border bg-card text-sm font-semibold">
            {(["clean", "original"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={"px-4 py-1.5 transition-colors " + (view === v ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary")}
              >
                {v === "clean" ? "정리본" : "원본 자막"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {view === "clean" ? "중복을 정리하고 문어체로 다듬은 정리본이에요." : "실시간으로 받아쓴 원본 자막이에요(중복 포함)."}
          </p>
          <div className="fade-up mt-3 whitespace-pre-wrap rounded-2xl border border-border bg-background p-4 text-sm leading-relaxed text-foreground">
            {view === "clean"
              ? s.cleanedTranscript || "(정리본 없음)"
              : originalTranscript || "(원본 자막 없음)"}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── 히스토리 진입용 mock 요약(기존 유지) ──────────────────────────────────── */
function MockSummaryContent({ lecture }: { lecture: Lecture }) {
  const [open, setOpen] = useState(false);
  const emphCount = lecture.script.filter((c) => c.emphasize).length;

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-muted-foreground">{lecture.date} · {lecture.course}</p>
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">강의가 끝났어요. 오늘 수업을 정리했습니다.</h1>
        <p className="mt-2 text-base text-muted-foreground">
          {lecture.week}: {lecture.title} · 자막 {lecture.script.length}줄 · 핵심 요약 {lecture.summaryPoints.length}개 · 📌 {emphCount}
        </p>
      </div>

      <div className="card-elev-1 mt-10 rounded-3xl border border-border bg-card p-7 sm:p-9">
        <h2 className="eyebrow">한 줄 요약</h2>
        <p className="mt-3 text-xl font-semibold leading-relaxed tracking-[-0.01em] text-foreground sm:text-2xl">
          {lecture.summaryOneLine}
        </p>

        <h2 className="eyebrow mt-10">핵심 포인트</h2>
        <ol className="mt-4 space-y-3">
          {lecture.summaryPoints.map((s, i) => (
            <li key={i} className="fade-up flex gap-3 rounded-2xl border border-border bg-background p-4" style={{ animationDelay: `${i * 80}ms` }}>
              <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <p className="text-base leading-relaxed text-foreground">{s}</p>
            </li>
          ))}
        </ol>

        {lecture.emphasisPoints.length > 0 && (
          <div className="mt-10 rounded-2xl border border-accent/60 bg-honey-soft/60 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-primary">
              <span aria-hidden>📌</span> 교수님이 강조한 부분
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-primary">
              {lecture.emphasisPoints.map((p, i) => (
                <li key={i}>· {p}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="full-transcript"
            className="lift inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            <span aria-hidden>{open ? "▾" : "▸"}</span>
            전체 자막 보기
          </button>
          {open && (
            <ol id="full-transcript" className="fade-up mt-3 space-y-2 rounded-2xl border border-border bg-background p-4 text-sm text-foreground">
              {lecture.script.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <span className="shrink-0 tabular-nums text-muted-foreground">{String(c.id).padStart(2, "0")}</span>
                  <span>{c.text}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}
