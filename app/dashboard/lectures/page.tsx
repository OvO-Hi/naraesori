"use client";

// app/dashboard/lectures/page.tsx
// 지난 강의 보기 — mock LECTURE_HISTORY 목록. 캘린더에서 ?date=&course= 로 넘어오면 필터.

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  LECTURE_HISTORY,
  correctionCount,
  courseById,
} from "@/lib/mock-dashboard";

// useSearchParams 는 Suspense 경계 안에서 사용(프리렌더 대응).
export default function LecturesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}>
      <LecturesList />
    </Suspense>
  );
}

function LecturesList() {
  const sp = useSearchParams();
  const date = sp.get("date");
  const course = sp.get("course");

  const filtered = LECTURE_HISTORY.filter(
    (l) => (!date || l.date === date) && (!course || l.courseId === course),
  );
  const list = filtered.length > 0 ? filtered : LECTURE_HISTORY;
  const isFiltered = (date || course) && filtered.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">지난 강의 보기</p>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-foreground sm:text-3xl">지난 강의 보기</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isFiltered
            ? `${date ?? ""} ${course ? courseById(course).name : ""} 강의`
            : "나래소리로 들었던 강의의 자막과 요약을 다시 볼 수 있어요."}
        </p>
        {isFiltered && (
          <Link href="/dashboard/lectures" className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">
            ← 전체 강의 보기
          </Link>
        )}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {list.map((l) => {
          const c = courseById(l.courseId);
          return (
            <li key={l.id}>
              <Link
                href={`/dashboard/lectures/${l.id}`}
                className="lift card-elev-1 flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 hover:border-primary/40"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={{ backgroundColor: `${c.color}22`, color: c.color }}
                  >
                    {c.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{l.date}</span>
                </div>
                <p className="text-base font-bold text-foreground">{l.title}</p>
                <p className="text-xs text-muted-foreground">
                  자막 {l.captions.length}줄 · 교정 {correctionCount(l)}건 · {l.durationMin}분
                </p>
                <span className="text-xs font-semibold text-primary">자막·요약 보기 →</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
