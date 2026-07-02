import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const openai = new OpenAI();

const CHUNK_DIR = process.argv[2];
const OUT = process.argv[3] || "transcript.json";
const CHUNK_SECONDS = 600;

if (!CHUNK_DIR) {
  console.error("사용법: node scripts/transcribe.mjs <청크폴더> [출력.json]");
  process.exit(1);
}

const files = fs.readdirSync(CHUNK_DIR).filter(f => f.endsWith(".mp3")).sort();
if (files.length === 0) { console.error(`${CHUNK_DIR}에 mp3 없음`); process.exit(1); }

async function withRetry(fn, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      const wait = 3000 * (i + 1);
      console.log(`  재시도 ${i + 1}/${tries} (${wait}ms 후): ${e.message}`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw new Error("재시도 전부 실패");
}

let fullText = "";
const segments = [];

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const offset = i * CHUNK_SECONDS;
  process.stdout.write(`[${i + 1}/${files.length}] ${file} ... `);

  const resp = await withRetry(() =>
    openai.audio.transcriptions.create({
      file: fs.createReadStream(path.join(CHUNK_DIR, file)),
      model: "whisper-1",
      response_format: "verbose_json",
    })
  );

  fullText += resp.text.trim() + "\n";
  for (const s of resp.segments ?? []) {
    segments.push({
      start: +(s.start + offset).toFixed(2),
      end: +(s.end + offset).toFixed(2),
      text: s.text.trim(),
    });
  }
  console.log("완료");
}

fs.writeFileSync(OUT, JSON.stringify({ text: fullText, segments }, null, 2));
fs.writeFileSync(OUT.replace(/\.json$/, ".txt"), fullText);
console.log(`\n완료 → ${OUT} (구간 ${segments.length}개)`);
