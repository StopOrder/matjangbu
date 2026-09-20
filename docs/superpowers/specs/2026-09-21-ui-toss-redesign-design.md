# 맞장부 웹 UI 재설계 — 토스 TDS 원칙 · 청록→초록 그라데이션 · `/try` React 재작성

작성 2026-09-21. 사용자 결정: 색은 첨부 이미지(그라데이션 알약 3개)의 실측값, 주색은 청록→초록, 폰트 Pretendard, 아이콘 Lucide 계열, 토스 TDS의 UX 원칙과 인터랙션 패턴 참고. 구현은 **C안**(React + shadcn 전면 재작성)을 **`/try` 한 장에만** 적용하고(A안), 나머지 3장은 순수 HTML에 새 토큰만 입힌다. **데스크톱 우선, 모바일은 무너지지 않게.** 목업 없이 글로 확정.

전제가 되는 정본: `docs/superpowers/specs/2026-09-20-matjangbu-design.md`(제품 설계, 특히 §6 화면·API·삼중 폴백, §7 사이트 네 경로). 이 문서는 그 §6·§7의 **화면 쪽만** 바꾼다. 엔진·서버·API·데이터는 손대지 않는다.

## 0. 목표와 성공 기준

목표: 사이트 네 장(`/` · `/try/` · `/download/` · `/phone/`)의 룩을 한 체계로 바꾸고, 상호작용이 있는 `/try/`를 React + shadcn 으로 다시 지어 토스풍 완성도(굵은 타이포, 넉넉한 여백, 즉시 피드백, 한 화면 한 일)를 얻는다.

성공 기준(전부 확인해야 끝):
1. `/try/`의 기존 기능이 하나도 빠지지 않는다 — 화면 7(대시보드·불러오기·봉투 입력·확인 큐·기록·명부·별칭·기기), 드로어(줄 상세), 토스트, 검색, 주차 선택, 마지막 확정 되돌리기, 삼중 폴백(같은 origin → meta 인스턴스 → `recorded.json` 읽기 전용), SSE 진행 표시, 세션 헤더 `X-Matjangbu-Session`, `window.matjangbuApiBase`.
2. 기존 검증 도구가 통과한다 — `tools/verify_site.cjs`(로컬 8123 · 공개 `--resolve`, `--expect-banner` 양쪽), `tools/verify_funnel.cjs`, `tools/site_shots.cjs`. 도구 수정은 §6의 「검증 계약」에 적은 한 가지(펼치기 클릭)뿐.
3. `.venv/bin/python -m pytest -q` 44개 그대로 통과(파이썬은 한 줄도 바꾸지 않는다).
4. 외부 요청 0 유지 — 폰트·아이콘·스크립트 전부 같은 출처. `verify_site.cjs`의 「외부 요청 0」이 그 증거.
5. 네 장 모두 같은 토큰(색·모서리·폰트)을 쓴다. 랜딩은 인스턴스에 의존하지 않는다(§5).
6. 1100px 미만 폭에서 `/try/`가 깨지지 않는다 — 하단 탭바, 바텀시트, 하단 고정 CTA(§3).

## 1. 디자인 토큰 (네 장 공통)

### 1.1 색 — 그라데이션 3종 = 제품의 세 경로

첨부 이미지 `~/Pictures/screenshot-2026-09-21_01-58-57.png`에서 ImageMagick 으로 실측한 값. 세 경로(규칙·모델·사람)에 하나씩 고정한다.

| 경로 | 이름 | 실측 stop(왼→오) | 쓰는 곳 |
|---|---|---|---|
| 규칙·자동 = **주색** | `brand` 청록→초록 | `#1DB5AB → #5FC884 → #9EDC5F` | 주 버튼, 활성 메뉴 표시, 로고 마크, 「자동」 큰 숫자, 진행 막대, 포커스 링(단색), 랜딩 히어로 pill·CTA |
| 모델 | `model` 파랑→보라 | `#0FC4C0 → #4B87D5 → #8A51E7` | 「모델」 근거 배지의 점, 대시보드 「모델 처리 시간」 카드 상단 선, 랜딩 파이프라인 AI 칸 테두리 |
| 사람 | `human` 초록→노랑 | `#AED15B → #D5D84F → #F6DC4D` | 「사람」 근거 배지의 점, 「사람이 확정」 큰 숫자, 랜딩 파이프라인 「사람」 칸 점 |

