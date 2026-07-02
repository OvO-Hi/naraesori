// app/api/correct/route.ts
//
// 자막 교정 API (POST). STT 자막을 받아 OOP 전공용어 오인식을 교정해 돌려준다.
// 핵심 로직은 ./correct 의 correctSubtitle 에 있다(테스트 스크립트와 공유).
//
// 입력:  { "text": "오늘은 다양성에 대해 배웁니다" }
// 출력:  { original, corrected, changes: [{from,to}], candidates: [...] }

import { NextRequest, NextResponse } from "next/server";
import { correctSubtitle, CorrectStageError } from "./correct";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // 입력 파싱 실패는 400.
  let text: unknown;
  try {
    const body = await req.json();
    text = body?.text;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "`text` (non-empty string) is required" }, { status: 400 });
  }

  try {
    const result = await correctSubtitle(text);
    return NextResponse.json(result);
  } catch (err) {
    // 임베딩/RPC/LLM 어느 단계에서 죽었는지 stage 로 구분. 최소한 원문은 살려서 반환한다.
    const stage = err instanceof CorrectStageError ? err.stage : "unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(`correct error [${stage}]:`, message);
    return NextResponse.json(
      {
        original: text,
        corrected: text, // 실패해도 원문 유지
        changes: [],
        candidates: [],
        error: `[${stage}] ${message}`,
      },
      { status: 500 },
    );
  }
}
