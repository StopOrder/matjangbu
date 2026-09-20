# 맞장부(matjangbu) 설계 — 헌금 이름 맞춤·기록 도우미를 나비 방식으로 공개 배포

2026-09-20 · 정지명 · 사용자 승인: 접근 1(나비 구조 이식) + 봉투 입력 포함 + 체험 인스턴스는 첫 판부터(A안) · 이름 「맞장부」(잠정명)

아이디어 정본: `~/Projects/02-hackathon/modoo-startup-2026/docs/application-draft.md`(v3.1, I-009)
참고 구현: `~/workspace/02-sandbox/nabi-core`(kingcheee/nabi-core, Apache-2.0) · 정적 MVP `~/Projects/02-hackathon/modoo-startup-2026/mvp/01-헌금이름맞춤/app`

## 0. 목표와 성공 기준

**목표.** 신청서가 말한 제품(단체 PC 안에서 봉투·통장의 이름을 명부와 맞추고 기록·합산하는 도구)을 나비와 같은 모양으로 공개한다: 공개 저장소 + GitHub Pages 제품 사이트 + 살아 있는 체험 인스턴스 + 폐폰(갤럭시 A31) 실측표.

**성공 기준(전부 기계로 확인).**
1. `https://stoporder.github.io/matjangbu/` 네 경로(`/`·`/try/`·`/download/`·`/phone/`)가 200이고 외부 자원 요청이 0건이다.
2. `/try/`가 삼중 폴백으로 동작한다: 인스턴스가 살아 있으면 실제 API, 죽으면 `recorded.json` 읽기 전용 + 앰버 배너.
3. `/phone/`에 A31(SM-A315N)에서 잰 실측표가 있고, 사이트의 모든 숫자는 `bench/results/`나 신청서 수치 대장에 근거가 있다.
4. `python3 -m pytest tests/ -q` 전부 통과(모델 서버 없이).
5. 체험 인스턴스에서 「지금 다시 재기」가 실제 모델을 돌리고 진행이 SSE로 흐른다.

**하지 않는 것(v0).** 암호화 백업(「준비 중」), 설치기·zip(「준비 중」), 은행 자동 연동, 손글씨 봉투 인식, 인증, 실제 단체 자료 취급. 실제 자료는 한 줄도 저장소·인스턴스에 넣지 않는다.

## 1. 전체 구조

```
matjangbu/                  StopOrder/matjangbu · Apache-2.0 · 로컬 ~/Projects/03-personal/matjangbu
  engine/    파이썬 표준 라이브러리만 — 명부·별칭·CSV·3단 대조·확인 큐·기록·CLI
  web/       server.py(정적+API+SSE+CORS) · demo.py(방문자 샌드박스) · record.py(recorded.json 생성기)
  site/      index.html(랜딩) · try/(앱 화면·recorded.json) · download/ · phone/ · assets/app.css
  bench/     bench.sh · match_all.py — A31·노트북 실측
  samples/   합성 명부·입금 4주·봉투·정답 (전부 가공) · tools/make_samples.py 가 만든다
  tests/     pytest — 모델은 주입, 서버는 진짜 HTTP
  tools/     make_samples.py · site_shots.js · verify_site.mjs
  docs/      이 설계 · 계획 · design-notes.md
  NOTICE     나비 유래 코드 출처 표기 (Apache-2.0, Copyright 2026 Kim Jiwoo)
```

- 브랜치는 둘. `main`(코드)과 `gh-pages`(`site/` 사본, 빌드 없음). 나비의 비공개·공개 이중 저장소는 두지 않는다.
- 체험 인스턴스는 이 노트북: `llama-server`(포트 8107) + `python3 -m web --demo --port 8108 --cors-origin https://stoporder.github.io`, `tailscale funnel --bg 8108`로 HTTPS 노출. `site/try/index.html`의 `<meta name="matjangbu-api">`가 그 주소를 가리킨다.
- A31은 ssh(`-p 8022 u0_a280@100.74.136.5`)로 벤치만 돌린다. 서버 역할 없음, 인터넷 노출 없음.
- 의존성: 파이썬 3.10+ 표준 라이브러리, llama.cpp `llama-server`. pip 패키지 0(테스트는 pytest).