**절제 규칙.** 그라데이션은 다음 5종류 요소에만 쓴다: (1) 주 버튼 면, (2) 활성 메뉴 표시(사이드바 왼쪽 세로 바 3px + 탭바 아이콘), (3) 로고 마크, (4) 큰 숫자 글자(`background-clip:text`), (5) 진행 막대 채움과 경로 점(8px 원). 카드·페이지·표 머리글 같은 **면**에는 쓰지 않는다. 한 화면에 그라데이션 면(주 버튼)은 하나가 원칙이다.

**대비.** 흰 글자를 얹는 면(주 버튼)은 주색을 한 단계 눌러 `linear-gradient(135deg,#14A99F 0%,#3DB874 55%,#6CC65B 100%)`로 칠한다(흰 글자 700 웨이트, 15~16px). 흰 바탕 위 링크·강조 글자는 단색 `--brand-ink:#0F7D71`(대비 4.6:1). 아이콘·테두리·포커스 링은 단색 `--brand:#17A896`. 배경 틴트 `--brand-bg:#E9F8F3`(활성 메뉴 배경, 선택 행, 「자동」 배지). 모델 틴트 `--model-bg:#EEF0FC`·글자 `#5B4BD6`, 사람 틴트 `--human-bg:#F6F9E4`·글자 `#6B7A12`.

**의미색은 단색 유지.** 「확인 필요」 앰버(`#b45309`/`#fef3c7`), 오류 빨강(`#b91c1c`/`#fee2e2`), 제외 회색. 초록→노랑을 「확인 필요」에 쓰면 앰버와 헷갈리므로 사람 경로에만 쓴다.

**라이트 전용** 그대로(다크 모드는 범위 밖).

### 1.2 타이포

- Pretendard Variable 1.3.9(OFL) **자체 호스팅**: `site/assets/fonts/pretendard/` 에 `pretendardvariable-dynamic-subset.css` + woff2 조각들. 다이내믹 서브셋이라 페이지가 실제 쓰는 글리프 조각만 내려받는다(페이지당 대략 150~350KB). 네 장이 같은 파일을 `<link rel="stylesheet">`로 쓴다. `font-display:swap`.
- 스택: `Pretendard Variable, Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`.
- 크기: 본문 15px/1.6, 페이지 제목 22px/700, 섹션 제목 17px/700, 큰 숫자 32px/800 `tabular-nums`, 보조 13px, 배지 12px/600. 자간 제목 -0.02em.
- 금액은 항상 `toLocaleString('ko-KR') + '원'`, 표에서는 오른쪽 정렬.

### 1.3 형태·간격·움직임

- 모서리: 카드 16px, 버튼·입력 12px, 배지·알약 999px, 작은 요소 8px.
- 간격 4px 배수. 카드 안 20px, 카드 사이 16px, 섹션 사이 32px. 배경 `#f8fafc`(slate-50), 카드 흰색 + 1px `#e5e7eb` 선 + 아주 옅은 그림자.
- 아이콘: 지금의 인라인 SVG 스프라이트(Lucide 선 아이콘, stroke 1.75) 유지. React 쪽은 `lucide-react`(같은 아이콘 세트, 트리 셰이킹).
- 움직임: 전환 150~200ms ease-out. 버튼 누름 `transform:scale(.98)`. 카드 사라짐은 높이·불투명도 200ms. `@media (prefers-reduced-motion: reduce)`에서 전부 끈다.
- 포커스: `outline:2px solid var(--brand); outline-offset:2px`. 아이콘만 있는 버튼은 전부 `aria-label`.

## 2. `/try/` 화면 구조 (React)

### 2.1 골격

- **데스크톱(≥1100px)**: 사이드바 240px(로고 · 메뉴 7 · 맨 아래 인스턴스 상태) + 상단바 56px(화면 이름 작게 · 검색 · 주차 · 되돌리기) + 본문(맨 위에 22px 페이지 제목) + **우측 패널 420px**(줄 상세). 패널은 본문을 **밀어내고**(오버레이 아님) 열린 채로 다른 줄을 눌러 갈아 끼울 수 있다 — 지금 동작 유지.
- **모바일(<1100px)**: 상단 얇은 바(로고 · 주차 · 되돌리기) + 본문 + **하단 탭바**(메뉴 7, 아이콘 + 한 단어, 가로 스크롤 없이 7칸) + 검색은 본문 상단 입력. 줄 상세는 **바텀시트**(shadcn Sheet, `side="bottom"`, 최대 높이 85vh). 폼 화면(불러오기·봉투 입력)의 주 버튼은 **하단 고정 CTA**(탭바 위에 붙는 흰 띠 + 그라데이션 버튼 전폭).
- 앰버 배너(읽기 전용)는 상단바 위에 전폭. 「예시 데이터」 배지는 사이드바 하단(데스크톱)·상단 바(모바일)에 상시.

