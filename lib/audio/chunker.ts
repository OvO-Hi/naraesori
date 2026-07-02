// lib/audio/chunker.ts
// 브라우저에서 실행. 오디오 File을 디코드 → 16kHz 모노로 리샘플 → N초 청크로 분할 →
// 각 청크를 유효한 WAV Blob으로 인코딩해서 반환한다.
export interface AudioChunk {
  index: number;
  blob: Blob; // WAV, 16kHz mono PCM16
  startSec: number;
  endSec: number;
}

const TARGET_RATE = 16000;

// 오버랩 청킹: 청크를 overlapSeconds 만큼 겹치게 잘라, 청크 경계에 걸친 단어가
// 다음(또는 이전) 청크 안에 온전히 들어오게 한다 → whisper 경계 오인식 감소.
//   시작점은 (chunkSeconds - overlapSeconds) 간격으로 전진.
//   예: chunk0=[0,8], chunk1=[6.5,14.5], chunk2=[13,21] … (1.5초씩 겹침)
//   startSec/endSec 은 겹친 실제 구간 기준으로 유지한다.
export async function chunkAudioFile(
  file: File,
  chunkSeconds = 8,
  overlapSeconds = 1.5,
): Promise<AudioChunk[]> {
  const arrayBuffer = await file.arrayBuffer();

  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const decodeCtx = new AudioCtx();
  const decoded = await decodeCtx.decodeAudioData(arrayBuffer);
  await decodeCtx.close();

  const durationSec = decoded.duration;
  const chunks: AudioChunk[] = [];
  let index = 0;

  // 전진 간격(= 청크 길이 - 겹침). 음수/0 방지.
  const step = Math.max(0.1, chunkSeconds - overlapSeconds);

  for (let start = 0; start < durationSec; start += step) {
    const end = Math.min(start + chunkSeconds, durationSec);
    const lengthSec = end - start;
    if (lengthSec < 0.05) break;

    const frameCount = Math.ceil(lengthSec * TARGET_RATE);
    const offline = new OfflineAudioContext(1, frameCount, TARGET_RATE);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0, start, lengthSec);
    const rendered = await offline.startRendering();

    const mono = rendered.getChannelData(0);
    const wav = encodeWav(mono, TARGET_RATE);

    chunks.push({
      index: index++,
      blob: new Blob([wav], { type: "audio/wav" }),
      startSec: start,
      endSec: end,
    });

    // 마지막 청크가 끝에 닿았으면 종료(끝을 넘는 중복 꼬리 청크 방지).
    if (end >= durationSec) break;
  }
  return chunks;
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, s, true);
    offset += 2;
  }
  return buffer;
}
