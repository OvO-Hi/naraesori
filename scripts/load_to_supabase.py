import json, os
from supabase import create_client

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

d = json.load(open("naraesori_dictionary.json"))
d = [t for t in d if t.get("embedding")]
print(f"적재 대상 {len(d)}개")

rows = [{
    "canonical": t["canonical"],
    "english": t.get("english",""),
    "definition": t.get("definition",""),
    "category": t.get("category",""),
    "variants": t.get("variants",[]),
    "observed_lectures": t.get("observed_lectures",[]),
    "embedding": t["embedding"],
} for t in d]

BATCH = 100
for i in range(0, len(rows), BATCH):
    sb.table("naraesori_terms").upsert(rows[i:i+BATCH], on_conflict="canonical").execute()
    print(f"  {min(i+BATCH, len(rows))}/{len(rows)}")

res = sb.table("naraesori_terms").select("id", count="exact").execute()
print(f"테이블 총 {res.count}행")
print("적재 완료")
