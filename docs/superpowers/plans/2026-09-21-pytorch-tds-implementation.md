# PyTorch 배치 + TDS 색 — 사이트·앱 전면 반영 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 확정된 시안 두 장(`docs/mockups/2026-09-21-landing.html`, `docs/mockups/2026-09-21-weekly-ledger.html`)을 실제 사이트(`site/`)와 앱(`ui/` → `site/try/`)에 그대로 반영하고, 사이트 지도를 세 장으로 줄이고, 검증 도구·pytest·NOTICE 를 새 DOM 에 맞춘다.

**Architecture:** 파이썬(`engine/`·`web/`)과 HTTP API 는 한 줄도 바꾸지 않는다. `ui/` 의 순수 모듈(`api.ts`·`load.ts`·`fallback.ts`·`route.ts`·`lines.ts`·`types.ts`·`store.tsx`)도 유지한다. 바뀌는 것은 **화면 계층뿐**이다 — `ui/src/components/`·`ui/src/views/`·`ui/src/index.css` 는 파일째 지우고 새로 짓고, `ui/src/labels.ts` 의 라우트 목록은 7개에서 4개로 줄인다. 정적 페이지는 `site/index.html`·`site/install/index.html` 두 장이며 **각자 CSS 를 인라인으로 품는다** — 체험 인스턴스가 죽어도 살아야 하므로 같은 출처의 폰트 파일 외에는 아무것도 `<link>` 하지 않는다(`docs/superpowers/specs/2026-09-21-ui-toss-redesign-design.md:131`). 약 10KB 중복은 감수한다. 쓰이지 않게 된 `site/assets/app.css` 는 지운다.

**Tech Stack:** React 19 + Vite + TypeScript + Tailwind v4 + shadcn(button·input·collapsible 만) · Vitest · 순수 정적 HTML/CSS · Playwright(검증 도구) · pytest

## Global Constraints

- **파이썬 불변** — `engine/`·`web/` 은 건드리지 않는다. 예외는 `tests/test_web.py:124` 의 페이지 목록 한 줄뿐이다.
- **외부 자원 0** — 폰트·아이콘·스크립트 전부 자체 호스팅. CDN 링크 금지.
- **삼중 폴백 유지** — 같은 origin → `meta[name="matjangbu-api"]` 인스턴스 → `recorded.json` 읽기 전용.
- **`X-Matjangbu-Session` 헤더와 `window.matjangbuApiBase` 유지.**
- **해시 라우팅 유지** — `#/week` · `#/year` · `#/roster` · `#/settings`.
- **재지 않은 숫자·가격·고객 수를 화면에 적지 않는다.** 계산으로 얻은 값은 계산값이라고 밝힌다.
- **실제 단체 자료 금지** — 체험은 가공 샘플만.
- **TDS 색 토큰(고정값, 전 파일 공통):**
  `--blue:#3182f6` `--blue-hover:#2272eb` `--blue-deep:#1b64da` `--blue-weak:#e8f3ff`
  `--g900:#191f28` `--g800:#333d4b` `--g700:#4e5968` `--g600:#6b7684` `--g500:#8b95a1` `--g400:#b0b8c1` `--g300:#d1d6db` `--g200:#e5e8eb` `--g100:#f2f4f6` `--g50:#f9fafb`
  `--hair:rgba(0,0,33,.07)` `--border:rgba(0,27,55,.1)` `--line5:rgba(2,32,71,.05)`
  `--green:#03b26c` `--green-weak:rgba(2,162,98,.16)` `--green-text:#029359`
  `--amber-weak:rgba(255,179,49,.16)` `--amber-text:#dd7d02`
  모델 보라 `#7b61ff` / weak `rgba(123,97,255,.16)` / text `#5b3fd6`
  사람 올리브 `#8c9440` / weak `rgba(140,148,64,.2)` / text `#646b25`
- **타이포** — Pretendard(로컬 woff2 subset), 본문 15px/22px, 리스트 제목 17px/26px, `letter-spacing:0`(32px 이상만 `-.02em`), `word-break:keep-all`, 숫자는 `font-variant-numeric:tabular-nums`.
- **커밋 메시지 끝**: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- **배포 금지** — `git subtree push` 는 사용자가 8108 에서 보고 승인한 뒤에만. 이 계획의 마지막 과제는 승인 요청까지다.

---

## 파일 구조

