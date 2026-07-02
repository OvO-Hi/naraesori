// lib/mock-lectures.ts
//
// 나래소리 통합 데모(/live)용 mock 데이터 + 타입.
// ⚠️ 아직 실제 API(/api/transcribe, /api/correct, /api/speak) 배선 전이라, 화면은 이 mock 을
//    setTimeout 으로 재생한다. 다음 단계에서 실제 STT/교정/발화로 교체한다.

export type Screen = "start" | "live" | "summary" | "history";

export type Caption = {
  id: number;
  text: string;
  corrected?: { from: string; to: string };
  emphasize?: boolean;
};

export type Lecture = {
  id: string;
  course: string;
  week: string;
  title: string;
  label: string; // dropdown label
  date: string;
  pdf: string;
  slides: { n: number; title: string }[];
  script: Caption[];
  slideForCaption: Record<number, number>;
  summaryAt: Record<number, string>;
  summaryOneLine: string;
  summaryPoints: string[];
  emphasisPoints: string[];
};

// 데모 도메인: 정보통신공학 (과목명은 lib/mock-dashboard.ts 의 ict 과목명과 일치)
export const LECTURES: Lecture[] = [
  {
    id: "ict-w3",
    course: "정보통신공학",
    week: "3주차",
    title: "전송 계층과 흐름 제어",
    label: "정보통신공학 — 3주차: 전송 계층과 흐름 제어",
    date: "2026.07.03",
    pdf: "3주차_전송계층.pdf",
    slides: [
      { n: 1, title: "전송 계층 개요" },
      { n: 2, title: "흐름 제어" },
      { n: 3, title: "오류 제어와 ARQ" },
      { n: 4, title: "Go-Back-N ARQ" },
      { n: 5, title: "슬라이딩 윈도우" },
    ],
    script: [
      {
        id: 1,
        text: "이번 시간에는 전송 계층의 흐름 제어를 다룹니다.",
        corrected: { from: "흐름 재어", to: "흐름 제어" },
      },
      {
        id: 2,
        text: "데이터는 소스 호스트에서 목적지 호스트까지 전달됩니다.",
        corrected: { from: "센더 소울스 호스트", to: "소스 호스트" },
      },
      { id: 3, text: "오류가 나면 재전송으로 복구하는데, 여기서 ARQ가 등장합니다." },
      {
        id: 4,
        text: "특히 Go-Back-N ARQ, 이거 시험에 꼭 나옵니다.",
        corrected: { from: "고백에는 ARQ", to: "Go-Back-N ARQ" },
        emphasize: true,
      },
      { id: 5, text: "슬라이딩 윈도우로 여러 프레임을 연속으로 보냅니다." },
    ],
    slideForCaption: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
    summaryAt: {
      2: "소스 호스트 → 목적지 호스트로 데이터 전달",
      3: "오류 복구를 위한 ARQ",
      5: "슬라이딩 윈도우로 연속 전송",
    },
    summaryOneLine:
      "전송 계층은 소스에서 목적지 호스트까지 데이터를 전달하며, ARQ와 슬라이딩 윈도우로 흐름·오류를 제어한다.",
    summaryPoints: [
      "전송 계층과 흐름 제어의 목적",
      "소스 ↔ 목적지 호스트 전달",
      "Go-Back-N ARQ (시험 출제 언급)",
    ],
    emphasisPoints: ["Go-Back-N ARQ는 반드시 이해할 것 — “이거 시험에 꼭 나옵니다”"],
  },
  {
    id: "ict-w5",
    course: "정보통신공학",
    week: "5주차",
    title: "오류 제어와 ARQ",
    label: "정보통신공학 — 5주차: 오류 제어(ARQ)",
    date: "2026.06.26",
    pdf: "5주차_오류제어.pdf",
    slides: [
      { n: 1, title: "오류 검출" },
      { n: 2, title: "패리티·CRC" },
      { n: 3, title: "정지-대기 ARQ" },
      { n: 4, title: "Go-Back-N ARQ" },
      { n: 5, title: "선택적 재전송" },
    ],
    script: [
      {
        id: 1,
        text: "오늘은 오류 제어와 ARQ 방식을 배웁니다.",
        corrected: { from: "오류 재어", to: "오류 제어" },
      },
      { id: 2, text: "가장 단순한 방식은 정지-대기 ARQ입니다." },
      {
        id: 3,
        text: "효율을 높이려면 Go-Back-N ARQ를 씁니다.",
        corrected: { from: "고백앤 ARQ", to: "Go-Back-N ARQ" },
      },
      { id: 4, text: "재전송 범위가 어디까지인지, 시험 단골입니다.", emphasize: true },
      { id: 5, text: "선택적 재전송은 오류가 난 프레임만 다시 보냅니다." },
    ],
    slideForCaption: { 1: 1, 2: 2, 3: 4, 4: 4, 5: 5 },
    summaryAt: {
      2: "정지-대기 ARQ가 가장 단순",
      3: "효율을 위한 Go-Back-N ARQ",
      5: "선택적 재전송은 오류 프레임만 재전송",
    },
    summaryOneLine: "ARQ는 오류를 재전송으로 복구하며, 정지-대기·Go-Back-N·선택적 재전송으로 나뉜다.",
    summaryPoints: [
      "오류 검출과 ARQ의 개념",
      "정지-대기 vs Go-Back-N ARQ",
      "선택적 재전송 (시험 출제 언급)",
    ],
    emphasisPoints: ["Go-Back-N의 재전송 범위는 시험 단골 — “재전송 범위가 어디까지인지”"],
  },
  {
    id: "ict-w4",
    course: "정보통신공학",
    week: "4주차",
    title: "네트워크 계층과 IP",
    label: "정보통신공학 — 4주차: 네트워크 계층/IP",
    date: "2026.06.19",
    pdf: "4주차_네트워크계층.pdf",
    slides: [
      { n: 1, title: "네트워크 계층 개요" },
      { n: 2, title: "IP 주소" },
      { n: 3, title: "라우팅 테이블" },
      { n: 4, title: "넥스트홉 전달" },
      { n: 5, title: "재캡슐화" },
    ],
    script: [
      { id: 1, text: "이번 시간엔 네트워크 계층과 IP를 봅니다." },
      {
        id: 2,
        text: "패킷은 목적지 IP를 보고 넥스트홉으로 전달됩니다.",
        corrected: { from: "데스티니션 IP", to: "목적지 IP" },
      },
      { id: 3, text: "라우터는 라우팅 테이블로 다음 경로를 결정합니다." },
      { id: 4, text: "목적지 IP와 넥스트홉 개념, 시험에 나옵니다.", emphasize: true },
      {
        id: 5,
        text: "각 홉을 지날 때마다 재캡슐화가 일어납니다.",
        corrected: { from: "재캡슐레이션", to: "재캡슐화" },
      },
    ],
    slideForCaption: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
    summaryAt: {
      2: "목적지 IP 기반 넥스트홉 전달",
      3: "라우팅 테이블로 경로 결정",
      5: "홉마다 재캡슐화 발생",
    },
    summaryOneLine: "네트워크 계층은 목적지 IP를 보고 라우팅 테이블로 넥스트홉을 정해 패킷을 전달한다.",
    summaryPoints: [
      "IP 주소와 네트워크 계층",
      "목적지 IP → 넥스트홉 전달 (시험 출제 언급)",
      "홉마다의 재캡슐화",
    ],
    emphasisPoints: ["목적지 IP와 넥스트홉 개념은 시험에 출제 — “시험에 나옵니다”"],
  },
  {
    id: "ict-w2",
    course: "정보통신공학",
    week: "2주차",
    title: "지연과 큐잉 지연",
    label: "정보통신공학 — 2주차: 지연·큐잉 지연",
    date: "2026.06.12",
    pdf: "2주차_지연.pdf",
    slides: [
      { n: 1, title: "지연의 종류" },
      { n: 2, title: "전파 지연" },
      { n: 3, title: "전송 지연" },
      { n: 4, title: "큐잉 지연" },
      { n: 5, title: "NB-IoT 사례" },
    ],
    script: [
      { id: 1, text: "네트워크 지연에는 여러 종류가 있습니다." },
      {
        id: 2,
        text: "혼잡할수록 큐잉 지연이 커집니다.",
        corrected: { from: "큐, EU, ING 딜레이", to: "큐잉 지연" },
      },
      { id: 3, text: "전파 지연과 전송 지연은 헷갈리기 쉬우니 꼭 구분하세요." },
      { id: 4, text: "큐잉 지연 계산, 중간고사 출제 포인트입니다.", emphasize: true },
      {
        id: 5,
        text: "저전력 사물인터넷은 NB-IoT를 많이 씁니다.",
        corrected: { from: "네로 밴드 IoT", to: "NB-IoT" },
      },
    ],
    slideForCaption: { 1: 1, 2: 4, 3: 2, 4: 4, 5: 5 },
    summaryAt: {
      2: "혼잡 시 큐잉 지연 증가",
      3: "전파 지연과 전송 지연 구분",
      5: "저전력 IoT는 NB-IoT 사용",
    },
    summaryOneLine: "네트워크 지연은 전파·전송·큐잉 지연으로 나뉘며, 혼잡할수록 큐잉 지연이 커진다.",
    summaryPoints: [
      "지연의 종류(전파/전송/큐잉)",
      "큐잉 지연 계산 (시험 출제 언급)",
      "NB-IoT 저전력 통신 사례",
    ],
    emphasisPoints: ["큐잉 지연 계산은 중간고사 출제 — “중간고사 출제 포인트입니다”"],
  },
];

export const lectureById = (id: string) => LECTURES.find((l) => l.id === id) ?? LECTURES[0];
