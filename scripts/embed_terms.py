import json, time, os
from openai import OpenAI

client = OpenAI()
raw = json.load(open("pdf_analysis/terms_raw.json"))

# canonical 기준 병합 (중복 제거, 출처/영어/정의 통합)
merged = {}
for t in raw:
    key = t["canonical"].strip()
    if key not in merged:
        merged[key] = {
            "canonical": key,
            "english": t.get("english", ""),
            "definition": t.get("definition", ""),
            "category": t.get("category", ""),
            "sources": set(),
        }
    merged[key]["sources"].add(t["source_chapter"].split(")")[0].split("(")[-1])

terms = list(merged.values())
for t in terms:
    t["sources"] = sorted(t["sources"])
print(f"고유 용어 {len(terms)}개 임베딩 시작")

def embed_batch(texts):
    for attempt in range(5):
        try:
            r = client.embeddings.create(model="text-embedding-3-small", input=texts)
            return [d.embedding for d in r.data]
        except Exception as e:
            print(f"  재시도 {attempt+1}/5: {e}")
            time.sleep(2 * (attempt + 1))
    raise RuntimeError("임베딩 실패")

BATCH = 100
for i in range(0, len(terms), BATCH):
    chunk = terms[i:i+BATCH]
    texts = [f"{t['canonical']} {t['english']} {t['definition']}" for t in chunk]
    embs = embed_batch(texts)
    for t, e in zip(chunk, embs):
        t["embedding"] = e
    print(f"  {min(i+BATCH, len(terms))}/{len(terms)}")

json.dump(terms, open("pdf_analysis/terms_embedded.json", "w"), ensure_ascii=False)
print(f"완료 → terms_embedded.json ({len(terms)}개)")
