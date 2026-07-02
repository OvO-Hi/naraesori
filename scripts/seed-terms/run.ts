// scripts/seed-terms/run.ts
//
// OOP 용어 사전(data/oop-terms.json)을 OpenAI 임베딩으로 벡터화해서
// Supabase(pgvector) oop_terms 테이블에 적재하는 seed 스크립트.
//
// STT 오인식 교정 RAG의 기준 데이터를 만드는 게 목적. term/aliases/misheard/definition 을
// 하나의 content 로 합쳐 임베딩하므로, 오인식된 형태("다양성")로 검색해도 정답("다형성")이 걸린다.
//
// ⚠️ 이 스크립트는 Next.js 앱 코드(app/, lib/)를 전혀 건드리지 않는다. scripts/seed-terms/ 안에서만 동작.
//
// 전제:
//   - Supabase 에 oop_terms 테이블과 match_oop_terms(query_embedding, match_count) 함수가 이미 존재.
//   - .env.local 에 OPENAI_API_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 존재.
//
// 실행: npm run seed:terms

import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// ──────────────────────────────────────────────────────────────────────────
// 0. 환경 설정
// ──────────────────────────────────────────────────────────────────────────

const ROOT = process.cwd(); // npm script 로 실행하면 프로젝트 루트
// .env.local 만 명시적으로 로드. override:true 로, 혹시 존재하는 .env / 기존 process.env 값이
// .env.local 을 덮어쓰지 못하게 한다(진단 목적: 어떤 키가 실제로 쓰이는지 확정).
dotenv.config({ path: path.join(ROOT, ".env.local"), override: true });

// ── 진단 로그: 실제로 어떤 OPENAI_API_KEY 가 로드됐는지 마스킹해서 출력.
{
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.log("[diag] OPENAI_API_KEY: (없음 — .env.local 로드 실패 또는 키 누락)");
  } else {
    console.log("[diag] key:", key.slice(0, 8) + "..." + key.slice(-4), `(len ${key.length})`);
  }
}

const TERMS_PATH = path.join(ROOT, "data", "oop-terms.json");

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536차원
const EMBEDDING_DIM = 1536;
// 임베딩 TPM(분당 토큰) 한도 회피용: 한 번에 다 보내지 않고 작게 쪼개 순차 호출한다.
const EMBED_BATCH_SIZE = Number(process.env.EMBED_BATCH_SIZE) || 5; // 배치당 input 개수(기본 5)
const EMBED_DELAY_MS = Number(process.env.EMBED_DELAY_MS) || 1500; // 배치 사이 지연(기본 1500ms)
const EMBED_MAX_RETRIES = 4; // 429 시 지수 백오프 최대 재시도 횟수
const EMBED_BACKOFF_BASE_MS = 2000; // 백오프 시작(2초 → 4초 → 8초)

// 검증용: 다형성의 오인식 형태. 이걸 임베딩해서 top-3 를 조회했을 때 1위가 "다형성" 이면 OK.
const VERIFY_QUERY = "다양성";
const VERIFY_TOP_K = 3;

// ──────────────────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────────────────

interface Term {
  term: string;
  aliases: string[];
  misheard: string[];
  definition: string;
}

interface TermRow extends Term {
  content: string;
  embedding: number[];
}

// ──────────────────────────────────────────────────────────────────────────
// 1. 환경변수 / 클라이언트
// ──────────────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} 가 .env.local 에 없습니다.`);
  return v;
}

function makeOpenAI(): OpenAI {
  return new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
}

function makeSupabase() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  // service_role 키 사용 → RLS 우회하여 seed(delete/insert) 가능. 서버 전용, 절대 클라이언트 노출 금지.
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ──────────────────────────────────────────────────────────────────────────
// 2. content 생성 + 임베딩
// ──────────────────────────────────────────────────────────────────────────

