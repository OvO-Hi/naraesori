"use client";

// app/dashboard/buddy/page.tsx
// 나래벗 프로필 보기 — 매칭된 나래벗 카드 + 나래벗이 올린 자료 목록. 전부 mock.

import { Download, Mail } from "lucide-react";
import { toast } from "sonner";
import { BUDDY, BUDDY_FILES, courseById } from "@/lib/mock-dashboard";

export default function BuddyPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">나래벗 프로필 보기</p>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-foreground sm:text-3xl">나래벗 프로필 보기</h1>
        <p className="mt-1 text-sm text-muted-foreground">매칭된 나래벗과 공유 자료를 확인하세요.</p>
      </div>

      {/* 나래벗 카드 */}
      <section className="card-elev-1 rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl font-bold text-secondary-foreground"
          >
            {BUDDY.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="text-lg font-bold text-foreground">{BUDDY.name}</p>
            <p className="text-sm text-muted-foreground">{BUDDY.department}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{BUDDY.contact}</p>
          </div>
        </div>
        <p className="mt-4 rounded-2xl bg-leaf-soft/40 p-4 text-sm leading-relaxed text-foreground">
          “{BUDDY.message}”
        </p>
        <button
          onClick={() => toast.success("나래벗에게 연락 요청을 보냈어요.")}
          className="lift mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-95"
        >
          <Mail className="h-4 w-4" />
          연락하기
        </button>
      </section>

      {/* 나래벗이 올린 자료 */}
      <section className="card-elev-1 rounded-3xl border border-border bg-card p-6">
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
  );
}