## 2. 작업공간과 데이터 (`engine/store.py`)

단체 하나 = 폴더 하나. 사람이 엑셀로 열고 고칠 것은 CSV, 대장은 append-only(나중 줄이 이긴다).

```
<작업공간>/
  명부.csv          id,이름,구역,세대,옛이름        ← 사람이 엑셀로 편집. UTF-8 BOM
  들어옴/           은행 CSV를 넣는 곳(로컬 모드는 화면 업로드도 같은 곳에 저장)
  내보내기/         주간 명단 · 개인별 누적 · 연말 합산 CSV (UTF-8 BOM)
  .matjangbu/
    aliases.json    {"정규화한 원문": {"person_id": "p19", "learned": "2026-03-08T10:00:00", "from": "l-abc123"}}
    lines.jsonl     줄 대장 append-only
    imports.jsonl   불러온 CSV 대장 {sha256, filename, week, date, n_lines, ts} — 같은 내용은 다시 넣지 않는다
```

**줄 레코드(`lines.jsonl`).**

| 필드 | 뜻 |
|---|---|
| `id` | `sha256(주차+원문+금액+순번)[:12]` |
| `week` · `date` | ISO 주차 `2026-W10` · 입금/봉투 날짜 |
| `raw` | 입금자명 원문(봉투는 사람이 친 이름) |
| `amount` | 정수 원 |
| `kind` | 헌금 종류(없으면 `""`) |
| `path` | `csv` \| `envelope` |
| `state` | `auto` 자동 확정 · `held` 확인 필요 · `confirmed` 사람이 골랐음 · `excluded` 제외 |
| `person_id` | 확정된 사람(없으면 `null`) |
| `how` | `완전일치` · `별칭사전` · `띄어쓰기` · `한자표기` · `종류분리` · `옛이름` · `유사도 0.92` · `동명이인` · `모델` · `사람` |
| `cands` | `[{person_id, why}]` 확인 큐 후보(근거 한 줄) |
| `reason` | 확인 사유 `dup` 동명이인 · `family` 가족 명의 · `company` 회사 명의 · `renamed` 개명 · `unknown` 모름 · `model_failed` 모델 미실행 |
| `model` | 3단 측정값 `{model, wall_s, prompt_n, pp_tps, tg_tps, raw, note}`(모델 안 탔으면 없음) |
| `ts` | 기록 시각 |

상태 전이: `held → confirmed`(사람이 고름) · `held → excluded`(제외) · `auto|confirmed → held`(되돌리기) · 모든 전이는 새 줄을 덧붙인다.

**명부.** `id`는 `p` + 3자리, 사람이 비우면 엔진이 채운다. `세대`는 가족 묶음 문자열(같으면 한 세대). `옛이름`은 쉼표로 여럿.

**은행 CSV.** v0는 두 벌만. (a) 헤더 자동 탐지: 첫 30줄 안에서 날짜·입금자(적요/보낸분/입금자명)·입금액 열을 이름으로 찾는다. (b) 실패하면 공용 3열 `날짜,입금자명,금액`. 인코딩은 UTF-8(BOM 허용)과 CP949를 차례로 시도. 출금 줄(출금액>0 또는 입금액 비어 있음)과 금액 0은 제외하고 그 수를 결과에 적는다. 실제 은행 양식은 1라운드 인터뷰에서 받아 추가한다.

## 3. 3단 대조 (`engine/match.py`)

MVP의 규칙(자모 분해·레벤슈타인·한자 이표기·종류 분리)을 파이썬으로 옮기고 3단만 실제 모델로 바꾼다.

