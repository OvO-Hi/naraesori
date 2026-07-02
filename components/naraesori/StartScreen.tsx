"use client";

// components/naraesori/StartScreen.tsx
// 화면 1 — 강의 선택 + 강의 시작.

import { LECTURES } from "@/lib/mock-lectures";
import { Logo } from "./Logo";

export function StartScreen({
  lectureId,
  setLectureId,
  audioFile,
  setAudioFile,
  pdfFile,
  setPdfFile,
  onStart,
}: {
  lectureId: string;
  setLectureId: (id: string) => void;
  audioFile: File | null;
  setAudioFile: (f: File | null) => void;
  pdfFile: File | null;
  setPdfFile: (f: File | null) => void;
  onStart: () => void;
}) {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center text-center">
      <div className="mt-8 sm:mt-10">
        <Logo variant="wordmark" size={190} />
      </div>
      <p className="eyebrow -mt-8">실시간 강의 자막 · 요약 AI</p>

      <div className="card-elev-1 mt-12 w-full rounded-3xl border border-border bg-card p-7 text-left sm:p-9">
        <label htmlFor="course" className="eyebrow block">
          강의 선택
        </label>
        <div className="relative mt-3">
          <select
            id="course"
            value={lectureId}
            onChange={(e) => setLectureId(e.target.value)}
            className="block w-full appearance-none rounded-2xl border border-border bg-background px-4 py-3.5 pr-10 text-base font-medium text-foreground focus:outline-none"
          >
            {LECTURES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            ▾
          </span>
        </div>

        {/* 데모용 강의자료·음원 (구글 드라이브) */}
        <a
          href="https://drive.google.com/drive/folders/1z3VukcR7MtwgvglJFPus3St1EI7vjChB?usp=sharing"
          target="_blank"
          rel="noopener noreferrer"
          className="lift mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 py-3.5 text-sm font-semibold text-foreground hover:bg-secondary"
        >
          <span aria-hidden>📁</span> 데모용 강의자료·음원 받기
        </a>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          이 폴더의 PDF와 음원으로 실시간/파일 모드를 직접 시연해볼 수 있어요.
        </p>

        <p className="eyebrow mt-8">강의자료 (PDF)</p>
        <div className="mt-3 rounded-2xl border border-border bg-background p-4">
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {pdfFile
              ? `선택됨: ${pdfFile.name}`
              : "PDF를 올리면 강의 중 왼쪽에 슬라이드로 표시돼요. (없어도 시작 가능)"}
          </p>
        </div>

        <p className="eyebrow mt-8">강의 음원 (실시간 모드용)</p>
        <div className="mt-3 rounded-2xl border border-border bg-background p-4">
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {audioFile
              ? `선택됨: ${audioFile.name}`
              : "오디오를 선택하면 실시간 자막이 동작합니다. (없으면 리플레이 모드로 데모 가능)"}
          </p>
        </div>

        <button
          onClick={onStart}
          className="lift mt-10 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-semibold tracking-[-0.01em] text-primary-foreground sm:text-lg"
        >
          <span aria-hidden>▶</span> 강의 시작
        </button>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          오디오를 올리면 실시간 자막·교정이 동작합니다 · 없으면 리플레이 데모로 볼 수 있어요
        </p>
      </div>
    </section>
  );
}
