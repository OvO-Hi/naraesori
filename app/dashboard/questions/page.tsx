"use client";

// app/dashboard/questions/page.tsx
// 질문 내역 보기 — SpeakBar 로 했던 질문 mock 기록. 과목별 그룹핑.

import { COURSES, QUESTION_HISTORY } from "@/lib/mock-dashboard";

export default function QuestionsPage() {
  // 과목별 그룹핑(질문이 있는 과목만)
  const groups = COURSES.map((c) => ({
    course: c,
    items: QUESTION_HISTORY.filter((q) => q.courseId === c.id),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">질문 내역 보기</p>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-foreground sm:text-3xl">질문 내역 보기</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          강의 중 음성으로 보낸 질문들을 모아 볼 수 있어요. (총 {QUESTION_HISTORY.length}개)
        </p>
      </div>

      <div className="space-y-5">
        {groups.map(({ course, items }) => (
          <section key={course.id} className="card-elev-1 rounded-3xl border border-border bg-card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                style={{ backgroundColor: `${course.color}22`, color: course.color }}
              >
                {course.name}
              </span>
              <span className="text-xs font-medium text-muted-foreground">{items.length}개</span>
            </h2>
            <ul className="mt-3 space-y-2">
              {items.map((q) => (
                <li key={q.id} className="flex items-start gap-3 rounded-2xl border border-border bg-background p-3">
                  <span aria-hidden className="mt-0.5 text-base">💬</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-foreground">{q.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{q.date}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
