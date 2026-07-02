// app/api/correct/correct.ts
//
// 나래소리 RAG 자막 교정의 "핵심 로직". route 와 테스트 스크립트가 함께 쓴다.
//
// 흐름: STT 자막 → (빠른 variant 필터) → 임베딩 → Supabase match_terms 로 관련 용어 검색
//       → 그 용어(canonical/english/variants)를 근거로 gpt-4o-mini 가 오인식된 전공용어만 교정.
//
// 사전: 테이블 naraesori_terms + 함수 match_terms (정보통신공학 도메인).
//
// ⚠️ 프레임워크 비의존: process.env 만 읽고, 클라이언트는 호출 시점에 생성한다
//    (테스트 스크립트가 dotenv 로드 후 직접 호출할 수 있게).
// ⚠️ 반환 형식({ original, corrected, changes, candidates })은 LiveScreen 하이라이트가 의존 → 바꾸지 않는다.

import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536차원
const LLM_MODEL = "gpt-4o-mini";
const MATCH_COUNT = 5; // 관련 용어 후보 top-5

// naraesori_terms 의 variant 항목(jsonb)
export interface Variant {
  text: string;
  count?: number;
  example?: string;
}

// match_terms 반환 행
export interface TermMatch {
  canonical: string;
  english: string | null;
  definition: string | null;
  variants: Variant[];
  similarity: number;
}

export interface Change {
  from: string;
  to: string;
}

export interface CorrectResult {
  original: string;
  corrected: string;
  changes: Change[];
  candidates: string[]; // 디버깅/데모용: 검색된 canonical 목록
}