- **정규화** `norm(s)`: 공백 제거 → 한자 성씨 표 치환(李→이 …) → 그대로. 임계 `SIM_THRESHOLD = 0.85`(화면에 표시).
- **1단(결정론).** 별칭 사전 → 완전 일치 → 띄어쓰기 제거 일치. 명부에 같은 이름이 둘 이상이면 `held/dup`(후보 = 동명이인 전부, 「새 이름으로 등록」 없음). 자동 확정 금지.
- **2단(결정론).** 한자 이표기 → 헌금 종류 접미어 분리(`kinds` 목록: 십일조·감사헌금·감사·주정헌금·주정·선교·건축·절기·맥추·추수, 긴 것부터) → 옛 이름 일치 → 자모 분해 레벤슈타인 유사도 ≥ 0.85이고 2위와 차이 > 0일 때만 자동(`how=유사도 0.xx`). 종류를 분리했으면 `kind`에 적는다.
- **3단(모델).** 남은 줄만. 입력: 원문, 규칙이 뽑은 상위 후보 5명(유사도 순, 구역·세대 포함), 후보와 같은 세대의 사람, 이 원문의 과거 확정 이력(별칭 사전·대장). 출력은 `json_schema`로 강제:

  ```json
  {"name_part": "박민수", "kind": "십일조", "relation": "family|company|typo|renamed|unknown",
   "candidates": [{"id": "p05", "why": "같은 세대"}, ...], "confidence": 0.0}
  ```

  temperature 0, `cache_prompt=false`, `n_predict` 160, timeout 300초. 스키마 거부 시 스키마 없이 1회 재시도(나비 `label.py` 방식). 후보 `id`가 명부에 없으면 버리고 note에 남긴다.
- **모델 결과는 항상 `held`.** 모델은 후보 순서·근거·사유(`reason`)만 만든다. 확정은 사람이 한다(신청서 「자동 확정 없이 후보 3명 제시가 기본값」).
- 모델 서버가 없거나 실패하면 규칙까지의 후보(유사도 상위 3)로 `held/unknown` + `model_failed` 표기. 파이프라인은 멈추지 않는다.
- 기본 모델 `Qwen2.5-1.5B-Instruct Q4_K_M`(Apache-2.0). HyperCLOVAX-SEED-1.5B는 라이선스가 자체 약관(`license: other`)이라 벤치 비교값으로만 싣고 기본값·배포 문구에 쓰지 않는다.

## 4. 확인 큐·확정·학습 (`engine/pipeline.py`)

- `import_csv(ws, csv_path|text, week, date, model_url)`: 파싱 → `imports.jsonl`에 sha256 기록(중복이면 건너뜀) → 줄마다 `match_one` → 대장에 붙인다. 모델 호출은 한 번에 한 줄, 진행은 제너레이터로 흘려 SSE가 받는다.
- `confirm(ws, line_id, person_id=None, new_person=None, kind=None)`: 후보를 고르면 `confirmed/how=사람`. `norm(raw) != 이름`이면 별칭 사전에 적립(다음 주 1단에서 끝난다). `new_person={name, group}`이면 명부에 행을 추가하고 그 사람으로 확정. `kind`를 주면 종류를 고친다.
- `hold(ws, line_id, why)` · `exclude(ws, line_id, why)` · `undo_last(ws)`: 마지막 사람 손 전이를 되돌린다(이전 상태 줄을 덧붙임; 별칭 적립도 되돌린다).
- `add_envelopes(ws, week, date, lines=[{name, kind, amount}], counted_total=None)`: 이름이 명부에 정확히 있으면 `confirmed/how=사람`, 동명이인이면 `held/dup`, 없으면 규칙 2단까지 돌려 `held`(모델 없음). `counted_total`을 주면 합계와의 차이를 결과에 적는다(검산).
- `rematch(ws, line_id, model_url)`: 그 줄의 3단만 다시 돌린다(체험의 「지금 다시 재기」).

## 5. 기록·내보내기 (`engine/report.py`)

대장에서 계산한다. 셋 다 합계 줄을 붙이고 CSV(UTF-8 BOM)로 `내보내기/`에 쓴다.

- **주간 명단** `week_list(ws, week)`: 사람 손이 닿은 줄(`confirmed`)부터, 그다음 `auto`, 마지막에 `held`·`excluded`는 별도 표. 열: 이름·구역·종류·금액·경로·근거.
- **개인별 누적** `person_totals(ws, year)`: 사람 × 종류 합계와 건수.
- **연말 합산** `year_summary(ws, year)`: 사람별 총액·건수·종류별 소계(기부금영수증 기초자료). `held`·`excluded`는 「미확정」 행으로 따로 합계.
- 암호화 백업은 v0에 없다. 화면·랜딩에 「준비 중」으로만 적는다.

