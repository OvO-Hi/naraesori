// lib/mock-dashboard.ts
//
// 대시보드 홈(app/dashboard/page.tsx)용 mock 데이터. 실제 연동/DB 없음(전부 mock).
// 색은 과목별 라벨색(hex). 렌더 시 저채도 칩(bg 알파 + 텍스트)으로 사용.

export interface Course {
  id: string;
  name: string;
  professor: string;
  room: string;
  color: string; // 과목 라벨색(hex)
}

export interface TimetableSlot {
  courseId: string;
  day: "월" | "화" | "수" | "목" | "금";
  start: number; // 24h 정수(예: 9)
  end: number; // 24h 정수(예: 11)
}

export interface Assignment {
  courseId: string;
  title: string;
  due: string; // 예: "2026.07.05"
}

export interface CalendarUsage {
  date: string; // "YYYY-MM-DD" — 나래소리로 강의를 들은 날
  courseId: string;
}

export const COURSES: Course[] = [
  { id: "oop", name: "객체지향 프로그래밍", professor: "김서연 교수", room: "공학관 401", color: "#3F7D58" },
  { id: "ds", name: "자료구조와 알고리즘", professor: "박준호 교수", room: "IT관 203", color: "#B8862F" },
  { id: "ss", name: "신호 및 시스템", professor: "이도현 교수", room: "전기관 512", color: "#4E6E9E" },
  { id: "em", name: "공업수학", professor: "정한별 교수", room: "자연관 108", color: "#8A66A8" },
  { id: "ict", name: "정보통신공학", professor: "최민석 교수", room: "전파관 301", color: "#2F8F83" },
];

export const courseById = (id: string): Course =>
  COURSES.find((c) => c.id === id) ?? COURSES[0];

export const TIMETABLE: TimetableSlot[] = [
  // 월요일 — "예정"으로 보여줄 과목들
  { courseId: "oop", day: "월", start: 9, end: 11 },
  { courseId: "ss", day: "월", start: 13, end: 15 },
  // 화
  { courseId: "ds", day: "화", start: 10, end: 12 },
  { courseId: "em", day: "화", start: 15, end: 17 },
  // 수
  { courseId: "oop", day: "수", start: 9, end: 11 },
  { courseId: "ict", day: "수", start: 13, end: 15 },
  // 목
  { courseId: "ds", day: "목", start: 10, end: 12 },
  { courseId: "ss", day: "목", start: 14, end: 16 },
  // 금(오늘) — 데모 대상 정보통신공학만
  { courseId: "ict", day: "금", start: 13, end: 15 },
];

// UPCOMING(다가오는 수업)은 TIMETABLE 을 단일 소스로 삼아 대시보드 홈에서 파생한다.
// (오늘 수업 = 강의 시작 가능, 그 외 = 예정)

export const ASSIGNMENTS: Assignment[] = [
  { courseId: "oop", title: "다형성 실습 과제 제출", due: "2026.07.05" },
  { courseId: "ds", title: "이진 탐색 트리 구현", due: "2026.07.08" },
  { courseId: "em", title: "미분방정식 문제풀이 3장", due: "2026.07.10" },
];

export const CALENDAR_USAGE: CalendarUsage[] = [
  { date: "2026-07-01", courseId: "oop" },
  { date: "2026-06-30", courseId: "ds" },
  { date: "2026-06-26", courseId: "ss" },
  { date: "2026-07-02", courseId: "ss" },
];

// 데모 기준 오늘(캘린더/시간표 강조용). 실제 now 대신 고정값(SSR 하이드레이션 안전).
export const TODAY = { year: 2026, month: 7, day: 3 }; // 2026-07-03 (금)

// 오늘 요일(고정 입력 → 서버/클라 동일, 하이드레이션 안전). 2026-07-03 = 금.
export const TODAY_DAY = (["일", "월", "화", "수", "목", "금", "토"][
  new Date(TODAY.year, TODAY.month - 1, TODAY.day).getDay()
]) as "월" | "화" | "수" | "목" | "금";

// ── 지난 강의 (lectures) ─────────────────────────────────────────────────────
export interface LectureCaption {
  text: string; // 교정된 최종 자막
  correction?: { from: string; to: string }; // 교정된 전공용어(있으면)
}

export interface LectureHistoryItem {
  id: string;
  courseId: string;
  date: string; // "YYYY-MM-DD"
  title: string;
  durationMin: number;
  summaryOneLine: string;
  summaryPoints: string[];
  captions: LectureCaption[];
}

