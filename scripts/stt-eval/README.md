# STT 3종 비교 평가 스크립트

같은 음성 파일을 **OpenAI(whisper-1, gpt-4o-transcribe) / Naver Clova CSR / Google STT v2** 에
모두 보내서 받아쓴 결과를 나란히 비교하고, 정답(reference)이 있으면 **WER**을 계산한다.

발표 근거용 **일회성 평가 도구**다. Next.js 앱 코드(`app/`, `lib/`)는 전혀 건드리지 않고
`scripts/stt-eval/` 안에서만 동작한다.

> 공정 비교를 위해 세 벤더 모두 **동일한 wav**(16kHz / 모노 / 16bit PCM, `lib/audio/chunker.ts` 와 같은 포맷)
> 를 입력으로 쓴다. 변환은 ffmpeg가 담당한다.

## 사전 준비

### 1. ffmpeg 설치 (필수)

Node 스크립트에서 오디오를 16kHz/모노/16bit WAV 로 변환하는 데 ffmpeg(및 ffprobe)를 쓴다.

```bash
# macOS
brew install ffmpeg
```

설치가 안 되어 있으면 스크립트가 안내 메시지를 출력하고 종료한다.

### 2. 의존성

이미 설치되어 있다. (참고용)

```bash
npm install -D tsx
npm install @google-cloud/speech dotenv
# openai 는 프로젝트에 이미 포함
```

### 3. 환경변수 (`.env.local`, 프로젝트 루트)

키는 코드에 하드코딩하지 않고 `.env.local` 에서 읽는다.

```
OPENAI_API_KEY=...
CLOVA_CLIENT_ID=...
CLOVA_CLIENT_SECRET=...
GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json   # 서비스 계정 JSON 키 절대경로
GOOGLE_CLOUD_PROJECT=naraesori
```

## 입력 / 정답 파일 두는 법

```
scripts/stt-eval/
  input/        # 비교할 음원 (mp3 / m4a / wav / flac / ogg ... ) 1개 이상
  reference/    # (선택) 정답 텍스트. 음원과 같은 이름의 .txt
  output/       # 결과 JSON 저장 위치 (자동 생성)
```

예시:

```
input/sample1.mp3
reference/sample1.txt   <- 있으면 WER 계산, 없으면 WER 자리에 "-"
```

> **Clova 주의:** CSR 은 짧은 발화용이라 60초가 넘는 음원은 **앞 60초만** 잘라서 보낸다(콘솔에 명시).
> 가능하면 1~2분 내외의 짧은 클립으로 준비할 것.

## 실행

```bash
npm run stt:eval
```

## 출력

- **콘솔**: 음원별로 벤더별 transcript / latency / WER, 마지막에 전체 평균 요약표.
- **파일**: `scripts/stt-eval/output/<음원이름>.result.json` (벤더별 transcript / latency / wer / error 포함).

콘솔 예시:

```
=== sample1.mp3 (길이 73.2s) ===
  [OpenAI whisper-1        ] latency  1240ms  WER 0.182
    transcript: ...
  [OpenAI gpt-4o-transcribe] latency  1510ms  WER 0.121
    transcript: ...
  [Clova CSR               ] latency   980ms  WER 0.205
    transcript: ...
  [Google STT v2           ] latency  1620ms  WER 0.158
    transcript: ...
```

## WER / 정규화

- `WER = (S + D + I) / N` — 단어(공백 토큰) 단위 편집거리(Levenshtein) 기반. 외부 패키지 없이 직접 구현.
- 정규화(최소): **소문자화 + 기본 구두점 제거 + 공백 단일화** 후 공백 토큰화.
  WER 은 정규화에 민감하므로 실행 시 어떤 정규화를 했는지 콘솔에 1줄 명시한다.

## 동작 메모

- 한 벤더가 실패해도 전체가 죽지 않는다. 벤더별 `try/catch` 로 격리하고, 실패는 결과의 `error` 로 기록한다.
- Clova: `401/403` → 키 문제, `429` → NAVER Cloud 콘솔에서 CSR 서비스 활성화 여부 확인(에러 메시지에 힌트 출력).
- Google: V2 클라이언트(`gspeech.v2.SpeechClient`), recognizer `projects/$PROJECT/locations/global/recognizers/_`,
  `model: "long"`(강의용 — 짧은 클립이면 `"short"` 로 바꿔도 됨, `run.ts` 주석 참고).