## 6. 웹 서버와 앱 화면 (`web/` + `site/try/`)

**모드 둘, 화면 하나.** `python3 -m web --demo`(체험: 샘플만, 방문자별 샌드박스, 업로드 없음, 큐는 `recorded.json`으로 즉시, 「지금 다시 재기」만 실제 모델) · `python3 -m web --workspace <dir>`(로컬: 작업공간 하나, 업로드·봉투 입력·내보내기 전부 실제). 기본 바인드 `127.0.0.1:8108`.

**세션.** 쿠키 `mj_session` + 헤더 `X-Matjangbu-Session`(제3자 쿠키 차단 대비, 화면이 localStorage에 보관). 샌드박스 TTL 2시간, 상한 200(나비 `demo.py`).

**화면(해시 라우팅, 사이드바 240px, 상단바 56px, 우측 드로어 420px).**

| 해시 | 화면 | 내용 |
|---|---|---|
| `#/dashboard` | 대시보드 | 타일 4(이번 주 줄·자동 확정·확인 필요·사람이 확정) · 확인 사유 분포 막대 · 최근 활동 · 모델 처리 시간(줄당 평균·최소·최대) · 체험 전용 「샘플 정답 대조」 |
| `#/import` | 불러오기 | 주차·날짜 · CSV 선택(로컬: 파일 내용을 텍스트로 POST / 체험: 샘플 4주 중 고르기) · 미리보기 표 · 「맞추기」 → SSE 진행 → 결과 머리 「자동 n / 확인 m」 대비 숫자 |
| `#/envelope` | 봉투 입력 | 주차·날짜 · 줄 입력(이름 자동완성 `<datalist>`=명부, 종류 select, 금액) · 합계와 계수 총액 검산 · 「저장」 |
| `#/queue` | 확인 큐 | 카드(원문·금액·종류·사유·후보와 근거·「새 이름으로 등록」·「보류」·「제외」) · 확정 시 토스트 「별칭 사전에 저장됨 · 다음부터 자동」 · 「지금 다시 재기」(SSE) |
| `#/records` | 기록 | 탭 3(주간 명단·개인별 누적·연말 합산) · 합계 줄 · 「CSV 내보내기」 · 「확인 목록으로」 |
| `#/roster` | 명부·별칭 | 명부 표(구역·세대·옛이름) · 별칭 사전 표(원문→사람·배운 날) · 명부 CSV 올리기(로컬) |
| `#/device` | 기기 | 인스턴스(기기·모델·스레드·모드·대기열) · 미리 잰 기록(pp/tg) · `/phone` 링크 |

상단바: 검색(원문·이름 클라이언트 필터) · 「예시 데이터」 배지(체험 상시) · 「마지막 확정 되돌리기」(되돌릴 것이 있을 때만).

**API(`/api/...`와 `/try/api/...` 둘 다).**

| | 무엇 |
|---|---|
| `GET /api/health` | 모드·기기·모델 생존(15초 캐시)·대기열·세션 수 |
| `GET /api/state` | `week`(현재) · `weeks[]` · `lines[]` · `roster[]` · `aliases{}` · `kinds[]` · `recorded_meta`(기기·모델·시각) · `mode` |
| `POST /api/import` | 로컬 `{week, date, filename, csv_text}` / 체험 `{sample_week}` → 202 `{job}` |
| `GET /api/jobs/{id}/events` | SSE `event: state` — `queued(position)` → `running(i, n, elapsed_s)` → `line(row)` → `done(summary)` / `failed(error)` |
| `POST /api/lines/{id}/confirm` | `{person_id}` 또는 `{new_person:{name,group}}`, 선택 `kind` |
| `POST /api/lines/{id}/hold` · `/exclude` | `{why?}` |
| `POST /api/lines/{id}/rematch` | 202 `{job}` — 확정된 줄은 409 |
| `POST /api/envelope` | `{week, date, lines:[{name,kind,amount}], counted_total?}` → `{rows, total, diff}` |
| `POST /api/undo` | 마지막 사람 손 전이 되돌리기 |
| `POST /api/reset` | (체험) 새 샌드박스 |
| `GET /api/export/{week\|person\|year}.csv?week=&year=` | CSV 다운로드 |
| `POST /api/roster` | (로컬) `{csv_text}` 명부 교체 — 기존 id는 유지 |