export const LECTURE_HISTORY: LectureHistoryItem[] = [
  {
    id: "lh-ss-0702",
    courseId: "ss",
    date: "2026-07-02",
    title: "라플라스 변환 기초",
    durationMin: 45,
    summaryOneLine: "라플라스 변환은 미분방정식을 대수적으로 풀게 해주며, 역변환과 회로 응용이 핵심.",
    summaryPoints: ["라플라스 변환의 정의", "기본 변환쌍", "역변환과 회로 응용 (시험 출제 언급)"],
    captions: [
      { text: "오늘은 라플라스 변환의 기초를 배웁니다.", correction: { from: "라플라스 변한", to: "라플라스 변환" } },
      { text: "라플라스 변환은 미분방정식을 대수 방정식으로 바꿔줍니다." },
      { text: "기본 변환쌍 몇 개는 외워두면 정말 편해요." },
      { text: "역변환 부분, 중간고사에 두 문제 나옵니다." },
      { text: "회로 해석에 어떻게 쓰이는지까지 보겠습니다." },
    ],
  },
  {
    id: "lh-oop-0701",
    courseId: "oop",
    date: "2026-07-01",
    title: "다형성과 인터페이스",
    durationMin: 48,
    summaryOneLine: "다형성은 하나의 인터페이스로 여러 타입을 다루는 성질이며, 캡슐화와 함께 객체지향의 핵심.",
    summaryPoints: ["다형성의 정의와 목적", "인터페이스와 구현 분리", "캡슐화로 내부 감추기"],
    captions: [
      { text: "오늘은 다형성에 대해 배웁니다.", correction: { from: "다양성", to: "다형성" } },
      { text: "다형성은 하나의 인터페이스로 여러 타입을 다루는 성질입니다." },
      { text: "캡슐화는 데이터를 숨기고 메서드로만 접근하게 합니다.", correction: { from: "캡술화", to: "캡슐화" } },
      { text: "오버라이딩으로 자식이 부모 메서드를 재정의할 수 있어요.", correction: { from: "오버라이팅", to: "오버라이딩" } },
      { text: "정리하면 다형성, 캡슐화, 상속이 객체지향의 핵심입니다." },
    ],
  },
  {
    id: "lh-ds-0630",
    courseId: "ds",
    date: "2026-06-30",
    title: "이진 탐색 트리",
    durationMin: 52,
    summaryOneLine: "이진 탐색 트리는 정렬된 구조로 탐색·삽입·삭제를 평균 O(log n)에 처리한다.",
    summaryPoints: ["이진 탐색 트리의 성질", "삽입과 삭제 연산", "균형이 깨질 때의 문제"],
    captions: [
      { text: "이진 탐색 트리는 왼쪽이 작고 오른쪽이 큰 구조입니다." },
      { text: "탐색은 루트에서 시작해 한쪽으로 내려갑니다." },
      { text: "삽입과 삭제도 같은 원리로 위치를 찾습니다." },
      { text: "균형이 깨지면 성능이 나빠져서, 이게 시험에 자주 나옵니다." },
    ],
  },
  {
    id: "lh-ss-0626",
    courseId: "ss",
    date: "2026-06-26",
    title: "푸리에 변환",
    durationMin: 50,
    summaryOneLine: "푸리에 변환은 시간 영역 신호를 주파수 영역으로 바꾸는 도구이며, 컨볼루션 정리가 핵심.",
    summaryPoints: ["푸리에 변환의 정의와 목적", "임펄스 응답과 컨볼루션의 관계", "컨볼루션 정리 (시험 출제 언급)"],
    captions: [
      { text: "자, 오늘은 푸리에 변환에 대해 알아보겠습니다.", correction: { from: "푸리에 변한", to: "푸리에 변환" } },
      { text: "푸리에 변환은 시간 영역의 신호를 주파수 영역으로 바꿔주는 도구입니다." },
      { text: "여기서 핵심은 임펄스 응답과 컨볼루션의 관계예요." },
      { text: "그래서 컨볼루션 정리를 꼭 이해하고 넘어가야 합니다." },
    ],
  },
];

export const lectureHistoryById = (id: string): LectureHistoryItem | undefined =>
  LECTURE_HISTORY.find((l) => l.id === id);

export const correctionCount = (l: LectureHistoryItem): number =>
  l.captions.filter((c) => c.correction).length;

// ── 나래벗 (buddy) ──────────────────────────────────────────────────────────
export interface BuddyFile {
  name: string;
  courseId: string;
  date: string;
}

export const BUDDY = {
  name: "정하늘",
  department: "컴퓨터공학과 22학번",
  contact: "sky.jung@example.ac.kr",
  message: "필기 자료는 강의 끝나고 그날 올려둘게요. 편하게 연락 주세요!",
};

export const BUDDY_FILES: BuddyFile[] = [
  { name: "정보통신공학_신호처리정리.pdf", courseId: "ict", date: "2026-07-03" },
  { name: "다형성_필기정리.pdf", courseId: "oop", date: "2026-07-01" },
  { name: "이진트리_요약.pdf", courseId: "ds", date: "2026-06-30" },
  { name: "라플라스변환_보충.pdf", courseId: "ss", date: "2026-07-02" },
];

// ── 질문 내역 (questions) ────────────────────────────────────────────────────
export interface QuestionItem {
  id: string;
  date: string;
  courseId: string;
  text: string;
}

export const QUESTION_HISTORY: QuestionItem[] = [
  { id: "q1", date: "2026-07-02", courseId: "ss", text: "방금 그 역변환 부분 다시 설명해 주세요." },
  { id: "q2", date: "2026-07-02", courseId: "ss", text: "회로 응용 예시를 하나만 더 보여주실 수 있나요?" },
  { id: "q3", date: "2026-07-01", courseId: "oop", text: "인터페이스랑 추상 클래스 차이가 뭔가요?" },
  { id: "q4", date: "2026-06-30", courseId: "ds", text: "균형이 깨진다는 게 정확히 어떤 상황인가요?" },
];

// ── 프로필 (profile) ────────────────────────────────────────────────────────
export const PROFILE = {
  name: "김나래",
  studentId: "20226789",
  department: "전자공학과",
  email: "narae.kim@example.ac.kr",
  enrolledCourseIds: ["ict", "oop", "ds", "ss", "em"],
};

// ── 장애학생센터 문의 (support) ──────────────────────────────────────────────
export interface SupportTicket {
  id: string;
  title: string;
  status: "답변 완료" | "확인 중" | "접수됨";
  date: string;
}

export const SUPPORT_TICKETS: SupportTicket[] = [
  { id: "t1", title: "강의실 앞자리 우선 배정 요청", status: "답변 완료", date: "2026-06-28" },
  { id: "t2", title: "나래벗 매칭 변경 문의", status: "확인 중", date: "2026-07-01" },
  { id: "t3", title: "시험 편의 지원 신청", status: "접수됨", date: "2026-07-02" },
];
