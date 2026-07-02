"use client";

// app/live/page.tsx
//
// 나래소리 통합 데모 앱. Live Notes(TanStack)의 useState<Screen> 화면 전환 상태 머신을
// 순수 React 로 재현한다. Header + (start/live/summary/history) 4개 화면.
//
// ⚠️ 이번 단계는 mock 데이터로 화면만 돌린다. 실제 API(/api/transcribe·correct·speak) 배선은 다음 단계.
// (기존 /  = STT 프로토타입은 그대로 두고, 통합 앱은 새 경로 /live 에 올린다.)

import { useEffect, useState } from "react";
import { LECTURES, lectureById, type Screen } from "@/lib/mock-lectures";
import type { TranscriptCaption } from "@/lib/pipeline/transcribe-client";
import { Header } from "@/components/naraesori/Header";
import { StartScreen } from "@/components/naraesori/StartScreen";
import { LiveScreen } from "@/components/naraesori/LiveScreen";
import { SummaryScreen } from "@/components/naraesori/SummaryScreen";
import { HistoryScreen } from "@/components/naraesori/HistoryScreen";

export default function LiveApp() {
  const [screen, setScreen] = useState<Screen>("start");
  const [lectureId, setLectureId] = useState<string>(LECTURES[0].id);
  const [audioFile, setAudioFile] = useState<File | null>(null); // 실시간 모드용 음원
  const [liveCaptions, setLiveCaptions] = useState<TranscriptCaption[]>([]); // 강의 종료 시 요약에 넘김
  const [fontScale, setFontScale] = useState(1);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", String(fontScale));
  }, [fontScale]);

  useEffect(() => {
    document.documentElement.classList.toggle("hc", highContrast);
  }, [highContrast]);

  // 언마운트 시 전역 스타일/클래스 원복(다른 페이지에 영향 주지 않게).
  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty("--font-scale");
      document.documentElement.classList.remove("hc");
    };
  }, []);

  const lecture = lectureById(lectureId);

  return (
    <div className="min-h-dvh watercolor-bg">
      <Header
        onHistory={() => setScreen("history")}
        onHome={() => setScreen("start")}
        fontScale={fontScale}
        setFontScale={setFontScale}
        highContrast={highContrast}
        setHighContrast={setHighContrast}
      />
      <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div key={screen + ":" + lectureId} className="screen-in">
          {screen === "start" && (
            <StartScreen
              lectureId={lectureId}
              setLectureId={setLectureId}
              audioFile={audioFile}
              setAudioFile={setAudioFile}
              onStart={() => {
                setLiveCaptions([]); // 새 강의 시작 → 이전 자막 초기화
                setScreen("live");
              }}
            />
          )}
          {screen === "live" && (
            <LiveScreen
              lecture={lecture}
              audioFile={audioFile}
              onEnd={(caps) => {
                setLiveCaptions(caps);
                setScreen("summary");
              }}
            />
          )}
          {screen === "summary" && (
            <SummaryScreen
              lecture={lecture}
              captions={liveCaptions}
              onSave={() => setScreen("history")}
              onNew={() => setScreen("start")}
            />
          )}
          {screen === "history" && (
            <HistoryScreen
              onNew={() => setScreen("start")}
              onOpen={(id) => {
                setLectureId(id);
                setLiveCaptions([]); // 과거 강의(mock) 요약으로 진입
                setScreen("summary");
              }}
            />
          )}
        </div>
      </main>
      <footer className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 text-center text-sm text-muted-foreground sm:px-6">
        © 2026 나래소리 · 데모 화면입니다.
      </footer>
    </div>
  );
}
