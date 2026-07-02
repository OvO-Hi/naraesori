"use client";

// app/dashboard/page.tsx
// 보드(홈) — 시간표(단일 소스) / 다가오는 수업·과제 / 캘린더 / 나래벗 자료. 데이터는 mock.
// UPCOMING 은 TIMETABLE 에서 파생. 오늘(금) 수업 = 강의 시작하기, 그 외 = 예정.

import { Fragment, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ASSIGNMENTS,
  BUDDY_FILES,
  CALENDAR_USAGE,
  TIMETABLE,
  TODAY,
  TODAY_DAY,
  courseById,
} from "@/lib/mock-dashboard";

const DAYS = ["월", "화", "수", "목", "금"] as const;
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17]; // 9~18시

export default function DashboardHome() {
  // 과제 체크 상태(로컬, mock — 저장 안 함)
  const [doneMap, setDoneMap] = useState<Record<number, boolean>>({});

  // 다가오는 수업 = 오늘(금) 수업 + 월요일 수업(예정). TIMETABLE 파생.
  const upcoming = [
    ...TIMETABLE.filter((s) => s.day === TODAY_DAY),
    ...TIMETABLE.filter((s) => s.day === "월"),
  ].map((s) => ({ ...s, isToday: s.day === TODAY_DAY }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">오늘의 시간표와 다가오는 수업을 확인하세요.</p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* 왼쪽 열: 시간표 + 나래벗 자료 */}
        <div className="space-y-4">
          <section className="card-elev-1 rounded-3xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-lg font-bold text-foreground">시간표</h2>
            <Timetable />
          </section>

          {/* 나래벗이 올린 자료 */}
          <section className="card-elev-1 rounded-3xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-lg font-bold text-foreground">나래벗이 올린 자료</h2>
            <ul className="mt-4 space-y-2">
              {BUDDY_FILES.map((f, i) => {
                const c = courseById(f.courseId);
                return (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span aria-hidden className="text-lg">📄</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{f.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          <span style={{ color: c.color }}>●</span> {c.name} · {f.date}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => toast(`${f.name} 다운로드를 시작했어요. (데모)`)}
                      aria-label={`${f.name} 다운로드`}
                      className="lift shrink-0 rounded-full border border-border p-2 text-foreground hover:bg-secondary"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* 오른쪽 열: 다가오는 수업·과제 + 캘린더 */}
        <div className="space-y-4">
          <section className="card-elev-1 rounded-3xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-lg font-bold text-foreground">다가오는 수업 · 과제</h2>

            {/* 다가오는 수업 */}
            <ul className="mt-4 space-y-2.5">
              {upcoming.map((u, i) => {
                const c = courseById(u.courseId);
                return (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {c.room} · {u.isToday ? `오늘 ${u.start}:00` : `${u.day}요일 ${u.start}:00`}
                      </p>
                    </div>
                    {u.isToday ? (
                      <Link
                        href={`/live?course=${u.courseId}`}
                        className="lift shrink-0 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-95"
                      >
                        강의 시작하기
                      </Link>
                    ) : (
                      <span className="shrink-0 rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
                        예정
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* 과제 */}
            <h3 className="eyebrow mt-6">과제</h3>
            <ul className="mt-3 space-y-2">
              {ASSIGNMENTS.map((a, i) => {
                const c = courseById(a.courseId);
                const done = !!doneMap[i];
                return (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
                  >
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => setDoneMap((m) => ({ ...m, [i]: !m[i] }))}
                      className="h-4 w-4 shrink-0 accent-primary"
                      aria-label={`${a.title} 완료 표시`}
                    />
                    <div className={cn("min-w-0 flex-1 transition-opacity", done && "opacity-50")}>
                      <p className={cn("truncate text-sm font-medium text-foreground", done && "line-through")}>
                        {a.title}
                      </p>
                      <p className={cn("truncate text-xs text-muted-foreground", done && "line-through")}>
                        <span aria-hidden style={{ color: c.color }}>
                          ●
                        </span>{" "}
                        {c.name} · 마감 {a.due}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 캘린더 */}
          <section className="card-elev-1 rounded-3xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-lg font-bold text-foreground">캘린더</h2>
            <Calendar />
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── 시간표 그리드 ─────────────────────────────────────────────────────────── */
function Timetable() {
  return (
    <div className="mt-4 overflow-x-auto">
      <div
        className="grid min-w-[520px] gap-0"
        style={{
          gridTemplateColumns: "44px repeat(5, minmax(0, 1fr))",
          gridTemplateRows: `auto repeat(${HOURS.length}, minmax(46px, 1fr))`,
        }}
      >
        {/* 헤더: 좌상단 빈칸 + 요일 */}
        <div style={{ gridColumn: 1, gridRow: 1 }} />
        {DAYS.map((d, di) => (
          <div
            key={d}
            style={{ gridColumn: di + 2, gridRow: 1 }}
            className={cn(
              "pb-2 text-center text-sm font-semibold",
              d === TODAY_DAY ? "text-primary" : "text-foreground",
            )}
          >
            {d}
            {d === TODAY_DAY && <span className="ml-1 text-[10px] text-accent-foreground">·오늘</span>}
          </div>
        ))}

        {/* 배경 셀 + 시간 라벨 */}
        {HOURS.map((h, hi) => (
          <Fragment key={h}>
            <div
              style={{ gridColumn: 1, gridRow: hi + 2 }}
              className="pr-2 pt-1 text-right text-[11px] tabular-nums text-muted-foreground"
            >
              {h}:00
            </div>
            {DAYS.map((d, di) => (
              <div
                key={d}
                style={{ gridColumn: di + 2, gridRow: hi + 2 }}
                className={cn(
                  "border-t border-border/60",
                  di === 0 && "border-l border-border/60",
                  "border-r border-border/60",
                  hi === HOURS.length - 1 && "border-b border-border/60",
                  d === TODAY_DAY && "bg-secondary/25",
                )}
              />
            ))}
          </Fragment>
        ))}

        {/* 수업 슬롯(배경 셀 위에 겹쳐 배치) */}
        {TIMETABLE.map((slot, idx) => {
          const c = courseById(slot.courseId);
          const di = DAYS.indexOf(slot.day);
          const startRow = HOURS.indexOf(slot.start) + 2;
          const span = slot.end - slot.start;
          if (di < 0 || startRow < 2) return null;
          return (
            <div
              key={idx}
              style={{
                gridColumn: di + 2,
                gridRow: `${startRow} / span ${span}`,
                backgroundColor: `${c.color}22`,
                borderColor: `${c.color}66`,
                color: c.color,
              }}
              className="m-0.5 overflow-hidden rounded-lg border p-1.5 text-[11px] font-semibold leading-tight"
            >
              <div className="truncate">{c.name}</div>
              <div className="mt-0.5 truncate text-[10px] opacity-80">{c.room}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 월간 캘린더 ───────────────────────────────────────────────────────────── */
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function Calendar() {
  const { year, month, day: todayDay } = TODAY;
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const usageByDay: Record<number, string[]> = {};
  for (const u of CALENDAR_USAGE) {
    const [y, m, d] = u.date.split("-").map(Number);
    if (y === year && m === month) {
      (usageByDay[d] ??= []).push(u.courseId);
    }
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="mt-4">
      <p className="mb-2 text-sm font-semibold text-foreground">
        {year}년 {month}월
      </p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={cn(
              "pb-1 text-[11px] font-semibold",
              i === 0 ? "text-destructive/80" : "text-muted-foreground",
            )}
          >
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const uses = usageByDay[day] ?? [];
          const isToday = day === todayDay;
          const dd = String(day).padStart(2, "0");
          return (
            <div
              key={day}
              className={cn(
                "flex min-h-14 flex-col rounded-lg border p-1 text-left",
                isToday ? "border-primary bg-secondary/40" : "border-border/50",
              )}
            >
              <span
                className={cn(
                  "text-right text-[11px] tabular-nums",
                  isToday ? "font-bold text-primary" : "text-muted-foreground",
                )}
              >
                {day}
              </span>
              <div className="mt-auto flex flex-wrap gap-0.5">
                {uses.map((cid, ui) => {
                  const c = courseById(cid);
                  return (
                    <Link
                      key={ui}
                      href={`/dashboard/lectures?date=${year}-${String(month).padStart(2, "0")}-${dd}&course=${cid}`}
                      title={`${c.name} 강의 내역 보기`}
                      className="rounded px-1 text-[9px] font-bold leading-4"
                      style={{ backgroundColor: `${c.color}26`, color: c.color }}
                    >
                      {c.name.slice(0, 2)}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        색 라벨 = 나래소리로 들은 강의 · 클릭하면 강의 내역으로 이동
      </p>
    </div>
  );
}