// 임베딩 대상 문자열: term/aliases/misheard/definition 을 모두 합친다.
// (오인식 형태로 검색해도 걸리게 하는 게 핵심)
function buildContent(t: Term): string {
  return `${t.term} ${t.aliases.join(" ")} ${t.misheard.join(" ")} ${t.definition}`.trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 한 배치(chunk)를 임베딩. 429(rate limit)면 지수 백오프(2→4→8초, 최대 EMBED_MAX_RETRIES회) 재시도.
// 성공하면 입력 순서대로 정렬된 벡터 배열을 반환한다.
async function embedChunk(client: OpenAI, chunk: string[]): Promise<number[][]> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: chunk,
      });
      // res.data 는 index 순서가 보장되지 않을 수 있으니 index 로 정렬.
      const sorted = [...res.data].sort((a, b) => a.index - b.index);
      return sorted.map((d) => {
        if (d.embedding.length !== EMBEDDING_DIM) {
          throw new Error(`임베딩 차원이 ${EMBEDDING_DIM} 이 아닙니다: ${d.embedding.length}`);
        }
        return d.embedding;
      });
    } catch (err) {
      const e = err as { status?: number; code?: string; type?: string; message?: string };

      // 429(TPM 한도)면 백오프 후 재시도. 그 외 에러는 즉시 던진다.
      if (e?.status === 429 && attempt < EMBED_MAX_RETRIES) {
        const waitMs = EMBED_BACKOFF_BASE_MS * 2 ** attempt; // 2초 → 4초 → 8초 ...
        console.warn(
          `[embed] 429 rate limit — ${waitMs}ms 후 재시도 (${attempt + 1}/${EMBED_MAX_RETRIES})`,
        );
        await sleep(waitMs);
        continue;
      }

      // 재시도 소진 또는 비-429 에러: 정확히 어디서, 어떤 형태인지 그대로 노출하고 중단.
      console.error("[diag] embeddings.create 실패:");
      console.error("  status:", e?.status);
      console.error("  code:  ", e?.code);
      console.error("  type:  ", e?.type);
      console.error("  message:", e?.message ?? String(err));
      if (e?.status === 429) {
        console.error(`  → 429 재시도 ${EMBED_MAX_RETRIES}회 모두 실패. EMBED_BATCH_SIZE 축소 또는 EMBED_DELAY_MS 증가를 검토하세요.`);
      }
      throw err;
    }
  }
}

// 여러 문자열을 EMBED_BATCH_SIZE 개씩 나눠 "순차" 임베딩. 배치 사이에 EMBED_DELAY_MS 지연.
// 반환 순서는 입력 순서와 동일.
async function embedBatch(client: OpenAI, inputs: string[]): Promise<number[][]> {
  const out: number[][] = [];
  const totalBatches = Math.ceil(inputs.length / EMBED_BATCH_SIZE);

  for (let i = 0; i < inputs.length; i += EMBED_BATCH_SIZE) {
    const batchNo = Math.floor(i / EMBED_BATCH_SIZE) + 1;
    const chunk = inputs.slice(i, i + EMBED_BATCH_SIZE);

    // 진단: 실제 호출하는 모델명 + 이번 요청의 input 개수.
    console.log(`[diag] embeddings.create → model=${EMBEDDING_MODEL}, count=${chunk.length}`);

    const vecs = await embedChunk(client, chunk);
    out.push(...vecs);
    console.log(`[embed] batch ${batchNo}/${totalBatches} (${chunk.length}개) ok / 누적 ${out.length}개 완료`);

    // 마지막 배치가 아니면 TPM 한도 회피용 지연.
    if (i + EMBED_BATCH_SIZE < inputs.length && EMBED_DELAY_MS > 0) {
      await sleep(EMBED_DELAY_MS);
    }
  }
  return out;
}

async function embedOne(client: OpenAI, input: string): Promise<number[]> {
  const [vec] = await embedBatch(client, [input]);
  return vec;
}

