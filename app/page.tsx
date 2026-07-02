"use client";

import { useRef, useState } from "react";
import { chunkAudioFile } from "@/lib/audio/chunker";
// 청킹 + 전사(간격/백오프) 로직은 공용 모듈로 추출됨. LiveScreen 과 공유.
import { runTranscription } from "@/lib/pipeline/transcribe-client";

interface SubtitleLine {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
  latencyMs: number;
  failed?: boolean;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [lines, setLines] = useState<SubtitleLine[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null); // "전사 대기 중…" 등
  const [error, setError] = useState<string | null>(null);
  const [latencies, setLatencies] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const audioUrlRef = useRef<string | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setLines([]);
    setDone(0);
    setTotal(0);
    setError(null);
    setLatencies([]);
    setFinished(false);

    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    if (f) {
      const url = URL.createObjectURL(f);
      audioUrlRef.current = url;
      setAudioUrl(url);
    } else {
      audioUrlRef.current = null;
      setAudioUrl(null);
    }
  }

  async function start() {
    if (!file || running) return;
    setRunning(true);
    setStatus(null);
    setError(null);
    setLines([]);
    setDone(0);
    setLatencies([]);
    setFinished(false);

    try {
      const chunks = await chunkAudioFile(file, 8);
      setTotal(chunks.length);

      const collected: number[] = [];

      // 청킹 후의 순차 전사 + 간격/백오프는 공용 모듈이 담당. 결과만 받아 자막에 반영.
      await runTranscription(chunks, {
        onStatus: setStatus,
        onChunk: (o) => {
          if (o.ok) {
            collected.push(o.latencyMs);
            setLines((prev) => [
              ...prev,
              {
                index: o.chunk.index,
                startSec: o.chunk.startSec,
                endSec: o.chunk.endSec,
                text: o.text,
                latencyMs: o.latencyMs,
              },
            ]);
          } else {
            setLines((prev) => [
              ...prev,
              {
                index: o.chunk.index,
                startSec: o.chunk.startSec,
                endSec: o.chunk.endSec,
                text: `[전사 실패] ${o.message}`,
                latencyMs: 0,
                failed: true,
              },
            ]);
          }
          setDone((d) => d + 1);
        },
      });

      setStatus(null);
      setLatencies(collected);
      setFinished(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리 중 오류가 발생했습니다.");
    } finally {
      setStatus(null);
      setRunning(false);
    }
  }

  const avgLatency =
    latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;

  // P95 = 정렬 후 ceil(0.95*N)-1 인덱스
  const p95Latency = (() => {
    if (latencies.length === 0) return 0;
    const sorted = [...latencies].sort((a, b) => a - b);
    const idx = Math.ceil(0.95 * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  })();

  return (
    <main className="mx-auto max-w-2xl p-6 font-sans">
      <h1 className="text-2xl font-bold">나래소리 — STT 자막 프로토타입 (v0)</h1>
      <p className="mt-1 text-sm text-gray-500">
        강의 음성 파일을 8초 청크로 잘라 순차 전사 → 자막 누적 표시
      </p>

      <section className="mt-6 space-y-3">
        <input
          type="file"
          accept="audio/*"
          onChange={onFileChange}
          disabled={running}
          className="block text-sm"
        />
        {audioUrl && <audio controls src={audioUrl} className="w-full" />}
        <button
          onClick={start}
          disabled={!file || running}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {running ? "전사 중…" : "자막 시작"}
        </button>
      </section>

      {(running || total > 0) && (
        <p className="mt-4 text-sm text-gray-600">
          진행률: {done} / {total}
        </p>
      )}

      {status && (
        <p className="mt-2 text-sm text-amber-600">⏳ {status}</p>
      )}

      {error && (
        <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <section className="mt-4 space-y-2">
        {lines.map((line) => (
          <div
            key={line.index}
            className={`rounded border p-3 text-sm ${
              line.failed ? "border-red-200 bg-red-50" : "border-gray-200"
            }`}
          >
            <div className="text-xs text-gray-400">
              [{fmtTime(line.startSec)}–{fmtTime(line.endSec)}] · {line.latencyMs}ms
            </div>
            <div
              className={`mt-1 whitespace-pre-wrap ${line.failed ? "text-red-600" : ""}`}
            >
              {line.text || <span className="text-gray-300">(빈 구간)</span>}
            </div>
          </div>
        ))}
      </section>

      {finished && latencies.length > 0 && (
        <footer className="mt-6 border-t border-gray-200 pt-4 text-sm text-gray-700">
          <p>완료 — 청크 {latencies.length}개</p>
          <p>평균 latency: {avgLatency}ms</p>
          <p>P95 latency: {p95Latency}ms</p>
        </footer>
      )}
    </main>
  );
}
