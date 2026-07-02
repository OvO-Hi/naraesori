// components/naraesori/Logo.tsx
//
// 나래소리 로고 — 실제 로고 이미지(next/image).
//   variant : "wordmark"(글자 포함) | "symbol"(심볼만)
//   tone    : "color"(초록, 밝은 배경용) | "white"(흰색, 그린 배경용)
//   size    : 높이(px). width 는 원본 비율(aspect)대로 auto.
//
// 로고 이미지 자체는 그대로. 배경에 맞춰 tone 만 고른다.

import Image from "next/image";

type Variant = "wordmark" | "symbol";
type Tone = "color" | "white";

const SOURCES: Record<Variant, Record<Tone, { src: string; ratio: number }>> = {
  wordmark: {
    color: { src: "/logo/naraesori_logo.png", ratio: 665 / 443 },
    white: { src: "/logo/logo-wordmark-white.png", ratio: 665 / 443 },
  },
  symbol: {
    color: { src: "/logo/naraesori_logo_simple.png", ratio: 1536 / 1024 },
    white: { src: "/logo/logo-symbol-white.png", ratio: 1536 / 1024 },
  },
};

export function Logo({
  variant = "wordmark",
  tone = "color",
  size = 36,
  className,
}: {
  variant?: Variant;
  tone?: Tone;
  /** 로고 높이(px). width 는 비율대로 자동. */
  size?: number;
  className?: string;
}) {
  const { src, ratio } = SOURCES[variant][tone];
  return (
    <Image
      src={src}
      alt="나래소리"
      height={size}
      width={Math.round(size * ratio)}
      priority
      className={className}
      style={{ height: size, width: "auto" }}
    />
  );
}
