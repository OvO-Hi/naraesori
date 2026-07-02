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

const SAMPLES: Sample[] = [
  { text: "오늘은 다양성에 대해 배웁니다", expect: "다양성 → 다형성" },
  { text: "캡술화는 데이터를 숨기는 것입니다", expect: "캡술화 → 캡슐화" },
  { text: "오늘 날씨가 좋습니다", expect: "교정 없음 (changes 빈 배열)" },
];

async function main(): Promise<void> {
  console.log("자막 교정 스모크 테스트 — 샘플 3개\n");

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
