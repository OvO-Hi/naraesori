"use client";

// app/dashboard/lectures/[id]/page.tsx
// 지난 강의 상세 — 전체 자막 + 교정 기록(from→to, 노랑 하이라이트) + 한줄요약/핵심포인트. 정적(mock).
// (LiveScreen/SummaryScreen 의 자막·교정 표시 톤 참고)

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  correctionCount,
  courseById,
  lectureHistoryById,
  type LectureCaption,
} from "@/lib/mock-dashboard";

// corrected 문장에서 교정 단어를 accent(Tuscan Sun) 하이라이트로 렌더.
function renderCaption(c: LectureCaption) {
  if (!c.correction) return c.text;
  const { from, to } = c.correction;
  const parts = c.text.split(to);
  return parts.map((seg, i) => (
    <span key={i}>
      {seg}
      {i < parts.length - 1 && (
        <span
          className="correct-word inline-flex items-center gap-1"
          style={{ border: "1px solid var(--accent)" }}
          title={`원본: ${from} → 교정: ${to}`}
        >
          {to}
          <span className="chip-honey rounded-full px-1.5 py-0 text-[10px] font-bold">
            원본 <s className="opacity-70">{from}</s>
          </span>
        </span>
      )}
    </span>
  ));
}

export default function LectureDetailPage() {
  const params = useParams<{ id: string }>();
  const lecture = lectureHistoryById(params.id);

  if (!lecture) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">강의를 찾을 수 없어요</h1>
        <Link href="/dashboard/lectures" className="text-sm font-semibold text-primary hover:underline">
          ← 지난 강의 목록으로
        </Link>
      </div>
    );
  }

  const c = courseById(lecture.courseId);
  const changes = lecture.captions.filter((x) => x.correction).map((x) => x.correction!);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/lectures" className="text-xs font-semibold text-primary hover:underline">
          ← 지난 강의 목록
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-bold"
            style={{ backgroundColor: `${c.color}22`, color: c.color }}
          >
            {c.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {lecture.date} · {lecture.durationMin}분
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-foreground sm:text-3xl">{lecture.title}</h1>
      </div>

      {/* 요약 */}
      <section className="card-elev-1 rounded-3xl border border-border bg-card p-6">
        <h2 className="eyebrow">한 줄 요약</h2>
        <p className="mt-2 text-lg font-semibold leading-relaxed text-foreground">{lecture.summaryOneLine}</p>
        <h2 className="eyebrow mt-6">핵심 포인트</h2>
        <ol className="mt-3 space-y-2">
          {lecture.summaryPoints.map((p, i) => (
            <li key={i} className="flex gap-3 rounded-2xl border border-border bg-background p-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-foreground">{p}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* 전체 자막 */}
        <section className="card-elev-1 rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold text-foreground">전체 자막</h2>
          <div className="mt-4 space-y-3">
            {lecture.captions.map((cap, i) => (
              <p key={i} className="leading-relaxed text-foreground">
                <span className="mr-2 tabular-nums text-xs text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {renderCaption(cap)}
              </p>
            ))}
          </div>
        </section>

        {/* 교정 기록 */}
        <aside className="space-y-4">
          <div className="card-elev-1 rounded-2xl border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <span aria-hidden>✨</span> 교정 기록 ({correctionCount(lecture)}건)
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {changes.length === 0 && <li className="text-muted-foreground">교정된 전공용어가 없어요.</li>}
              {changes.map((ch, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl bg-leaf-soft/40 p-3">
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
  );
}