**삼중 폴백(`try/index.html`).** `./api`(같은 origin) → `<meta name="matjangbu-api">`의 주소들 차례로 → 둘 다 없으면 `recorded.json` 읽기 전용(액션 비활성, 앰버 배너 「체험 인스턴스가 응답하지 않습니다 · 미리 잰 기록을 보여줍니다」).

**디자인 시스템.** 나비 `assets/app.css`를 가져와 워드마크만 「맞장부」(잠정명)로. 흰 배경, 강조 초록, 보류 앰버, 라이트 전용, 시스템 글꼴, 인라인 SVG 스프라이트, 외부 자원 0. 거북이 개인 문서 규격은 쓰지 않는다. **2026-09-21 재설계**: `docs/superpowers/specs/2026-09-21-ui-toss-redesign-design.md`(React + shadcn, 그라데이션 3종, Pretendard).

## 7. 사이트 네 경로 (`site/`)

| 경로 | 내용 |
|---|---|
| `/` | 랜딩 한 파일(CSS 인라인). 히어로(워드마크·한 줄·제품 스크린샷·「체험」「설치」) · 문제 한 줄(수거→계수→이름 대조→기록→연말 영수증 사슬) · 작동 방식(불러오기→3단 대조→확인 큐→기록, 인라인 SVG 도식) · 기능 6(은행 CSV·봉투 입력·별칭 사전·확인 큐·기록 3종·엑셀 내보내기) · AI 활용 방식(모델은 한 칸, 결과는 항상 확인 큐) · 실측(A31·노트북 표) · 지원 기기 · 요금(구독 예정 · 가격 미정) · FAQ(PC가 고장 나면? 인터넷? 실제 자료를 올리나? 후임자?) · 도구·라이선스(Python·llama.cpp·Qwen2.5 Apache-2.0·나비 유래 코드) |
| `/try/` | 앱 화면(§6) + `recorded.json` |
| `/download/` | 요구 사양(파이썬 3.10+·llama-server·RAM 4GB) · 설치 절차 · 설치하면 생기는 것(작업공간 구조) · 개발자 명령 · zip 「준비 중」 |
| `/phone/` | A31 카드(SM-A315N · 4GB · Helio P65 · A55×6 + A75×2 · Android 12) · 실측표(모델×스레드: 줄당 초·pp·tg·후보 1위 정답률·후보 3 안 비율) · Termux 절차 · 노트북 대조행 |

**규율.** 재지 않은 숫자를 넣지 않는다(못 잰 칸은 「예정」). 가격은 적지 않는다(인터뷰 1건은 근거가 아니다). 고객·후기·사용자 수를 지어내지 않는다. 링크는 공개 저장소와 Pages만. 「예시 데이터」 배지 상시.

## 8. 벤치 (`bench/`)

- 대상: `samples/held_lines.json` 합성 「확인 필요 줄」 30건(가족 명의·회사 명의·종류 병기+동명이인·개명·오타·모름 각 5, 정답 있음). 규칙 1·2단이 먼저 걸러 남는 줄만 모델이 본다는 조건을 그대로 재현한다.
- `bench/bench.sh --model qwen|hyperclova --threads 8,4 [--taskset 6,7:2] [--thermal] [--quick]`: llama-server를 띄우고 `bench/match_all.py`가 3단만 30건 호출 → `bench/results/<기기>-<모델>-<시각>.md/.jsonl`. 측정: 줄당 wall·prompt_n·pp·tg, 후보 1위 정답률, 정답이 후보 3 안에 든 비율, JSON 실패율. 공통 설정 `-c 2048 -ub 128 -fa on`, KV f16, 줄 사이 2초.
- A31 절차: `pkg install python` → tar 스트림으로 `bench/`·`samples/`·`engine/` 전송 → `setsid nohup … < /dev/null &` → 로그 마지막 줄로 판정(pgrep 금지). 시작 전 유휴 `llama-cli`(pid 4687)를 내린다. 모델 파일은 이미 `~/models/qwen1.5b.gguf`·`hyperclova1.5b.gguf`.
- `python3 -m web.record --device "<기기> · N스레드"`: 샘플 4주를 엔진 전체(규칙+모델)로 돌려 `site/try/recorded.json`을 만든다. 인스턴스가 노트북이므로 노트북 값으로 만들고 머리에 기기·모델·시각을 적는다. A31 값은 `/phone` 표에만.