### 2.2 화면 7 — 지금 것을 그대로, 구조만 정리

| 해시 | 유지하는 것 | 이 재설계에서 바뀌는 것 |
|---|---|---|
| `#/dashboard` | 타일 4 · 확인 사유 분포 · 모델 처리 시간 · 최근 활동 · 샘플 정답 대조(체험) | 타일 큰 숫자 32px, 「자동 확정」은 brand 그라데이션 글자, 「사람이 확정」은 human 그라데이션 글자, 「확인 필요」 앰버 단색. 모델 카드 상단 2px model 선. 분포 막대 채움은 앰버 단색(의미색) |
| `#/import` | 체험: 샘플 주차 select + 「맞추기」 / 로컬: 주차·날짜·CSV 파일 + 미리보기 · SSE 진행 · 결과 표(확인 필요 먼저) | 진행은 그라데이션 막대 + 「n / N 줄 · 지금 보는 줄: …」. 결과 머리 「자동 n / 확인 m」 큰 숫자. 모바일에서 「맞추기」 하단 고정 |
| `#/envelope` | 주차·날짜 · 줄 입력(이름 datalist·종류·금액) · 줄 추가 · 샘플 12줄 · 합계/계수 검산 · 저장 | 차이가 0이 아니면 검산 줄이 앰버, 0이면 brand 틴트 + 체크. 모바일에서 「저장」 하단 고정 |
| `#/queue` | 카드(원문·금액·종류·사유·근거·후보 버튼·새 이름 등록·명부에서 직접 고르기·보류·제외·지금 다시 재기) | **한 화면 한 일**: 카드에는 후보 버튼(근거 한 줄 포함)과 보류·제외·다시 재기만 보인다. 「다른 방법 ▾」를 누르면 「명부에서 직접 고르기」와 「새 이름으로 등록」이 펼쳐진다(동명이인은 등록 없음, 지금과 같음). 확정하면 카드가 200ms 접히며 사라지고 토스트에 **「되돌리기」 버튼**(기존 `/undo`). 카드가 0이면 빈 상태 + 「다음 주 불러오기 →」 버튼 하나 |
| `#/records` | 탭 3(주간·개인별·연말) · CSV 표 · 내보내기 · 확인 목록으로 · 미확정 줄 목록 | 탭은 알약형 세그먼트(활성 = 잉크색 면, 지금과 같음). 표 로딩은 스켈레톤 4줄 |
| `#/roster` | 명부 표 · 별칭 사전 표 · 명부 CSV 교체(로컬) | 표 머리 고정, 검색이 두 표 모두 거름(지금과 같음) |
| `#/device` | 인스턴스 kv · 미리 잰 기록 kv · `/phone` 링크 · `/health` 갱신 | 그대로 |

**줄 상세(패널/바텀시트).** 판정 kv(상태·맞춘 사람·근거·종류·사유·샘플 정답) · `held`면 후보 고르기(큐 카드와 같은 컴포넌트) · 모델 메타(모델·초·토큰·pp·tg·미리 잰 값·오류) · 「모델 출력 JSON」 접기. 지금과 같다.

**토스트.** 오른쪽 아래(모바일은 탭바 위 가운데), 3.2초, 종류 `ok`·`err`·기본. 확정·보류·제외 토스트에 「되돌리기」 액션(누르면 `/undo` → 다시 불러오기, 토스트 닫힘). DOM 계약 `#toasts .toast(.err|.ok)` 유지 — 그래서 sonner 를 쓰지 않고 직접 만든다(30줄).

### 2.3 상태와 데이터 흐름