// 단계별 실패를 구분하기 위한 에러(라우트가 어느 단계에서 죽었는지 메시지에 담는다).
export class CorrectStageError extends Error {
  constructor(
    public stage: "embed" | "rpc" | "llm",
    message: string,
  ) {
    super(message);
    this.name = "CorrectStageError";
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} 가 환경변수에 없습니다.`);
  return v;
}

function makeOpenAI(): OpenAI {
  return new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
}

function makeSupabase(): SupabaseClient {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const SYSTEM_PROMPT = [
  "너는 공학(정보통신공학) 강의 실시간 자막의 STT(음성인식) 오인식을 교정하는 도구다.",
  "사용자가 주는 '관련 정답 용어 후보'는 이 강의에서 실제로 나올 수 있는 정확한 용어(canonical)와 그 오표기(variant) 목록이다.",
  "자막에서 후보에 있는 용어가 발음이 비슷하게 잘못 표기된 부분만 정확한 canonical 로 교정하라.",
  "후보에 없는 표현은 절대 건드리지 마라. 확신이 없으면 원문을 그대로 유지하라(보수적 교정, 오교정 금지).",
  "문장의 의미와 어투는 바꾸지 말고, 오인식된 전공용어만 고쳐라.",
  "",
  "반드시 아래 JSON 형식으로만 답하라. 마크다운/코드블록/설명 없이 순수 JSON 객체만 출력한다:",
  '{ "corrected": "교정된 문장 전체", "changes": [{ "from": "잘못된표기", "to": "정확한용어(canonical)" }] }',
  "changes 에는 실제로 바꾼 항목만 넣는다. 바꾼 게 없으면 corrected 는 원문과 동일하고 changes 는 빈 배열([])이다.",
].join("\n");

// 후보 용어들을 LLM 이 읽기 좋은 "사전" 텍스트로 정리(canonical(english): variant…).
function buildTermDictionary(candidates: TermMatch[]): string {
  return candidates
    .map((c) => {
      const eng = c.english ? ` (${c.english})` : "";
      const variantTexts = (c.variants ?? []).map((v) => v?.text).filter((t): t is string => !!t);
      const variants = variantTexts.length ? ` | 오표기: ${variantTexts.join(", ")}` : "";
      const def = c.definition ? ` | 뜻: ${c.definition}` : "";
      return `- ${c.canonical}${eng}${variants}${def}`;
    })
    .join("\n");
}

// ── 빠른 variant 필터(옵션 성능) ────────────────────────────────────────────
// 사전의 모든 variant 문자열을 메모리에 캐시해두고, 자막에 겹치는 오표기가 전혀 없으면 임베딩/LLM 스킵.
// fail-open: 로드 실패/인덱스 없음이면 항상 교정.
//
// ⚠️ 기본 OFF. 테스트에서 "큐, EU, ING 딜레이"(Queueing delay) 처럼 표기 편차가 큰 오인식이
//    variant 문자열과 substring 매칭이 안 돼 교정을 "놓치는" 것을 확인 → 정확성 우선으로 꺼둔다.
//    지연이 문제될 때만 켜라(그때는 variant 매칭을 더 느슨하게 보강 필요).
const ENABLE_VARIANT_PREFILTER = false;

let variantCache: string[] | null = null;

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

async function loadVariantIndex(supabase: SupabaseClient): Promise<string[]> {
  if (variantCache) return variantCache;
  try {
    const { data, error } = await supabase.from("naraesori_terms").select("variants");
    if (error) throw new Error(error.message);
    const set = new Set<string>();
    for (const row of data ?? []) {
      const vs = (row as { variants?: Variant[] }).variants ?? [];
      for (const v of vs) {
        if (v?.text) {
          const n = norm(v.text);
          if (n.length >= 2) set.add(n);
        }
      }
    }
    variantCache = [...set];
  } catch {
    variantCache = []; // fail-open
  }
  return variantCache;
}

// 자막에 알려진 오표기가 하나라도 있으면 교정 후보(true). 인덱스 없으면 항상 true.
function mightNeedCorrection(text: string, variants: string[]): boolean {
  if (variants.length === 0) return true;
  const n = norm(text);
  return variants.some((v) => n.includes(v));
}

// LLM 응답에서 JSON 을 안전하게 파싱. 실패하면 null.
function safeParseLlm(raw: string): { corrected?: unknown; changes?: unknown } | null {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

// changes 를 안전하게 정규화(문자열 from/to 쌍만 통과).
function normalizeChanges(value: unknown): Change[] {
  if (!Array.isArray(value)) return [];
  const out: Change[] = [];
  for (const item of value) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as Change).from === "string" &&
      typeof (item as Change).to === "string"
    ) {
      out.push({ from: (item as Change).from, to: (item as Change).to });
    }
  }
  return out;
}

// 핵심: 자막 한 줄(또는 여러 줄)을 받아 교정 결과를 반환.
export async function correctSubtitle(text: string): Promise<CorrectResult> {
  const original = text;

  // supabase 클라이언트(필터 + 검색 공용). 생성 실패는 rpc 단계에서 다시 시도/에러.
  let supabase: SupabaseClient | null = null;
  try {
    supabase = makeSupabase();
  } catch {
    /* rpc 단계에서 처리 */
  }

  // (0) 빠른 필터(기본 OFF): 자막에 알려진 오표기가 전혀 없으면 스킵.
  if (ENABLE_VARIANT_PREFILTER && supabase) {
    try {
      const variants = await loadVariantIndex(supabase);
      if (!mightNeedCorrection(text, variants)) {
        return { original, corrected: original, changes: [], candidates: [] };
      }
    } catch {
      /* 필터 실패 → 계속 교정(안전) */
    }
  }

  // (1) 임베딩
  let queryEmbedding: number[];
  try {
    const openai = makeOpenAI();
    const emb = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: text });
    queryEmbedding = emb.data[0].embedding;
  } catch (err) {
    throw new CorrectStageError("embed", err instanceof Error ? err.message : String(err));
  }

  // (2) Supabase RPC: 관련 용어 top-5 (match_terms)
  let candidates: TermMatch[];
  try {
    const sb = supabase ?? makeSupabase();
    const { data, error } = await sb.rpc("match_terms", {
      query_embedding: queryEmbedding,
      match_count: MATCH_COUNT,
    });
    if (error) throw new Error(error.message);
    candidates = (data ?? []) as TermMatch[];
  } catch (err) {
    throw new CorrectStageError("rpc", err instanceof Error ? err.message : String(err));
  }

  const candidateTerms = candidates.map((c) => c.canonical);

  // (3) LLM 교정
  let raw: string;
  try {
    const openai = makeOpenAI();
    const dictionary = buildTermDictionary(candidates);
    const userPrompt = [
      "아래 실시간 강의 자막(STT)에 전공 용어 오인식이 있을 수 있다.",
      "",
      "[관련 정답 용어 후보]  (canonical(english) | 오표기 | 뜻)",
      dictionary || "(관련 용어 없음)",
      "",
      "[자막 원문]",
      original,
      "",
      "후보에 있는 용어의 오인식만 정확한 canonical 로 고쳐라. 후보에 없는 건 건드리지 마라. 확신 없으면 원문 유지.",
    ].join("\n");

    const completion = await openai.chat.completions.create({
      model: LLM_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    raw = completion.choices[0]?.message?.content ?? "";
  } catch (err) {
    throw new CorrectStageError("llm", err instanceof Error ? err.message : String(err));
  }

  // (4) 응답 파싱 — 실패해도 500 아님. 원문 유지로 폴백.
  const parsed = safeParseLlm(raw);
  if (!parsed || typeof parsed.corrected !== "string") {
    return { original, corrected: original, changes: [], candidates: candidateTerms };
  }

  return {
    original,
    corrected: parsed.corrected,
    changes: normalizeChanges(parsed.changes),
    candidates: candidateTerms,
  };
}
