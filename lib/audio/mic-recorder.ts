// lib/audio/mic-recorder.ts
//
// 마이크 준실시간 캡처. getUserMedia 로 마이크를 잡고, intervalMs(기본 5초)마다
// "그때까지의 오디오 조각"을 독립 디코딩 가능한 Blob 으로 만들어 onChunk 로 흘려보낸다.
//
// 구현: MediaRecorder 를 5초마다 stop→start 반복 → 각 사이클이 헤더 포함 완결형 webm/ogg Blob 을 만든다.
//       (timeslice 방식은 두 번째 청크부터 헤더가 없어 독립 디코딩이 안 되므로 stop/start 방식 사용.)
// 조각은 audio/webm(opus) 등으로 나오는데, whisper API 가 webm 을 지원하므로 그대로 전송한다.

export interface MicRecorderHandle {
  stop: () => void;
}

export interface MicRecorderOptions {
  intervalMs?: number; // 조각 길이(기본 5000ms)
  onChunk: (blob: Blob) => void; // 조각 하나가 준비될 때마다
  onError?: (err: Error) => void; // 녹음 중 오류
}

// MediaRecorder 가 지원하는 mime 중 whisper 가 받는 것으로 선택.
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

// 마이크 시작. 권한 요청은 이 함수 호출 시(사용자 제스처 안에서) 이뤄져야 한다.
export async function startMicRecorder(opts: MicRecorderOptions): Promise<MicRecorderHandle> {
  const intervalMs = opts.intervalMs ?? 5000;

  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("이 브라우저는 마이크 입력을 지원하지 않습니다.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();

  let recorder: MediaRecorder | null = null;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function cleanupStream() {
    stream.getTracks().forEach((t) => t.stop());
  }

  function startCycle() {
    if (stopped) return;
    const parts: Blob[] = [];
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (err) {
      opts.onError?.(err instanceof Error ? err : new Error("MediaRecorder 생성 실패"));
      cleanupStream();
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) parts.push(e.data);
    };
    recorder.onerror = () => opts.onError?.(new Error("녹음 중 오류가 발생했습니다."));
    recorder.onstop = () => {
      if (parts.length > 0) {
        const blob = new Blob(parts, { type: mimeType || "audio/webm" });
        if (blob.size > 0) opts.onChunk(blob);
      }
      if (stopped) {
        cleanupStream();
      } else {
        startCycle(); // 다음 5초 조각
      }
    };

    recorder.start();
    timer = setTimeout(() => {
      if (recorder && recorder.state === "recording") recorder.stop();
    }, intervalMs);
  }

  startCycle();

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
      if (recorder && recorder.state === "recording") {
        recorder.stop(); // onstop 에서 마지막 조각 emit + 트랙 정리
      } else {
        cleanupStream();
      }
    },
  };
}
