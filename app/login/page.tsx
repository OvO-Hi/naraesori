"use client";

// app/login/page.tsx
// 실제 구글 OAuth 로그인 + 발표 안전벨트(데모 우회).

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Logo } from "@/components/naraesori/Logo";

export default function LoginPage() {
  const router = useRouter();

  // 실제 구글 OAuth 플로우.
  function loginWithGoogle() {
    signIn("google", { callbackUrl: "/dashboard" });
  }

  // 데모 우회(발표 중 OAuth 삐끗 대비) — OAuth 없이 로컬 플래그로 통과.
  function continueAsDemo() {
    try {
      localStorage.setItem("naraesori_demo_auth", "true");
    } catch {
      /* localStorage 불가 환경 무시 */
    }
    router.push("/dashboard");
  }

  return (
    <main className="watercolor-bg grid min-h-dvh place-items-center p-6">
      <div className="card-elev-2 w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center sm:p-10">
        <div className="flex justify-center">
          <Logo variant="wordmark" size={150} />
        </div>
        <p className="eyebrow mt-1">실시간 강의 자막 · 요약 AI</p>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          청각장애 학생을 위한 강의 도우미.
          <br />
          로그인하고 오늘의 강의를 시작하세요.
        </p>

        <div className="mt-8 space-y-3">
          <button
            onClick={loginWithGoogle}
            className="lift flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-background px-5 py-3.5 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            <GoogleIcon />
            구글로 로그인
          </button>
          <button
            disabled
            title="준비 중"
            className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-2xl border border-border bg-muted px-5 py-3.5 text-sm font-semibold text-muted-foreground opacity-60"
          >
            <span aria-hidden>🎓</span>
            학교 계정으로 로그인 (준비 중)
          </button>
        </div>

        {/* 발표용 데모 우회 — 눈에 띄지 않게 하단에 작게 */}
        <button
          onClick={continueAsDemo}
          className="mt-6 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          데모로 계속하기 →
        </button>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
