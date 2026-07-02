import os, sys, json, base64, time, re
import fitz
from anthropic import Anthropic

client = Anthropic()
MODEL = "claude-sonnet-4-6"

PDF_DIR = sys.argv[1] if len(sys.argv) > 1 else "pdfs"
OUT_DIR = sys.argv[2] if len(sys.argv) > 2 else "pdf_analysis"
MAX_PAGES = int(sys.argv[3]) if len(sys.argv) > 3 else 0  # 0 = 전체
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(f"{OUT_DIR}/pages", exist_ok=True)

PROMPT = """이 페이지는 대학 정보통신공학(데이터 커뮤니케이션) 강의 슬라이드다.
두 가지를 해라.

1) description: 이 페이지 내용을 한국어로 3~6문장 설명. 그림/다이어그램/표 안의 라벨과 용어도 반드시 포함.

2) terms: 이 페이지에 나오는 전문 용어를 추출. 각 항목:
   - canonical: 표준 한국어 표기 (한국어 정착 용어가 없으면 영어 원어)
   - english: 영어 원어 (약어면 풀네임도)
   - definition: 한 문장 정의
   - category: 소분류 (예: 프로토콜계층, 전송매체, 오류제어 등)

반드시 아래 JSON만 출력. 다른 텍스트 절대 금지:
{"description":"...","terms":[{"canonical":"...","english":"...","definition":"...","category":"..."}]}
용어가 없으면 terms는 빈 배열."""

def salvage(txt):
    terms = []
    for m in re.finditer(r'\{[^{}]*"canonical"[^{}]*\}', txt):
        try:
            terms.append(json.loads(m.group()))
        except Exception:
            pass
    desc = ""
    dm = re.search(r'"description"\s*:\s*"([^"]*)"', txt)
    if dm: desc = dm.group(1)
    return {"description": desc, "terms": terms}

def analyze_page(png_b64, page_no):
    last_txt = ""
    for attempt in range(4):
        try:
            resp = client.messages.create(
                model=MODEL, max_tokens=4000,
                messages=[{"role":"user","content":[
                    {"type":"image","source":{"type":"base64","media_type":"image/png","data":png_b64}},
                    {"type":"text","text":PROMPT},
                ]}],
            )
            last_txt = resp.content[0].text.strip()
            last_txt = re.sub(r"^```json|^```|```$", "", last_txt, flags=re.MULTILINE).strip()
            return json.loads(last_txt)
        except json.JSONDecodeError:
            recovered = salvage(last_txt)
            if recovered["terms"]:
                print(f"    p.{page_no} 부분복구: 용어 {len(recovered['terms'])}개")
                return recovered
            time.sleep(3 * (attempt + 1))
        except Exception as e:
            print(f"    p.{page_no} 재시도 {attempt+1}/4: {e}")
            time.sleep(3 * (attempt + 1))
    print(f"    !! p.{page_no} 완전실패")
    return {"description":"[실패]","terms":[]}

pdfs = sorted([f for f in os.listdir(PDF_DIR) if f.lower().endswith(".pdf")])
print(f"PDF {len(pdfs)}개 발견" + (f" (페이지 {MAX_PAGES}개만)" if MAX_PAGES else "") + "\n")

all_terms = []
failed_pages = []
for pdf_name in pdfs:
    chap = os.path.splitext(pdf_name)[0]
    doc = fitz.open(os.path.join(PDF_DIR, pdf_name))
    n = len(doc) if MAX_PAGES == 0 else min(MAX_PAGES, len(doc))
    print(f"=== {pdf_name} ({n}/{len(doc)}p) ===")
    page_texts = []
    for i in range(n):
        page = doc[i]
        pix = page.get_pixmap(dpi=120)
        png_b64 = base64.b64encode(pix.tobytes("png")).decode()
        result = analyze_page(png_b64, i + 1)
        if result["description"] == "[실패]":
            failed_pages.append(f"{chap} p.{i+1}")
        page_texts.append(f"[p.{i+1}] {result.get('description','')}")
        for t in result.get("terms", []):
            t["source_chapter"] = chap
            t["source_page"] = i + 1
            all_terms.append(t)
        print(f"  p.{i+1} 완료 (용어 {len(result.get('terms',[]))}개)")
    with open(f"{OUT_DIR}/pages/{chap}.txt", "w") as f:
        f.write("\n\n".join(page_texts))
    doc.close()

with open(f"{OUT_DIR}/terms_raw.json", "w") as f:
    json.dump(all_terms, f, ensure_ascii=False, indent=2)
print(f"\n완료 → {OUT_DIR}/terms_raw.json (용어 {len(all_terms)}개)")
print("완전실패 페이지 없음" if not failed_pages else f"완전실패 {len(failed_pages)}개: {failed_pages}")