### 새로 만드는 것
| 파일 | 책임 |
|---|---|
| `site/install/index.html` | 설치·백업·인수인계 안내 한 장. `/download/`·`/phone/` 가 하던 일을 흡수. **CSS 인라인** |
| `ui/src/ui/tokens.css` | TDS 토큰 한 곳. `index.css` 가 import |
| `ui/src/components/Shell.tsx` | 어두운 GNB(로고·탭 4개·찾기·상태) + 페이지 뼈대 |
| `ui/src/components/Row.tsx` | 리스트 한 줄(3슬롯). 채워진 줄·빈 줄 둘 다 |
| `ui/src/components/RowPanel.tsx` | 빈 줄을 눌렀을 때 그 자리에서 펼쳐지는 판 |
| `ui/src/components/EntryRow.tsx` | 리스트 맨 위 고정 봉투 입력 줄 |
| `ui/src/components/Badge.tsx` | 근거 뱃지(규칙·모델·사람·확인 필요·회색) |
| `ui/src/components/Toasts.tsx` | 토스트(되돌리기 포함). 기존 것을 TDS 로 다시 |
| `ui/src/views/Week.tsx` | 이번 주 — 주간 장 |
| `ui/src/views/Year.tsx` | 연말 — 누적 장 |
| `ui/src/views/Roster.tsx` | 명부·별칭 |
| `ui/src/views/Settings.tsx` | 설정 — 기기·인스턴스·내보내기·불러오기 |

### 고치는 것
| 파일 | 무엇을 |
|---|---|
| `site/index.html` | 시안의 랜딩으로 전면 교체. **CSS 는 인라인 유지**(「인스턴스에 의존하지 않는다」 규칙) |
| `README.md:86` | 나비 유래 목록에서 `site/assets/app.css`·「앱 화면 골격」 삭제 |
| `ui/src/index.css` | Tailwind v4 + `tokens.css` import + 앱 전역 기본값만 |
| `ui/src/labels.ts` | `ROUTES` 를 `["week","year","roster","settings"]` 로, `TITLES` 동기화 |
| `ui/src/route.ts` | 기본 라우트를 `dashboard` → `week` 로 |
| `ui/src/App.tsx` | `Layout` → `Shell`, 스켈레톤을 TDS 로 |
| `ui/src/views/index.tsx` | `VIEWS` 를 새 4개로 |
| `ui/test/route.test.ts` | 라우트 목록 변경 반영 |
| `tools/verify_site.cjs` | 새 DOM 계약으로 |
| `tools/verify_funnel.cjs` | 새 DOM 계약으로 |
| `tools/site_shots.cjs` | 페이지 목록·선택자 |
| `tests/test_web.py:124` | `("/", "/try/", "/install/")` |
| `NOTICE` | `app.css`·`try/index.html` 골격 항목 삭제 |

### 지우는 것
`site/download/` · `site/phone/` · `site/assets/dashboard.jpg` · **`site/assets/app.css`**(참조처가 문서 둘뿐이라 함께 폐기) ·
`ui/src/components/` 의 옛 파일 전부(Banner·CandidatePicker·CsvTable·EmptyState·Foot·GradientNumber·HowBadge·InstanceStatus·Layout·LinePanel·LineTable·ProgressBar·SectionHead·Sidebar·StateBadge·StatTile·TabBar·Topbar) ·
`ui/src/components/ui/` 에서 `badge.tsx`·`card.tsx`·`sheet.tsx`·`skeleton.tsx` ·
`ui/src/views/` 의 옛 파일 전부(Dashboard·Device·Envelope·Import·Queue·Records·Roster)

### 손대지 않는 것
`engine/` · `web/` · `ui/src/{api,load,fallback,lines,types,format,hooks,store}.*` · `ui/src/lib/utils.ts` · `ui/src/components/ui/{button,input,collapsible}.tsx` · `ui/test/` 의 나머지 7개 · `site/try/recorded.json` · `site/try/sample-envelopes.json` · `site/assets/fonts/`

---

## DOM 계약 (검증 도구와 화면이 함께 지키는 약속)

검증 도구는 이 속성들만 본다. 클래스 이름이 바뀌어도 도구가 깨지지 않도록 **`data-*` 로 고정한다.**

