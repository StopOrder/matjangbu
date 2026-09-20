# 맞장부 (matjangbu) — 종교단체 헌금 이름 맞춤·기록 도우미, 온디바이스 sLLM

봉투·통장에 적힌 이름을 신도 명부와 맞추고, 매주 기록하고, 연말에 합산한다. 단체 PC 안에서 끝나고 자료는 밖으로 나가지 않는다.
언어모델은 규칙이 못 푼 줄의 후보를 세우는 **한 칸**만 맡고, 확정은 사람이 한다. 사람이 고른 답은 별칭 사전에 쌓여 다음 주부터 자동이 된다.

> **시제품**이다(모두의창업 시즌2 도전 과제 I-009). 사이트·문서의 숫자는 전부 직접 잰 값이다 — 재지 않은 숫자는 적지 않는다.
> `samples/`는 전부 가공 데이터다. 실제 단체 자료는 들어 있지 않고, 체험 인스턴스는 파일 업로드를 받지 않는다.

사이트: <https://stoporder.github.io/matjangbu/> — `/` 랜딩 · `/try/` 앱 화면(체험) · `/download/` 설치 · `/phone/` 폐폰 실측

## 무엇을 하나

```
은행 CSV · 봉투 입력 → [규칙 2단] → [모델 3단] → [확인 큐] → 사람 확정 → [기록] 주간·개인별·연말
                        결정론        후보만        사람        별칭 학습     결정론 · CSV
```

- **규칙 2단**: 별칭 사전 · 완전 일치 · 띄어쓰기 · 한자 성씨 · 헌금 종류 분리(「박민수십일조」) · 옛 이름 · 세대주 이름 · 자모 유사도(임계 0.85).
- **모델 3단**: 규칙이 못 푼 줄만. 상위 후보 5명·같은 세대·과거 확정 이력을 주고 후보 순서·근거·사유(가족/회사/오타/개명/모름)를 JSON 스키마로 받는다. **결과는 항상 확인 큐**. 동명이인은 모델을 거치지 않고 곧장 사람에게 간다.
- **확인 큐**: 후보 버튼 · 명부에서 직접 고르기 · 새 이름 등록 · 보류 · 제외 · 되돌리기 · 「지금 다시 재기」(실제 모델).
- **기록**: 주간 명단(사람 손이 닿은 줄부터) · 개인별 누적 · 연말 합산(미확정 따로) · UTF-8 BOM CSV.

| 폴더 | 무엇 |
|---|---|
| `engine/` | 엔진 — 명부·별칭·은행 CSV·3단 대조·확인 큐·기록·CLI. 파이썬 표준 라이브러리만 |
| `web/` | 로컬 웹 UI 서버 — 정적 + API + SSE, 체험 샌드박스, 기록 생성기(`web.record`) |
| `ui/` | `/try` 앱 화면의 React + shadcn 소스 — `npm run build` 가 `site/try/` 로 낸다. 실행 시점 의존은 없다(빌드 도구) |
| `site/` | 제품 사이트 — 정적 HTML, 외부 자원 0. `try/`는 인스턴스 → `recorded.json` 삼중 폴백 |
| `bench/` | 3단 실측(30건) — 노트북·갤럭시 A31 결과는 `bench/results/` |
| `samples/` | 가공 명부 60명·입금 4주·봉투·벤치 줄 30건·정답 — `tools/make_samples.py`가 만든다 |
| `tests/` | pytest — 모델 서버 없이 돈다(모델 출력은 주입) |
| `tools/` | 샘플 생성기 · 사이트 검증(Playwright) · 스크린샷 · 실측표 채우기 |
| `docs/` | 설계·계획·운영 절차 |

## 실행 방법