- `store.tsx`: `useReducer` 하나. 상태 = `{st, readonly, apiBase, route, selected, query, tab, busy, envRows, recordsCache, toasts}`. 지금의 전역 변수들을 그대로 옮긴 것. 외부 상태 라이브러리 없음.
- `api.ts`: `api(path, opts)`(세션 헤더·`credentials`·CSV/JSON 분기·오류 객체), `post`, `stream(path, onEvent)`(fetch + ReadableStream 으로 SSE 파싱 — `EventSource`는 헤더를 못 붙인다). 세션 토큰은 `localStorage['mj.session@' + apiBase]`. **지금 코드와 동일 동작.**
- `fallback.ts`: `offline(rec, week)`(recorded.json → state 모양), `localWeekCsv`, `localYearCsv`, `parseCsv`, `guessWeek`. 전부 순수 함수 → Vitest 대상.
- `load(week)`: 후보 base 순서 = 같은 origin `./` → `<meta name="matjangbu-api">` 주소들 → 전부 실패 시 `recorded.json`. 성공한 base 를 `window.matjangbuApiBase`에, 실패면 `null`. **지금과 동일.**
- 라우팅: `useHashRoute()` 훅 — `#/queue` 형식, 모르는 해시는 `dashboard`, 해시가 바뀌면 상세 닫음. react-router 없음.
- 오류: `api` 가 던진 오류는 `toast(err)`. 불러오기·다시 재기 실패는 해당 진행 표시에 빨간 글자 + 토스트. 초기 로드 실패는 본문에 한 줄.

### 2.4 컴포넌트

```
ui/src/
  main.tsx  App.tsx  store.tsx  api.ts  fallback.ts  route.ts  format.ts(won·fmtTs)
  labels.ts(TITLES·STATE·REASON·NO_KIND)
  components/  Layout(Sidebar·Topbar·TabBar·Banner)  LinePanel(데스크톱 패널/모바일 Sheet)
               LineTable  StateBadge  HowBadge  StatTile  GradientNumber  ProgressBar
               CandidatePicker(후보·다른 방법 접기·보류·제외·다시 재기)  EmptyState  Skeleton  Toasts  StickyCta
  views/       Dashboard  Import  Envelope  Queue  Records  Roster  Device
  components/ui/  (shadcn 생성: button badge card input select tabs sheet collapsible tooltip skeleton progress)
```

shadcn 은 코드가 저장소에 복사되는 방식이라 런타임 의존은 `react`·`react-dom`·`radix-ui`·`lucide-react`·`class-variance-authority`·`clsx`·`tailwind-merge` 뿐. 예상 번들 gzip 100~130KB(지금 단일 파일 약 20KB에서 늘지만 로컬 PC 서빙이라 문제 없음).

## 3. 토스 TDS 에서 가져오는 패턴 — 채택 목록

1. **한 화면 한 일**: 확인 큐 카드의 접기(§2.2). 폼은 한 카드에 한 폼.
2. **큰 숫자·굵은 제목**: §1.2 크기. 페이지 제목은 상단바에서 본문 맨 위로 내려 22px 로 키운다(상단바에는 화면 이름을 작게).
3. **즉시 피드백**: 누름 scale, 카드 접힘, 토스트 즉시. 되돌리기는 토스트 안에.
4. **쉬운 되돌리기**: 토스트 액션 + 상단 되돌리기 버튼(되돌릴 게 있을 때만 활성).
5. **빈 상태 = 한 줄 + 행동 하나**: 큐 비면 「다음 주 불러오기 →」, 기록 없으면 「불러오기로 →」, 별칭 없으면 설명 한 줄.
6. **로딩 = 스켈레톤**: 초기 로드(타일 4 + 카드 2), 기록 표(4줄). 스피너 없음.
7. **진행 = 막대 + 지금 하는 일 한 줄**: 불러오기 SSE.
8. **하단 고정 CTA**(모바일 폼), **바텀시트**(모바일 상세), **하단 탭바**.
9. **쉬운 말**: 문구는 지금 것을 유지. 새로 생기는 문구(「다른 방법」, 「되돌리기」, 「다음 주 불러오기」)도 같은 결로.
10. **접근성**: 포커스 링, aria-label, 색만으로 상태를 말하지 않음(배지에 글자 있음).

토스 자산 사용 범위: 토스페이스·Slash 라이브러리·TDS 컴포넌트는 **쓰지 않는다**(앱인토스 파트너가 아니고, 외부 자원 0 규칙). 가져오는 것은 위 원칙과 패턴뿐이다.

## 4. 빌드·저장소 구조