| 선택자 | 어디에 | 뜻 |
|---|---|---|
| `[data-mj="gnb"]` | 앱·정적 공통 상단 | 머리띠가 떴다 |
| `[data-mj="tab"][data-route="week\|year\|roster\|settings"]` | 앱 GNB 탭 | 장 4개 |
| `[data-mj="ledger"]` | 주간 장 리스트 컨테이너 | 장부가 떴다 |
| `[data-mj="row"]` | 줄 하나 | 줄 수 세기 |
| `[data-mj="row"][data-blank="1"]` | 빈 줄 | 채울 줄 수 |
| `[data-mj="panel"]` | 펼쳐진 판 | 그 자리 펼침이 열렸다 |
| `[data-mj="cand"]` | 후보 버튼 | 후보 고르기 |
| `[data-mj="entry"]` | 맨 위 입력 줄 | 봉투 입력 |
| `[data-mj="total"]` | 바닥 합계 줄 | 검산 |
| `[data-mj="hero"]` | 랜딩 히어로 띠 | 랜딩이 떴다 |
| `[data-mj="matrix"]` | 랜딩 고르기 판 | 고르기 판이 떴다 |
| `[data-mj="opt"][data-on="1"]` | 고른 칸 | 선택 상태 |
| `[data-mj="out"]` | 잰 값 상자 | 결과 |

---

## Task 1: 정적 사이트 세 장 — 랜딩 교체 · `/install/` 신설 · 옛 두 장 폐지

**Files:**
- Modify: `site/index.html` (전면 교체, CSS 인라인)
- Create: `site/install/index.html` (CSS 인라인)
- Delete: `site/download/index.html`, `site/phone/index.html`, `site/assets/dashboard.jpg`, `site/assets/app.css`
- Modify: `tests/test_web.py:124`
- Modify: `NOTICE`, `README.md:86`

**Interfaces:**
- Produces: `data-mj="hero"`·`"matrix"`·`"opt"`·`"out"`·`"gnb"` 를 `tools/verify_site.cjs`(Task 5)가 본다.
- Consumes: 없음.

> **개정(착수 전 확인)** — 원안은 CSS 를 `site/assets/app.css` 로 빼서 두 장이 공유하게 했으나, 저장소 규칙(`site/index.html:13`, `docs/superpowers/specs/2026-09-21-ui-toss-redesign-design.md:131`)은 **「인스턴스에 의존하지 않는다」** — 랜딩은 CSS 를 인라인으로 품는다. 그래서 두 장 모두 인라인으로 가고 `app.css` 는 지운다(참조처는 `NOTICE:8`·`README.md:86` 두 문서뿐). 폰트만 같은 출처에서 `<link>` 한다.

- [x] **Step 1: `site/index.html` 을 시안으로 전면 교체한다 (CSS 인라인)**

`docs/mockups/2026-09-21-landing.html` 의 `<style>` 전문을 그대로 `<style>` 안에 둔 채 옮긴다. `<head>` 는 아래로 시작하고 **옛 `og:` 메타 3개를 새 문구로 살려 옮긴다**(시안에는 없다).

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>맞장부 — 봉투와 통장의 이름을 명부와 맞춰요</title>
<meta name="description" content="봉투와 통장에 찍힌 이름을 명부와 맞춰 주는 장부. 단체 PC 한 대 안에서 끝나고, 인터넷이 없어도 켜집니다.">
<meta property="og:title" content="맞장부 — 봉투와 통장의 이름을 명부와 맞춰요">
<meta property="og:description" content="단체 PC 한 대 안에서 끝나는 헌금 장부. 규칙이 대부분을 맞추고, 남은 몇 줄만 사람이 고릅니다. 외부 API 호출 0.">
<meta property="og:type" content="website">
<link rel="stylesheet" href="assets/fonts/pretendard/pretendardvariable-dynamic-subset.css">
<style>/* 시안 <style> 전문. 인스턴스가 죽어도 이 링크는 살아야 하므로 인라인이다. */</style>
</head>
```

- [x] **Step 2: 링크와 `data-mj` 를 채운다**

CTA 링크 치환 규칙:
- 「체험하기」 · 「장부 열기」 · 「장부 열어 보기」 · 공지 띠 링크 → `href="try/"`
- 「설치 안내」 · 「인수인계 안내」 · 「설치 안내 보기」 → `href="install/"`
- 「저장소 보기」 · 푸터 「저장소」 → `href="https://github.com/StopOrder/matjangbu"` (저장소 주소는 이미 정해져 있다 — `README.md:86` 등에서 확인)
- 절 안 앵커(`#work`·`#pick`·`#ai`·`#measured`·`#price`)는 그대로

`data-mj` 를 넣는 자리: 히어로 `<section class="hero">` → `data-mj="hero"`, GNB `<header class="gnb">` → `data-mj="gnb"`, `.matrix` → `data-mj="matrix"`, 각 `.opt` → `data-mj="opt"`(켜진 칸은 `data-on="1"`), `.outbox` → `data-mj="out"`.

