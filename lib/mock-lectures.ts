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

export const LECTURES: Lecture[] = [
  {
    id: "ss-w3",
    course: "신호 및 시스템",
    week: "3주차",
    title: "푸리에 변환",
    label: "신호 및 시스템 — 3주차: 푸리에 변환",
    date: "2026.06.26",
    pdf: "3주차_푸리에변환.pdf",
    slides: [
      { n: 1, title: "강의 개요" },
      { n: 2, title: "시간 영역의 신호" },
      { n: 3, title: "주파수 영역이란?" },
      { n: 4, title: "푸리에 변환의 정의" },
      { n: 5, title: "컨볼루션 정리" },
    ],
    script: [
      {
        id: 1,
        text: "자, 오늘은 푸리에 변환에 대해 알아보겠습니다.",
        corrected: { from: "푸리에 변한", to: "푸리에 변환" },
      },
      { id: 2, text: "푸리에 변환은 시간 영역의 신호를 주파수 영역으로 바꿔주는 도구입니다." },
      { id: 3, text: "여기서 핵심은 임펄스 응답과 컨볼루션의 관계예요." },
      { id: 4, text: "이 부분 정말 중요합니다. 이거 시험에 나옵니다.", emphasize: true },
      { id: 5, text: "그래서 컨볼루션 정리를 꼭 이해하고 넘어가야 합니다." },
    ],
    slideForCaption: { 1: 3, 2: 4, 3: 4, 4: 5, 5: 5 },
    summaryAt: {
      2: "푸리에 변환: 시간 → 주파수 변환 도구",
      3: "임펄스 응답과 컨볼루션의 관계가 핵심",
      5: "컨볼루션 정리는 반드시 이해할 것",
    },
    summaryOneLine: "푸리에 변환은 시간 영역 신호를 주파수 영역으로 바꾸는 도구이며, 컨볼루션 정리가 핵심이다.",
    summaryPoints: [
      "푸리에 변환의 정의와 목적",
      "임펄스 응답과 컨볼루션의 관계",
      "컨볼루션 정리 (시험 출제 언급)",
    ],
    emphasisPoints: ["컨볼루션 정리는 반드시 이해할 것 — “이거 시험에 나옵니다”"],
  },
  {
    id: "em-w5",
    course: "공업수학",
    week: "5주차",
    title: "미분방정식의 일반해",
    label: "공업수학 — 5주차: 미분방정식의 일반해",
    date: "2026.06.18",
    pdf: "5주차_미분방정식.pdf",
    slides: [
      { n: 1, title: "미분방정식이란" },
      { n: 2, title: "계수와 차수" },
      { n: 3, title: "제차·비제차" },
      { n: 4, title: "일반해와 특수해" },
      { n: 5, title: "초기조건 적용" },
    ],
    script: [
      {
        id: 1,
        text: "오늘 배울 내용은 미분 방정식의 일반해입니다.",
        corrected: { from: "미분 방적식", to: "미분 방정식" },
      },
      { id: 2, text: "미분방정식은 함수와 그 도함수 사이의 관계를 나타냅니다." },
      { id: 3, text: "일반해는 임의의 상수를 포함하는 해의 집합이에요." },
      { id: 4, text: "여기, 초기조건 대입하는 부분 시험에 꼭 나옵니다.", emphasize: true },
      { id: 5, text: "그래서 특수해를 구하는 과정을 정확히 익혀야 합니다." },
    ],
    slideForCaption: { 1: 1, 2: 1, 3: 4, 4: 5, 5: 5 },
    summaryAt: {
      2: "미분방정식: 함수와 도함수의 관계",
      3: "일반해는 임의 상수를 포함하는 해의 집합",
      5: "초기조건으로 특수해를 구한다",
    },
    summaryOneLine: "미분방정식의 일반해는 임의 상수를 포함하며, 초기조건으로 특수해를 구한다.",
    summaryPoints: [
      "미분방정식의 정의",
      "일반해와 특수해의 차이",
      "초기조건 적용 (시험 출제 언급)",
    ],
    emphasisPoints: ["초기조건 대입 부분은 반드시 익힐 것 — “시험에 꼭 나옵니다”"],
  },
  {
    id: "ph-w4",
    course: "전자기학",
    week: "4주차",
    title: "가우스 법칙",
    label: "전자기학 — 4주차: 가우스 법칙",
    date: "2026.06.12",
    pdf: "4주차_가우스법칙.pdf",
    slides: [
      { n: 1, title: "전기장 복습" },
      { n: 2, title: "전기 선속" },
      { n: 3, title: "가우스 법칙 정의" },
      { n: 4, title: "대칭성과 가우스면" },
      { n: 5, title: "예제 풀이" },
    ],
    script: [
      {
        id: 1,
        text: "이번 시간에는 가우스 법칙에 대해 다루겠습니다.",
        corrected: { from: "가우스 법친", to: "가우스 법칙" },
      },
      { id: 2, text: "가우스 법칙은 폐곡면을 지나는 전기 선속과 전하의 관계를 말합니다." },
      { id: 3, text: "대칭성이 좋은 경우 가우스면을 잡으면 계산이 쉬워져요." },
      { id: 4, text: "이 대칭 조건, 시험 단골입니다.", emphasize: true },
      { id: 5, text: "예제에서 구·원통·평면 대칭을 꼭 구분하세요." },
    ],
    slideForCaption: { 1: 1, 2: 3, 3: 4, 4: 4, 5: 5 },
    summaryAt: {
      2: "가우스 법칙: 폐곡면 전기 선속과 전하의 관계",
      3: "대칭성을 이용하면 전기장 계산이 쉬워진다",
      5: "구·원통·평면 대칭별로 가우스면을 선택할 것",
    },
    summaryOneLine: "가우스 법칙은 폐곡면 전기 선속과 전하의 관계이며, 대칭성을 이용해 전기장을 구한다.",
    summaryPoints: [
      "전기 선속의 개념",
      "가우스 법칙의 의미",
      "대칭별 가우스면 선택 (시험 출제 언급)",
    ],
    emphasisPoints: ["대칭 조건은 시험 단골 — “이 대칭 조건, 시험 단골입니다”"],
  },
  {
    id: "ss-w2",
    course: "신호 및 시스템",
    week: "2주차",
    title: "라플라스 변환 기초",
    label: "신호 및 시스템 — 2주차: 라플라스 변환 기초",
    date: "2026.06.19",
    pdf: "2주차_라플라스변환.pdf",
    slides: [
      { n: 1, title: "복습: 미분방정식" },
      { n: 2, title: "라플라스 변환의 정의" },
      { n: 3, title: "기본 변환쌍" },
      { n: 4, title: "역변환" },
      { n: 5, title: "회로 응용" },
    ],
    script: [
      {
        id: 1,
        text: "오늘은 라플라스 변환의 기초를 배웁니다.",
        corrected: { from: "라플라스 변한", to: "라플라스 변환" },
      },
      { id: 2, text: "라플라스 변환은 미분방정식을 대수 방정식으로 바꿔줍니다." },
      { id: 3, text: "기본 변환쌍 몇 개는 외워두면 정말 편해요." },
      { id: 4, text: "역변환 부분, 중간고사에 두 문제 나옵니다.", emphasize: true },
      { id: 5, text: "회로 해석에 어떻게 쓰이는지까지 보겠습니다." },
    ],
    slideForCaption: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
    summaryAt: {
      2: "라플라스 변환: 미분방정식 → 대수 방정식",
      3: "기본 변환쌍은 외워두면 유리",
      5: "회로 해석에 응용됨",
    },
    summaryOneLine: "라플라스 변환은 미분방정식을 대수적으로 풀게 해주며, 역변환과 회로 응용이 핵심.",
    summaryPoints: [
      "라플라스 변환의 정의",
      "기본 변환쌍",
      "역변환과 회로 응용 (시험 출제 언급)",
    ],
    emphasisPoints: ["역변환 부분은 중간고사 출제 — “두 문제 나옵니다”"],
  },
];

export const lectureById = (id: string) => LECTURES.find((l) => l.id === id) ?? LECTURES[0];