## 9. 오류 처리

| 상황 | 처리 |
|---|---|
| CSV 열 탐지 실패 | 공용 3열로 재시도, 그것도 안 되면 400 「열을 찾지 못했습니다: 첫 줄 …」 |
| 줄 하나 파싱 실패(금액·날짜) | 그 줄만 `held/unknown` + `reason=parse` 로 큐에 올리고 계속 |
| 같은 CSV 재업로드 | sha256 같으면 건너뛰고 「이미 불러온 파일」 |
| 모델 서버 없음·시간 초과·JSON 깨짐 | 규칙 후보로 `held` + `model_failed`, 대시보드 배너 「모델이 응답하지 않습니다」. 파이프라인 계속 |
| 후보 id가 명부에 없음 | 버리고 note |
| 동명이인 | 항상 `held/dup`, 자동 확정 금지 |
| 확정된 줄에 rematch·confirm | 409 |
| 체험에서 업로드·명부 교체 | 403 |
| 경로 탈출·없는 정적 파일 | 404 |
| 대기열 | 모델 작업은 한 번에 하나, 나머지는 줄 서고 위치를 SSE로 |

## 10. 테스트 (`tests/`)

- `test_match.py`: MVP 24줄 fixture로 「자동 20 / 확인 4」 재현, 자모·한자·종류·옛이름·동명이인·임계 경계, 모델은 함수 주입.
- `test_pipeline.py`: 불러오기→확정→별칭 학습→다음 주 자동, 새 이름 등록, 되돌리기, 봉투 입력(정확·동명이인·없는 이름·검산), rematch, 모델 실패 경로.
- `test_report.py`: 주간·개인별·연말 합계 검산(fixture 합계 5,025,000원), CSV BOM.
- `test_csv.py`: 헤더 자동 탐지 2벌·CP949·출금 제외·중복 sha256.
- `test_web.py`: 진짜 HTTP. 세션 격리·import SSE·confirm/hold/undo·envelope·export·정적 서빙·경로 탈출·CORS 프리플라이트·체험 403.
- `tools/verify_site.mjs`(Playwright, mvp-agent `verify.mjs` 이식): 네 경로 외부 요청 0·콘솔 에러 0·`<h1>` 존재.

## 11. 구현·배포 순서

1. 저장소 초기화(git, LICENSE, NOTICE, README) → `engine/` + `samples/` + `tests/` 통과.
2. `web/` + `site/try/` + `recorded.json`(노트북) → `test_web` 통과, 폴백 3단 수동 확인.
3. `site/` 나머지 세 경로 → `verify_site` 통과, 스크린샷.
4. A31 벤치 2모델 → `bench/results/` → `/phone` 표.
5. GitHub 공개 저장소 생성·push·`gh-pages`·Pages 200 확인.
6. 노트북 인스턴스 기동(llama-server + web --demo + funnel) → meta 갱신 → Pages의 `/try`가 인스턴스에 붙는지, 끄면 읽기 전용으로 내려앉는지 확인.
7. 신청서 프로젝트 `docs/`에 링크·결과 기록, 메모리 갱신.

## 12. 결정 기록

- 나비 코드 재사용은 Apache-2.0 조건대로 `NOTICE`에 출처를 적는다. 가져오는 것: `web/server.py`의 HTTP·세션·SSE·정적 서빙 뼈대, `web/demo.py` 샌드박스, `engine/label.py` 모델 호출, `engine/store.py` append-only 대장, `site/assets/app.css`, `site/try/index.html` 골격.
- 포트 8107/8108은 나비(8097/8098)와 한 기기에서 겹치지 않게 고른 값이다.
- HyperCLOVAX는 이 기기에서 한국어 품질·속도 1위였지만 라이선스 때문에 기본값이 아니다. 표에 「라이선스: 자체 약관」을 적는다.
- 신청서의 월 5만 원은 인터뷰 1건이라 사이트에 적지 않는다.