- [x] **Step 3: 히어로 그림을 사이트로 복사한다**

```bash
cp docs/mockups/assets/ledger.png site/assets/ledger.png
```

- [x] **Step 4: `site/install/index.html` 을 만든다**

CSS 는 랜딩과 같은 것을 **인라인으로 다시 품는다**(약 10KB 중복). 폰트만 `../assets/fonts/pretendard/pretendardvariable-dynamic-subset.css` 로 건다. 구조는 랜딩과 같은 문법(공지 띠 → 어두운 GNB → 파랑 히어로 띠 → 검은 띠 → 절들 → 어두운 링크 띠 → 푸터), 내용은 셋:
1. **설치** — 단체 PC 에 올리는 순서. 아직 설치 파일이 없으므로 「준비 중입니다」를 그대로 적고, 지금 할 수 있는 것(저장소를 내려받아 파이썬으로 실행)만 쓴다. **없는 명령을 지어내지 않는다.**
2. **백업** — 작업공간 폴더 하나를 복사. 자동 백업은 준비 중.
3. **인수인계** — 담당자 교체 때 넘기는 것 목록(폴더·별칭 사전·명부).

- [x] **Step 5: 옛 두 장을 지운다**

```bash
git rm -r site/download site/phone
git rm site/assets/dashboard.jpg site/assets/app.css
```

- [x] **Step 6: pytest 페이지 목록을 고친다**

`tests/test_web.py:124` 한 줄만:

```python
    for path in ("/", "/try/", "/install/"):
```

- [x] **Step 7: NOTICE 와 README 에서 두 항목을 뺀다**

`NOTICE:8` 의 `site/assets/app.css 디자인 시스템, site/try/index.html 화면 골격.` 줄을 지운다.
`README.md:86` 의 나비 유래 목록에서도 「디자인 시스템(`site/assets/app.css`)」과 「앱 화면 골격」을 뺀다 — 둘 다 이번에 버려진다.
**파이썬 유래 항목(`web/server.py`·`web/demo.py`·`engine/model.py`·`engine/store.py`)은 그대로 남긴다** — 그 코드는 계속 쓴다.

- [x] **Step 8: 검증**

```bash
.venv/bin/python -m pytest -q tests/test_web.py
python3 -m http.server 8123 -d site &
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/dev_shot.cjs "http://127.0.0.1:8123/" /tmp/s-home.png
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/dev_shot.cjs "http://127.0.0.1:8123/install/" /tmp/s-install.png
```

Expected: pytest PASS · 두 스크린샷 모두 콘솔 에러 0(`dev_shot.cjs` 가 에러 시 exit 1) · 모바일 390px 가로 넘침 0.

- [x] **Step 9: 커밋**

```bash
git add -A
git commit -m "site: 랜딩을 PyTorch 배치+TDS 로 교체 · /install/ 신설 · /download/·/phone/ 폐지"
```

---

## Task 2: 앱 껍데기 — 토큰·Shell·라우트 4개, 옛 화면 파일 삭제

**Files:**
- Create: `ui/src/ui/tokens.css`, `ui/src/components/Shell.tsx`, `ui/src/components/Badge.tsx`, `ui/src/components/Toasts.tsx`
- Modify: `ui/src/index.css`, `ui/src/labels.ts`, `ui/src/route.ts`, `ui/src/App.tsx`, `ui/src/views/index.tsx`, `ui/test/route.test.ts`
- Delete: `ui/src/components/` 옛 18개, `ui/src/components/ui/{badge,card,sheet,skeleton}.tsx`, `ui/src/views/` 옛 7개

**Interfaces:**
- Produces:
  - `export const ROUTES = ["week","year","roster","settings"] as const`
  - `export type Route = (typeof ROUTES)[number]`
  - `export function Shell({ route, children }: { route: Route; children: ReactNode }): JSX.Element`
  - `export function Badge({ tone, children }: { tone: "rule"|"model"|"human"|"need"|"plain"; children: ReactNode }): JSX.Element`
  - `export function Toasts(): JSX.Element`
- Consumes: `useApp()`·`useData()`(`store.tsx`, 그대로) · `howOf`·`counts`·`matches`(`lines.ts`, 그대로)

- [x] **Step 1: 라우트 테스트를 먼저 고쳐 실패를 만든다**

`ui/test/route.test.ts` 의 기존 기대값을 새 목록으로 바꾼다.

