// scripts/test-correct.ts
//
// 자막 교정 로직 스모크 테스트. 로컬 서버(localhost:3000) 없이 correctSubtitle 을 직접 호출한다.
// (route 와 동일한 로직 모듈을 공유하므로 서버 기동 불필요)
//
// 실행: npm run test:correct

import * as path from "node:path";
import * as dotenv from "dotenv";

// .env.local 을 먼저 로드해야 correctSubtitle 안에서 클라이언트 생성 시 키가 잡힌다.
dotenv.config({ path: path.join(process.cwd(), ".env.local"), override: true });

import { correctSubtitle } from "../app/api/correct/correct";

interface Sample {
  text: string;
  expect: string;
}

// 정보통신공학 도메인 사전(naraesori_terms)의 실제 오류쌍
const SAMPLES: Sample[] = [
  { text: "센더 소울스 호스트에서 데스티니션 호스트까지 전달됩니다", expect: "source host / destination host 관련 교정" },
  { text: "고백에는 ARQ 방식으로 재전송합니다", expect: "고백에는 → Go-Back-N" },
  { text: "이런 경우 큐, EU, ING 딜레이가 커집니다", expect: "큐, EU, ING 딜레이 → Queueing delay" },
  { text: "네로 밴드 IoT는 저전력 통신에 쓰입니다", expect: "네로 밴드 IoT → NB-IoT" },
  { text: "오늘 날씨가 좋습니다", expect: "교정 없음 (changes 빈 배열)" },
];

async function main(): Promise<void> {
  console.log(`자막 교정 스모크 테스트 — 샘플 ${SAMPLES.length}개\n`);

  for (let i = 0; i < SAMPLES.length; i++) {
    const { text, expect } = SAMPLES[i];
    console.log(`── [${i + 1}/${SAMPLES.length}] ─────────────────────────────`);
    console.log(`원문:   ${text}`);
    console.log(`기대:   ${expect}`);
    try {
      const r = await correctSubtitle(text);
      console.log(`교정:   ${r.corrected}`);
      console.log(
        `변경:   ${r.changes.length === 0 ? "(없음)" : r.changes.map((c) => `${c.from}→${c.to}`).join(", ")}`,
      );
      console.log(`후보:   ${r.candidates.join(", ")}`);
    } catch (err) {
      console.error(`❌ 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error("\n❌ 실행 중 치명적 오류:", err instanceof Error ? err.message : err);
  process.exit(1);
});
