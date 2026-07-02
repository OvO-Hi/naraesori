// app/api/auth/[...nextauth]/route.ts
// NextAuth 라우트 핸들러(App Router). /api/auth/* 만 사용 — 기존 /api/* route 는 무관.

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