```ts
import { describe, expect, it } from "vitest"
import { parseHash } from "../src/route"

describe("parseHash", () => {
  it("빈 해시는 이번 주", () => { expect(parseHash("")).toBe("week") })
  it("아는 라우트는 그대로", () => {
    expect(parseHash("#/week")).toBe("week")
    expect(parseHash("#/year")).toBe("year")
    expect(parseHash("#/roster")).toBe("roster")
    expect(parseHash("#/settings")).toBe("settings")
  })
  it("모르는 라우트는 이번 주", () => { expect(parseHash("#/dashboard")).toBe("week") })
})
```

- [x] **Step 2: 실패를 확인한다**

Run: `cd ui && npx vitest run test/route.test.ts`
Expected: FAIL — `parseHash("")` 가 `"dashboard"` 를 돌려준다.

- [x] **Step 3: `labels.ts` 와 `route.ts` 를 고친다**

```ts
// ui/src/labels.ts
import type { LineState } from "./types"

export const ROUTES = ["week", "year", "roster", "settings"] as const
export type Route = (typeof ROUTES)[number]
export const TITLES: Record<Route, string> = {
  week: "이번 주", year: "연말", roster: "명부", settings: "설정",
}
export const STATE: Record<LineState, string> = { auto: "자동 확정", held: "확인 필요", confirmed: "확정", excluded: "제외" }
export const REASON: Record<string, string> = {
  dup: "동명이인", family: "가족 명의", company: "회사 명의", renamed: "개명", typo: "오타·이표기",
  unknown: "명부에 없음", model_failed: "모델 미실행", parse: "읽지 못함",
}
export const NO_KIND = "(종류 없음)"
```

```ts
// ui/src/route.ts — 기본값 두 곳만 바꾼다
export function parseHash(hash: string): Route {
  const r = (hash || "#/week").replace(/^#\/?/, "").split("/")[0] || "week"
  return (ROUTES as readonly string[]).includes(r) ? (r as Route) : "week"
}
// useHashRoute 의 getServerSnapshot 도 () => "week"
```

- [x] **Step 4: 테스트 통과를 확인한다**

Run: `cd ui && npx vitest run test/route.test.ts`
Expected: PASS

- [x] **Step 5: 옛 화면 파일을 지운다**

```bash
cd ui/src
git rm components/Banner.tsx components/CandidatePicker.tsx components/CsvTable.tsx \
  components/EmptyState.tsx components/Foot.tsx components/GradientNumber.tsx \
  components/HowBadge.tsx components/InstanceStatus.tsx components/Layout.tsx \
  components/LinePanel.tsx components/LineTable.tsx components/ProgressBar.tsx \
  components/SectionHead.tsx components/Sidebar.tsx components/StateBadge.tsx \
  components/StatTile.tsx components/TabBar.tsx components/Topbar.tsx \
  components/ui/badge.tsx components/ui/card.tsx components/ui/sheet.tsx components/ui/skeleton.tsx \
  views/Dashboard.tsx views/Device.tsx views/Envelope.tsx views/Import.tsx \
  views/Queue.tsx views/Records.tsx views/Roster.tsx
```

`components/Toasts.tsx` 는 지우고 같은 이름으로 새로 쓴다.

- [x] **Step 6: `ui/src/ui/tokens.css` 에 토큰을 넣는다**

Global Constraints 의 TDS 토큰 전부를 `:root` 에 선언한다. 시안 `docs/mockups/2026-09-21-weekly-ledger.html` 의 `:root` 블록이 그대로 정답이다.

- [x] **Step 7: `index.css` 를 다시 쓴다**

```css
@import "tailwindcss";
@import "./ui/tokens.css";
@import "../../site/assets/fonts/pretendard/pretendardvariable-dynamic-subset.css";

*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  font-family:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,system-ui,Roboto,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;
  font-size:15px;line-height:22px;letter-spacing:0;color:var(--g800);background:var(--g50);
  word-break:keep-all;overflow-wrap:break-word;-webkit-font-smoothing:antialiased;margin:0;
}
.num{font-variant-numeric:tabular-nums}
```

폰트 경로는 Vite 가 번들에 넣을 수 있게 `ui/public/fonts/` 로 복사해 쓰는 쪽이 안전하다. 빌드 뒤 `site/try/` 에서 폰트 404 가 나지 않는지 Step 10 에서 확인한다.

- [x] **Step 8: `Shell.tsx` 를 쓴다**

어두운 GNB(배경 `--g900`) + 로고 + 탭 4개(`data-mj="tab" data-route=...`) + 찾기 입력 + 상태 칩, 그 아래 `<main>`. 켜진 탭은 배경 `--blue-weak`, 글자 `--blue-deep`. **사이드바를 만들지 않는다.** 루트에 `data-mj="gnb"`.

