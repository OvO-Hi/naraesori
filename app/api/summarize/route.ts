// app/api/summarize/route.ts
//
// 강의 종료 후 요약자료 생성. 누적된 자막(원본+교정)을 이어붙여 오버랩 중복을 제거하고,
// gpt-4o-mini 로 요약(한 줄 요약 / 핵심 포인트 / 전공용어 / 정리된 전체 자막)을 만든다.
//
// ⚠️ /api/transcribe·correct·speak route 는 건드리지 않는다. dedup 로직만 공용 모듈에서 재사용.

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { dedupOverlap, type Change } from "@/lib/pipeline/transcribe-client";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const runtime = "nodejs";
export const maxDuration = 30;

const LLM_MODEL = "gpt-4o-mini";

interface InCaption {
  original?: string;
  corrected?: string;
  changes?: Change[];
}

interface SummaryResult {
  oneLineSummary: string;
  keyPoints: string[];
  terms: { term: string; note: string }[];
  cleanedTranscript: string;
}

export async function POST(req: NextRequest) {
  let body: { captions?: InCaption[]; courseName?: string; pdfContext?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const captions = Array.isArray(body?.captions) ? body.captions : [];

  // (1) corrected(교정본) 기준으로 이어붙이며 오버랩 중복 제거 → "정리된 전체 스크립트"
  let cleaned = "";
  const termSet = new Set<string>();
  for (const cap of captions) {
    const text = (cap.corrected || cap.original || "").trim();
    if (text) cleaned = cleaned ? `${cleaned} ${dedupOverlap(cleaned, text)}` : text;
    for (const ch of cap.changes ?? []) if (ch?.to) termSet.add(ch.to);
  }
  cleaned = cleaned.trim();
  const correctedTerms = [...termSet];

  // 입력이 비면 빈 요약
  if (!cleaned) {
    const empty: SummaryResult = { oneLineSummary: "", keyPoints: [], terms: [], cleanedTranscript: "" };
    return NextResponse.json(empty);
  }

  // 폴백: LLM 실패/파싱 실패 시 최소한 정리된 스크립트 + 교정 용어는 준다.
  const fallback = (): SummaryResult => ({
    oneLineSummary: "",
    keyPoints: [],
    terms: correctedTerms.map((t) => ({ term: t, note: "" })),
    cleanedTranscript: cleaned,
  });

  try {
    const system = [
      "너는 대학 강의 자막을 정리해 학습용 요약자료를 만드는 도구다.",
      "입력은 실시간 STT 자막을 이어붙인 것이라 반복/중복 문장과 끊긴 구어체가 섞여 있다.",
      "반복·중복 문장을 정리하고 자연스러운 문어체로 다듬어라. 내용은 왜곡하지 마라.",
      body.courseName ? `과목: ${body.courseName}` : "",
      body.pdfContext ? `강의 자료 맥락: ${body.pdfContext}` : "",
      correctedTerms.length ? `이 강의에서 교정된 전공용어(용어 목록에 우선 반영): ${correctedTerms.join(", ")}` : "",
      "",
      "반드시 아래 JSON 형식으로만 답하라(마크다운/코드블록/설명 없이 순수 JSON):",
      '{ "oneLineSummary": "강의 한 줄 요약", "keyPoints": ["핵심 3~5개"], "terms": [{"term":"전공용어","note":"짧은 설명"}], "cleanedTranscript": "반복 제거되고 문어체로 다듬어진 전체 정리본" }',
    ]
      .filter(Boolean)
      .join("\n");

    const completion = await openai.chat.completions.create({
      model: LLM_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `[정리 대상 자막]\n${cleaned}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = safeParse(raw);
    if (!parsed) return NextResponse.json(fallback());

    const result: SummaryResult = {
      oneLineSummary: str(parsed.oneLineSummary),
      keyPoints: strArray(parsed.keyPoints).slice(0, 5),
      terms: termArray(parsed.terms, correctedTerms),
      cleanedTranscript: str(parsed.cleanedTranscript) || cleaned,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("summarize error:", err instanceof Error ? err.message : err);
    return NextResponse.json(fallback());
  }
}

// ── 파싱/정규화 헬퍼 (any 없이) ─────────────────────────────────────────────
function safeParse(raw: string): Record<string, unknown> | null {
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(raw);
  if (direct) return direct;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return tryParse(raw.slice(start, end + 1));
  return null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
}

function termArray(v: unknown, fallbackTerms: string[]): { term: string; note: string }[] {
  if (Array.isArray(v)) {
    const out: { term: string; note: string }[] = [];
    for (const item of v) {
      if (item && typeof item === "object") {
        const t = (item as { term?: unknown }).term;
        const n = (item as { note?: unknown }).note;
        if (typeof t === "string" && t.trim()) out.push({ term: t, note: typeof n === "string" ? n : "" });
      }
    }
    if (out.length) return out;
  }
  return fallbackTerms.map((t) => ({ term: t, note: "" }));
}
