"use client";

// app/providers.tsx
// 최상위 SessionProvider — useSession/ signIn / signOut 을 어디서든 쓸 수 있게.

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