- [x] **Step 9: `Badge.tsx`·`Toasts.tsx`·`App.tsx`·`views/index.tsx` 를 쓴다**

`Badge` 는 DOM 계약의 tone 5종. `Toasts` 는 화면 아래 가운데, 되돌리기 버튼 포함. `App.tsx` 는 `Layout` 대신 `Shell`, 스켈레톤은 회색 블록 세 줄. `views/index.tsx` 는 새 4개를 매핑한다(Task 3·4 에서 채운다. 이 단계에서는 각 뷰가 제목만 렌더하는 최소 구현이어도 된다).

- [x] **Step 10: 타입·테스트·빌드를 확인한다**

```bash
cd ui && npm run typecheck && npx vitest run && npm run build
```

Expected: 타입 0 오류 · Vitest 20개 PASS · 빌드 성공 · `site/try/assets/` 갱신.

- [x] **Step 11: 커밋**

```bash
git add -A
git commit -m "ui: 앱 껍데기를 TDS 로 — 어두운 GNB·장 4개·토큰, 옛 컴포넌트·뷰 삭제"
```

---

## Task 3: 주간 장(week) — 리스트 · 맨 위 입력 줄 · 그 자리 펼침 · 바닥 합계

**Files:**
- Create: `ui/src/components/Row.tsx`, `ui/src/components/RowPanel.tsx`, `ui/src/components/EntryRow.tsx`
- Create: `ui/src/views/Week.tsx`
- Modify: `ui/src/views/index.tsx`

**Interfaces:**
- Consumes: `useData()`·`useApp()`·`useLineActions()`(`store.tsx`) · `howOf`·`counts`·`matches`(`lines.ts`) · `Badge`·`Shell`(Task 2)
- Produces:
  - `export function Row({ line, open, onOpen }: { line: Line; open: boolean; onOpen(id: string | null): void }): JSX.Element`
  - `export function RowPanel({ line }: { line: Line }): JSX.Element`
  - `export function EntryRow(): JSX.Element`

- [x] **Step 1: `Row.tsx` — 줄 하나**

시안의 `.row` 를 그대로 옮긴다. 3슬롯:
- 좌 `.av` 44×44 radius 14 — 통장이면 카드 아이콘, 봉투면 봉투 아이콘. 빈 줄이면 배경 `--amber-weak`, 글자 `--amber-text`.
- 중앙 — 제목 17px/700: 채워진 줄은 `line.name` + 구역, 빈 줄은 `line.raw` + 앰버로 「이름을 고르세요」. 서브 13px: 번호 · 경로 · (원문이 제목과 다를 때만) 원문 · 종류.
- 우 — 금액 17px/700 `tabular-nums`, 아래 근거 뱃지(`howOf(line)` 의 tone 을 `Badge` 에 넘긴다). 빈 줄이면 사유 뱃지 + 「고르기 ▾」.

루트에 `data-mj="row"`, 빈 줄이면 `data-blank="1"`. 줄 사이 구분은 `::before` 로 좌 24px 들여쓴 1px `--hair`.

- [x] **Step 2: `RowPanel.tsx` — 그 자리 펼침**

배경 `rgba(255,179,49,.1)`, 왼쪽 84px 들여씀. 안에: 한 줄 설명 → 후보 버튼들(`data-mj="cand"`, 흰 카드 radius 14, 숫자 키 칩) → 직접 고르기 입력 + 「새 이름으로 등록」 → 바닥에 보류·제외·모델로 다시 재기 + 단축키 안내. 루트에 `data-mj="panel"`.

동작은 `useLineActions()` 의 `pick`·`addNew`·`hold`·`exclude`·`rematch` 를 그대로 부른다. **드로어·모달을 만들지 않는다.** `line.allow_new` 가 거짓이면(동명이인) 「새 이름으로 등록」을 숨긴다.

- [x] **Step 3: `EntryRow.tsx` — 맨 위 고정 입력 줄**

`position:sticky; top:64px`. 이름(명부 자동 완성 `<datalist>`) · 종류(`<select>`, `data.kinds`) · 금액 · 「넣기」 파란 버튼 · 안내 문구. Enter 로 확정하면 `POST /envelope` 를 부르고 입력을 비운 뒤 이름 칸에 포커스를 돌린다. 루트에 `data-mj="entry"`.

기존 `Envelope.tsx` 가 쓰던 요청 형태를 그대로 쓴다 — `client.post("/envelope", { rows: [{ name, kind, amount }] })`.

- [x] **Step 4: `Week.tsx` — 장 한 장**

