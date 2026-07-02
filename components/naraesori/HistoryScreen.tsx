"use client";

// components/naraesori/HistoryScreen.tsx
// 화면 4 — 지난 강의 기록 목록(mock LECTURES). 카드 클릭 시 요약 화면으로.

import { LECTURES } from "@/lib/mock-lectures";

export function HistoryScreen({
  onNew,
  onOpen,
}: {
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <section>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">내 강의 기록</h1>
          <p className="mt-2 text-base text-muted-foreground">
            들었던 강의의 자막과 요약을 다시 볼 수 있어요.
          </p>
        </div>
        <button
          onClick={onNew}
          className="lift shrink-0 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-md hover:opacity-95 sm:px-5"
        >
          + 새 강의 시작
        </button>
      </div>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {LECTURES.map((r, i) => {
          const emph = r.script.filter((c) => c.emphasize).length;
          return (
            <li key={r.id} className="fade-up" style={{ animationDelay: `${i * 70}ms` }}>
              <button
                onClick={() => onOpen(r.id)}
                className="lift group flex w-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-sm hover:border-leaf"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-foreground">{r.course}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.week} · {r.date}
                    </p>
                  </div>
                  <span
                    className={
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold " +
                      (emph > 0 ? "chip-honey" : "bg-secondary text-foreground")
                    }
                    aria-label={`교수님 강조 ${emph}개`}
                  >
                    📌 {emph}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-foreground">{r.title}</p>
                <span className="text-xs font-semibold text-primary opacity-70 group-hover:opacity-100">
                  상세 보기 →
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
