"use client";

// components/naraesori/Header.tsx
// 상단 네비: 홈(로고) / 내 강의 기록 / 글자 크기 조절 / 고대비 토글.
// B안: 헤더는 "밝게"(콘텐츠와 같은 Parchment 계열). 유일한 그린 영역은 사이드바.
// 헤더-콘텐츠 경계는 아주 옅은 보더+그림자로만 구분. 로고는 원래 초록 + 키워서 시원하게.

import type { ReactNode } from "react";
import { Logo } from "./Logo";

export function Header({
  onHistory,
  onHome,
  fontScale,
  setFontScale,
  highContrast,
  setHighContrast,
  showHistory = true,
  rightExtra,
}: {
  onHistory?: () => void;
  onHome: () => void;
  fontScale: number;
  setFontScale: (v: number) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  // showHistory=false + rightExtra 로 대시보드는 "내 강의 기록" 숨기고 사용자 메뉴를 붙인다.
  // (기본값은 기존 /live 동작 유지)
  showHistory?: boolean;
  rightExtra?: ReactNode;
}) {
  const dec = () => setFontScale(Math.max(0.85, Math.round((fontScale - 0.1) * 100) / 100));
  const inc = () => setFontScale(Math.min(1.4, Math.round((fontScale + 0.1) * 100) / 100));

  return (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background/85 shadow-[0_4px_16px_-12px_oklch(0.3_0.04_150_/_0.28)] backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        본문 바로가기
      </a>
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 sm:px-6">
        <button
          onClick={onHome}
          className="group flex min-w-0 items-center text-left"
          aria-label="나래소리 홈으로 이동"
        >
          {/* 밝은 헤더 → 원래 초록 워드마크. 크게(시원하게). */}
          <Logo variant="wordmark" size={56} />
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {showHistory && onHistory && (
            <button
              onClick={onHistory}
              className="lift rounded-full px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-secondary focus-visible:bg-secondary"
            >
              내 강의 기록
            </button>
          )}
          <div
            role="group"
            aria-label="글자 크기 조절"
            className="flex items-center overflow-hidden rounded-full border border-border bg-card"
          >
            <button
              onClick={dec}
              aria-label="글자 작게"
              className="min-h-11 min-w-11 px-3 text-base font-bold text-foreground transition hover:bg-secondary"
            >
              A−
            </button>
            <span className="px-2 text-xs tabular-nums text-muted-foreground">
              {Math.round(fontScale * 100)}%
            </span>
            <button
              onClick={inc}
              aria-label="글자 크게"
              className="min-h-11 min-w-11 px-3 text-base font-bold text-foreground transition hover:bg-secondary"
            >
              A＋
            </button>
          </div>
          <button
            role="switch"
            aria-checked={highContrast}
            onClick={() => setHighContrast(!highContrast)}
            className={
              "lift inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold " +
              (highContrast
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-secondary")
            }
          >
            <span aria-hidden>◐</span>
            <span>고대비</span>
          </button>
          {rightExtra}
        </div>
      </div>
    </header>
  );
}