머리: 주차 넘기기 화살표 + 날짜 제목 + 「채울 줄만 보기」 토글 + 「줄 넣기」(CSV) + 「내보내기」 + 「되돌리기」(`data.can_undo` 일 때만 활성).
요약 한 줄: 전체 줄 수 · 자동 · 채울 줄 · 합계. 체험 모드일 때만 정답 대조 배지(`data.answers` 로 계산).
본문: `data-mj="ledger"` 안에 구역 둘 — 봉투(최신→과거), 통장(최신→과거). 각 구역 머리에 장 수·합계.
바닥: `data-mj="total"` 합계 3줄(봉투·통장·이번 주).

한 번에 하나만 펼친다 — `s.selected` 를 그대로 쓴다.

- [x] **Step 5: 확인**

```bash
cd ui && npm run typecheck && npx vitest run && npm run build
cd .. && python3 -m http.server 8123 -d site &
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/dev_shot.cjs "http://127.0.0.1:8123/try/" /tmp/s-try.png
```

Expected: 콘솔 에러 0. 오프라인 폴백(`recorded.json`)으로 36줄이 뜨고 빈 줄 6개가 앰버로 보인다.

- [x] **Step 6: 커밋**

```bash
git add -A
git commit -m "ui: 주간 장을 TDS 리스트로 — 맨 위 입력 줄·그 자리 펼침·바닥 합계"
```

---

## Task 4: 연말(year)·명부(roster)·설정(settings)

**Files:**
- Create: `ui/src/views/Year.tsx`, `ui/src/views/Roster.tsx`, `ui/src/views/Settings.tsx`
- Modify: `ui/src/views/index.tsx`

**Interfaces:**
- Consumes: Task 2·3 의 `Shell`·`Badge`·`Row` · `useData()`·`useApp()`
- Produces: `VIEWS` 4개 완성

- [x] **Step 1: `Year.tsx`**

사람별 누적 리스트(같은 `Row` 문법, 좌 아바타는 사람 아이콘). 머리에 연도 넘기기 + 「CSV 로 내보내기」(`/export/year`). 미확정 줄은 따로 세어 앰버 줄로 맨 위에 요약 한 줄.

- [x] **Step 2: `Roster.tsx`**

명부 리스트(이름·구역·세대) + 별칭 사전 리스트 둘로 나눈 탭. 기존 `Roster.tsx` 의 `POST /roster` 교체 기능을 그대로 유지한다.

- [x] **Step 3: `Settings.tsx`**

기기·모델 상태(`/health`), 인스턴스 주소(`window.matjangbuApiBase`), 읽기 전용 여부, 「샘플 주차 넣기」·CSV 불러오기(`POST /import` + SSE 진행), 내보내기 링크들, 초기화(`POST /reset`). 옛 `Device.tsx`·`Import.tsx`·`Records.tsx` 가 하던 일을 여기로 모은다.

- [x] **Step 4: 확인**

```bash
cd ui && npm run typecheck && npx vitest run && npm run build
```

각 해시(`#/week`·`#/year`·`#/roster`·`#/settings`)를 `dev_shot.cjs` 로 찍어 콘솔 에러 0 을 확인한다.

- [x] **Step 5: 커밋**

```bash
git add -A
git commit -m "ui: 연말·명부·설정 화면 — 대시보드·확인 큐·불러오기·기기 화면을 흡수"
```

---

## Task 5: 검증 도구 3개를 새 DOM 계약으로

**Files:**
- Modify: `tools/verify_site.cjs`, `tools/verify_funnel.cjs`, `tools/site_shots.cjs`

**Interfaces:**
- Consumes: 위 「DOM 계약」 표의 `data-mj` 선택자
- Produces: 없음(도구)

- [x] **Step 1: `verify_site.cjs`**

페이지 목록을 `["/", "/install/", "/try/"]` 로 바꾸고, 각 페이지에서 확인할 것:
- `/` — `[data-mj="hero"]` 1개, `[data-mj="matrix"]` 1개, `[data-mj="opt"][data-on="1"]` 5개 이상, `[data-mj="out"]` 1개, 콘솔 에러 0, 모바일 390px 가로 넘침 0
- `/install/` — `[data-mj="gnb"]` 1개, 콘솔 에러 0, 모바일 넘침 0
- `/try/` — `[data-mj="ledger"]` 1개, `[data-mj="tab"]` 4개, 콘솔 에러 0
- 외부 자원 0 — 모든 요청 URL 이 같은 origin 인지 확인