- 새 폴더 `ui/`: `package.json`, `vite.config.ts`, `tsconfig.json`, `components.json`(shadcn), `src/`, `index.html`, `public/`(비움). Node 26 · npm 11(이 머신). 의존 버전은 잠금 파일(`package-lock.json`)로 고정하고 커밋.
- `vite.config.ts`: `base:'./'`, `build.outDir:'../site/try'`, `emptyOutDir:false`. 빌드 스크립트가 먼저 `site/try/assets/`만 지운다(`recorded.json`·`sample-envelopes.json`은 `web.record`·`tools/`가 만드는 파일이라 그대로 둔다).
- `ui/index.html` → 빌드된 `site/try/index.html`: `<meta name="matjangbu-api" content="https://omarchy.tailb0e058.ts.net/">` 유지, `<link rel="stylesheet" href="../assets/fonts/pretendard/pretendardvariable-dynamic-subset.css">`, `<title>맞장부 — 앱</title>`, `<h1>` 하나(검증 도구가 센다).
- 산출물(`site/try/index.html` + `site/try/assets/*.js|css`)은 **커밋**한다 — 파이썬 서버와 Pages 가 그대로 서빙하고, `git subtree push --prefix site origin gh-pages` 절차가 안 바뀐다. 파일명 해시는 Vite 기본대로(서버 `_NO_CACHE` 가 `.js`·`.css` 를 no-cache 로 주므로 어느 쪽이든 안전).
- `.gitignore` 추가: `ui/node_modules/`.
- 명령: `cd ui && npm ci && npm run build`(빌드) · `npm run dev`(개발 서버, `/api` 를 8108 로 프록시) · `npm test`(Vitest).
- 파이썬 서버·엔진·테스트는 변경 없음. 「pip 패키지 0」은 그대로다(npm 은 빌드 시점 도구이고 실행 시점 의존이 아니다) — README 에 그렇게 적는다.

## 5. 나머지 3장 (`/` · `/download/` · `/phone/`) — 토큰 교체

- `site/assets/app.css`와 `site/index.html` 인라인 CSS 의 `:root` 토큰을 §1 값으로 교체(둘을 맞춘다는 기존 규칙 유지). `--green` 계열 → `--brand`·`--brand-ink`·`--brand-bg` 이름으로 바꾸고, 그라데이션 토큰 `--grad-brand`·`--grad-model`·`--grad-human`·`--grad-brand-deep` 추가. 모서리 16/12, 폰트 스택, 폰트 `<link>` 4장 모두.
- 마크업 변경은 액센트 자리만: 로고 마크(SVG `<linearGradient>`), 주 버튼(`.btn-primary` 그라데이션 면), 히어로 pill(brand 틴트 + 그라데이션 점), 히어로 h1 의 「맞추고」 한 단어 그라데이션 글자, 파이프라인 AI 칸(model 그라데이션 테두리 2px) · 사람 칸(human 점), 실측표의 큰 숫자. 본문·표·문구·수치는 그대로.
- 「파일 하나」 규칙은 **「인스턴스에 의존하지 않는다」**로 정확히 한다: 랜딩은 CSS 인라인을 유지하되, 같은 출처(Pages)의 폰트 파일은 지금의 `assets/dashboard.jpg`처럼 허용. 폰트 파일이 없어도 시스템 글꼴로 떨어질 뿐 깨지지 않는다.

## 6. 검증 계약과 테스트

**Playwright 도구 3종이 쓰는 셀렉터 — React 가 그대로 낸다.**

| 셀렉터 | 어디 |
|---|---|
| `h1`(장마다 1개 이상) | 네 장 |
| `#banner` + `hidden` 속성(읽기 전용일 때만 보임) | 앱 배너 |
| `.qcard`(원문 텍스트 포함) | 확인 큐 카드 |
| `select[data-any]` · `[data-pick-any]` | 「다른 방법」 안 명부 직접 고르기 |
| `#imp-week` · `#imp-run` · `#imp-progress`(`.err`) | 불러오기 |
| `tr.row[data-id]` · `main table tbody tr` | 결과 표 |
| `#toasts .toast.err` | 토스트 |
| `window.matjangbuApiBase` | 폴백 판정 |

**도구 수정 한 가지.** `site_shots.cjs`·`verify_funnel.cjs`에서 `select[data-any]`를 고르기 전에 카드의 `[data-more]`(「다른 방법 ▾」)를 클릭하는 한 줄을 넣는다(접힌 select 는 Playwright 가 actionable 로 보지 않는다).

