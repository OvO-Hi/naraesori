import json, collections, re

pairs = json.load(open("error_pairs_all.json"))
terms = json.load(open("pdf_analysis/terms_embedded.json"))

def norm(s):
    return re.sub(r"\s+", " ", (s or "").strip())

def canon_key(c):
    # "애플리케이션 계층 (Applications layer)" → "애플리케이션 계층"
    return norm(re.split(r"\s*\(", c)[0])

# 1) 오류쌍 정리: variant==canonical 제거, 공백정리
clean = []
dropped_same = 0
for p in pairs:
    v = norm(p.get("variant"))
    c = norm(p.get("canonical"))
    ck = canon_key(c)
    if not v or not ck:
        continue
    if v == ck or v == c:   # variant가 정답과 같으면 오탐
        dropped_same += 1
        continue
    clean.append({"canonical": ck, "variant": v,
                  "context": norm(p.get("context")), "lecture": p.get("lecture")})

# 2) canonical별로 variant 묶기 (관측된 오류)
by_canon = collections.defaultdict(lambda: {"variants": collections.Counter(),
                                            "examples": {}, "lectures": set()})
for p in clean:
    ck = p["canonical"]
    by_canon[ck]["variants"][p["variant"]] += 1
    by_canon[ck]["lectures"].add(p["lecture"])
    # variant별 대표 context 하나 보관 (데모용)
    if p["variant"] not in by_canon[ck]["examples"] and p["context"]:
        by_canon[ck]["examples"][p["variant"]] = p["context"]

# 3) PDF 용어 메타(영어/정의/임베딩)와 병합
term_by_key = {canon_key(t["canonical"]): t for t in terms}

dictionary = []
for ck, info in by_canon.items():
    meta = term_by_key.get(ck, {})
    variants = [{"text": v, "count": n, "example": info["examples"].get(v, "")}
                for v, n in info["variants"].most_common()]
    dictionary.append({
        "canonical": ck,
        "english": meta.get("english", ""),
        "definition": meta.get("definition", ""),
        "category": meta.get("category", ""),
        "variants": variants,
        "observed_lectures": sorted(info["lectures"]),
        "in_pdf": ck in term_by_key,
        "embedding": meta.get("embedding"),  # 6단계 적재용
    })

# variant 총합 많은 순 정렬
dictionary.sort(key=lambda d: -sum(v["count"] for v in d["variants"]))

json.dump(dictionary, open("naraesori_dictionary.json", "w"), ensure_ascii=False, indent=2)

# 리포트
total_variants = sum(len(d["variants"]) for d in dictionary)
matched = sum(1 for d in dictionary if d["in_pdf"])
print(f"원본 오류쌍: {len(pairs)}")
print(f"오탐 제거(variant=정답): {dropped_same}")
print(f"유효 쌍: {len(clean)}")
print(f"→ 사전 표제어: {len(dictionary)}개 (PDF매칭 {matched}, 미매칭 {len(dictionary)-matched})")
print(f"→ 고유 variant: {total_variants}개")
print(f"\n=== variant 많은 top 15 ===")
for d in dictionary[:15]:
    vs = ", ".join(v["text"] for v in d["variants"][:4])
    print(f"{d['canonical']} ({d['english'][:25]}) ← {vs}")