- [x] **Step 2: `verify_funnel.cjs`**

깔때기를 새 동선으로: `/` 히어로의 「체험하기」 → `/try/` → `[data-mj="row"][data-blank="1"]` 첫 줄 클릭 → `[data-mj="panel"]` 이 열림 → `[data-mj="cand"]` 첫 후보 클릭 → 그 줄의 `data-blank` 가 사라짐. 읽기 전용(폴백) 모드에서는 후보 클릭이 막히므로, 그때는 판이 열리는 데까지만 확인한다.

- [x] **Step 3: `site_shots.cjs`**

찍을 목록을 `/`(데스크톱·모바일) · `/install/` · `/try/#/week` · `/try/#/year` · `/try/#/roster` · `/try/#/settings` 로 바꾼다.

- [x] **Step 4: 확인**

```bash
python3 -m http.server 8123 -d site &
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.cjs http://127.0.0.1:8123
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_funnel.cjs http://127.0.0.1:8123
```

Expected: 둘 다 exit 0.

- [x] **Step 5: 커밋**

```bash
git add -A
git commit -m "tools: 검증 도구 3개를 새 DOM 계약(data-mj)으로 다시 씀"
```

---

## Task 6: 통합 — 8108 인스턴스에서 실제로 돌려 보고 승인 요청

**Files:** 없음(확인만)

- [x] **Step 1: 전체 검사**

```bash
.venv/bin/python -m pytest -q
cd ui && npm run typecheck && npx vitest run && npm run build && cd ..
```

Expected: pytest 44개 PASS · 타입 0 · Vitest 20개 PASS · 빌드 성공

- [x] **Step 2: 인스턴스에서 확인**

```bash
systemctl --user status matjangbu-web --no-pager | head -5
curl -s 127.0.0.1:8108/api/health
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.cjs http://127.0.0.1:8108
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_funnel.cjs http://127.0.0.1:8108
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/site_shots.cjs http://127.0.0.1:8108
```

Expected: 전부 exit 0. 8108 은 작업 트리의 `site/` 를 그대로 서빙하므로 빌드 산출물이 바로 반영된다.

- [~] **Step 3: 커밋하고 사용자에게 보인다** — 커밋 완료, 사용자 승인 대기

```bash
git add -A
git commit -m "site(try): React 앱 빌드 산출물 — TDS 리스트형 장부·스크린샷 갱신"
```

그리고 **사용자에게 8108 을 직접 열어 보라고 요청한다.** 승인 전에는 `git subtree push --prefix site origin gh-pages` 를 하지 않는다(결정 #15).

---

## 자체 점검

**스펙 커버리지** — 결정 기록(`docs/superpowers/specs/2026-09-21-ledger-redesign-decisions.md`) 대조:
- #3·#4 장부 한 권 · 장 4개 → Task 2 Step 3·8, Task 3·4
- #5' 줄 자리 펼침 → Task 3 Step 2
- #6' 맨 위 고정 입력 줄 → Task 3 Step 3
- #7 사이트 세 장 → Task 1
- #8·13b''·13b''' 랜딩 서사·PyTorch 배치·TDS 색 → Task 1 Step 2
- #9'·9'' 리스트·토스 파랑 → Task 2 Step 6·7, Task 3 Step 1
- #10 순수 모듈 유지·components/views 파일째 삭제 → Task 2 Step 5
- #11 대시보드·확인 큐·최근 활동 삭제, 정답 대조 한 줄 → Task 2 Step 5, Task 3 Step 4
- #12 랜딩 모바일 완전 대응·장부는 1100px 미만 줄 카드 → Task 1 Step 8, Task 3(시안 미디어 쿼리 이식)
- #15 배포 게이트 → Task 6 Step 3
- #18 고르기 판은 명령이 아니라 잰 값 → Task 1 Step 2(시안 그대로)
- 「알아서 처리」 3건(검증 도구·pytest·NOTICE) → Task 5, Task 1 Step 6·7

**빠진 것 없음.** 「잠정명」 배지는 시안에 이미 들어 있다.

**타입 일관성** — `Route` 는 `labels.ts` 한 곳에서만 나온다. `Row`/`RowPanel`/`EntryRow` 의 시그니처는 Task 3 Interfaces 에 적힌 것과 Task 4 에서 쓰는 것이 같다. `Badge` 의 tone 5종은 DOM 계약 표와 `lines.ts` 의 `HowTone`(3종) + 빈 줄용 2종으로 맞춘다 — `howOf` 는 `rule|model|human` 만 내고, `need`·`plain` 은 화면이 직접 준다.