요구: Python 3.10+, [llama.cpp](https://github.com/ggml-org/llama.cpp)의 `llama-server`, 모델 파일 Qwen2.5-1.5B-Instruct Q4_K_M(Apache-2.0). pip 패키지 0. (npm 은 `/try` 화면의 빌드 도구이고 실행 시점 의존이 아니다.)

```bash
# 0) 모델 서버 — 가중치는 저장소에 없다
python3 -m engine serve --model ~/models/qwen1.5b.gguf --run          # llama-server … --port 8107

# 1) 작업공간 — 명부 CSV(id,이름,구역,세대,옛이름)
python3 -m engine init ~/맞장부 --roster samples/roster.csv

# 2) 은행 CSV 를 맞춘다 — 남은 줄은 확인 큐에
python3 -m engine import ~/맞장부 samples/weeks/2026-W10.csv --week 2026-W10
python3 -m engine list ~/맞장부 --held
python3 -m engine confirm ~/맞장부 <줄id> --person p19               # 별칭 사전에 쌓인다
python3 -m engine report ~/맞장부 year --year 2026

# 웹 화면 — 로컬 모드(설치된 PC) 또는 체험 모드(샘플 4주, 방문자별 샌드박스)
python3 -m web --workspace ~/맞장부        # http://127.0.0.1:8108/try/
python3 -m web --demo
```

```bash
# 화면(/try)을 고쳤으면 다시 빌드해 site/try/ 에 넣는다 — 파이썬은 site/ 를 그대로 서빙한다
cd ui && npm ci && npm run build      # Node 26 · 산출물(site/try/)은 커밋한다 · 개발 중엔 npm run dev(5173, API 는 8108 로 프록시)
```

모델 없이 규칙만 시험하려면 `--no-model`. 로컬 모드는 인증이 없으니 `127.0.0.1`에만 연다.

### 테스트

```bash
python3 -m venv .venv && .venv/bin/pip install pytest
.venv/bin/python -m pytest -q          # 모델 서버 불필요
NODE_PATH=<playwright 있는 node_modules> node tools/verify_site.cjs --base http://127.0.0.1:8123 --expect-banner   # 외부 요청 0
```

### 실측

```bash
bench/bench.sh --model qwen --threads 4 --device laptop-i7-10750H     # → bench/results/*.md
python3 tools/bench_table.py                                           # 사이트 실측표를 결과 파일에서 채운다
python3 -m web.record --device "…" --model-name "…" --threads 4       # 체험용 기록(recorded.json)
```

## 샘플에 대해

`samples/`의 명부 60명·입금 4주·봉투 12줄·벤치 줄 30건은 `tools/make_samples.py`가 표에서 만든 **가공 데이터**다. 이름·구역·상호(「우리상사」「대성정밀」「(주)한빛건설」)·금액은 전부 지어낸 값이며 실존 개인·단체 정보는 들어 있지 않다. 가족 명의·회사 명의·한자 표기·종류 병기·개명·오타·동명이인 같은 「지저분함」은 일부러 넣은 것이다.

## 나비에서 가져온 것

이 저장소는 [나비(nabi-core)](https://github.com/kingcheee/nabi-core)(Apache-2.0, Copyright 2026 Kim Jiwoo)의 구조를 따른다. 웹서버의 HTTP·세션·SSE·정적 서빙 뼈대, 체험 샌드박스, llama-server 호출 방식, append-only 대장, 디자인 시스템(`site/assets/app.css`), 앱 화면 골격을 가져왔다. 출처는 `NOTICE`에.

## 라이선스

코드·문서·샘플은 **Apache License 2.0** — `LICENSE`. Copyright 2026 정지명 (Jimyeong Jeong).
모델 가중치는 저장소에 없으며 각 모델의 라이선스를 따른다(Qwen2.5-1.5B-Instruct: Apache-2.0). llama.cpp 는 MIT.

Pretendard 글꼴은 SIL OFL-1.1(`site/assets/fonts/pretendard/LICENSE.txt`). `/try` 화면의 React·radix-ui·lucide-react·Tailwind 는 MIT — 빌드 산출물에 함께 들어간다.
