"use client";

// app/dashboard/support/page.tsx
// 장애학생센터 문의하기 — QnA 폼(제목/내용) + 기존 문의 내역. 제출은 mock(sonner 토스트).

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { SUPPORT_TICKETS, type SupportTicket } from "@/lib/mock-dashboard";

const STATUS_STYLE: Record<SupportTicket["status"], string> = {
  "답변 완료": "chip-leaf",
  "확인 중": "chip-honey",
  접수됨: "bg-secondary text-secondary-foreground",
};

export default function SupportPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("제목과 내용을 입력해 주세요.");
      return;
    }
    // ⚠️ mock — 실제 전송 없음.
    toast.success("문의를 보냈습니다. 장애학생센터에서 확인 후 답변드릴게요.");
    setTitle("");
    setBody("");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">장애학생센터 문의하기</p>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-foreground sm:text-3xl">장애학생센터 문의하기</h1>
        <p className="mt-1 text-sm text-muted-foreground">필요한 지원이나 불편한 점을 편하게 문의하세요.</p>
      </div>

      {/* 문의 폼 */}
      <form onSubmit={submit} className="card-elev-1 space-y-4 rounded-3xl border border-border bg-card p-6">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-foreground">제목</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 강의실 앞자리 배정 요청" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-foreground">내용</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="문의 내용을 자세히 적어주세요."
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
        <div className="flex justify-end">
          <button
            type="submit"
            className="lift rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-95"
          >
            문의 보내기
          </button>
        </div>
      </form>

      {/* 기존 문의 내역 */}
      <section className="card-elev-1 rounded-3xl border border-border bg-card p-6">
        <h2 className="text-lg font-bold text-foreground">문의 내역</h2>
        <ul className="mt-4 divide-y divide-border">
          {SUPPORT_TICKETS.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{t.title}</p>
                <p className="text-xs text-muted-foreground">{t.date}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[t.status]}`}>
                {t.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
