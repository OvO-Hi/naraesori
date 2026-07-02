// app/api/correct/correct.ts
//
// 나래소리 RAG 자막 교정의 "핵심 로직". route 와 테스트 스크립트가 함께 쓴다.
//
// 흐름: STT 자막 → 임베딩 → Supabase match_oop_terms 로 관련 OOP 용어 top-8 검색
//       → 그 용어 목록을 근거로 gpt-4o-mini 가 오인식된 전공용어만 교정.
//
// ⚠️ 프레임워크 비의존: process.env 만 읽고, 클라이언트는 호출 시점에 생성한다
//    (테스트 스크립트가 dotenv 로드 후 직접 호출할 수 있게).

import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536차원
const LLM_MODEL = "gpt-4o-mini";
const MATCH_COUNT = 8; // 관련 용어 후보 top-8

// match_oop_terms 반환 행
export interface TermMatch {
  id: number;
  term: string;
  aliases: string[];
  misheard: string[];
  definition: string;
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
  candidates: string[]; // 디버깅/데모용: 검색된 용어 top-8
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
  "너는 공학(OOP, 객체지향 프로그래밍) 강의 실시간 자막의 STT(음성인식) 오인식을 교정하는 도구다.",
  "사용자가 주는 '관련 전공 용어 목록'은 이 강의에서 실제로 나올 수 있는 정확한 용어들이다.",
  "자막에서 이 용어들이 발음이 비슷하게 잘못 표기된 부분만 정확한 용어로 교정하라.",
  "확실하지 않으면 원문을 그대로 유지하라. 멀쩡한 일반 단어를 전공용어로 억지로 바꾸지 마라(오교정 금지).",
  "문장의 의미와 어투는 절대 바꾸지 말고, 오인식된 전공용어만 고쳐라.",
  "",
  "반드시 아래 JSON 형식으로만 답하라. 마크다운/코드블록/설명 없이 순수 JSON 객체만 출력한다:",
  '{ "corrected": "교정된 문장 전체", "changes": [{ "from": "잘못된표기", "to": "정확한용어" }] }',
  "changes 에는 실제로 바꾼 항목만 넣는다. 바꾼 게 없으면 corrected 는 원문과 동일하고 changes 는 빈 배열([])이다.",
].join("\n");

// 후보 용어들을 LLM 이 읽기 좋은 "사전" 텍스트로 정리.
function buildTermDictionary(candidates: TermMatch[]): string {
  return candidates
    .map((c) => {
      const aliases = c.aliases?.length ? ` | 별칭: ${c.aliases.join(", ")}` : "";
      const misheard = c.misheard?.length ? ` | 자주 틀리는 표기: ${c.misheard.join(", ")}` : "";
      return `- ${c.term}${aliases}${misheard} | 뜻: ${c.definition}`;
    })
    .join("\n");
}

// LLM 응답에서 JSON 을 안전하게 파싱. 실패하면 null.
function safeParseLlm(raw: string): { corrected?: unknown; changes?: unknown } | null {
  try {
    return JSON.parse(raw);
  } catch {
    // 혹시 코드펜스 등이 섞였으면 첫 { ~ 마지막 } 만 떼어 재시도.
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
// 단계별 실패는 CorrectStageError 로 던진다(라우트가 500 처리). LLM JSON 파싱 실패는
// 던지지 않고 corrected=original / changes=[] 로 폴백한다.
export async function correctSubtitle(text: string): Promise<CorrectResult> {
  const original = text;

  // (1) 임베딩
  let queryEmbedding: number[];
  try {
    const openai = makeOpenAI();
    const emb = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: text });
    queryEmbedding = emb.data[0].embedding;
  } catch (err) {
    throw new CorrectStageError("embed", err instanceof Error ? err.message : String(err));
  }

  // (2) Supabase RPC: 관련 용어 top-8
  let candidates: TermMatch[];
  try {
    const supabase = makeSupabase();
    const { data, error } = await supabase.rpc("match_oop_terms", {
      query_embedding: queryEmbedding,
      match_count: MATCH_COUNT,
    });
    if (error) throw new Error(error.message);
    candidates = (data ?? []) as TermMatch[];
  } catch (err) {
    throw new CorrectStageError("rpc", err instanceof Error ? err.message : String(err));
  }

  const candidateTerms = candidates.map((c) => c.term);

  // (3) LLM 교정
  let raw: string;
  try {
    const openai = makeOpenAI();
    const dictionary = buildTermDictionary(candidates);
    const userPrompt = [
      "다음은 STT 가 받아쓴 강의 자막이다. 오인식된 전공용어만 교정하라.",
      "",
      "[관련 전공 용어 목록]",
      dictionary || "(관련 용어 없음)",
      "",
      "[자막 원문]",
      original,
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