// ──────────────────────────────────────────────────────────────────────────
// 3. 메인
// ──────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const openai = makeOpenAI();
  const supabase = makeSupabase();

  // (1) 데이터 로드
  if (!fs.existsSync(TERMS_PATH)) {
    throw new Error(`용어 파일이 없습니다: ${TERMS_PATH}`);
  }
  const allTerms = JSON.parse(fs.readFileSync(TERMS_PATH, "utf8")) as Term[];
  if (!Array.isArray(allTerms) || allTerms.length === 0) {
    throw new Error("data/oop-terms.json 이 비어있거나 배열이 아닙니다.");
  }

  // 진단 테스트 모드: SEED_TEST=1 이면 맨 앞 1개만 임베딩(배치가 429의 원인인지 격리).
  // 이 모드에서는 DB delete/insert 와 검증을 건너뛰고, 임베딩 호출만 찔러본다.
  const TEST_MODE = process.env.SEED_TEST === "1";
  const terms = TEST_MODE ? allTerms.slice(0, 1) : allTerms;
  if (TEST_MODE) {
    console.log(`[diag] SEED_TEST=1 → 맨 앞 1개만 임베딩 테스트 (DB 적재/검증 생략): "${terms[0].term}"`);
  }
  console.log(`📖 용어 ${terms.length}개 로드: ${path.relative(ROOT, TERMS_PATH)}`);

  // (2) content 생성 + 배치 임베딩
  const contents = terms.map(buildContent);
  console.log(`🧠 OpenAI ${EMBEDDING_MODEL} 로 ${contents.length}개 임베딩 중...`);
  const embeddings = await embedBatch(openai, contents);
  console.log(`   임베딩 완료 (${embeddings.length}개 × ${EMBEDDING_DIM}차원)`);

  // 테스트 모드는 여기서 종료: 임베딩 호출이 성공하는지만 확인하고 DB 는 건드리지 않는다.
  if (TEST_MODE) {
    console.log('[diag] SEED_TEST=1 → 임베딩 호출 성공. DB 적재/검증은 생략하고 종료합니다.');
    return;
  }

  const rows: TermRow[] = terms.map((t, i) => ({
    term: t.term,
    aliases: t.aliases,
    misheard: t.misheard,
    definition: t.definition,
    content: contents[i],
    embedding: embeddings[i],
  }));

  // (3) 재실행 가능하게: 기존 데이터 전체 삭제 후 insert.
  //     (truncate RPC 가 없으므로, 항상 참인 조건으로 delete)
  console.log("🧹 oop_terms 기존 데이터 삭제...");
  const { error: delErr } = await supabase.from("oop_terms").delete().not("term", "is", null);
  if (delErr) throw new Error(`기존 데이터 삭제 실패: ${delErr.message}`);

  // (4) insert
  console.log("⬆️  oop_terms 에 insert...");
  const { data: inserted, error: insErr } = await supabase
    .from("oop_terms")
    .insert(rows)
    .select("term");
  if (insErr) throw new Error(`insert 실패: ${insErr.message}`);

  const insertedCount = inserted?.length ?? 0;
  console.log(`✅ 적재 완료: ${insertedCount}개 행`);

  // ──────────────────────────────────────────────────────────────────────
  // (5) 검증: "다양성"(다형성의 오인식) 을 임베딩해서 match_oop_terms 로 top-3 조회.
  //     1위가 "다형성" 이면 오인식 교정 RAG 가 제대로 동작하는 것.
  // ──────────────────────────────────────────────────────────────────────
  console.log(`\n🔎 검증: "${VERIFY_QUERY}" (다형성의 오인식) → match_oop_terms top-${VERIFY_TOP_K}`);
  const queryEmbedding = await embedOne(openai, VERIFY_QUERY);

  const { data: matches, error: matchErr } = await supabase.rpc("match_oop_terms", {
    query_embedding: queryEmbedding,
    match_count: VERIFY_TOP_K,
  });
  if (matchErr) throw new Error(`match_oop_terms 호출 실패: ${matchErr.message}`);

  const results = (matches ?? []) as Array<{
    term?: string;
    aliases?: string[];
    definition?: string;
    similarity?: number;
  }>;

  if (results.length === 0) {
    console.log("   ⚠️  결과가 없습니다. match_oop_terms 함수/데이터를 확인하세요.");
  } else {
    results.forEach((r, i) => {
      const sim = typeof r.similarity === "number" ? r.similarity.toFixed(4) : "-";
      console.log(`   ${i + 1}. ${r.term ?? "(term 없음)"}  (similarity ${sim})`);
      if (r.definition) console.log(`      ${r.definition}`);
    });

    const top1 = results[0]?.term;
    if (top1 === "다형성") {
      console.log('\n🎉 검증 성공: 1위가 "다형성" — 오인식 교정 RAG 검색이 정상 동작합니다.');
    } else {
      console.log(`\n⚠️  검증 주의: 1위가 "${top1}" 입니다("다형성" 기대). 데이터/함수를 점검하세요.`);
    }
  }
}

main().catch((err) => {
  console.error("\n❌ 실행 중 치명적 오류:", err instanceof Error ? err.message : err);
  process.exit(1);
});
