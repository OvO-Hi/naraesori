"use client";

// components/naraesori/DashboardIntro.tsx
// 대시보드 진입 시 1회 뜨는 안내 모달(shadcn Dialog) — 데모 자료·GitHub 링크.
// localStorage 'naraesori_intro_seen' 로 첫 닫기 이후엔 자동으로 안 뜨게 하고,
// 우측 하단 "데모 안내" 버튼으로 언제든 다시 볼 수 있다(심사위원용).

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const INTRO_KEY = "naraesori_intro_seen";
const DRIVE_URL = "https://drive.google.com/drive/folders/1z3VukcR7MtwgvglJFPus3St1EI7vjChB?usp=sharing";
const GITHUB_URL = "https://github.com/OvO-Hi/naraesori";

export function DashboardIntro() {
  const [open, setOpen] = useState(false);

  // 첫 진입(플래그 없음)에만 자동으로 띄운다.
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(INTRO_KEY) !== "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
    }
  }, []);

  // 닫힘(닫기 버튼/바깥 클릭/Esc) 시 플래그 저장 → 다음부턴 자동으로 안 뜸.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      try {
        localStorage.setItem(INTRO_KEY, "1");
      } catch {
        /* 무시 */
      }
    }
  }

  return (
    <>
      {/* 우측 하단 "안내 다시 보기" (플래그 지우지 않고 재오픈만) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="데모 안내 다시 보기"
        className="lift fixed bottom-4 right-4 z-40 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-md hover:bg-secondary"
      >
        ℹ️ 데모 안내
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>나래소리 데모에 오신 걸 환영합니다 👋</DialogTitle>
            <DialogDescription>
              청각장애 학생을 위한 실시간 강의 자막·요약·발화 데모예요. 아래 자료로 직접 시연해보세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            <a
              href={DRIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lift flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:opacity-95"
            >
              📁 데모용 강의자료·음원 받기
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lift flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              💻 GitHub 저장소
            </a>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="lift rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              닫기
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
