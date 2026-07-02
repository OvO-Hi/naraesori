"use client";

// components/naraesori/StartScreen.tsx
// 화면 1 — 강의 선택 + 강의 시작.

import { LECTURES, lectureById } from "@/lib/mock-lectures";
import { Logo } from "./Logo";

export function StartScreen({
  lectureId,
  setLectureId,
  audioFile,
  setAudioFile,
  onStart,
}: {
  lectureId: string;
  setLectureId: (id: string) => void;
  audioFile: File | null;
  setAudioFile: (f: File | null) => void;
  onStart: () => void;
}) {
  const lecture = lectureById(lectureId);
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

        <p className="eyebrow mt-8">강의 자료</p>
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-muted/40 p-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            강의 자료(PDF/PPT)를 올리면 전공 용어를 더 정확히 알아들어요.
          </p>
          <div
            key={lecture.pdf}
            className="fade-up mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium text-foreground"
          >
            <span aria-hidden>📄</span>
            <span>{lecture.pdf}</span>
            <span className="text-muted-foreground">· 1.2 MB</span>
            <span className="chip-leaf ml-1 rounded-full px-2 py-0.5 text-[11px]">분석 완료</span>
          </div>
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
