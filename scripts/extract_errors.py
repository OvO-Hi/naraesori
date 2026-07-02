import json, sys, time, os, re
import numpy as np
from openai import OpenAI
from anthropic import Anthropic

oai = OpenAI()
anthro = Anthropic()
CHAT_MODEL = "claude-sonnet-4-6"

# 정답 용어 + 임베딩 로드
terms = json.load(open("pdf_analysis/terms_embedded.json"))
T_EMB = np.array([t["embedding"] for t in terms], dtype=np.float32)
T_EMB /= (np.linalg.norm(T_EMB, axis=1, keepdims=True) + 1e-9)

LECTURES = sys.argv[1] if len(sys.argv) > 1 else "all"  # "0,1,2" 또는 "all"
OUT = sys.argv[2] if len(sys.argv) > 2 else "error_pairs.json"
CHUNK_CHARS = 1400   # 청크 길이(글자)
OVERLAP = 200
TOPK = 25            # 청크당 참고할 정답 용어 수

if LECTURES == "all":
    nums = list(range(25))
else:
    nums = [int(x) for x in LECTURES.split(",")]

def embed(text):
    for a in range(5):
        try:
            r = oai.embeddings.create(model="text-embedding-3-small", input=[text])
            return np.array(r.data[0].embedding, dtype=np.float32)
        except Exception as e:
            time.sleep(2*(a+1))
    raise RuntimeError("embed fail")

def topk_terms(chunk_text, k=TOPK):
    q = embed(chunk_text); q /= (np.linalg.norm(q)+1e-9)
    sims = T_EMB @ q
    idx = np.argsort(-sims)[:k]
    return [terms[i] for i in idx]

def find_errors(chunk_text, cand):
    lst = "\n".join(f"- {t['canonical']} ({t['english']})" for t in cand)
    prompt = f"""아래는 대학 정보통신공학 강의의 STT(음성인식) 전사본 일부다. 교수가 영어 용어를 한국식으로 발음해서 whisper가 음차·오인식한 오류가 섞여 있다.

[정답 용어 후보]
{lst}

[STT 전사본]
{chunk_text}

전사본에서 위 정답 용어가 잘못 표기된 부분을 찾아라. 예: "소울스"는 source의 오인식, "모듈라이제이션"은 modularization의 음차.
JSON 배열로만 출력(다른 텍스트 금지):
[{{"canonical":"정답용어(후보목록에서)","variant":"전사본에 실제 나온 틀린표기","context":"그 표기가 든 짧은 구절"}}]
확실한 것만. 후보에 없는 용어는 만들지 마라. 없으면 []."""
    for a in range(4):
        try:
            r = anthro.messages.create(model=CHAT_MODEL, max_tokens=2000,
                messages=[{"role":"user","content":prompt}])
            txt = re.sub(r"^```json|^```|```$","",r.content[0].text.strip(),flags=re.M).strip()
            return json.loads(txt)
        except json.JSONDecodeError:
            # 잘린 경우 완성된 객체만 건지기
            got=[]
            for m in re.finditer(r'\{[^{}]*"variant"[^{}]*\}', txt):
                try: got.append(json.loads(m.group()))
                except: pass
            if got: return got
            time.sleep(2*(a+1))
        except Exception as e:
            print(f"    재시도 {a+1}: {e}"); time.sleep(2*(a+1))
    return []

def chunks_of(text):
    out=[]; i=0
    while i < len(text):
        out.append(text[i:i+CHUNK_CHARS]); i += CHUNK_CHARS - OVERLAP
    return out

all_pairs=[]
for n in nums:
    path=f"transcripts/lecture{n}_transcript.txt"
    if not os.path.exists(path):
        path=f"lecture{n}_transcript.txt"
    if not os.path.exists(path):
        print(f"lecture{n} 전사본 없음, 건너뜀"); continue
    text=open(path).read()
    chs=chunks_of(text)
    print(f"=== lecture{n} ({len(chs)}청크) ===")
    for ci,ch in enumerate(chs):
        cand=topk_terms(ch)
        pairs=find_errors(ch,cand)
        for p in pairs:
            p["lecture"]=n
        all_pairs.extend(pairs)
        print(f"  청크 {ci+1}/{len(chs)}: 오류 {len(pairs)}개 (누적 {len(all_pairs)})")

json.dump(all_pairs, open(OUT,"w"), ensure_ascii=False, indent=2)
print(f"\n완료 → {OUT} (오류쌍 {len(all_pairs)}개)")
