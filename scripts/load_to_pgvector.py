import json, os, psycopg2
from psycopg2.extras import execute_values

d = json.load(open("naraesori_dictionary.json"))
d = [t for t in d if t.get("embedding")]  # 임베딩 있는 것만
print(f"적재 대상 {len(d)}개")

conn = psycopg2.connect(
    host=os.environ["SUPABASE_DB_HOST"],
    port=os.environ.get("SUPABASE_DB_PORT", "5432"),
    dbname=os.environ.get("SUPABASE_DB_NAME", "postgres"),
    user=os.environ.get("SUPABASE_DB_USER", "postgres"),
    password=os.environ["SUPABASE_DB_PASSWORD"],
    sslmode="require",
)
cur = conn.cursor()

rows = []
for t in d:
    emb = "[" + ",".join(str(x) for x in t["embedding"]) + "]"
    rows.append((
        t["canonical"], t.get("english",""), t.get("definition",""),
        t.get("category",""), json.dumps(t.get("variants",[]), ensure_ascii=False),
        t.get("observed_lectures",[]), emb,
    ))

execute_values(cur, """
    insert into naraesori_terms
      (canonical, english, definition, category, variants, observed_lectures, embedding)
    values %s
    on conflict (canonical) do update set
      english=excluded.english, definition=excluded.definition,
      category=excluded.category, variants=excluded.variants,
      observed_lectures=excluded.observed_lectures, embedding=excluded.embedding
""", rows, template="(%s,%s,%s,%s,%s,%s,%s::vector)")

conn.commit()
cur.execute("select count(*) from naraesori_terms")
print(f"테이블 총 {cur.fetchone()[0]}행")
cur.close(); conn.close()
print("적재 완료")
