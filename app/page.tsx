// app/page.tsx
// 루트(/) 진입점 — 앱 흐름은 /login → /dashboard 이므로 로그인으로 보낸다.
// (서버 컴포넌트에서 즉시 redirect. 기존 STT 프로토타입 UI는 진입점이 아니므로 제거.)

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/login");
}