**테스트.**
- Vitest(`ui/src/*.test.ts`): `parseCsv`(따옴표·이스케이프·BOM), `guessWeek`(ISO 주차 경계), `offline()`(recorded.json → state 모양, 후보 이름 붙이기), `localYearCsv`/`localWeekCsv`(합계·미확정 줄). 실제 `site/try/recorded.json`을 픽스처로 읽는다. TDD 로 먼저 쓴다.
- 흐름: 로컬 `python3 -m web --demo`(8108)에서 `tools/site_shots.cjs`(7장 찍힘 + 콘솔 에러 0) · `tools/verify_site.cjs --base http://127.0.0.1:8108`(배너 없음) · 정적 8123 에서 `--expect-banner`(폴백) · 마지막에 공개 배포 뒤 `verify_funnel.cjs --resolve`.
- pytest 44개는 그대로 돌려 변경 없음을 확인.

## 7. 오류 처리

- 인스턴스 없음: 지금과 같은 삼중 폴백. 읽기 전용에서는 액션 버튼 `disabled` + 앰버 배너 문구 유지.
- SSE 끊김·실패: 진행 표시 빨간 글자 + 토스트, `busy` 해제, 「맞추기」 다시 활성.
- 되돌리기 실패(409 등): 토스트 오류, 화면 유지.
- 폰트 파일 404: `font-display:swap` 이라 시스템 글꼴로 표시. `verify_site.cjs`의 정적 4xx 검사가 잡으므로 배포 전에 드러난다.
- 빌드 산출물과 `recorded.json` 어긋남: 없음 — 데이터 파일은 빌드가 손대지 않는다.

## 8. 문서

- `README.md`: 폴더 표에 `ui/` 행, 실행 방법에 빌드 명령, 「pip 패키지 0 · npm 은 빌드 도구」 한 줄.
- `docs/ops.md` 「사이트 재배포」: `cd ui && npm ci && npm run build` 를 subtree push 앞에.
- `docs/design-notes.md`: 결정 한 줄(「/try 는 React + shadcn, 나머지는 순수 HTML — 상호작용이 있는 장만」·「그라데이션 3종 = 세 경로」).
- `docs/superpowers/specs/2026-09-20-matjangbu-design.md` §6 「디자인 시스템」 문단 끝에 이 문서로의 링크 한 줄.
- 화면은 `tools/site_shots.cjs`로 다시 찍어 `docs/shots/` 갱신.

## 9. 범위 밖

다크 모드 · 사이트 문구·정확도 수치 검수(핸드오프 「계획」 6번, 사용자 결정 대기) · 랜딩·설치·기기 페이지의 React 화 · 파이썬(엔진·서버·테스트) 변경 · 모바일 우선 별도 레이아웃 · 토스 자산(Tossface·Slash·TDS 컴포넌트) 사용 · 새 기능(암호화 백업·설치 zip 등 핸드오프 1~5·7).

## 10. 결정 기록

| 결정 | 이유 |
|---|---|
| C안(React 전면 재작성)을 `/try` 에만 | 상호작용이 있는 장이 하나뿐. 랜딩은 인스턴스가 죽어도 살아야 해서 정적 유지가 운영상 이득 |
| 그라데이션 3종을 규칙·모델·사람 세 경로에 고정 | 제품의 핵심 서사(규칙 2단 + 모델 1단 + 사람 확정)와 1:1. 색이 곧 설명이 된다 |
| 「확인 필요」는 앰버 단색 | 초록→노랑을 경고에 쓰면 앰버와 헷갈린다. 의미색은 단색 |
| 주 버튼 면은 눌린 그라데이션 | 흰 글자 대비(토스 파랑 버튼도 3.7:1 수준, 굵은 글자로 보완) |
| Pretendard 자체 호스팅 다이내믹 서브셋 | 외부 호출 0 유지, OFL, 페이지당 수백 KB |
| 토스트 자체 구현 | 검증 도구의 DOM 계약(`#toasts .toast.err`) 유지, 의존 하나 줄임 |
| react-router 없음, 외부 상태 라이브러리 없음 | 해시 라우트 7개와 상태 10개에 라이브러리는 과함 |
| 빌드 산출물 커밋 | 파이썬 서버·Pages·subtree push 절차를 안 바꾼다 |
| 데스크톱 패널은 밀어내기 유지 | 확인 작업에서 패널 열어 둔 채 다른 줄로 옮겨 가는 흐름이 실사용에 맞다 |
