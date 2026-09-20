# 웹 UI 재설계(토스 TDS · 그라데이션 3종 · `/try` React) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/try` 체험 앱을 Vite + React 19 + TypeScript + Tailwind 4 + shadcn(Radix) 으로 다시 짓고, 사이트 네 장에 청록→초록 주색·Pretendard·16px 모서리 토큰을 입힌다. 기능·API·삼중 폴백·검증 도구 계약은 그대로.

**Architecture:** 파이썬 서버(`web/`)는 `site/`를 정적으로 서빙하고 API 15개를 낸다 — 손대지 않는다. 새 폴더 `ui/`의 React 소스를 `npm run build`로 `site/try/`(index.html + assets/)에 빌드해 커밋한다. 상태는 `useReducer` 하나, 해시 라우팅 훅 하나, API 클라이언트 모듈 하나. 나머지 3장(`/`·`/download/`·`/phone/`)은 `site/assets/app.css`와 랜딩 인라인 CSS 의 토큰만 바꾼다.

**Tech Stack:** Node 26 · npm 11 · Vite 8 · React 19 · TypeScript 6 · Tailwind 4 · shadcn 4(radix-nova 프리셋, `radix-ui` 패키지) · lucide-react · Vitest 5 · Playwright(검증 도구, `NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules`) · Pretendard 1.3.9(OFL, npm `pretendard`).

정본 스펙: `docs/superpowers/specs/2026-09-21-ui-toss-redesign-design.md`. 이 계획의 §번호 언급은 그 스펙의 절이다.

## Global Constraints

- 외부 요청 0: 폰트·아이콘·스크립트 전부 같은 출처. `tools/verify_site.cjs`의 「외부 요청 0」이 증거(스펙 §0-4).
- 파이썬(`engine/`·`web/`·`tests/`)은 한 줄도 바꾸지 않는다. `.venv/bin/python -m pytest -q` 44개 그대로(스펙 §0-3).
- 검증 계약 셀렉터를 React 가 그대로 낸다: `h1`, `#banner`(+`hidden`), `.qcard`, `select[data-any]`, `[data-pick-any]`, `[data-more]`, `#imp-week`, `#imp-run`, `#imp-progress`(`.err`), `tr.row[data-id]`, `main table tbody tr`, `#toasts .toast.err`, `window.matjangbuApiBase`(스펙 §6). 같은 id 를 한 화면에 두 번 내지 않는다(Playwright strict).
- 그라데이션은 5종류 요소에만: 주 버튼 면 · 활성 메뉴 표시 · 로고 마크 · 큰 숫자 글자 · 진행 막대/경로 점. 면(카드·배경·표 머리)에는 금지(스펙 §1.1).
- 색 값(스펙 §1.1): brand `#1DB5AB → #5FC884 → #9EDC5F`, brand-deep(흰 글자 면) `#14A99F → #3DB874 → #6CC65B`, model `#0FC4C0 → #4B87D5 → #8A51E7`, human `#AED15B → #D5D84F → #F6DC4D`; 단색 `--brand #17A896` · `--brand-ink #0F7D71` · `--brand-bg #E9F8F3` · `--model #5B4BD6`/`--model-bg #EEF0FC` · `--human #6B7A12`/`--human-bg #F6F9E4`; 앰버 `#b45309`/`#fef3c7`, 빨강 `#b91c1c`/`#fee2e2` 단색 유지. 라이트 전용.
- 타이포(스펙 §1.2): 스택 `"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`. 본문 15px/1.6 · 페이지 제목 22px/700 · 섹션 제목 17px/700 · 큰 숫자 32px/800 tabular · 보조 13px · 배지 12px/600.
- 형태(스펙 §1.3): 카드 16px · 버튼/입력 12px · 배지 999px · 작은 요소 8px. 간격 4px 배수. 전환 150~200ms ease-out, `prefers-reduced-motion` 존중. 아이콘 버튼 전부 `aria-label`.
- 문구는 지금 것을 유지. 새 문구는 「다른 방법」·「되돌리기」·「다음 주 불러오기」·「불러오기로」뿐(스펙 §3-9).
- 재지 않은 숫자·가격·고객 수를 적지 않는다. 실제 단체 자료를 넣지 않는다.
- 커밋 메시지 끝: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. 빌드 산출물(`site/try/index.html`·`site/try/assets/`)은 커밋한다. `ui/node_modules/`는 커밋하지 않는다.
- 작업 위치 `~/Projects/03-personal/matjangbu`, `main` 직접. 체험 인스턴스(systemd `matjangbu-web`, 8108)는 이 작업 트리의 `site/`를 그대로 서빙하므로 `site/try/`를 빌드하면 Funnel 의 `/try/`도 즉시 바뀐다(공개 Pages 는 subtree push 전까지 그대로). 개발 중 확인은 `npm run dev`(5173, API 프록시 → 8108)로 하고, `site/try/` 빌드는 과제 13 에서만 한다.

---

## 파일 구조

```
ui/                                  ← 새 폴더(과제 1)
  package.json  package-lock.json  vite.config.ts  tsconfig.json  tsconfig.app.json  tsconfig.node.json
  components.json  index.html  eslint.config.js  .prettierrc  .prettierignore
  src/
    main.tsx            React 루트 마운트
    App.tsx             Provider + 골격(Layout) + 라우트 스위치 + 초기 로드
    index.css           Tailwind 진입 + 토큰(§1) + 컴포넌트 클래스(.qcard .toast .grad-text .btn-grad …)
    types.ts            서버 payload 타입(AppData·Line·Person·Cand·ModelInfo·Recorded·Health·Toast·EnvRow)
    labels.ts           ROUTES·TITLES·STATE·REASON·NO_KIND
    format.ts           won·fmtTs
    fallback.ts         guessWeek·parseCsv·offline·localWeekCsv·localYearCsv (순수, Vitest)
    api.ts              세션 저장·makeClient(api/post/stream)·parseSse (순수 부분 Vitest)
    load.ts             삼중 폴백 resolveState
    store.tsx           AppState·reducer·Provider·useApp·useLineActions
    route.ts            parseHash·useHashRoute
    hooks.ts            useMediaQuery
    components/
      Layout.tsx        골격(사이드바·상단바·탭바·배너·본문·패널·토스트·datalist)
      Sidebar.tsx  Topbar.tsx  TabBar.tsx  Banner.tsx  InstanceStatus.tsx  Toasts.tsx
      StateBadge.tsx  HowBadge.tsx  StatTile.tsx  GradientNumber.tsx  ProgressBar.tsx
      EmptyState.tsx  LineTable.tsx  CandidatePicker.tsx  LinePanel.tsx  CsvTable.tsx  SectionHead.tsx
      ui/               shadcn 생성물(button badge card input sheet collapsible skeleton) — 손으로 고치지 않는다
    views/
      Dashboard.tsx  Import.tsx  Envelope.tsx  Queue.tsx  Records.tsx  Roster.tsx  Device.tsx
  test/
    fixtures.ts         recorded.json 픽스처 로더
    fallback.test.ts  format.test.ts  api.test.ts  route.test.ts
site/assets/fonts/pretendard/        ← 과제 2 (CSS 1 + woff2 92 + LICENSE)
site/assets/app.css  site/index.html  site/download/index.html  site/phone/index.html   ← 과제 3 토큰
site/try/index.html  site/try/assets/                                                   ← 과제 13 빌드 산출물
tools/site_shots.cjs  tools/verify_funnel.cjs                                           ← 과제 13 [data-more] 한 줄
README.md  docs/ops.md  docs/design-notes.md  docs/superpowers/specs/2026-09-20-matjangbu-design.md  docs/handoffs/HANDOFF.md ← 과제 14
```

각 파일의 책임은 하나다. 화면 컴포넌트는 데이터를 `useApp()`에서 읽고 액션을 `useLineActions()`로 보낸다. 서버 모양(`types.ts`)은 `web/server.py`의 `state()`·`health()`·`_view()` 반환값과 1:1 이다.

---

### Task 1: `ui/` 스캐폴드 — Vite + React + Tailwind + shadcn, 빌드·테스트 배관

**Files:**
- Create: `ui/`(shadcn CLI 가 만든다) → 정리 후 `ui/vite.config.ts`, `ui/index.html`, `ui/package.json`(scripts), `ui/src/main.tsx`, `ui/src/App.tsx`, `ui/src/index.css`
- Create: `ui/test/smoke.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm run dev`(5173, `/api`·`/recorded.json`·`/sample-envelopes.json`·`/assets/fonts` → 8108 프록시), `npm run build`(→ `../site/try/`), `npm test`(Vitest), 경로 별칭 `@/` = `ui/src/`, shadcn 컴포넌트 `@/components/ui/{button,badge,card,input,sheet,collapsible,skeleton}`.

- [ ] **Step 1: shadcn 으로 Vite 프로젝트 생성**

```bash
cd ~/Projects/03-personal/matjangbu
npx -y shadcn@latest init -t vite -b radix -p nova -y --no-monorepo -n ui </dev/null
cd ui
npx -y shadcn@latest add badge card input sheet collapsible skeleton -y </dev/null
ls src/components/ui   # badge.tsx button.tsx card.tsx collapsible.tsx input.tsx sheet.tsx skeleton.tsx
```

Expected: `ui/` 에 `package.json`·`vite.config.ts`·`components.json`·`src/`. (`-p nova` 없이 돌리면 프리셋 프롬프트에서 멈춘다. `--no-monorepo` 없이도 멈춘다.)

- [ ] **Step 2: 스캐폴드 찌꺼기 제거 — 내부 git·Geist 폰트·다크 테마·샘플 자산**

```bash
cd ~/Projects/03-personal/matjangbu/ui
rm -rf .git README.md public/vite.svg src/assets src/components/theme-provider.tsx
npm uninstall @fontsource-variable/geist
npm i -D @types/node@^26 vitest@^5     # @types/node@20 이면 vitest 5 가 ERESOLVE 로 실패한다
```

Expected: `package.json` 의 `dependencies` 에 geist 없음, `devDependencies` 에 `vitest`·`@types/node@^26`.

- [ ] **Step 3: `vite.config.ts` — base·outDir·프록시**

```ts
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const api = "http://127.0.0.1:8108"

// 빌드는 ../site/try 로 나간다(index.html + assets/). recorded.json·sample-envelopes.json 은 web.record 가 만드는
// 데이터 파일이라 emptyOutDir 를 끄고, package.json 의 build 스크립트가 assets/ 만 지운다.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { outDir: "../site/try", emptyOutDir: false },
  server: {
    proxy: {
      "/api": api,
      "/recorded.json": { target: api, rewrite: (p) => "/try" + p },
      "/sample-envelopes.json": { target: api, rewrite: (p) => "/try" + p },
      "/assets/fonts": api,
    },
  },
})
```

- [ ] **Step 4: `package.json` scripts 교체**

`scripts` 를 다음으로 바꾼다(다른 키는 그대로):

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && rm -rf ../site/try/assets && vite build",
  "test": "vitest run",
  "typecheck": "tsc -b",
  "lint": "eslint .",
  "format": "prettier --write \"**/*.{ts,tsx}\"",
  "preview": "vite preview"
}
```

- [ ] **Step 5: `index.html`**

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>맞장부 — 앱</title>
<meta name="description" content="맞장부 앱 화면 — 불러오기 · 봉투 입력 · 확인 큐 · 기록 · 명부. 체험 인스턴스에서는 가공 샘플 4주를 규칙 2단 + 소형 언어모델로 맞춘 결과를 보여주고, 사람이 고른 답은 별칭 사전에 쌓여 다음 주부터 자동이 됩니다. 외부 API 호출 0.">
<!-- 체험 인스턴스 주소(쉼표로 여러 개, 앞이 우선) — 같은 origin(./api)이 먼저, 안 되면 이 주소들을 차례로, 다 안 되면 recorded.json 읽기 전용 -->
<meta name="matjangbu-api" content="https://omarchy.tailb0e058.ts.net/">
<!-- 같은 출처 폰트(과제 2). Vite 는 루트 밖 상대 경로를 손대지 않고 그대로 낸다 -->
<link rel="stylesheet" href="../assets/fonts/pretendard/pretendardvariable-dynamic-subset.css">
</head>
<body>
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 6: `src/main.tsx`·`src/App.tsx` 를 최소로**

`src/main.tsx`:
```tsx
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/App.tsx`(과제 6 에서 교체):
```tsx
export default function App() {
  return <h1 className="p-6 text-[22px] font-bold">맞장부</h1>
}
```

- [ ] **Step 7: `src/index.css` — 토큰(§1)으로 교체**

파일 전체를 다음으로 바꾼다:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

/* ---- 토큰(스펙 §1). 네 장 공통 값 — site/assets/app.css 와 site/index.html 인라인 CSS 의 :root 와 같은 값을 쓴다. */
@theme inline {
  --font-sans: "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  --breakpoint-lg: 1100px;

  --color-brand: #17A896;
  --color-brand-ink: #0F7D71;
  --color-brand-bg: #E9F8F3;
  --color-model: #5B4BD6;
  --color-model-bg: #EEF0FC;
  --color-human: #6B7A12;
  --color-human-bg: #F6F9E4;
  --color-amber: #b45309;
  --color-amber-bg: #fef3c7;
  --color-red: #b91c1c;
  --color-red-bg: #fee2e2;
  --color-ink: #0f172a;
  --color-muted: var(--muted);
  --color-faint: #94a3b8;
  --color-line: #e5e7eb;
  --color-line-2: #cbd5e1;
  --color-surface: #f8fafc;

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 16px;
  --radius-3xl: 20px;
}

:root {
  --background: #ffffff;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --popover: #ffffff;
  --popover-foreground: #0f172a;
  --primary: #17A896;
  --primary-foreground: #ffffff;
  --secondary: #f1f5f9;
  --secondary-foreground: #0f172a;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --accent: #E9F8F3;
  --accent-foreground: #0F7D71;
  --destructive: #b91c1c;
  --border: #e5e7eb;
  --input: #cbd5e1;
  --ring: #17A896;
  --radius: 12px;

  --grad-brand: linear-gradient(135deg, #1DB5AB 0%, #5FC884 55%, #9EDC5F 100%);
  --grad-brand-deep: linear-gradient(135deg, #14A99F 0%, #3DB874 55%, #6CC65B 100%);
  --grad-model: linear-gradient(135deg, #0FC4C0 0%, #4B87D5 55%, #8A51E7 100%);
  --grad-human: linear-gradient(135deg, #AED15B 0%, #D5D84F 55%, #F6DC4D 100%);

  --sidebar-w: 240px;
  --topbar-h: 56px;
  --panel-w: 420px;
  --tabbar-h: 60px;
}

@layer base {
  * { @apply border-border outline-ring/50; }
  html { -webkit-text-size-adjust: 100%; }
  body { @apply bg-surface text-ink font-sans; font-size: 15px; line-height: 1.6; letter-spacing: -0.005em;
         word-break: keep-all; overflow-wrap: break-word; -webkit-font-smoothing: antialiased; }
  h1, h2, h3, h4 { @apply font-bold; letter-spacing: -0.02em; line-height: 1.3; }
  :focus-visible { outline: 2px solid var(--color-brand); outline-offset: 2px; }
  select, input[type="text"], input[type="search"], input[type="number"], input[type="date"] {
    @apply h-10 w-full rounded-lg border border-line-2 bg-white px-3 text-[15px] text-ink;
  }
  select:focus, input:focus { outline: none; border-color: var(--color-brand); box-shadow: 0 0 0 3px var(--color-brand-bg); }
  input[type="file"] { @apply text-[14px]; }
  table { border-collapse: collapse; }
}

/* ---- 그라데이션 5종류(면·표 머리·배경 금지) */
.grad-text { background: var(--grad-brand); -webkit-background-clip: text; background-clip: text; color: transparent; }
.grad-text-human { background: var(--grad-human); -webkit-background-clip: text; background-clip: text; color: transparent; }
.btn-grad { background: var(--grad-brand-deep); color: #fff; border-color: transparent; }
.btn-grad:hover { filter: brightness(1.06); }
.btn-grad:active { transform: scale(0.98); }
.btn-grad:disabled { filter: none; }
.dot-brand, .dot-model, .dot-human { display: inline-block; width: 8px; height: 8px; border-radius: 999px; flex: none; }
.dot-brand { background: var(--grad-brand); }
.dot-model { background: var(--grad-model); }
.dot-human { background: var(--grad-human); }
.nav-active::before { content: ""; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px; border-radius: 999px; background: var(--grad-brand); }
.bar-fill { background: var(--grad-brand); transition: width 150ms ease-out; }
.card-model { border-top: 2px solid transparent; border-image: var(--grad-model) 1; border-image-width: 2px 0 0 0; }

/* ---- 카드·배지·토스트(검증 계약 클래스는 여기 이름 그대로) */
.card { @apply rounded-2xl border border-line bg-white p-5; box-shadow: 0 1px 2px rgba(15,23,42,.05); }
.badge { @apply inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap leading-none; }
.badge-auto, .badge-confirmed { @apply bg-brand-bg text-brand-ink; }
.badge-held { @apply bg-amber-bg text-amber; }
.badge-excluded, .badge-gray { @apply bg-slate-100 text-muted-foreground; }
.badge-model { @apply bg-model-bg text-model; }
.badge-human { @apply bg-human-bg text-human; }
.badge-red { @apply bg-red-bg text-red; }
.qcard { @apply rounded-2xl border border-line bg-white p-5 grid gap-3; box-shadow: 0 1px 2px rgba(15,23,42,.05);
         transition: opacity 200ms ease-out, transform 200ms ease-out; }
.qcard.leaving { opacity: 0; transform: scale(0.98); pointer-events: none; }
.cand { @apply flex w-full items-center gap-3 rounded-xl border border-line bg-white px-3.5 py-3 text-left text-[15px];
        transition: border-color 150ms ease-out, background 150ms ease-out, transform 150ms ease-out; }
.cand:hover:not(:disabled) { border-color: var(--color-brand); background: var(--color-brand-bg); }
.cand:active:not(:disabled) { transform: scale(0.99); }
.cand:disabled { opacity: .55; }
.toast-wrap { position: fixed; right: 20px; bottom: 20px; display: grid; gap: 8px; z-index: 60; max-width: min(26rem, calc(100vw - 40px)); }
.toast { @apply flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] text-white; background: #0f172a;
         box-shadow: 0 10px 30px rgba(15,23,42,.18); animation: toast-in 180ms ease-out; }
.toast.err { background: var(--color-red); }
.toast.ok { background: var(--color-brand-ink); }
.toast button { @apply ml-auto rounded-lg px-2.5 py-1 text-[13px] font-bold; background: rgba(255,255,255,.16); }
.toast button:hover { background: rgba(255,255,255,.28); }
@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.row-click { cursor: pointer; }
.row-click:hover { background: var(--color-surface); }
.row-click[aria-selected="true"] { background: var(--color-brand-bg); }
.press:active { transform: scale(0.98); }

/* ---- 골격(스펙 §2.1). 1100px 경계 */
.app { display: grid; height: 100vh; grid-template-columns: var(--sidebar-w) minmax(0, 1fr); grid-template-rows: auto var(--topbar-h) minmax(0, 1fr); }
.app .sidebar { grid-row: 1 / 4; grid-column: 1; }
.app .banner { grid-column: 2; grid-row: 1; }
.app .topbar { grid-column: 2; grid-row: 2; }
.app .main { grid-column: 2; grid-row: 3; transition: margin-right 180ms ease-out; }
.app.panel-open .main, .app.panel-open .topbar, .app.panel-open .banner { margin-right: var(--panel-w); }
.panel { position: fixed; top: 0; right: 0; bottom: 0; width: var(--panel-w); max-width: 100vw; background: #fff; border-left: 1px solid var(--color-line);
         box-shadow: -4px 0 16px rgba(15,23,42,.06); z-index: 50; transform: translateX(100%); transition: transform 180ms ease-out; display: flex; flex-direction: column; }
.panel.open { transform: none; }
.tabbar { display: none; }
.cta-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
@media (max-width: 1099px) {
  .app { height: auto; min-height: 100vh; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr); padding-bottom: var(--tabbar-h); }
  .app .sidebar { display: none; }
  .app .banner { grid-column: 1; grid-row: 1; }
  .app .topbar { grid-column: 1; grid-row: 2; height: auto; }
  .app .main { grid-column: 1; grid-row: 3; overflow: visible; }
  .app.panel-open .main, .app.panel-open .topbar, .app.panel-open .banner { margin-right: 0; }
  .panel { display: none; }
  .tabbar { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); position: fixed; left: 0; right: 0; bottom: 0; height: var(--tabbar-h);
            background: rgba(255,255,255,.96); backdrop-filter: blur(8px); border-top: 1px solid var(--color-line); z-index: 45; }
  .cta-row.cta-fixed { position: fixed; left: 0; right: 0; bottom: var(--tabbar-h); padding: 12px 16px; background: rgba(255,255,255,.96);
                    backdrop-filter: blur(8px); border-top: 1px solid var(--color-line); z-index: 44; }
  .cta-row.cta-fixed > button:first-child { flex: 1; height: 48px; font-size: 16px; }
  .toast-wrap { right: 16px; left: 16px; bottom: calc(var(--tabbar-h) + 12px); max-width: none; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

- [ ] **Step 8: 스모크 테스트 작성·실행**

`ui/test/smoke.test.ts`:
```ts
import { expect, test } from "vitest"

test("vitest runs", () => {
  expect(1 + 1).toBe(2)
})
```

Run: `cd ~/Projects/03-personal/matjangbu/ui && npm test`
Expected: `Tests  1 passed (1)`

- [ ] **Step 9: 타입 검사·개발 서버 확인**

```bash
cd ~/Projects/03-personal/matjangbu/ui && npm run typecheck && (npm run dev -- --port 5173 >/tmp/claude-1000/vite-dev.log 2>&1 &) && sleep 3 && curl -s http://127.0.0.1:5173/ | grep -o '<title>[^<]*' && curl -s http://127.0.0.1:5173/api/health | head -c 120; echo; pkill -f 'vite --port 5173'
```

Expected: `<title>맞장부 — 앱`, `/api/health` 가 8108 의 JSON(`{"mode": "demo", …}`)을 프록시로 돌려준다. **`npm run build` 는 아직 돌리지 않는다**(살아 있는 `site/try/index.html` 을 덮어쓴다).

- [ ] **Step 10: `.gitignore` 에 추가 후 커밋**

`.gitignore` 끝에:
```
ui/node_modules/
ui/node_modules/.tmp/
```

```bash
cd ~/Projects/03-personal/matjangbu && git add .gitignore ui && git status --short | head -30
git commit -m "ui: Vite + React + Tailwind + shadcn 스캐폴드 — 토큰·프록시·Vitest 배관

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Pretendard 자체 호스팅 — `site/assets/fonts/pretendard/` + 네 장 `<link>`

**Files:**
- Create: `site/assets/fonts/pretendard/pretendardvariable-dynamic-subset.css`, `site/assets/fonts/pretendard/woff2-dynamic-subset/*.woff2`(92개), `site/assets/fonts/pretendard/LICENSE.txt`
- Modify: `site/index.html`(head), `site/download/index.html`(head), `site/phone/index.html`(head) — `ui/index.html` 은 과제 1 에서 이미 넣었다
- Modify: `NOTICE`(있으면) 또는 `README.md` 라이선스 절 — 과제 14 에서 함께

**Interfaces:**
- Produces: `assets/fonts/pretendard/pretendardvariable-dynamic-subset.css`(`font-family: 'Pretendard Variable'`, `font-weight: 45 920`, `font-display: swap`, 상대 경로 `./woff2-dynamic-subset/…`).

- [ ] **Step 1: npm 패키지에서 다이내믹 서브셋만 꺼낸다**

```bash
cd /tmp/claude-1000 && npm pack pretendard@1.3.9 --silent && mkdir -p pt && tar xzf pretendard-1.3.9.tgz -C pt package/dist/web/variable/pretendardvariable-dynamic-subset.css package/dist/web/variable/woff2-dynamic-subset package/dist/LICENSE.txt
D=~/Projects/03-personal/matjangbu/site/assets/fonts/pretendard; mkdir -p $D
cp pt/package/dist/web/variable/pretendardvariable-dynamic-subset.css $D/ && cp -r pt/package/dist/web/variable/woff2-dynamic-subset $D/ && cp pt/package/dist/LICENSE.txt $D/
ls $D/woff2-dynamic-subset | wc -l; du -sh $D; head -12 $D/pretendardvariable-dynamic-subset.css
```

Expected: `92`, 약 `3.2M`, CSS 머리에 OFL 고지와 `@font-face { font-family: 'Pretendard Variable'; … font-weight: 45 920; src: url(./woff2-dynamic-subset/PretendardVariable.subset.0.woff2) …`.

- [ ] **Step 2: 세 장의 `<head>`에 링크 — `<meta property="og:type">` 다음 줄(랜딩), `<link rel="stylesheet" href="../assets/app.css">` 앞 줄(설치·기기)**

랜딩 `site/index.html`:
```html
<link rel="stylesheet" href="assets/fonts/pretendard/pretendardvariable-dynamic-subset.css">
```
`site/download/index.html`·`site/phone/index.html`:
```html
<link rel="stylesheet" href="../assets/fonts/pretendard/pretendardvariable-dynamic-subset.css">
```

랜딩 `<style>` 첫 주석의 「외부 스크립트·웹폰트·CDN·외부 이미지 없음」을 「외부 스크립트·CDN·외부 이미지 없음 — 폰트는 같은 출처(assets/fonts)에서 읽고, 없으면 시스템 글꼴」로 고친다.

- [ ] **Step 3: 정적 서버로 검증 — 외부 요청 0 · 정적 4xx 0**

```bash
cd ~/Projects/03-personal/matjangbu && (python3 -m http.server 8123 -d site >/dev/null 2>&1 &) ; sleep 1
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.cjs --base http://127.0.0.1:8123 --expect-banner
curl -sI http://127.0.0.1:8123/assets/fonts/pretendard/pretendardvariable-dynamic-subset.css | head -1
```

Expected: 네 경로 `✓`, `✓ 외부 요청 0`, `✓ 정적 4xx 0`, 폰트 CSS `200`. (8123 이 이미 떠 있으면 그대로 쓴다 — 핸드오프에 pid 371329 로 적혀 있다.)

- [ ] **Step 4: 커밋**

```bash
cd ~/Projects/03-personal/matjangbu && git add site/assets/fonts site/index.html site/download/index.html site/phone/index.html
git commit -m "site: Pretendard Variable 자체 호스팅(다이내믹 서브셋, OFL) — 네 장 같은 출처 링크

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: 정적 3장 토큰 교체 — `app.css` + 랜딩 인라인 CSS + 그라데이션 액센트

**Files:**
- Modify: `site/assets/app.css:6-20`(`:root`), `:45-70`(버튼·배지), 카드·스탯·표·폼 radius
- Modify: `site/index.html` `<style>` `:root`·`.btn-primary`·`.hero .pill`·`.pipe .box.ai/.human`·`.step .ico`·`.feat .ico`·`.eyebrow`, `<symbol id="i-logo">`, 히어로 `<h1>`
- Modify: `site/download/index.html`·`site/phone/index.html` `<symbol id="i-logo">`

**Interfaces:**
- Produces: CSS 토큰 이름 `--brand`·`--brand-ink`·`--brand-bg`·`--grad-brand`·`--grad-brand-deep`·`--grad-model`·`--grad-human`·`--model`·`--model-bg`·`--human`·`--human-bg`. 기존 `--green`·`--green-2`·`--green-bg` 는 **별칭으로 남긴다**(`--green: var(--brand-ink)` 등) — 세 장의 본문 CSS 가 수십 곳에서 쓰고 있어 이름을 전부 바꾸지 않는다.

- [ ] **Step 1: `site/assets/app.css` 의 `:root` 를 교체**

```css
:root{
  color-scheme:light;
  --bg:#fff; --surface:#f8fafc; --line:#e5e7eb; --line-2:#cbd5e1; --ink:#0f172a; --muted:#64748b; --faint:#94a3b8;
  /* 주색(규칙·자동) — 스펙 2026-09-21 §1.1. --green* 은 옛 이름의 별칭 */
  --brand:#17A896; --brand-ink:#0F7D71; --brand-bg:#E9F8F3;
  --green:var(--brand-ink); --green-2:#0B6359; --green-bg:var(--brand-bg);
  --model:#5B4BD6; --model-bg:#EEF0FC; --human:#6B7A12; --human-bg:#F6F9E4;
  --grad-brand:linear-gradient(135deg,#1DB5AB 0%,#5FC884 55%,#9EDC5F 100%);
  --grad-brand-deep:linear-gradient(135deg,#14A99F 0%,#3DB874 55%,#6CC65B 100%);
  --grad-model:linear-gradient(135deg,#0FC4C0 0%,#4B87D5 55%,#8A51E7 100%);
  --grad-human:linear-gradient(135deg,#AED15B 0%,#D5D84F 55%,#F6DC4D 100%);
  --amber:#b45309; --amber-bg:#fef3c7;
  --red:#b91c1c; --red-bg:#fee2e2;
  --blue:#1d4ed8; --blue-bg:#dbeafe;
  --gray-bg:#f1f5f9;
  --sans:"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;
  --radius:16px; --radius-sm:12px;
  --shadow:0 1px 2px rgba(15,23,42,.05);
  --shadow-2:0 10px 30px rgba(15,23,42,.10),0 1px 2px rgba(15,23,42,.06);
  --sidebar:240px; --topbar:56px; --drawer:420px;
}
```

같은 파일에서:
- `.btn-primary{background:var(--green);color:#fff;border-color:var(--green)}` → `.btn-primary{background:var(--grad-brand-deep);color:#fff;border-color:transparent}` / `.btn-primary:hover{filter:brightness(1.06);color:#fff}` / `.btn:active{transform:scale(.98)}` 추가.
- `.btn{…padding:.6rem .95rem…}` → `padding:.7rem 1.1rem`, `.btn-lg{font-size:1rem;padding:.9rem 1.5rem}`.
- `.badge-approved{background:var(--blue-bg);color:var(--blue)}` 는 그대로(기록 화면 「자동」 배지는 React 쪽이 새 이름을 쓴다).
- 파일 머리 주석의 「시스템 글꼴」을 「Pretendard(같은 출처)」로.
- 맨 끝에 추가:
```css
/* ---------- 그라데이션 액센트(5종류에만: 주 버튼·활성 표시·로고·큰 숫자·진행/경로 점) */
.grad-text{background:var(--grad-brand);-webkit-background-clip:text;background-clip:text;color:transparent}
.dot-brand,.dot-model,.dot-human{display:inline-block;width:8px;height:8px;border-radius:999px;flex:none}
.dot-brand{background:var(--grad-brand)} .dot-model{background:var(--grad-model)} .dot-human{background:var(--grad-human)}
.stat .n.grad{background:var(--grad-brand);-webkit-background-clip:text;background-clip:text;color:transparent}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{transition-duration:.01ms!important;animation-duration:.01ms!important}}
```

- [ ] **Step 2: 랜딩 `site/index.html` 인라인 `<style>` 의 `:root` 를 Step 1 과 같은 값으로 교체하고(`--sidebar`·`--topbar`·`--drawer` 세 줄은 뺀다), 아래 규칙을 바꾼다**

- `.btn-primary`·`.btn-primary:hover`·`.btn:active` — Step 1 과 동일.
- `.hero .pill{…color:var(--green);background:var(--green-bg);…}` → 앞에 점: `.hero .pill::before{content:"";width:8px;height:8px;border-radius:999px;background:var(--grad-brand)}` 추가, `gap:.55rem`.
- `.hero h1 .grad-text` 는 Step 1 의 `.grad-text` 규칙을 인라인 `<style>`에도 복사(랜딩은 인라인이므로).
- `.pipe .box.ai{border-color:var(--green);background:var(--green-bg);box-shadow:0 0 0 3px rgba(21,128,61,.12)}` → `.pipe .box.ai{border:2px solid transparent;background:linear-gradient(#fff,#fff) padding-box,var(--grad-model) border-box}` · `.pipe .box.ai span{color:var(--model)}` · `.pipe .box.ai .who{background:var(--grad-model);color:#fff}`.
- `.pipe .box.human .who{background:var(--amber-bg);color:var(--amber)}` → `.pipe .box.human .who{background:var(--human-bg);color:var(--human)}` + `.pipe .box.human .who::before{content:"";display:inline-block;width:6px;height:6px;border-radius:999px;background:var(--grad-human);margin-right:.35em;vertical-align:middle}`.
- `.step .ico`·`.feat .ico`·`.dev .ico`·`.problem .ico`·`.privacy .ico` 의 `color:var(--green)` 은 별칭 덕에 자동으로 `--brand-ink` 가 된다 — 손대지 않는다.
- `.shot{…border-radius:12px…}` → `16px`.

- [ ] **Step 3: 로고 마크를 그라데이션으로 — 세 장의 `<symbol id="i-logo">`(랜딩 208행, 설치 32행, 기기 32행)**

```html
<symbol id="i-logo" viewBox="0 0 32 32"><defs><linearGradient id="g-logo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1DB5AB"/><stop offset=".55" stop-color="#5FC884"/><stop offset="1" stop-color="#9EDC5F"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#g-logo)"/><path d="M8 9h16M8 15h16M8 21h10" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M21 19l2.5 2.5L28 17" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></symbol>
```

- [ ] **Step 4: 히어로 h1 의 한 단어를 그라데이션 글자로 — `site/index.html` 244행**

```html
<h1>봉투와 통장의 이름을 명부와 <span class="grad-text">맞추고</span>, 매주 기록합니다</h1>
```

- [ ] **Step 5: 정적 서버 검증 + 스크린샷으로 눈 확인**

```bash
cd ~/Projects/03-personal/matjangbu
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.cjs --base http://127.0.0.1:8123 --expect-banner
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:900}});
for(const [u,n] of [['/','landing-top'],['/download/','download'],['/phone/','phone']]){await p.goto('http://127.0.0.1:8123'+u,{waitUntil:'networkidle'});await p.screenshot({path:'docs/shots/'+n+'.png'});}
await b.close();})()"
```

Expected: 검증 전부 `✓`. `docs/shots/landing-top.png` 을 Read 로 열어 로고·pill 점·「맞추고」·주 버튼이 청록→초록 그라데이션이고 카드 모서리가 둥글어졌는지 본다. 글꼴이 Pretendard 로 바뀌었는지(한글 자형이 굵고 정갈)도 본다.

- [ ] **Step 6: 커밋**

```bash
cd ~/Projects/03-personal/matjangbu && git add site/assets/app.css site/index.html site/download/index.html site/phone/index.html docs/shots/landing-top.png docs/shots/download.png docs/shots/phone.png
git commit -m "site: 디자인 토큰 교체 — 청록→초록 주색·그라데이션 3종·16px 모서리·Pretendard(정적 3장)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: 타입·라벨·서식·폴백 순수 모듈 (Vitest, 픽스처 = `site/try/recorded.json`)

**Files:**
- Create: `ui/src/types.ts`, `ui/src/labels.ts`, `ui/src/format.ts`, `ui/src/fallback.ts`
- Test: `ui/test/fixtures.ts`, `ui/test/format.test.ts`, `ui/test/fallback.test.ts`

**Interfaces:**
- Produces(다른 과제가 그대로 쓰는 이름): `AppData`·`Line`·`Person`·`Cand`·`ModelInfo`·`Recorded`·`RecordedMeta`·`Health`·`Toast`·`EnvRow`·`LineState`·`Route`·`RecTab`; `ROUTES`·`TITLES`·`STATE`·`REASON`·`NO_KIND`; `won(n)`·`fmtTs(ts)`; `guessWeek(d?)`·`parseCsv(text)`·`offline(rec, week?)`·`localWeekCsv(data)`·`localYearCsv(rec, roster, which)`.

- [ ] **Step 1: `src/types.ts` — 서버 `state()`·`health()`·`_view()`·`recorded.json` 과 1:1**

```ts
export type LineState = "auto" | "held" | "confirmed" | "excluded"
export type LinePath = "bank" | "envelope"
export type RecTab = "week" | "person" | "year"

export interface Person { id: string; name: string; group: string; household: string; old_names: string[] }
export interface Cand { person_id: string; name: string; group: string; why: string; score?: number }
export interface ModelPred { relation?: string; name_part?: string; kind?: string; [k: string]: unknown }
export interface ModelInfo {
  model?: string; wall_s?: number; prompt_n?: number; pp_tps?: number; tg_tps?: number
  replayed?: boolean; note?: string; error?: string; pred?: ModelPred | null
}
export interface Line {
  id: string; raw: string; amount: number; kind: string; date: string; week: string; path: LinePath
  state: LineState; reason?: string; how?: string; person_id?: string | null
  name: string; group: string; cands: Cand[]; model?: ModelInfo | null; allow_new?: boolean
  ts?: string; human?: boolean; undo_of?: string; note?: string; alias_learned?: boolean
}
export interface Activity {
  id: string; week?: string; raw?: string; state?: LineState; ts?: string
  note?: string; alias_learned?: boolean; undo_of?: string; human?: boolean
}
export interface RecordedMeta { device: string; model: string; threads: number; url?: string; ts: string; engine_git?: string }
export interface Alias { person_id: string; learned: string; from?: string }
export interface AppData {
  mode: "demo" | "local" | "recorded"; week: string; weeks: string[]; weeks_available: string[]
  lines: Line[]; all_count: number; roster: Person[]; aliases: Record<string, Alias>; kinds: string[]
  device: string; model_alive: boolean; recorded: RecordedMeta | null; answers: Record<string, string>
  can_undo: boolean; recent?: Activity[]
}
/** recorded.json 의 줄 — name/group 없이 person_id 와 cands[{person_id, why}] 만 있다 */
export type RecordedRow = Omit<Line, "name" | "group" | "cands"> & { cands?: { person_id: string; why: string; score?: number }[] }
export interface Recorded {
  meta: RecordedMeta; weeks: Record<string, { rows: RecordedRow[] }>; roster: Person[]
  aliases: Record<string, Alias>; answers: Record<string, Record<string, string>>
}
export interface Health {
  mode: string; device: string; model_url: string; model_alive: boolean; queued: number; sessions: number; recorded: RecordedMeta | null
}
export interface Toast { id: number; msg: string; kind?: "ok" | "err"; action?: { label: string; run: () => void } }
export interface EnvRow { name: string; kind: string; amount: string }
export interface SseEvent {
  event?: "start" | "line" | string; state?: "queued" | "running" | "done" | "failed" | string
  i?: number; n?: number; skipped?: number; row?: Line; position?: number; error?: string; elapsed_s?: number
}
```

- [ ] **Step 2: `src/labels.ts`**

```ts
import type { LineState } from "./types"

export const ROUTES = ["dashboard", "import", "envelope", "queue", "records", "roster", "device"] as const
export type Route = (typeof ROUTES)[number]
export const TITLES: Record<Route, string> = {
  dashboard: "대시보드", import: "불러오기", envelope: "봉투 입력", queue: "확인 큐", records: "기록", roster: "명부·별칭", device: "기기",
}
export const STATE: Record<LineState, string> = { auto: "자동 확정", held: "확인 필요", confirmed: "확정", excluded: "제외" }
export const REASON: Record<string, string> = {
  dup: "동명이인", family: "가족 명의", company: "회사 명의", renamed: "개명", typo: "오타·이표기",
  unknown: "명부에 없음", model_failed: "모델 미실행", parse: "읽지 못함",
}
export const NO_KIND = "(종류 없음)"
```

- [ ] **Step 3: `src/format.ts` + 테스트(먼저 실패)**

`test/format.test.ts`:
```ts
import { expect, test } from "vitest"
import { fmtTs, won } from "../src/format"

test("won formats with ko-KR grouping and suffix", () => {
  expect(won(250000)).toBe("250,000원")
  expect(won("12000")).toBe("12,000원")
  expect(won(null)).toBe("0원")
})
test("fmtTs shows minute precision without T", () => {
  expect(fmtTs("2026-09-20T21:59:11")).toBe("2026-09-20 21:59")
  expect(fmtTs(undefined)).toBe("")
})
```

Run: `cd ~/Projects/03-personal/matjangbu/ui && npx vitest run test/format.test.ts` → Expected: FAIL `Cannot find module '../src/format'`.

`src/format.ts`:
```ts
export const won = (n: unknown): string => (Number(n) || 0).toLocaleString("ko-KR") + "원"
export const fmtTs = (ts?: string | null): string => (ts || "").replace("T", " ").slice(0, 16)
```

Run again → Expected: PASS 2.

- [ ] **Step 4: 픽스처 로더 `test/fixtures.ts`**

```ts
import { readFileSync } from "node:fs"
import type { Recorded } from "../src/types"

export function loadRecorded(): Recorded {
  return JSON.parse(readFileSync(new URL("../../site/try/recorded.json", import.meta.url), "utf8")) as Recorded
}
```

- [ ] **Step 5: `test/fallback.test.ts` — 먼저 실패**

```ts
import { describe, expect, test } from "vitest"
import { guessWeek, localWeekCsv, localYearCsv, offline, parseCsv } from "../src/fallback"
import { loadRecorded } from "./fixtures"

const rec = loadRecorded()

describe("guessWeek", () => {
  test("ISO week: 2026-01-01(목) → W01, 2026-09-21(월) → W39", () => {
    expect(guessWeek(new Date(2026, 0, 1))).toBe("2026-W01")
    expect(guessWeek(new Date(2026, 8, 21))).toBe("2026-W39")
  })
})

describe("parseCsv", () => {
  test("따옴표·이스케이프·BOM·CRLF", () => {
    expect(parseCsv('﻿이름,금액\r\n"김,정호","1,000"\r\n"a""b",2\n')).toEqual([["이름", "금액"], ["김,정호", "1,000"], ['a"b', "2"]])
  })
  test("빈 줄은 버린다", () => {
    expect(parseCsv("a,b\n\n1,2\n")).toEqual([["a", "b"], ["1", "2"]])
  })
})

describe("offline", () => {
  test("주차 미지정이면 첫 주차, mode recorded, 액션 불가", () => {
    const d = offline(rec)
    const weeks = Object.keys(rec.weeks).sort()
    expect(d.mode).toBe("recorded")
    expect(d.week).toBe(weeks[0])
    expect(d.weeks).toEqual(weeks)
    expect(d.lines.length).toBe(rec.weeks[weeks[0]].rows.length)
    expect(d.model_alive).toBe(false)
    expect(d.can_undo).toBe(false)
    expect(d.recorded).toEqual(rec.meta)
    expect(d.all_count).toBe(weeks.reduce((n, w) => n + rec.weeks[w].rows.length, 0))
  })
  test("있는 주차를 주면 그 주차, 없는 주차면 첫 주차", () => {
    const weeks = Object.keys(rec.weeks).sort()
    expect(offline(rec, weeks[1]).week).toBe(weeks[1])
    expect(offline(rec, "1999-W01").week).toBe(weeks[0])
  })
  test("줄의 name/group 과 후보의 name/group 을 명부에서 붙인다", () => {
    const d = offline(rec)
    const byId = new Map(rec.roster.map((p) => [p.id, p]))
    for (const l of d.lines) {
      if (l.person_id && byId.has(l.person_id)) expect(l.name).toBe(byId.get(l.person_id)!.name)
      else expect(l.name).toBe("")
      for (const c of l.cands) expect(c.name).toBe(byId.get(c.person_id)!.name)
    }
    const withCands = d.lines.find((l) => l.cands.length > 0)
    expect(withCands).toBeDefined()
  })
})

describe("localWeekCsv / localYearCsv", () => {
  test("주간: 확정+자동 줄, 머리글 7칸, 마지막은 합계", () => {
    const d = offline(rec)
    const rows = parseCsv(localWeekCsv(d))
    expect(rows[0]).toEqual(["이름", "구역", "종류", "금액", "경로", "근거", "원문"])
    const n = d.lines.filter((l) => l.state === "confirmed" || l.state === "auto").length
    expect(rows.length).toBe(n + 2)
    expect(rows[rows.length - 1][0]).toBe("합계")
    const sum = d.lines.filter((l) => l.state === "confirmed" || l.state === "auto").reduce((a, l) => a + l.amount, 0)
    expect(rows[rows.length - 1][3]).toBe(String(sum))
  })
  test("연말: 합계 다음에 미확정 줄, 개인별: 머리글이 이름·구역·종류들·합계·건수", () => {
    const d = offline(rec)
    const year = parseCsv(localYearCsv(rec, d.roster, "year"))
    expect(year[year.length - 1][0]).toBe("미확정")
    expect(year[year.length - 2][0]).toBe("합계")
    expect(year[0].slice(0, 4)).toEqual(["이름", "구역", "합계", "건수"])
    const person = parseCsv(localYearCsv(rec, d.roster, "person"))
    expect(person[0][0]).toBe("이름")
    expect(person[0].slice(-2)).toEqual(["합계", "건수"])
    expect(person[person.length - 1][0]).toBe("합계")
  })
})
```

Run: `npx vitest run test/fallback.test.ts` → Expected: FAIL `Cannot find module '../src/fallback'`.

- [ ] **Step 6: `src/fallback.ts` — 옛 `try/index.html` 의 `offline`·`parseCsv`·`guessWeek`·`localWeekCsv`·`localYearCsv` 를 그대로 옮긴 것**

```ts
import { NO_KIND } from "./labels"
import type { AppData, Cand, Line, Person, Recorded } from "./types"

/** ISO 주차 문자열 `YYYY-Www` */
export function guessWeek(d: Date = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return t.getUTCFullYear() + "-W" + String(Math.ceil(((t.getTime() - y0.getTime()) / 864e5 + 1) / 7)).padStart(2, "0")
}

/** RFC 4180 대로 — 따옴표 안의 쉼표·줄바꿈·"" 이스케이프, BOM·CR 제거, 빈 줄 버림 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cur = "", q = false
  text = text.replace(/^﻿/, "")
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false }
      else cur += ch
    } else if (ch === '"') q = true
    else if (ch === ",") { row.push(cur); cur = "" }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = "" }
    else if (ch !== "\r") cur += ch
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows.filter((r) => r.length > 1 || r[0])
}

/** recorded.json → 읽기 전용 화면 상태(삼중 폴백의 마지막 단) */
export function offline(rec: Recorded, week?: string): AppData {
  const weeks = Object.keys(rec.weeks).sort()
  const cur = week && rec.weeks[week] ? week : weeks[0]
  const byId = new Map<string, Person>(rec.roster.map((p) => [p.id, p]))
  const view = (row: Recorded["weeks"][string]["rows"][number]): Line => {
    const p = row.person_id ? byId.get(row.person_id) : undefined
    const cands: Cand[] = (row.cands || [])
      .filter((c) => byId.has(c.person_id))
      .map((c) => ({ ...c, name: byId.get(c.person_id)!.name, group: byId.get(c.person_id)!.group }))
    return { ...row, name: p ? p.name : "", group: p ? p.group : "", cands }
  }
  return {
    mode: "recorded", week: cur, weeks, weeks_available: [],
    lines: cur ? rec.weeks[cur].rows.map(view) : [],
    all_count: weeks.reduce((n, w) => n + rec.weeks[w].rows.length, 0),
    roster: rec.roster, aliases: rec.aliases, kinds: [], device: rec.meta.device, model_alive: false,
    recorded: rec.meta, answers: rec.answers[cur] || {}, can_undo: false,
  }
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)
const csvLines = (rows: string[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\n")

/** 읽기 전용: 현재 주차 줄에서 주간 명단을 직접 만든다(서버의 export/week.csv 와 같은 열) */
export function localWeekCsv(data: AppData): string {
  const rows = data.lines.filter((l) => l.state === "confirmed").concat(data.lines.filter((l) => l.state === "auto"))
  const out: string[][] = [["이름", "구역", "종류", "금액", "경로", "근거", "원문"]]
  for (const l of rows) out.push([l.name, l.group, l.kind || NO_KIND, String(l.amount), l.path === "envelope" ? "봉투" : "통장", l.how || "", l.raw])
  out.push(["합계", "", "", String(rows.reduce((a, l) => a + l.amount, 0)), "", "", ""])
  return csvLines(out)
}

/** 읽기 전용: 기록의 모든 주차에서 개인별 누적(person) 또는 연말 합산(year, 미확정 줄 포함) */
export function localYearCsv(rec: Recorded, roster: Person[], which: "person" | "year"): string {
  const byId = new Map<string, Person>(roster.map((p) => [p.id, p]))
  const acc: Record<string, { total: number; count: number; k: Record<string, number> }> = {}
  const kinds = new Set<string>()
  let unc = 0, uncN = 0
  for (const w of Object.values(rec.weeks)) for (const l of w.rows) {
    if (l.state === "held") { unc += l.amount; uncN++ }
    if (!(l.state === "auto" || l.state === "confirmed") || !l.person_id) continue
    const k = l.kind || NO_KIND
    kinds.add(k)
    const a = (acc[l.person_id] = acc[l.person_id] || { total: 0, count: 0, k: {} })
    a.total += l.amount; a.count++; a.k[k] = (a.k[k] || 0) + l.amount
  }
  const ks = Array.from(kinds).sort((a, b) => Number(a === NO_KIND) - Number(b === NO_KIND) || a.localeCompare(b))
  const rows = Object.keys(acc).map((id) => ({ id, ...acc[id] })).sort((a, b) => b.total - a.total)
  const nm = (id: string) => byId.get(id)?.name ?? id
  const gp = (id: string) => byId.get(id)?.group ?? ""
  const head = which === "person" ? ["이름", "구역", ...ks, "합계", "건수"] : ["이름", "구역", "합계", "건수", ...ks]
  const line = (r: (typeof rows)[number]) =>
    which === "person"
      ? [nm(r.id), gp(r.id), ...ks.map((k) => String(r.k[k] || 0)), String(r.total), String(r.count)]
      : [nm(r.id), gp(r.id), String(r.total), String(r.count), ...ks.map((k) => String(r.k[k] || 0))]
  const out: string[][] = [head, ...rows.map(line)]
  const tot = rows.reduce((a, r) => a + r.total, 0), cnt = rows.reduce((a, r) => a + r.count, 0)
  out.push(which === "person"
    ? ["합계", "", ...ks.map(() => ""), String(tot), String(cnt)]
    : ["합계", "", String(tot), String(cnt), ...ks.map((k) => String(rows.reduce((a, r) => a + (r.k[k] || 0), 0)))])
  if (which === "year") out.push(["미확정", "", String(unc), String(uncN)])
  return csvLines(out)
}
```

Run: `npx vitest run` → Expected: 전부 PASS(format 2 + fallback 7 + smoke 1). `npm run typecheck` 도 통과.

- [ ] **Step 7: 커밋**

```bash
cd ~/Projects/03-personal/matjangbu && git add ui/src/types.ts ui/src/labels.ts ui/src/format.ts ui/src/fallback.ts ui/test
git commit -m "ui: 타입·라벨·서식·폴백 순수 모듈(recorded.json 픽스처 테스트)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: API 클라이언트 — 세션 헤더·fetch·SSE 파서

**Files:**
- Create: `ui/src/api.ts`
- Test: `ui/test/api.test.ts`

**Interfaces:**
- Produces: `HEADER`, `sessionKey(apiBase)`, `savedSession(apiBase)`, `remember(apiBase, tok)`, `class ApiError(message, status)`, `parseSse(buf) → {events, rest}`, `interface Client { api, post, stream }`, `makeClient(apiBase, sameOrigin) → Client`.
- 동작은 옛 `try/index.html` 의 `api`·`post`·`stream` 과 같다: `fetch(apiBase + "api" + path)`, 세션 토큰은 요청 헤더로 보내고 응답 헤더에서 받아 `localStorage["mj.session@" + apiBase]` 에 저장, CSV(`text/csv`)는 문자열, 그 외 JSON, `!ok` 면 `ApiError`. SSE 는 `EventSource` 대신 fetch + ReadableStream(헤더가 필요해서).

- [ ] **Step 1: 테스트 먼저 — `test/api.test.ts`**

```ts
import { describe, expect, test } from "vitest"
import { parseSse, sessionKey } from "../src/api"

describe("parseSse", () => {
  test("완전한 이벤트 두 개와 남은 조각", () => {
    const { events, rest } = parseSse('data: {"event":"start","n":3}\n\ndata: {"event":"line","i":0}\n\ndata: {"ev')
    expect(events).toEqual([{ event: "start", n: 3 }, { event: "line", i: 0 }])
    expect(rest).toBe('data: {"ev')
  })
  test("JSON 이 깨진 이벤트는 건너뛴다", () => {
    const { events, rest } = parseSse("data: nope\n\ndata: {\"state\":\"done\"}\n\n")
    expect(events).toEqual([{ state: "done" }])
    expect(rest).toBe("")
  })
  test("event: 줄이 앞에 있어도 data: 만 읽는다", () => {
    expect(parseSse('event: state\ndata: {"state":"queued","position":2}\n\n').events).toEqual([{ state: "queued", position: 2 }])
  })
})

test("sessionKey 는 apiBase 별로 다르다", () => {
  expect(sessionKey("/try/")).toBe("mj.session@/try/")
  expect(sessionKey("https://x.example/")).toBe("mj.session@https://x.example/")
})
```

Run: `npx vitest run test/api.test.ts` → Expected: FAIL `Cannot find module '../src/api'`.

- [ ] **Step 2: `src/api.ts`**

```ts
import type { SseEvent } from "./types"

export const HEADER = "X-Matjangbu-Session"
export const sessionKey = (apiBase: string) => "mj.session@" + apiBase

export function savedSession(apiBase: string): string {
  try { return localStorage.getItem(sessionKey(apiBase)) || "" } catch { return "" }
}
export function remember(apiBase: string, tok: string | null): void {
  if (!tok) return
  try { localStorage.setItem(sessionKey(apiBase), tok) } catch { /* 저장 못 해도 쿠키로 간다 */ }
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.name = "ApiError"; this.status = status }
}

/** `data: {...}\n\n` 단위로 자른다. 마지막 미완 조각은 rest 로 돌려준다. */
export function parseSse(buf: string): { events: SseEvent[]; rest: string } {
  const parts = buf.split("\n\n")
  const rest = parts.pop() ?? ""
  const events: SseEvent[] = []
  for (const chunk of parts) {
    const m = /(?:^|\n)data: (.*)/.exec(chunk)
    if (!m) continue
    try { events.push(JSON.parse(m[1]) as SseEvent) } catch { /* 깨진 이벤트는 버린다 */ }
  }
  return { events, rest }
}

export interface Client {
  api<T = unknown>(path: string, opts?: RequestInit): Promise<T>
  post<T = unknown>(path: string, data?: unknown): Promise<T>
  stream(path: string, onEvent: (ev: SseEvent) => void): Promise<void>
}

export function makeClient(apiBase: string, sameOrigin: boolean): Client {
  const credentials: RequestCredentials = sameOrigin ? "same-origin" : "omit"
  const sessionHeaders = (): Record<string, string> => { const t = savedSession(apiBase); return t ? { [HEADER]: t } : {} }

  async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
    const r = await fetch(apiBase + "api" + path, { credentials, ...opts, headers: { ...(opts.headers as Record<string, string> | undefined), ...sessionHeaders() } })
    remember(apiBase, r.headers.get(HEADER))
    const ct = r.headers.get("Content-Type") || ""
    if (ct.startsWith("text/csv")) {
      if (!r.ok) throw new ApiError("HTTP " + r.status, r.status)
      return (await r.text()) as unknown as T
    }
    let body: { ok?: boolean; error?: string } | null = null
    try { body = await r.json() } catch { body = null }
    if (!r.ok) throw new ApiError((body && body.error) || "HTTP " + r.status, r.status)
    return body as unknown as T
  }

  const post = <T = unknown>(path: string, data?: unknown) =>
    api<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data ?? {}) })

  async function stream(path: string, onEvent: (ev: SseEvent) => void): Promise<void> {
    const r = await fetch(apiBase + "api" + path, { credentials, headers: sessionHeaders() })
    if (!r.ok || !r.body) throw new ApiError("HTTP " + r.status, r.status)
    const reader = r.body.getReader(), dec = new TextDecoder()
    let buf = ""
    for (;;) {
      const x = await reader.read()
      if (x.done) break
      buf += dec.decode(x.value, { stream: true })
      const { events, rest } = parseSse(buf)
      buf = rest
      for (const ev of events) onEvent(ev)
    }
  }

  return { api, post, stream }
}
```

Run: `npx vitest run` → Expected: 전부 PASS. `npm run typecheck` 통과.

- [ ] **Step 3: 커밋**

```bash
cd ~/Projects/03-personal/matjangbu && git add ui/src/api.ts ui/test/api.test.ts
git commit -m "ui: API 클라이언트 — 세션 헤더·CSV/JSON·fetch 기반 SSE 파서

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: 스토어·라우트·삼중 폴백·골격(사이드바/상단바/탭바/배너/토스트)

**Files:**
- Create: `ui/src/route.ts`, `ui/src/hooks.ts`, `ui/src/load.ts`, `ui/src/store.tsx`, `ui/src/components/{Layout,Sidebar,Topbar,TabBar,Banner,InstanceStatus,Toasts,EmptyState}.tsx`, `ui/src/views/index.tsx`, `tools/dev_shot.cjs`
- Modify: `ui/src/App.tsx`
- Test: `ui/test/route.test.ts`, `ui/test/load.test.ts`

**Interfaces:**
- Produces: `parseHash(hash) → Route`, `useHashRoute() → Route`, `useMediaQuery(q) → boolean`, `BASE`, `candidateBases(here, metas) → string[]`, `resolveState(week?, cached) → Loaded`, `AppProvider`, `useApp() → { s, dispatch, load, toast, fail, client }`, `useData() → AppData`, `useLineActions() → { pick, addNew, hold, exclude, rematch, undo }`, `VIEWS: Record<Route, ComponentType>`(과제 8~12 가 항목을 채운다), `EmptyState({ text, action? })`, `tools/dev_shot.cjs`(개발 서버 스크린샷).
- DOM 계약: `#banner`(+`hidden`), `#q`, `#week`, `#undo`, `#toasts .toast(.err|.ok)`, `#roster-list`, `main#main` 안의 `h1`, `window.matjangbuApiBase`.

- [ ] **Step 1: 라우트 테스트 → 구현**

`test/route.test.ts`:
```ts
import { expect, test } from "vitest"
import { parseHash } from "../src/route"

test("parseHash", () => {
  expect(parseHash("")).toBe("dashboard")
  expect(parseHash("#/")).toBe("dashboard")
  expect(parseHash("#/queue")).toBe("queue")
  expect(parseHash("#queue")).toBe("queue")
  expect(parseHash("#/records/week")).toBe("records")
  expect(parseHash("#/nope")).toBe("dashboard")
})
```

`src/route.ts`:
```ts
import { useSyncExternalStore } from "react"
import { ROUTES, type Route } from "./labels"

export function parseHash(hash: string): Route {
  const r = (hash || "#/dashboard").replace(/^#\/?/, "").split("/")[0] || "dashboard"
  return (ROUTES as readonly string[]).includes(r) ? (r as Route) : "dashboard"
}

const subscribe = (cb: () => void) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb) }
export function useHashRoute(): Route {
  return useSyncExternalStore(subscribe, () => parseHash(location.hash), () => "dashboard")
}
```

`src/hooks.ts`:
```ts
import { useSyncExternalStore } from "react"

export function useMediaQuery(q: string): boolean {
  return useSyncExternalStore(
    (cb) => { const m = matchMedia(q); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb) },
    () => matchMedia(q).matches,
    () => false,
  )
}
export const useMobile = () => useMediaQuery("(max-width: 1099px)")
```

Run: `npx vitest run test/route.test.ts` → PASS.

- [ ] **Step 2: 삼중 폴백 — 테스트 → `src/load.ts`**

`test/load.test.ts`:
```ts
import { expect, test } from "vitest"
import { candidateBases } from "../src/load"

test("같은 origin 이 먼저, meta 주소는 슬래시를 붙여 뒤에, 자기 자신·중복은 뺀다", () => {
  const here = "https://stoporder.github.io/matjangbu/try/"
  expect(candidateBases("/matjangbu/try/", here, ["https://a.example", "https://a.example/", "https://stoporder.github.io/matjangbu/try"]))
    .toEqual(["/matjangbu/try/", "https://a.example/"])
})
```

`src/load.ts`:
```ts
import { makeClient } from "./api"
import { offline } from "./fallback"
import type { AppData, Recorded } from "./types"

/** 이 화면이 있는 디렉터리(`/try/` 또는 `/matjangbu/try/`) — 같은 origin API 는 `BASE + "api/..."` */
export const BASE = typeof location === "undefined" ? "/" : location.pathname.endsWith("/") ? location.pathname : location.pathname.replace(/[^/]*$/, "")

export function metaApis(): string[] {
  const el = document.querySelector('meta[name="matjangbu-api"]') as HTMLMetaElement | null
  return (el?.content || "").split(/[\s,]+/).filter(Boolean)
}

/** 후보 base 순서: 같은 origin → meta 주소들(앞이 우선). here 는 BASE 의 절대 주소. */
export function candidateBases(base: string, here: string, metas: string[]): string[] {
  const out = [base]
  for (const m of metas) {
    const u = new URL(m.endsWith("/") ? m : m + "/", here).href
    if (u !== here && !out.includes(u)) out.push(u)
  }
  return out
}

export interface Loaded { data: AppData; readonly: boolean; apiBase: string; recorded: Recorded | null }

/** 삼중 폴백: 후보 base 를 차례로 `/state` 로 찔러 보고, 전부 실패하면 recorded.json 읽기 전용. */
export async function resolveState(week: string | undefined, cached: Recorded | null): Promise<Loaded> {
  const here = new URL(BASE, location.href).href
  const q = week ? "?week=" + encodeURIComponent(week) : ""
  for (const b of candidateBases(BASE, here, metaApis())) {
    try {
      const data = await makeClient(b, b === BASE).api<AppData>("/state" + q)
      window.matjangbuApiBase = b
      return { data, readonly: false, apiBase: b, recorded: cached }
    } catch { /* 다음 후보 */ }
  }
  window.matjangbuApiBase = null
  const rec = cached ?? ((await (await fetch(BASE + "recorded.json", { cache: "no-cache" })).json()) as Recorded)
  return { data: offline(rec, week), readonly: true, apiBase: BASE, recorded: rec }
}

declare global { interface Window { matjangbuApiBase: string | null | undefined } }
```

Run: `npx vitest run test/load.test.ts` → PASS. (Vitest 는 node 환경이라 `location` 이 없다 — `BASE` 의 `typeof location` 가드가 그래서 있다.)

- [ ] **Step 3: `src/store.tsx`**

```tsx
import { createContext, useCallback, useContext, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from "react"
import { makeClient, type Client } from "./api"
import { BASE, resolveState } from "./load"
import type { AppData, EnvRow, Recorded, RecTab, Toast } from "./types"

export interface AppState {
  data: AppData | null; readonly: boolean; apiBase: string; recorded: Recorded | null
  loading: boolean; error: string | null; loadSeq: number
  selected: string | null; query: string; tab: RecTab; busy: boolean; envRows: EnvRow[]; toasts: Toast[]
}
export type Action =
  | { type: "loading" }
  | { type: "loaded"; data: AppData; readonly: boolean; apiBase: string; recorded: Recorded | null }
  | { type: "loadError"; error: string }
  | { type: "select"; id: string | null }
  | { type: "query"; q: string }
  | { type: "tab"; tab: RecTab }
  | { type: "busy"; busy: boolean }
  | { type: "envRows"; rows: EnvRow[] }
  | { type: "toast"; toast: Toast }
  | { type: "dismiss"; id: number }

export const emptyRow = (): EnvRow => ({ name: "", kind: "", amount: "" })

const initial: AppState = {
  data: null, readonly: false, apiBase: BASE, recorded: null, loading: true, error: null, loadSeq: 0,
  selected: null, query: "", tab: "week", busy: false, envRows: [emptyRow()], toasts: [],
}

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case "loading": return { ...s, loading: true }
    case "loaded": return { ...s, data: a.data, readonly: a.readonly, apiBase: a.apiBase, recorded: a.recorded, loading: false, error: null, loadSeq: s.loadSeq + 1 }
    case "loadError": return { ...s, loading: false, error: a.error }
    case "select": return { ...s, selected: a.id }
    case "query": return { ...s, query: a.q }
    case "tab": return { ...s, tab: a.tab }
    case "busy": return { ...s, busy: a.busy }
    case "envRows": return { ...s, envRows: a.rows.length ? a.rows : [emptyRow()] }
    case "toast": return { ...s, toasts: [...s.toasts, a.toast] }
    case "dismiss": return { ...s, toasts: s.toasts.filter((t) => t.id !== a.id) }
  }
}

interface Ctx {
  s: AppState; dispatch: Dispatch<Action>; client: Client
  load(week?: string): Promise<void>
  toast(msg: string, kind?: Toast["kind"], action?: Toast["action"]): void
  fail(e: unknown): void
}
const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [s, dispatch] = useReducer(reducer, initial)
  const recRef = useRef<Recorded | null>(null)
  const seq = useRef(0)

  const toast = useCallback((msg: string, kind?: Toast["kind"], action?: Toast["action"]) => {
    const id = ++seq.current
    dispatch({ type: "toast", toast: { id, msg, kind, action } })
    setTimeout(() => dispatch({ type: "dismiss", id }), 3200)
  }, [])
  const fail = useCallback((e: unknown) => toast(e instanceof Error ? e.message : String(e), "err"), [toast])

  const load = useCallback(async (week?: string) => {
    try {
      const r = await resolveState(week, recRef.current)
      recRef.current = r.recorded
      dispatch({ type: "loaded", ...r })
    } catch (e) {
      dispatch({ type: "loadError", error: e instanceof Error ? e.message : String(e) })
    }
  }, [])

  const client = useMemo(() => makeClient(s.apiBase, s.apiBase === BASE), [s.apiBase])
  const value = useMemo<Ctx>(() => ({ s, dispatch, client, load, toast, fail }), [s, client, load, toast, fail])
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp(): Ctx {
  const c = useContext(AppCtx)
  if (!c) throw new Error("AppProvider 밖")
  return c
}
/** 화면 컴포넌트는 데이터가 있을 때만 마운트된다 */
export function useData(): AppData {
  const { s } = useApp()
  if (!s.data) throw new Error("데이터 없음")
  return s.data
}

/** 확인 큐·줄 상세가 쓰는 액션. 확정·보류·제외 토스트에 「되돌리기」(POST /undo). */
export function useLineActions() {
  const { s, client, load, toast, fail } = useApp()
  const week = s.data?.week
  const undo = useCallback(async () => {
    try {
      const u = await client.post<{ id: string }>("/undo")
      const l = s.data?.lines.find((x) => x.id === u.id)
      toast("되돌림: " + (l ? l.raw : u.id))
      await load(week)
    } catch (e) { fail(e) }
  }, [client, s.data, load, toast, fail, week])
  const withUndo = { label: "되돌리기", run: () => { void undo() } }

  const pick = useCallback(async (id: string, personId: string) => {
    try {
      const out = await client.post<{ alias_learned?: boolean }>("/lines/" + id + "/confirm", { person_id: personId })
      toast(out.alias_learned ? "별칭 사전에 저장됨 · 다음부터 자동" : "확정", "ok", withUndo)
      await load(week)
    } catch (e) { fail(e) }
  }, [client, load, toast, fail, week])
  const addNew = useCallback(async (id: string, name: string, group: string) => {
    try {
      const out = await client.post<{ new_person?: { name: string } }>("/lines/" + id + "/confirm", { new_person: { name, group } })
      toast("명부에 등록하고 확정: " + (out.new_person ? out.new_person.name : name), "ok", withUndo)
      await load(week)
    } catch (e) { fail(e) }
  }, [client, load, toast, fail, week])
  const hold = useCallback(async (id: string) => {
    try { await client.post("/lines/" + id + "/hold", {}); toast("보류", undefined, withUndo); await load(week) } catch (e) { fail(e) }
  }, [client, load, toast, fail, week])
  const exclude = useCallback(async (id: string) => {
    try { await client.post("/lines/" + id + "/exclude", { why: "" }); toast("제외했습니다", undefined, withUndo); await load(week) } catch (e) { fail(e) }
  }, [client, load, toast, fail, week])
  /** onProgress(text, err) 로 진행 문구를 준다. 끝나면 다시 불러온다. */
  const rematch = useCallback(async (id: string, onProgress: (text: string, err?: boolean) => void) => {
    onProgress("줄 서는 중…")
    let tick: ReturnType<typeof setInterval> | undefined
    try {
      const job = await client.post<{ job: string }>("/lines/" + id + "/rematch", {})
      let t0 = Date.now()
      tick = setInterval(() => onProgress("모델이 보는 중 · " + Math.round((Date.now() - t0) / 1000) + "초"), 500)
      await client.stream("/jobs/" + job.job + "/events", (ev) => {
        if (ev.state === "queued" && ev.position) { onProgress("앞에 " + ev.position + "건"); t0 = Date.now() }
        if (ev.state === "failed") onProgress(ev.error || "실패", true)
      })
      clearInterval(tick)
      toast("다시 쟀습니다", "ok")
      await load(week)
    } catch (e) { if (tick) clearInterval(tick); onProgress(e instanceof Error ? e.message : String(e), true); fail(e) }
  }, [client, load, toast, fail, week])

  return { pick, addNew, hold, exclude, rematch, undo }
}
```

- [ ] **Step 4: 골격 컴포넌트**

`src/components/EmptyState.tsx`:
```tsx
import { ArrowRight } from "lucide-react"

export function EmptyState({ text, action }: { text: string; action?: { label: string; href: string } }) {
  return (
    <div className="empty rounded-2xl border border-dashed border-line-2 bg-white px-6 py-10 text-center text-muted-foreground">
      <p className="m-0">{text}</p>
      {action && (
        <a href={action.href} className="press mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[15px] font-bold text-brand-ink hover:bg-brand-bg">
          {action.label} <ArrowRight className="size-4" aria-hidden="true" />
        </a>
      )}
    </div>
  )
}
```

`src/components/Toasts.tsx`:
```tsx
import { useApp } from "@/store"

export function Toasts() {
  const { s, dispatch } = useApp()
  return (
    <div className="toast-wrap" id="toasts" aria-live="polite">
      {s.toasts.map((t) => (
        <div key={t.id} className={"toast" + (t.kind ? " " + t.kind : "")}>
          <span>{t.msg}</span>
          {t.action && <button type="button" onClick={() => { t.action!.run(); dispatch({ type: "dismiss", id: t.id }) }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  )
}
```

`src/components/Banner.tsx`:
```tsx
import { AlertTriangle } from "lucide-react"
import { fmtTs } from "@/format"
import { useApp } from "@/store"

export function Banner() {
  const { s } = useApp()
  const meta = s.recorded?.meta
  return (
    <div id="banner" className="banner flex items-center gap-2.5 border-b border-line bg-amber-bg px-5 py-2.5 text-[14px] text-[#78350f]" hidden={!s.readonly}>
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <span id="banner-text">
        체험 인스턴스가 응답하지 않습니다 — {meta?.device || "기기"}에서 {fmtTs(meta?.ts)}에 미리 잰 기록을 읽기 전용으로 보여드립니다. 확정·불러오기·다시 재기는 지금 할 수 없습니다.
      </span>
    </div>
  )
}
```

`src/components/InstanceStatus.tsx`:
```tsx
import { useApp } from "@/store"

export function InstanceStatus({ compact = false }: { compact?: boolean }) {
  const { s } = useApp()
  const d = s.data
  if (!d) return null
  const demo = d.mode !== "local"
  const dot = d.model_alive ? "bg-brand" : "bg-red"
  const text = d.model_alive ? "모델 서버 응답" : s.readonly ? "읽기 전용" : "모델 서버 없음"
  if (compact) return demo ? <span className="badge badge-held">예시 데이터</span> : null
  return (
    <div className="inst mt-auto border-t border-line px-4 py-4 text-[13px] leading-snug text-muted-foreground">
      <b className="block truncate text-[13px] font-semibold text-ink">{d.device || "이 PC"}</b>
      <div className="mt-1.5 flex items-center gap-1.5"><span className={"inline-block size-2 rounded-full " + dot} />{text}</div>
      {demo && (
        <div className="mt-3 grid gap-1 border-t border-dashed border-line pt-3">
          <span className="badge badge-held justify-self-start">예시 데이터</span>
          <span>가공 샘플 · 실제 단체 자료 아님</span>
        </div>
      )}
    </div>
  )
}
```

`src/components/Sidebar.tsx`(활성 표시 = 왼쪽 3px 그라데이션 바 + brand 틴트):
```tsx
import { Clock, Cpu, Download, FileText, LayoutDashboard, Mail, Users, type LucideIcon } from "lucide-react"
import { TITLES, type Route } from "@/labels"
import { useApp } from "@/store"
import { InstanceStatus } from "./InstanceStatus"

export const NAV: { route: Route; Icon: LucideIcon }[] = [
  { route: "dashboard", Icon: LayoutDashboard }, { route: "import", Icon: Download }, { route: "envelope", Icon: Mail },
  { route: "queue", Icon: Clock }, { route: "records", Icon: FileText }, { route: "roster", Icon: Users }, { route: "device", Icon: Cpu },
]

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs><linearGradient id="g-logo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1DB5AB" /><stop offset=".55" stopColor="#5FC884" /><stop offset="1" stopColor="#9EDC5F" /></linearGradient></defs>
      <rect width="32" height="32" rx="9" fill="url(#g-logo)" />
      <path d="M8 9h16M8 15h16M8 21h10" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M21 19l2.5 2.5L28 17" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Sidebar({ route }: { route: Route }) {
  const { s } = useApp()
  const held = s.data ? s.data.lines.filter((l) => l.state === "held").length : 0
  return (
    <aside className="sidebar flex min-h-0 flex-col border-r border-line bg-white" aria-label="메뉴">
      <a className="brand flex h-14 items-center gap-2.5 border-b border-line px-4 text-[17px] font-extrabold text-ink" href="../">
        <Logo /> 맞장부 <span className="badge badge-gray">잠정명</span>
      </a>
      <nav id="nav" className="flex flex-col gap-0.5 overflow-y-auto p-2.5">
        {NAV.map(({ route: r, Icon }) => {
          const active = r === route
          return (
            <a key={r} href={"#/" + r} data-route={r} aria-current={active ? "page" : "false"}
               className={"relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] transition-colors " + (active ? "nav-active bg-brand-bg font-bold text-brand-ink" : "text-muted-foreground hover:bg-surface hover:text-ink")}>
              <Icon className="size-5" aria-hidden="true" />{TITLES[r]}
              {r === "queue" && <span className="cnt badge badge-held ml-auto" id="n-queue" hidden={!held}>{held}</span>}
            </a>
          )
        })}
      </nav>
      <InstanceStatus />
    </aside>
  )
}
```

`src/components/TabBar.tsx`(모바일 하단 탭바 — 활성 아이콘은 그라데이션):
```tsx
import { TITLES, type Route } from "@/labels"
import { NAV } from "./Sidebar"

export function TabBar({ route }: { route: Route }) {
  return (
    <nav className="tabbar" aria-label="메뉴">
      {NAV.map(({ route: r, Icon }) => {
        const active = r === route
        return (
          <a key={r} href={"#/" + r} aria-current={active ? "page" : "false"}
             className={"flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold " + (active ? "text-brand-ink" : "text-muted-foreground")}>
            <span className={active ? "rounded-lg p-1 bg-brand-bg" : "p-1"}><Icon className="size-5" aria-hidden="true" /></span>
            {TITLES[r].replace("·별칭", "")}
          </a>
        )
      })}
    </nav>
  )
}
```

`src/components/Topbar.tsx`:
```tsx
import { Search, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TITLES, type Route } from "@/labels"
import { useApp } from "@/store"
import { InstanceStatus } from "./InstanceStatus"
import { Logo } from "./Sidebar"

export function Topbar({ route }: { route: Route }) {
  const { s, dispatch, load, client, toast, fail } = useApp()
  const d = s.data
  const undo = async () => {
    try { const u = await client.post<{ id: string }>("/undo"); const l = d?.lines.find((x) => x.id === u.id); toast("되돌림: " + (l ? l.raw : u.id)); await load(d?.week) } catch (e) { fail(e) }
  }
  return (
    <header className="topbar flex flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-2 lg:px-6">
      <span className="flex items-center gap-2 lg:hidden"><Logo size={22} /><InstanceStatus compact /></span>
      <span className="hidden text-[13px] font-semibold text-muted-foreground lg:inline">{TITLES[route]}</span>
      <label className="search relative order-3 flex w-full items-center lg:order-none lg:w-[22rem]">
        <Search className="pointer-events-none absolute left-3 size-4 text-faint" aria-hidden="true" />
        <input type="search" id="q" className="pl-9! bg-surface! border-line!" placeholder="입금자명 · 이름" aria-label="검색"
               value={s.query} onChange={(e) => dispatch({ type: "query", q: e.target.value.trim() })} />
      </label>
      <select id="week" aria-label="주차" className="w-auto! max-w-[12rem]" value={d?.week || ""} onChange={(e) => { void load(e.target.value) }}>
        {(d?.weeks.length ? d.weeks : ["-"]).map((w) => <option key={w}>{w}</option>)}
      </select>
      <div className="actions ml-auto flex items-center gap-2">
        <Button id="undo" variant="outline" size="sm" className="h-9 rounded-xl px-3 text-[13px]" disabled={s.readonly || !d?.can_undo} onClick={() => { void undo() }}>
          <Undo2 aria-hidden="true" /><span className="hidden sm:inline">마지막 확정 되돌리기</span><span className="sm:hidden">되돌리기</span>
        </Button>
      </div>
    </header>
  )
}
```

`src/components/Layout.tsx`:
```tsx
import type { ReactNode } from "react"
import { TITLES, type Route } from "@/labels"
import { useApp } from "@/store"
import { Banner } from "./Banner"
import { Sidebar } from "./Sidebar"
import { TabBar } from "./TabBar"
import { Toasts } from "./Toasts"
import { Topbar } from "./Topbar"

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  const { s } = useApp()
  return (
    <div className={"app" + (s.selected ? " panel-open" : "")}>
      <Sidebar route={route} />
      <Banner />
      <Topbar route={route} />
      <main id="main" className="main min-w-0 overflow-y-auto p-4 lg:p-6">
        <section className="max-w-[1400px]">
          <h1 className="mb-4 text-[22px] font-bold">{TITLES[route]}</h1>
          {children}
        </section>
      </main>
      <TabBar route={route} />
      <Toasts />
      <datalist id="roster-list">{s.data?.roster.map((p) => <option key={p.id} value={p.name}>{p.group}</option>)}</datalist>
    </div>
  )
}
```

`src/views/index.tsx`(과제 8~12 가 한 줄씩 바꾼다):
```tsx
import type { ComponentType } from "react"
import { EmptyState } from "@/components/EmptyState"
import type { Route } from "@/labels"

const Pending = () => <EmptyState text="이 화면은 아직 옮기는 중입니다" />
export const VIEWS: Record<Route, ComponentType> = {
  dashboard: Pending, import: Pending, envelope: Pending, queue: Pending, records: Pending, roster: Pending, device: Pending,
}
```

`src/App.tsx`:
```tsx
import { useEffect } from "react"
import { Layout } from "@/components/Layout"
import { Skeleton } from "@/components/ui/skeleton"
import { useHashRoute } from "@/route"
import { AppProvider, useApp } from "@/store"
import { VIEWS } from "@/views"

function LoadingSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-56 rounded-2xl" /><Skeleton className="h-56 rounded-2xl" /></div>
    </div>
  )
}

function Shell() {
  const { s, load, dispatch } = useApp()
  const route = useHashRoute()
  useEffect(() => { void load() }, [load])
  useEffect(() => { dispatch({ type: "select", id: null }) }, [route, dispatch])
  const View = VIEWS[route]
  return (
    <Layout route={route}>
      {s.data ? <View /> : s.error ? <div className="empty text-muted-foreground">화면을 시작하지 못했습니다: {s.error}</div> : <LoadingSkeleton />}
    </Layout>
  )
}

export default function App() {
  return <AppProvider><Shell /></AppProvider>
}
```

- [ ] **Step 5: 개발 서버 스크린샷 도구 `tools/dev_shot.cjs`**

```js
#!/usr/bin/env node
// NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/dev_shot.cjs <url> <out.png> [--mobile]
// 개발 중 화면 확인용. 1400×900(기본) 또는 390×844(--mobile). 콘솔 에러가 있으면 1 로 끝난다.
const { chromium } = require('playwright');
const [url, out] = process.argv.slice(2); const mobile = process.argv.includes('--mobile');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1400, height: 900 } });
  const errors = []; p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(800); await p.screenshot({ path: out, fullPage: false }); await b.close();
  console.log('찍음:', out); if (errors.length) { console.log('콘솔 에러:', errors); process.exit(1); }
})().catch(e => { console.error(e); process.exit(2); });
```

- [ ] **Step 6: 테스트·타입·화면 확인**

```bash
cd ~/Projects/03-personal/matjangbu/ui && npm test && npm run typecheck
(npm run dev -- --port 5173 >/tmp/claude-1000/vite-dev.log 2>&1 &) ; sleep 3
cd .. && NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/dev_shot.cjs 'http://127.0.0.1:5173/#/queue' /tmp/claude-1000/shell-desktop.png
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/dev_shot.cjs 'http://127.0.0.1:5173/#/queue' /tmp/claude-1000/shell-mobile.png --mobile
```

Expected: 테스트 전부 PASS, 콘솔 에러 0. 데스크톱 스크린샷: 왼쪽 사이드바(로고 그라데이션, 「확인 큐」 활성 = 왼쪽 그라데이션 바 + 틴트, 배지 4), 상단바(검색·2026-W10·되돌리기), 본문 제목 「확인 큐」 22px, 「옮기는 중」 빈 상태. 모바일: 사이드바 없음, 하단 탭바 7칸, 상단에 로고 + 「예시 데이터」. 두 장 다 Read 로 열어 본다. 개발 서버는 다음 과제에서도 쓰니 켜 둔다.

- [ ] **Step 7: 커밋**

```bash
cd ~/Projects/03-personal/matjangbu && git add ui/src tools/dev_shot.cjs ui/test
git commit -m "ui: 스토어·해시 라우트·삼중 폴백·골격(사이드바/상단바/탭바/배너/토스트)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: 공용 컴포넌트 — 배지·큰 숫자·진행·표·후보 고르기·줄 상세 패널

**Files:**
- Create: `ui/src/lines.ts`, `ui/src/components/{StateBadge,HowBadge,GradientNumber,StatTile,ProgressBar,SectionHead,Foot,LineTable,CsvTable,CandidatePicker,LinePanel}.tsx`
- Modify: `ui/src/index.css`(표·kv·feed 규칙 추가), `ui/src/components/Layout.tsx`(`<LinePanel />` 추가), `ui/src/store.tsx`(`pick`·`addNew`·`hold`·`exclude` 가 `Promise<boolean>` 을 돌려주게)
- Test: `ui/test/lines.test.ts`

**Interfaces:**
- Produces: `counts(lines) → {n, auto, held, confirmed, excluded}`, `matches(line, query)`, `howOf(line) → {text, tone: "model"|"human"|"rule"}`; `StateBadge({state})`, `HowBadge({line})`, `GradientNumber({n, tone})`(tone `"brand"|"human"|"amber"|"plain"`), `StatTile({label, n, tone, sub})`, `ProgressBar({id?, text, err?, ratio?})`, `SectionHead({title, sub?, right?})`, `Foot()`, `LineTable({rows, week, live?})`, `CsvTable({text})`, `CandidatePicker({line, onAct?})`, `LinePanel()`.
- `useLineActions().pick/addNew/hold/exclude` → `Promise<boolean>`(성공 true).
- DOM 계약: `.qcard` 는 과제 10 이 낸다. 여기서는 `tr.row[data-id]`, `select[data-any]`, `[data-pick-any]`, `[data-more]`, `[data-pick]`, `[data-new]`, `[data-hold]`, `[data-exclude]`, `[data-rematch]`, `[data-progress]`, `#drawer`, `#d-close`.

- [ ] **Step 1: `index.css` 끝에 표·kv·feed 규칙 추가**

```css
/* ---- 표·정의목록·피드(옛 app.css 의 이름 그대로) */
.table-wrap { @apply overflow-x-auto rounded-2xl border border-line bg-white; }
table.data { @apply w-full text-[14px]; }
table.data th, table.data td { @apply border-b border-line px-3.5 py-2.5 text-left align-middle; }
table.data thead th { @apply sticky top-0 z-[1] bg-surface text-[12px] font-semibold text-muted-foreground whitespace-nowrap; }
table.data tbody tr:last-child td { border-bottom: 0; }
table.data td.n, table.data th.n { @apply text-right tabular-nums; }
table.data td.mono { @apply font-mono text-[13px]; }
table.data td.file { @apply font-medium; }
table.data tr.total td { @apply bg-surface font-bold; }
.kv { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 7px 20px; font-size: 14px; margin: 0; }
.kv dt { color: var(--color-muted-foreground); white-space: nowrap; }
.kv dd { margin: 0; font-variant-numeric: tabular-nums; }
.feed { list-style: none; margin: 0; padding: 0; display: grid; gap: 9px; font-size: 14px; }
.feed li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: baseline; }
.feed .when { color: var(--color-faint); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.feed .f { font-weight: 500; }
.bars { display: grid; gap: 10px; }
.bars .b { display: grid; grid-template-columns: minmax(0, 1fr) 3rem; gap: 10px; align-items: center; font-size: 14px; }
.bars .track { height: 8px; border-radius: 999px; background: #f1f5f9; overflow: hidden; }
.bars .fill { height: 100%; border-radius: 999px; background: var(--color-amber); }
.bars .v { text-align: right; font-variant-numeric: tabular-nums; color: var(--color-muted-foreground); }
```

- [ ] **Step 2: `src/lines.ts` + 테스트**

`test/lines.test.ts`:
```ts
import { expect, test } from "vitest"
import { counts, howOf, matches } from "../src/lines"
import { offline } from "../src/fallback"
import { loadRecorded } from "./fixtures"

const d = offline(loadRecorded())

test("counts 는 상태별 개수와 총합", () => {
  const c = counts(d.lines)
  expect(c.n).toBe(d.lines.length)
  expect(c.auto + c.held + c.confirmed + c.excluded).toBe(c.n)
})
test("matches 는 원문·이름을 대소문자 무시로 부분 일치, 빈 검색은 전부", () => {
  const l = d.lines[0]
  expect(matches(l, "")).toBe(true)
  expect(matches(l, l.raw.slice(0, 2))).toBe(true)
  expect(matches(l, "없는이름zzz")).toBe(false)
})
test("howOf: 모델 줄은 model, 사람 줄은 human, 나머지는 rule, 없으면 사유", () => {
  expect(howOf({ ...d.lines[0], how: "모델", model: { replayed: true } })).toEqual({ text: "모델 · 미리 잰 값", tone: "model" })
  expect(howOf({ ...d.lines[0], how: "사람" })).toEqual({ text: "사람", tone: "human" })
  expect(howOf({ ...d.lines[0], how: "별칭" })).toEqual({ text: "별칭", tone: "rule" })
  expect(howOf({ ...d.lines[0], how: undefined, reason: "dup" })).toEqual({ text: "동명이인", tone: "rule" })
  expect(howOf({ ...d.lines[0], how: undefined, reason: undefined })).toBeNull()
})
```

`src/lines.ts`:
```ts
import { REASON } from "./labels"
import type { Line } from "./types"

export function counts(lines: Line[]) {
  const c = { n: lines.length, auto: 0, held: 0, confirmed: 0, excluded: 0 }
  for (const l of lines) c[l.state] += 1
  return c
}
export const matches = (l: Line, query: string): boolean =>
  !query || [l.raw, l.name].some((v) => v && v.toLowerCase().includes(query.toLowerCase()))

export type HowTone = "model" | "human" | "rule"
export function howOf(l: Line): { text: string; tone: HowTone } | null {
  const h = l.how || (l.reason ? REASON[l.reason] || l.reason : "")
  if (!h) return null
  if (l.how === "모델") return { text: "모델" + (l.model?.replayed ? " · 미리 잰 값" : ""), tone: "model" }
  if (l.how === "사람") return { text: "사람", tone: "human" }
  return { text: h, tone: "rule" }
}
```

Run: `npx vitest run test/lines.test.ts` → PASS 3.

- [ ] **Step 3: 작은 컴포넌트 5개**

`src/components/StateBadge.tsx`:
```tsx
import { STATE } from "@/labels"
import type { LineState } from "@/types"

export const StateBadge = ({ state }: { state: LineState }) => <span className={"badge badge-" + state}>{STATE[state]}</span>
```

`src/components/HowBadge.tsx`(근거 배지 = 틴트 + 경로 점):
```tsx
import { howOf } from "@/lines"
import type { Line } from "@/types"

const CLS = { model: "badge-model dot-model", human: "badge-human dot-human", rule: "badge-auto dot-brand" }
export function HowBadge({ line }: { line: Line }) {
  const h = howOf(line)
  if (!h) return null
  const [badge, dot] = CLS[h.tone].split(" ")
  return <span className={"badge badge-how " + badge}><i className={dot} aria-hidden="true" />{h.text}</span>
}
```

`src/components/GradientNumber.tsx`:
```tsx
export type NumTone = "brand" | "human" | "amber" | "plain"
const CLS: Record<NumTone, string> = { brand: "grad-text", human: "grad-text-human", amber: "text-amber", plain: "text-ink" }
export function GradientNumber({ n, tone = "plain", size = "text-[32px]" }: { n: number | string; tone?: NumTone; size?: string }) {
  return <span className={size + " font-extrabold leading-none tabular-nums tracking-[-0.03em] " + CLS[tone]}>{n}</span>
}
```

`src/components/StatTile.tsx`:
```tsx
import { GradientNumber, type NumTone } from "./GradientNumber"

export function StatTile({ label, n, tone, sub }: { label: string; n: number | string; tone: NumTone; sub?: string }) {
  return (
    <div className="card stat px-5 py-4">
      <div className="text-[13px] font-semibold text-muted-foreground">{label}</div>
      <div className="mt-2 mb-1"><GradientNumber n={n} tone={tone} /></div>
      {sub && <div className="text-[13px] text-muted-foreground">{sub}</div>}
    </div>
  )
}
```

`src/components/ProgressBar.tsx`(막대는 `ratio` 가 있을 때만, 글자는 항상 — `id` 가 `imp-progress` 계약):
```tsx
export function ProgressBar({ id, text, err = false, ratio }: { id?: string; text: string; err?: boolean; ratio?: number | null }) {
  return (
    <div className="progress-wrap grid gap-1.5">
      {typeof ratio === "number" && (
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
          <div className="bar-fill h-full rounded-full" style={{ width: Math.round(ratio * 100) + "%" }} />
        </div>
      )}
      <p id={id} className={"progress m-0 min-h-5 text-[13px] " + (err ? "err text-red" : "text-muted-foreground")}>{text}</p>
    </div>
  )
}
```

`src/components/SectionHead.tsx`·`src/components/Foot.tsx`:
```tsx
import type { ReactNode } from "react"
export function SectionHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="sec-head mb-3.5 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="m-0 text-[17px] font-bold">{title}</h2>{sub && <p className="sub m-0 mt-0.5 text-[13px] text-muted-foreground">{sub}</p>}</div>
      {right}
    </div>
  )
}
```
```tsx
import { useApp, useData } from "@/store"
export function Foot() {
  const d = useData(); const { s } = useApp()
  if (d.mode === "local") return null
  const dev = (s.recorded?.meta.device ?? d.recorded?.device) || ""
  return <p className="foot mt-5 text-[13px] leading-relaxed text-muted-foreground">예시 데이터입니다 · 실제 단체 자료가 아닙니다 · 모델 판정은 {dev}에서 미리 잰 값이고 「지금 다시 재기」만 실제로 돕니다 · 임계 유사도 0.85 · 동명이인은 자동 확정하지 않습니다</p>
}
```

- [ ] **Step 4: `LineTable`·`CsvTable`**

`src/components/LineTable.tsx`:
```tsx
import { won } from "@/format"
import { counts } from "@/lines"
import { useApp, useData } from "@/store"
import type { Line } from "@/types"
import { EmptyState } from "./EmptyState"
import { GradientNumber } from "./GradientNumber"
import { HowBadge } from "./HowBadge"
import { SectionHead } from "./SectionHead"
import { StateBadge } from "./StateBadge"

function AnswerMark({ line }: { line: Line }) {
  const d = useData()
  if (!d.answers || !Object.keys(d.answers).length || line.state !== "auto") return null
  const want = d.answers[line.raw]
  if (!want) return null
  const p = d.roster.find((x) => x.id === want)
  return want === line.person_id ? <span className="text-[12px] text-brand-ink">정답</span> : <span className="text-[12px] text-red">정답: {p ? p.name : want}</span>
}

export function LineTable({ rows, week, live = false }: { rows: Line[]; week: string; live?: boolean }) {
  const { s, dispatch } = useApp()
  const c = counts(rows)
  const ordered = rows.slice().sort((a, b) => Number(a.state !== "held") - Number(b.state !== "held"))
  return (
    <div className="card">
      <SectionHead title={week + " 맞추기 결과" + (live ? " · 진행 중" : "")} sub="확인 필요 줄부터 보여줍니다. 줄을 누르면 근거와 후보가 열립니다." />
      <div className="split mb-4 flex flex-wrap items-baseline gap-3">
        <GradientNumber n={c.auto} tone="brand" /><span className="text-muted-foreground">자동</span>
        <span className="text-[22px] text-faint">/</span>
        <GradientNumber n={c.held} tone="amber" /><span className="text-muted-foreground">확인 필요</span>
        {c.confirmed > 0 && <span className="text-muted-foreground">· 확정 {c.confirmed}</span>}
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>상태</th><th>입금자명</th><th className="n">금액</th><th>종류</th><th>맞춘 사람</th><th>근거</th><th></th></tr></thead>
            <tbody>
              {ordered.map((l) => (
                <tr key={l.id} className="row row-click" data-id={l.id} aria-selected={s.selected === l.id} onClick={() => dispatch({ type: "select", id: l.id })}>
                  <td><StateBadge state={l.state} /></td>
                  <td className="file">{l.raw}</td>
                  <td className="n">{won(l.amount)}</td>
                  <td>{l.kind || ""}</td>
                  <td>{l.name ? <>{l.name} <span className="text-[13px] text-muted-foreground">{l.group}</span></> : l.cands.length ? <span className="text-muted-foreground">후보 {l.cands.length}</span> : ""}</td>
                  <td><HowBadge line={l} /></td>
                  <td><AnswerMark line={l} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState text="아직 줄이 없습니다" />}
    </div>
  )
}
```

`src/components/CsvTable.tsx`:
```tsx
import { parseCsv } from "@/fallback"
import { EmptyState } from "./EmptyState"

export function CsvTable({ text }: { text: string }) {
  const rows = parseCsv(text)
  if (!rows.length) return <EmptyState text="비어 있습니다" />
  const [head, ...body] = rows
  const numCol = (i: number) => i > 1 && /^[\d,]*$/.test((body[0] || [])[i] || "")
  return (
    <div className="table-wrap">
      <table className="data">
        <thead><tr>{head.map((h, i) => <th key={i} className={numCol(i) ? "n" : ""}>{h}</th>)}</tr></thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri} className={/^(합계|미확정)$/.test(r[0]) ? "total" : ""}>
              {r.map((v, i) => /^-?\d+$/.test(v) && i > 1 ? <td key={i} className="n">{Number(v).toLocaleString("ko-KR")}</td> : <td key={i}>{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: `store.tsx` 의 네 액션이 성공 여부를 돌려주게**

`pick`·`addNew`·`hold`·`exclude` 의 본문을 `try { …; await load(week); return true } catch (e) { fail(e); return false }` 로 바꾸고, 반환 타입을 `Promise<boolean>` 으로. (`rematch`·`undo` 는 그대로.)

- [ ] **Step 6: `CandidatePicker` — 한 화면 한 일(후보만 보이고 「다른 방법 ▾」 아래 직접 고르기·새 이름 등록)**

```tsx
import { ChevronDown, RefreshCw } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { useApp, useData, useLineActions } from "@/store"
import type { Line } from "@/types"

/** onAct: 확정·보류·제외 요청의 Promise<boolean> 을 받는다(확인 큐가 카드 접힘에 쓴다) */
export function CandidatePicker({ line, onAct }: { line: Line; onAct?: (p: Promise<boolean>) => void }) {
  const d = useData(); const { s, toast } = useApp(); const act = useLineActions()
  const disabled = s.readonly
  const [more, setMore] = useState(line.cands.length === 0)
  const [newName, setNewName] = useState(line.raw.replace(/\s+/g, ""))
  const [newGroup, setNewGroup] = useState("")
  const [any, setAny] = useState("")
  const [prog, setProg] = useState<{ text: string; err: boolean }>({ text: "", err: false })
  const fire = (p: Promise<boolean>) => { if (onAct) onAct(p) }
  const canRematch = !disabled && !(d.mode === "local" && !d.model_alive)
  return (
    <div className="grid gap-3">
      {line.cands.length > 0 && (
        <div className="cands grid gap-2">
          {line.cands.map((c) => (
            <button key={c.person_id} type="button" className="cand" data-pick={line.id} data-person={c.person_id} disabled={disabled} onClick={() => fire(act.pick(line.id, c.person_id))}>
              <span className="font-semibold">{c.name}</span><span className="text-[13px] text-muted-foreground">{c.group}</span>
              <span className="ml-auto text-[13px] text-muted-foreground">{c.why}</span>
            </button>
          ))}
        </div>
      )}
      <Collapsible open={more} onOpenChange={setMore}>
        <CollapsibleTrigger asChild>
          <button type="button" data-more={line.id} className="press inline-flex items-center gap-1 rounded-lg px-1 text-[14px] font-semibold text-brand-ink" aria-expanded={more}>
            다른 방법 <ChevronDown className={"size-4 transition-transform " + (more ? "rotate-180" : "")} aria-hidden="true" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="grid gap-3 pt-3">
          <div className="anyrow grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <select data-any={line.id} disabled={disabled} value={any} onChange={(e) => setAny(e.target.value)} aria-label="명부에서 직접 고르기">
              <option value="">명부에서 직접 고르기…</option>
              {d.roster.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.group})</option>)}
            </select>
            <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl px-3.5" data-pick-any={line.id} disabled={disabled}
                    onClick={() => { if (!any) { toast("명부에서 사람을 고르세요", "err"); return } fire(act.pick(line.id, any)) }}>이 사람으로 확정</Button>
          </div>
          {line.allow_new !== false ? (
            <div className="newform grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className="grid gap-1 text-[13px] font-semibold text-muted-foreground">새 이름으로 등록
                <Input className="h-10 rounded-xl text-[15px]" data-new-name={line.id} value={newName} disabled={disabled} onChange={(e) => setNewName(e.target.value)} /></label>
              <label className="grid gap-1 text-[13px] font-semibold text-muted-foreground">구역
                <Input className="h-10 rounded-xl text-[15px]" data-new-group={line.id} placeholder="5구역" value={newGroup} disabled={disabled} onChange={(e) => setNewGroup(e.target.value)} /></label>
              <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl px-3.5" data-new={line.id} disabled={disabled}
                      onClick={() => fire(act.addNew(line.id, newName.trim(), newGroup.trim()))}>등록하고 확정</Button>
            </div>
          ) : <p className="m-0 text-[13px] text-muted-foreground">동명이인은 새 이름 등록 없이 후보 중에서 고릅니다.</p>}
        </CollapsibleContent>
      </Collapsible>
      <div className="row-actions flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-9 rounded-xl px-3" data-hold={line.id} disabled={disabled} onClick={() => fire(act.hold(line.id))}>보류</Button>
        <Button type="button" variant="ghost" size="sm" className="h-9 rounded-xl px-3" data-exclude={line.id} disabled={disabled} onClick={() => fire(act.exclude(line.id))}>제외</Button>
        <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3" data-rematch={line.id} disabled={!canRematch}
                onClick={() => { void act.rematch(line.id, (text, err) => setProg({ text, err: !!err })) }}><RefreshCw aria-hidden="true" />지금 다시 재기</Button>
        <span className={"progress text-[13px] " + (prog.err ? "err text-red" : "text-muted-foreground")} data-progress={line.id}>{prog.text}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: `LinePanel` — 데스크톱은 밀어내는 패널, 모바일은 바텀시트**

```tsx
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { won } from "@/format"
import { useMobile } from "@/hooks"
import { NO_KIND, REASON } from "@/labels"
import { useApp, useData } from "@/store"
import type { Line } from "@/types"
import { CandidatePicker } from "./CandidatePicker"
import { HowBadge } from "./HowBadge"
import { StateBadge } from "./StateBadge"

function Body({ line }: { line: Line }) {
  const d = useData()
  const m = line.model || null
  const want = d.answers?.[line.raw]
  const wantName = want ? (d.roster.find((p) => p.id === want)?.name ?? want) : ""
  const meta = m ? [m.model && "모델 " + m.model, typeof m.wall_s === "number" && m.wall_s + "초", m.prompt_n && "프롬프트 " + m.prompt_n + " 토큰",
    m.pp_tps && "pp " + Number(m.pp_tps).toFixed(1) + " tok/s", m.tg_tps && "tg " + Number(m.tg_tps).toFixed(1) + " tok/s", m.replayed && "미리 잰 값", m.note, m.error && "오류 " + m.error].filter(Boolean).join(" · ") : ""
  return (
    <div className="d-body grid gap-5 text-[14px]">
      <section><h4 className="mb-2 text-[12px] font-semibold tracking-wide text-muted-foreground">판정</h4>
        <dl className="kv">
          <dt>상태</dt><dd><StateBadge state={line.state} /></dd>
          <dt>맞춘 사람</dt><dd>{line.name ? <>{line.name} <span className="text-muted-foreground">{line.group}</span></> : <span className="text-muted-foreground">없음</span>}</dd>
          <dt>근거</dt><dd><HowBadge line={line} /> {!line.how && !line.reason && <span className="text-muted-foreground">-</span>}</dd>
          <dt>종류</dt><dd>{line.kind || NO_KIND}</dd>
          {line.reason && <><dt>사유</dt><dd>{REASON[line.reason] || line.reason}</dd></>}
          {want && <><dt>샘플 정답</dt><dd>{wantName}</dd></>}
        </dl></section>
      {line.state === "held" && <section><h4 className="mb-2 text-[12px] font-semibold tracking-wide text-muted-foreground">후보</h4><CandidatePicker line={line} /></section>}
      {m && (
        <section><h4 className="mb-2 text-[12px] font-semibold tracking-wide text-muted-foreground">모델</h4>
          <div className="text-[13px] leading-relaxed text-muted-foreground">{meta}</div>
          {m.pred && <details className="mt-3 rounded-xl border border-line px-3 py-2 text-[13px]"><summary className="cursor-pointer font-semibold text-muted-foreground">모델 출력 JSON</summary>
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface p-2.5 text-[12px] text-ink">{JSON.stringify(m.pred, null, 1)}</pre></details>}
        </section>
      )}
    </div>
  )
}

export function LinePanel() {
  const { s, dispatch } = useApp()
  const mobile = useMobile()
  const line = s.data && s.selected ? s.data.lines.find((l) => l.id === s.selected) ?? null : null
  const close = () => dispatch({ type: "select", id: null })
  const subtitle = line ? won(line.amount) + " · " + line.week + " · " + (line.path === "envelope" ? "봉투" : "통장") : ""
  if (mobile) {
    return (
      <Sheet open={!!line} onOpenChange={(o) => { if (!o) close() }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-5">
          {line && <><SheetHeader className="p-0 text-left"><SheetTitle className="text-[17px] font-bold break-all">{line.raw}</SheetTitle><SheetDescription>{subtitle}</SheetDescription></SheetHeader>
            <div className="mt-4"><Body line={line} /></div></>}
        </SheetContent>
      </Sheet>
    )
  }
  return (
    <aside id="drawer" className={"panel" + (line ? " open" : "")} aria-hidden={!line} aria-label="줄 상세">
      {line && <>
        <div className="d-head flex items-start gap-3 border-b border-line px-5 pt-4 pb-3">
          <div><div className="text-[17px] font-bold leading-snug break-all">{line.raw}</div><div className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</div></div>
          <Button id="d-close" variant="ghost" size="icon-sm" className="ml-auto rounded-lg" aria-label="닫기" onClick={close}><X aria-hidden="true" /></Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-8"><Body line={line} /></div>
      </>}
    </aside>
  )
}
```

`Layout.tsx` 에 `import { LinePanel } from "./LinePanel"` 를 넣고 `<Toasts />` 앞에 `<LinePanel />` 를 렌더한다.

- [ ] **Step 8: 테스트·타입·개발 서버 확인, 커밋**

```bash
cd ~/Projects/03-personal/matjangbu/ui && npm test && npm run typecheck
```
Expected: PASS(총 16), 타입 오류 0. (화면은 과제 8 이후에 본다 — 아직 어느 화면도 이 컴포넌트를 쓰지 않는다.)

```bash
cd ~/Projects/03-personal/matjangbu && git add ui/src ui/test
git commit -m "ui: 공용 컴포넌트 — 배지·큰 숫자·진행·표·후보 고르기(다른 방법 접기)·줄 상세 패널/바텀시트

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: 화면 — 대시보드 · 기기

**Files:**
- Create: `ui/src/views/Dashboard.tsx`, `ui/src/views/Device.tsx`
- Modify: `ui/src/views/index.tsx`(두 항목 교체)

**Interfaces:**
- Consumes: `useData`, `useApp`, `counts`, `StatTile`, `Foot`, `fmtTs`, `REASON`, `STATE`, `Health`.
- 스펙 §2.2 표의 두 행 그대로. 타일 4 = 이번 주 줄(plain) · 자동 확정(brand) · 확인 필요(amber) · 사람이 확정(human). 모델 카드는 상단 2px model 선(`.card-model`).

- [ ] **Step 1: `views/Dashboard.tsx`**

```tsx
import { Foot } from "@/components/Foot"
import { GradientNumber } from "@/components/GradientNumber"
import { StatTile } from "@/components/StatTile"
import { fmtTs } from "@/format"
import { REASON, STATE } from "@/labels"
import { counts } from "@/lines"
import { useData } from "@/store"

export default function Dashboard() {
  const d = useData()
  const c = counts(d.lines)
  const reasons: Record<string, number> = {}
  for (const l of d.lines) if (l.state === "held") { const k = l.reason || "unknown"; reasons[k] = (reasons[k] || 0) + 1 }
  const rk = Object.keys(reasons).sort((a, b) => reasons[b] - reasons[a])
  const mx = Math.max(1, ...rk.map((k) => reasons[k]))
  const walls = d.lines.map((l) => l.model?.wall_s).filter((v): v is number => typeof v === "number")
  const mean = walls.length ? (walls.reduce((a, b) => a + b, 0) / walls.length).toFixed(1) : null
  const acts = (d.recent ?? d.lines.filter((l) => l.human || l.undo_of)).slice().sort((a, b) => (b.ts || "").localeCompare(a.ts || "")).slice(0, 8)
  const autos = d.lines.filter((l) => l.state === "auto")
  const hasAnswers = d.answers && Object.keys(d.answers).length > 0
  const ok = autos.filter((l) => d.answers[l.raw] === l.person_id).length
  const dev = d.recorded?.device || d.device || ""
  return (
    <>
      <div className="stats mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="이번 주 줄" n={c.n} tone="plain" sub={d.week} />
        <StatTile label="자동 확정" n={c.auto} tone="brand" sub="규칙 1·2단" />
        <StatTile label="확인 필요" n={c.held} tone="amber" sub="사람이 고른다" />
        <StatTile label="사람이 확정" n={c.confirmed} tone="human" sub="별칭 사전에 쌓임" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card"><h3 className="mb-3 text-[17px]">확인 사유 분포</h3>
          {rk.length ? <div className="bars">{rk.map((k) => (
            <div className="b" key={k}><div><div className="mb-1 flex justify-between gap-2"><span>{REASON[k] || k}</span></div><div className="track"><div className="fill" style={{ width: Math.round((reasons[k] / mx) * 100) + "%" }} /></div></div><div className="v">{reasons[k]}</div></div>
          ))}</div> : <div className="empty text-muted-foreground">확인 필요 줄이 없습니다</div>}
        </div>
        <div className="card card-model"><h3 className="mb-3 text-[17px]">모델 처리 시간</h3>
          {walls.length ? <>
            <dl className="kv"><dt>모델이 본 줄</dt><dd>{walls.length}</dd><dt>줄당 평균</dt><dd>{mean}초</dd><dt>최소 · 최대</dt><dd>{Math.min(...walls).toFixed(1)} · {Math.max(...walls).toFixed(1)}초</dd><dt>기기</dt><dd>{dev}</dd></dl>
            {d.recorded && <p className="mt-3 mb-0 text-[13px] text-muted-foreground">미리 잰 값 · {d.recorded.model} · {fmtTs(d.recorded.ts)}</p>}
          </> : <div className="empty text-muted-foreground">이번 주에는 모델이 본 줄이 없습니다</div>}
        </div>
        <div className="card"><h3 className="mb-3 text-[17px]">최근 활동 <span className="text-[13px] font-medium text-muted-foreground">모든 주차</span></h3>
          {acts.length ? <ul className="feed">{acts.map((l) => (
            <li key={l.id + (l.ts || "")}><span className="when">{fmtTs(l.ts)} · {l.week || ""}</span><span className="f">{l.raw}</span>
              <span className="text-muted-foreground">{l.undo_of ? "되돌림" : l.note || (l.state ? STATE[l.state] : "")}{l.alias_learned ? " · 별칭 저장" : ""}</span></li>
          ))}</ul> : <div className="empty text-muted-foreground">아직 사람 손이 닿은 줄이 없습니다</div>}
        </div>
        {hasAnswers && (
          <div className="card"><h3 className="mb-1 text-[17px]">샘플 정답 대조 <span className="badge badge-gray">체험 전용</span></h3>
            <p className="text-[13px] text-muted-foreground">자동 확정한 줄의 사람이 샘플 정답과 같은가(사람이 고친 줄은 제외). 규칙이 낸 답의 정확도이지 모델의 정확도가 아니다.</p>
            <div className="flex items-baseline gap-3"><GradientNumber n={ok} tone="brand" /><span className="text-muted-foreground">/ {autos.length} 줄 일치</span></div>
          </div>
        )}
      </div>
      <Foot />
    </>
  )
}
```

- [ ] **Step 2: `views/Device.tsx`**

```tsx
import { useEffect, useState } from "react"
import { Foot } from "@/components/Foot"
import { fmtTs } from "@/format"
import { useApp, useData } from "@/store"
import type { Health } from "@/types"

export default function Device() {
  const d = useData(); const { s, client } = useApp()
  const [h, setH] = useState<Health | null>(null)
  useEffect(() => {
    if (s.readonly) return
    let alive = true
    client.api<Health>("/health").then((x) => { if (alive) setH(x) }).catch(() => {})
    return () => { alive = false }
  }, [client, s.readonly, s.loadSeq])
  const r = d.recorded
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card"><h3 className="mb-3 text-[17px]">인스턴스</h3>
          <dl className="kv" id="dev-kv">
            <dt>주소</dt><dd>{s.readonly ? "(없음 · 읽기 전용)" : s.apiBase}</dd>
            {h && <><dt>모드</dt><dd>{h.mode === "demo" ? "체험" : "로컬"}</dd><dt>기기</dt><dd>{h.device}</dd>
              <dt>모델 서버</dt><dd>{h.model_alive ? "응답" : "없음"} <span className="font-mono text-[13px] text-muted-foreground">{h.model_url}</span></dd>
              <dt>대기열</dt><dd>{h.queued}</dd><dt>세션</dt><dd>{h.sessions}</dd></>}
          </dl></div>
        <div className="card"><h3 className="mb-3 text-[17px]">미리 잰 기록</h3>
          {r ? <dl className="kv"><dt>기기</dt><dd>{r.device}</dd><dt>모델</dt><dd>{r.model}</dd><dt>스레드</dt><dd>{r.threads}</dd><dt>시각</dt><dd>{fmtTs(r.ts)}</dd><dt>엔진</dt><dd className="font-mono">{r.engine_git || ""}</dd></dl>
             : <div className="empty text-muted-foreground">로컬 모드</div>}
          <p className="mt-3 mb-0 text-[13px] text-muted-foreground"><a className="text-brand-ink hover:underline" href="../phone/">지원 기기 · 갤럭시 A31 실측표 →</a></p>
        </div>
      </div>
      <Foot />
    </>
  )
}
```

- [ ] **Step 3: `views/index.tsx` 에 연결**

```tsx
import Dashboard from "./Dashboard"
import Device from "./Device"
// … VIEWS 의 dashboard: Dashboard, device: Device 로 교체
```

- [ ] **Step 4: 확인·커밋**

```bash
cd ~/Projects/03-personal/matjangbu/ui && npm run typecheck && cd .. && \
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/dev_shot.cjs 'http://127.0.0.1:5173/#/dashboard' /tmp/claude-1000/dash.png && \
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/dev_shot.cjs 'http://127.0.0.1:5173/#/device' /tmp/claude-1000/device.png
```
Expected: 콘솔 에러 0. 대시보드: 타일 4(「자동 확정」 숫자가 청록→초록 글자, 「사람이 확정」 초록→노랑, 「확인 필요」 앰버), 모델 카드 상단 보라 선, 분포 막대 앰버. Read 로 열어 본다.

```bash
cd ~/Projects/03-personal/matjangbu && git add ui/src/views && git commit -m "ui: 대시보드·기기 화면

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: 화면 — 불러오기(SSE 진행 막대 · 하단 고정 CTA)

**Files:**
- Create: `ui/src/views/Import.tsx`
- Modify: `ui/src/views/index.tsx`(`import: Import`)

**Interfaces:**
- Consumes: `useData`·`useApp`(`client.post/stream`, `load`, `toast`, `fail`, `dispatch busy`), `LineTable`, `ProgressBar`, `guessWeek`, `counts`, `Foot`.
- DOM 계약: `#imp-week`(체험, 네이티브 select), `#imp-run`, `#imp-progress`(`.err`), `#imp-result` 안의 `tr.row`. 「끝」 뒤에도 `#imp-progress` 글자를 남긴다(옛 화면은 다시 그리며 지웠다 — `site_shots.cjs` 가 그 글자를 기다리므로 남기는 쪽이 안전하다).

- [ ] **Step 1: `views/Import.tsx`**

```tsx
import { Zap } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/EmptyState"
import { Foot } from "@/components/Foot"
import { LineTable } from "@/components/LineTable"
import { ProgressBar } from "@/components/ProgressBar"
import { guessWeek } from "@/fallback"
import { counts } from "@/lines"
import { useApp, useData } from "@/store"
import type { Line } from "@/types"

type Prog = { text: string; err: boolean; ratio: number | null }

export default function Import() {
  const d = useData(); const { s, client, load, toast, fail, dispatch } = useApp()
  const demo = d.mode !== "local"
  const [sampleWeek, setSampleWeek] = useState("")
  const weekSel = sampleWeek && d.weeks_available.includes(sampleWeek) ? sampleWeek : d.weeks_available[0] || ""
  const [wk, setWk] = useState(guessWeek())
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [csv, setCsv] = useState<{ text: string; name: string; lines: string[] } | null>(null)
  const [prog, setProg] = useState<Prog>({ text: "", err: false, ratio: null })
  const [live, setLive] = useState<{ rows: Line[]; week: string } | null>(null)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    const buf = await f.arrayBuffer()
    let text = new TextDecoder("utf-8", { fatal: false }).decode(buf)
    if (text.includes("�")) { try { text = new TextDecoder("euc-kr").decode(buf) } catch { /* utf-8 그대로 */ } }
    setCsv({ text, name: f.name, lines: text.split(/\r?\n/).filter(Boolean) })
  }

  const run = async () => {
    if (s.busy) return
    dispatch({ type: "busy", busy: true })
    setProg({ text: "줄을 서는 중…", err: false, ratio: 0 })
    const rows: Line[] = []; let n = 0
    const week = demo ? weekSel : wk.trim()
    const body = demo ? { sample_week: weekSel } : { week, date, filename: csv?.name, csv_text: csv?.text }
    try {
      const job = await client.post<{ job: string }>("/import", body)
      await client.stream("/jobs/" + job.job + "/events", (ev) => {
        if (ev.event === "start") { n = ev.n || 0; setProg({ text: "0 / " + n + " 줄 · 파일에서 " + (ev.skipped ?? 0) + "줄 제외(출금·금액 0)", err: false, ratio: 0 }) }
        else if (ev.event === "line" && ev.row) {
          rows.push(ev.row); const i = (ev.i ?? rows.length - 1) + 1; const N = ev.n || n
          setProg({ text: i + " / " + N + " 줄" + (ev.row.how === "모델" ? " · 모델이 본 줄: " + ev.row.raw : ""), err: false, ratio: N ? i / N : null })
          setLive({ rows: rows.slice(), week })
        }
        else if (ev.state === "failed") setProg({ text: ev.error || "실패", err: true, ratio: null })
        else if (ev.state === "done") setProg((p) => ({ ...p, text: "끝", ratio: 1 }))
      })
      await load(week)
      const c = counts(rows)
      toast("자동 " + c.auto + " / 확인 " + c.held, "ok")
      setProg({ text: "끝 · 자동 " + c.auto + " / 확인 " + c.held, err: false, ratio: 1 })
      setLive(null)
    } catch (e) { setProg({ text: e instanceof Error ? e.message : String(e), err: true, ratio: null }); fail(e) }
    dispatch({ type: "busy", busy: false })
  }

  const canRun = !s.busy && (demo ? !!weekSel : !!csv)
  return (
    <>
      <div className="card mb-4">
        <h3 className="mb-3 text-[17px]">불러오기</h3>
        {s.readonly ? <EmptyState text={"읽기 전용에서는 불러올 수 없습니다. 아래 표는 " + d.week + " 의 미리 잰 결과입니다."} /> : (
          <div className="form grid max-w-[720px] gap-3.5">
            {demo ? (
              <label className="field grid gap-1 text-[13px] font-semibold text-muted-foreground">샘플 주차
                <select id="imp-week" value={weekSel} onChange={(e) => setSampleWeek(e.target.value)} disabled={!d.weeks_available.length}>
                  {d.weeks_available.length ? d.weeks_available.map((w) => <option key={w}>{w}</option>) : <option value="">(남은 샘플 주차 없음)</option>}
                </select></label>
            ) : (
              <>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <label className="field grid gap-1 text-[13px] font-semibold text-muted-foreground">주차<input type="text" id="imp-wk" placeholder="2026-W10" value={wk} onChange={(e) => setWk(e.target.value)} /></label>
                  <label className="field grid gap-1 text-[13px] font-semibold text-muted-foreground">날짜<input type="date" id="imp-date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                </div>
                <label className="field grid gap-1 text-[13px] font-semibold text-muted-foreground">은행 CSV<input type="file" id="imp-file" accept=".csv,text/csv" onChange={(e) => { void onFile(e.target.files?.[0]) }} /></label>
                {csv && <div id="imp-preview" className="text-[13px] text-muted-foreground"><b>{csv.name}</b> · {csv.lines.length}줄 미리보기
                  <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-ink p-3 text-[12px] leading-relaxed text-slate-200">{csv.lines.slice(0, 8).join("\n")}</pre></div>}
              </>
            )}
            <div className="cta-row cta-fixed">
              <Button id="imp-run" className="btn-grad h-11 rounded-xl px-5 text-[15px] font-bold" disabled={!canRun} onClick={() => { void run() }}><Zap aria-hidden="true" />맞추기</Button>
              <span className="text-[13px] text-muted-foreground">{demo ? "샘플 은행 CSV 를 실제 규칙으로 맞춥니다. 모델 판정은 미리 잰 값을 재생합니다." : "파일은 이 PC 의 「들어옴」 폴더에 저장됩니다. 인터넷으로 나가지 않습니다."}</span>
            </div>
            <ProgressBar id="imp-progress" text={prog.text} err={prog.err} ratio={prog.ratio} />
          </div>
        )}
        {s.readonly && <p id="imp-progress" className="progress m-0 min-h-5 text-[13px] text-muted-foreground" />}
      </div>
      <div id="imp-result">{live ? <LineTable rows={live.rows} week={live.week} live /> : <LineTable rows={d.lines} week={d.week} />}</div>
      <Foot />
    </>
  )
}
```

- [ ] **Step 2: `views/index.tsx` 에 `import Import from "./Import"` 후 `import: Import`**

- [ ] **Step 3: 개발 서버에서 한 바퀴 — 8108 체험 인스턴스에서 실제로 W11 을 불러온다**

```bash
cd ~/Projects/03-personal/matjangbu/ui && npm run typecheck && cd .. && NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:900}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://127.0.0.1:5173/#/import',{waitUntil:'networkidle'});await p.locator('#imp-week option').first().waitFor({state:'attached'});
const opts=await p.locator('#imp-week option').allTextContents();console.log('주차',opts);
await p.locator('#imp-run').click();await p.waitForFunction(()=>/끝/.test(document.querySelector('#imp-progress')?.textContent||''),null,{timeout:120000});
await p.screenshot({path:'/tmp/claude-1000/import-done.png'});console.log('progress',await p.locator('#imp-progress').textContent(),'rows',await p.locator('main table tbody tr').count());
await p.setViewportSize({width:390,height:844});await p.screenshot({path:'/tmp/claude-1000/import-mobile.png'});await b.close();if(errs.length){console.log(errs);process.exit(1)}})()"
```

Expected: 주차 선택지에 남은 샘플 주차(개발 서버는 새 세션이라 `2026-W11`~`W13`), 진행 막대가 차오르며 결과 표가 실시간으로 늘고, 끝나면 `#imp-progress` 가 「끝 · 자동 n / 확인 m」, 표 행 ≥ 1, 콘솔 에러 0. `import-done.png`·`import-mobile.png`(하단 고정 「맞추기」 띠가 탭바 위에)를 Read 로 본다.

- [ ] **Step 4: 커밋**

```bash
cd ~/Projects/03-personal/matjangbu && git add ui/src/views && git commit -m "ui: 불러오기 화면 — SSE 진행 막대·실시간 결과 표·하단 고정 CTA

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: 화면 — 확인 큐(한 화면 한 일 · 카드 접힘 · 되돌리기 토스트)

**Files:**
- Create: `ui/src/views/Queue.tsx`
- Modify: `ui/src/views/index.tsx`(`queue: Queue`)

**Interfaces:**
- Consumes: `CandidatePicker({line, onAct})`, `HowBadge`, `SectionHead`, `EmptyState`, `Foot`, `matches`, `won`, `REASON`.
- DOM 계약: `.qcard`(`id="q-<id>"`, 원문 텍스트 포함), 카드 안에 `[data-more]`·`select[data-any]`·`[data-pick-any]`(CandidatePicker).

- [ ] **Step 1: `views/Queue.tsx`**

```tsx
import { useState } from "react"
import { CandidatePicker } from "@/components/CandidatePicker"
import { EmptyState } from "@/components/EmptyState"
import { Foot } from "@/components/Foot"
import { HowBadge } from "@/components/HowBadge"
import { SectionHead } from "@/components/SectionHead"
import { won } from "@/format"
import { REASON } from "@/labels"
import { matches } from "@/lines"
import { useApp, useData } from "@/store"
import type { Line } from "@/types"

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function why(l: Line): string {
  const rel = l.model?.pred?.relation
  if (rel) return "모델 판단: " + (REASON[rel] || rel) + (l.model?.pred?.name_part ? " · 이름 부분 「" + l.model.pred.name_part + "」" : "")
  if (l.reason === "model_failed") return "모델이 응답하지 않아 규칙이 세운 후보만 있습니다"
  return "규칙이 세운 후보"
}

export default function Queue() {
  const d = useData(); const { s } = useApp()
  const [leaving, setLeaving] = useState<Set<string>>(() => new Set())
  const held = d.lines.filter((l) => l.state === "held" && matches(l, s.query))
  /** 확정·보류·제외가 시작되면 카드를 200ms 접고, 결과와 무관하게 표시를 되돌린다(성공이면 이미 사라진 뒤다) */
  const onAct = (id: string) => async (p: Promise<boolean>) => {
    setLeaving((prev) => new Set(prev).add(id))
    await Promise.all([p, sleep(200)])
    setLeaving((prev) => { const n = new Set(prev); n.delete(id); return n })
  }
  const next = d.mode === "local" ? { label: "불러오기로", href: "#/import" } : d.weeks_available.length ? { label: "다음 주 불러오기", href: "#/import" } : undefined
  return (
    <>
      <SectionHead title={"확인 필요 " + held.length + "줄"} sub="확신이 낮으면 맞추지 않고 묻습니다. 고른 답은 별칭 사전에 쌓여 다음 주 같은 줄은 자동이 됩니다." />
      {held.length ? (
        <div className="grid gap-3">
          {held.map((l) => (
            <div key={l.id} id={"q-" + l.id} className={"qcard" + (leaving.has(l.id) ? " leaving" : "")}>
              <div className="head flex flex-wrap items-center gap-2.5">
                <span className="raw text-[17px] font-bold">{l.raw}</span>
                <span className="amt tabular-nums text-muted-foreground">{won(l.amount)}</span>
                {l.kind && <span className="badge badge-gray">{l.kind}</span>}
                <span className="badge badge-held">{REASON[l.reason || ""] || l.reason || ""}</span>
                <HowBadge line={l} />
              </div>
              <div className="why text-[13px] text-muted-foreground">{why(l)}</div>
              <CandidatePicker line={l} onAct={onAct(l.id)} />
            </div>
          ))}
        </div>
      ) : <EmptyState text={"확인할 줄이 없습니다" + (s.query ? " (검색: " + s.query + ")" : "")} action={next} />}
      <Foot />
    </>
  )
}
```

- [ ] **Step 2: `views/index.tsx` 에 `queue: Queue`**

- [ ] **Step 3: 개발 서버에서 흐름 — 우리상사 → 다른 방법 → 김태섭 확정 → 카드 사라짐 → 토스트에 되돌리기 → 되돌리면 카드 복귀**

```bash
cd ~/Projects/03-personal/matjangbu/ui && npm run typecheck && cd .. && NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:900}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://127.0.0.1:5173/#/queue',{waitUntil:'networkidle'});await p.waitForSelector('.qcard');
await p.screenshot({path:'/tmp/claude-1000/queue.png'});
const card=p.locator('.qcard',{hasText:'우리상사'});console.log('카드',await card.count());
await card.locator('[data-more]').click();await card.locator('select[data-any]').selectOption({label:'김태섭 (4구역)'});await card.locator('[data-pick-any]').click();
await card.waitFor({state:'detached',timeout:60000});console.log('사라짐 ok');
const t=p.locator('#toasts .toast.ok');console.log('토스트',await t.textContent());await t.locator('button').click();
await p.locator('.qcard',{hasText:'우리상사'}).waitFor({state:'attached',timeout:60000});console.log('되돌린 뒤 복귀 ok');
await p.setViewportSize({width:390,height:844});await p.screenshot({path:'/tmp/claude-1000/queue-mobile.png'});await b.close();if(errs.length){console.log(errs);process.exit(1)}})()"
```

Expected: `카드 1`, `사라짐 ok`, 토스트 「별칭 사전에 저장됨 · 다음부터 자동 되돌리기」, `되돌린 뒤 복귀 ok`, 콘솔 에러 0. `queue.png`: 카드마다 후보 버튼만 보이고 「다른 방법 ▾」가 접혀 있다. 카드 머리 원문 17px 굵게.

- [ ] **Step 4: 커밋**

```bash
cd ~/Projects/03-personal/matjangbu && git add ui/src/views && git commit -m "ui: 확인 큐 — 한 화면 한 일(다른 방법 접기)·카드 접힘·되돌리기 토스트

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: 화면 — 봉투 입력(검산 표시 · 하단 고정 저장)

**Files:**
- Create: `ui/src/views/Envelope.tsx`
- Modify: `ui/src/views/index.tsx`(`envelope: Envelope`)

**Interfaces:**
- Consumes: `useApp`(`s.envRows`, `dispatch envRows`, `client.post`, `load`, `toast`, `fail`), `emptyRow`, `BASE`, `guessWeek`, `won`, `LineTable`, `NO_KIND`, `EmptyState`, `Foot`.
- DOM: `#env-rows`, `#env-add`, `#env-sample`, `#env-total`, `#env-counted`, `#env-diff`, `#env-save`, `#env-result`. 명부 자동완성은 `Layout` 의 `<datalist id="roster-list">`.

- [ ] **Step 1: `views/Envelope.tsx`**

```tsx
import { Check, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/EmptyState"
import { Foot } from "@/components/Foot"
import { LineTable } from "@/components/LineTable"
import { guessWeek } from "@/fallback"
import { won } from "@/format"
import { NO_KIND } from "@/labels"
import { BASE } from "@/load"
import { emptyRow, useApp, useData } from "@/store"
import type { EnvRow, Line } from "@/types"

const FALLBACK: EnvRow[] = [{ name: "김정호", kind: "십일조", amount: "100000" }, { name: "박민수", kind: "감사헌금", amount: "50000" }, { name: "홍길동", kind: "", amount: "20000" }]

export default function Envelope() {
  const d = useData(); const { s, dispatch, client, load, toast, fail } = useApp()
  const rows = s.envRows
  const setRows = (r: EnvRow[]) => dispatch({ type: "envRows", rows: r })
  const [wk, setWk] = useState(d.week || guessWeek())
  const [date, setDate] = useState(d.lines[0]?.date || new Date().toISOString().slice(0, 10))
  const [counted, setCounted] = useState("")
  const [result, setResult] = useState<{ rows: Line[]; week: string } | null>(null)
  if (s.readonly) return <><EmptyState text="읽기 전용에서는 봉투를 입력할 수 없습니다." /><Foot /></>

  const total = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0)
  const diff = counted === "" ? null : total - Number(counted)
  const edit = (i: number, k: keyof EnvRow, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const del = (i: number) => setRows(rows.filter((_, j) => j !== i))
  const add = () => {
    setRows([...rows, emptyRow()])
    requestAnimationFrame(() => { const ins = document.querySelectorAll<HTMLInputElement>("#env-rows input[data-k=name]"); ins[ins.length - 1]?.focus() })
  }
  const sample = async () => {
    try {
      const sm = await (await fetch(BASE + "sample-envelopes.json", { cache: "no-cache" })).json() as { lines: { name: string; kind: string; amount: number }[]; counted_total: number }
      setRows(sm.lines.map((l) => ({ name: l.name, kind: l.kind, amount: String(l.amount) })))
      setCounted(String(sm.counted_total))
    } catch { setRows(FALLBACK) }
  }
  const save = async () => {
    const lines = rows.filter((r) => r.name || r.amount).map((r) => ({ name: r.name, kind: r.kind, amount: Number(r.amount) || 0 }))
    if (!lines.length) { toast("입력한 줄이 없습니다", "err"); return }
    try {
      const out = await client.post<{ rows: Line[]; total: number; diff: number | null; errors?: string[] }>("/envelope", { week: wk.trim(), date, lines, counted_total: counted === "" ? null : Number(counted) })
      const held = out.rows.filter((r) => r.state === "held").length
      toast("봉투 " + out.rows.length + "줄 저장 · 확인 필요 " + held + (out.diff != null ? " · 계수와 차이 " + out.diff.toLocaleString("ko-KR") + "원" : ""), held ? undefined : "ok")
      if (out.errors?.length) toast(out.errors.join(" / "), "err")
      setRows([emptyRow()])
      await load(wk.trim())
      setResult({ rows: out.rows, week: out.rows[0]?.week || wk.trim() })
    } catch (e) { fail(e) }
  }
  return (
    <>
      <div className="card mb-4">
        <h3 className="mb-1 text-[17px]">봉투 입력</h3>
        <p className="mb-4 text-[13px] text-muted-foreground">봉투에 적힌 이름·종류·금액을 줄줄이 넣습니다. 명부에 있는 이름은 곧바로 확정되고, 동명이인이거나 명부에 없으면 확인 큐로 갑니다. 모델은 쓰지 않습니다.</p>
        <div className="form grid max-w-[720px] gap-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="field grid gap-1 text-[13px] font-semibold text-muted-foreground">주차<input type="text" id="env-wk" value={wk} onChange={(e) => setWk(e.target.value)} /></label>
            <label className="field grid gap-1 text-[13px] font-semibold text-muted-foreground">날짜<input type="date" id="env-date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          </div>
          <div className="env-rows grid gap-2" id="env-rows">
            {rows.map((r, i) => (
              <div key={i} className="env-row grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_auto] items-center gap-2">
                <input type="text" list="roster-list" data-i={i} data-k="name" placeholder="이름 (명부 자동완성)" value={r.name} onChange={(e) => edit(i, "name", e.target.value)} />
                <select data-i={i} data-k="kind" value={r.kind} onChange={(e) => edit(i, "kind", e.target.value)} aria-label="종류">
                  <option value="">{NO_KIND}</option>{d.kinds.map((k) => <option key={k}>{k}</option>)}
                </select>
                <input type="number" data-i={i} data-k="amount" placeholder="금액" min={0} step={1000} value={r.amount} onChange={(e) => edit(i, "amount", e.target.value)} />
                <Button type="button" variant="ghost" size="icon-sm" className="rounded-lg" aria-label="줄 삭제" onClick={() => del(i)}><X aria-hidden="true" /></Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3" id="env-add" onClick={add}>줄 추가</Button>
            <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3" id="env-sample" onClick={() => { void sample() }}>샘플 12줄 채우기</Button>
          </div>
          <div className="sum flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">
            <span>입력 합계 <b id="env-total" className="tabular-nums">{won(total)}</b></span>
            <label className="flex items-center gap-2">계수 총액 <input type="number" id="env-counted" step={1000} className="w-44!" placeholder="세어 본 총액" value={counted} onChange={(e) => setCounted(e.target.value)} /></label>
            <span id="env-diff" className={diff == null ? "text-muted-foreground" : diff === 0 ? "badge badge-auto" : "badge badge-held"}>
              {diff == null ? "" : diff === 0 ? <><Check className="size-3.5" aria-hidden="true" />일치</> : "차이 " + (diff >= 0 ? "+" : "") + diff.toLocaleString("ko-KR") + "원"}
            </span>
          </div>
          <div className="cta-row cta-fixed">
            <Button id="env-save" className="btn-grad h-11 rounded-xl px-5 text-[15px] font-bold" onClick={() => { void save() }}><Check aria-hidden="true" />저장</Button>
          </div>
        </div>
      </div>
      <div id="env-result">{result && <LineTable rows={result.rows} week={result.week} />}</div>
      <Foot />
    </>
  )
}
```

- [ ] **Step 2: `views/index.tsx` 에 `envelope: Envelope`**

- [ ] **Step 3: 개발 서버 확인 — 샘플 12줄 → 계수 일치 배지 → 저장 → 결과 표**

```bash
cd ~/Projects/03-personal/matjangbu/ui && npm run typecheck && cd .. && NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:900}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://127.0.0.1:5173/#/envelope',{waitUntil:'networkidle'});await p.locator('#env-sample').click();await p.waitForFunction(()=>document.querySelectorAll('#env-rows .env-row').length>=12);
console.log('합계',await p.locator('#env-total').textContent(),'차이',await p.locator('#env-diff').textContent());await p.screenshot({path:'/tmp/claude-1000/envelope.png'});
await p.locator('#env-save').click();await p.locator('#env-result tr.row').first().waitFor({timeout:60000});console.log('결과 행',await p.locator('#env-result tr.row').count());
await b.close();if(errs.length){console.log(errs);process.exit(1)}})()"
```

Expected: 12줄, 「일치」 배지(샘플의 계수 총액이 합계와 같다), 저장 뒤 결과 표 12행, 콘솔 에러 0.

- [ ] **Step 4: 커밋**

```bash
cd ~/Projects/03-personal/matjangbu && git add ui/src/views && git commit -m "ui: 봉투 입력 화면 — 검산 배지·하단 고정 저장

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: 화면 — 기록(탭 · 스켈레톤 · CSV 내보내기) · 명부·별칭

**Files:**
- Create: `ui/src/views/Records.tsx`, `ui/src/views/Roster.tsx`
- Modify: `ui/src/views/index.tsx`(전부 실제 화면으로, `Pending` 제거)

**Interfaces:**
- Consumes: `useApp`(`s.tab`, `dispatch tab`, `s.readonly`, `s.recorded`, `s.loadSeq`, `client.api`), `localWeekCsv`·`localYearCsv`, `CsvTable`, `Skeleton`, `EmptyState`, `Foot`, `REASON`, `won`, `fmtTs`.
- DOM: `[data-tab]`(`aria-pressed`), `#rec-dl`, `#rec-body`, `#ros-file`.

- [ ] **Step 1: `views/Records.tsx`**

```tsx
import { Download } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CsvTable } from "@/components/CsvTable"
import { EmptyState } from "@/components/EmptyState"
import { Foot } from "@/components/Foot"
import { localWeekCsv, localYearCsv } from "@/fallback"
import { won } from "@/format"
import { REASON } from "@/labels"
import { useApp, useData } from "@/store"
import type { RecTab } from "@/types"

export default function Records() {
  const d = useData(); const { s, dispatch, client } = useApp()
  const year = (d.week || "2026").slice(0, 4)
  const held = d.lines.filter((l) => l.state === "held")
  const cache = useRef(new Map<string, string>())
  const key = s.tab + "|" + d.week + "|" + s.loadSeq
  const [text, setText] = useState<string | null>(() => cache.current.get(key) ?? null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setErr(null)
    if (cache.current.has(key)) { setText(cache.current.get(key)!); return }
    setText(null)
    const tab = s.tab
    const p: Promise<string> = s.readonly
      ? Promise.resolve(tab === "week" ? localWeekCsv(d) : localYearCsv(s.recorded!, d.roster, tab))
      : client.api<string>("/export/" + tab + ".csv?" + (tab === "week" ? "week=" + encodeURIComponent(d.week) : "year=" + year))
    p.then((t) => { cache.current.set(key, t); if (alive) setText(t) }).catch((e) => { if (alive) setErr(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const download = () => {
    const t = text; if (!t) return
    const name = ({ week: "주간명단-" + d.week, person: "개인별누적-" + year, year: "연말합산-" + year } as Record<RecTab, string>)[s.tab] + ".csv"
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob(["﻿" + t.replace(/^﻿/, "")], { type: "text/csv;charset=utf-8" })); a.download = name; a.click()
  }
  const TABS: [RecTab, string][] = [["week", "주간 명단 · " + d.week], ["person", "개인별 누적 · " + year], ["year", "연말 합산 · " + year]]
  return (
    <>
      <div className="tabs mb-4 flex flex-wrap items-center gap-1.5">
        {TABS.map(([k, t]) => (
          <button key={k} type="button" data-tab={k} aria-pressed={s.tab === k} onClick={() => dispatch({ type: "tab", tab: k })}
                  className={"press rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors " + (s.tab === k ? "border-ink bg-ink text-white" : "border-line bg-white text-muted-foreground hover:text-ink")}>{t}</button>
        ))}
        <span className="ml-auto" />
        <Button id="rec-dl" variant="outline" size="sm" className="h-9 rounded-xl px-3" disabled={s.readonly || !text} onClick={download}><Download aria-hidden="true" />CSV 내보내기</Button>
        <a className="press rounded-xl px-3 py-2 text-[13px] font-semibold text-muted-foreground hover:bg-slate-100 hover:text-ink" href="#/queue">확인 목록으로</a>
      </div>
      <div className="card" id="rec-body">
        {err ? <EmptyState text={err} /> : text == null ? <div className="grid gap-2.5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 rounded-lg" />)}</div> : <CsvTable text={text} />}
      </div>
      {s.tab === "week" && held.length > 0 && (
        <div className="card mt-4"><h3 className="mb-1 text-[17px]">이 주에 아직 확인하지 않은 줄 {held.length}</h3>
          <p className="mb-3 text-[13px] text-muted-foreground">확정되기 전에는 합계에 들어가지 않습니다.</p>
          <ul className="feed">{held.map((l) => <li key={l.id}><span className="when">{won(l.amount)}</span><span className="f">{l.raw}</span><span className="text-muted-foreground">{REASON[l.reason || ""] || ""}</span></li>)}</ul>
        </div>
      )}
      <p className="foot mt-5 text-[13px] leading-relaxed text-muted-foreground">{s.tab === "week" ? "주간 명단은 사람 손이 닿은 줄부터 보여줍니다. 통장 순서대로 두면 완전일치가 앞을 다 차지해 이 도구가 한 일이 안 보이기 때문입니다." : "연말 합산은 기부금영수증 기초자료입니다. 미확정 줄은 따로 합계를 냅니다. 암호화 백업은 준비 중입니다."}</p>
      <Foot />
    </>
  )
}
```

- [ ] **Step 2: `views/Roster.tsx`**

```tsx
import { EmptyState } from "@/components/EmptyState"
import { Foot } from "@/components/Foot"
import { SectionHead } from "@/components/SectionHead"
import { fmtTs } from "@/format"
import { useApp, useData } from "@/store"

export default function Roster() {
  const d = useData(); const { s, client, load, toast, fail } = useApp()
  const q = s.query
  const people = d.roster.filter((p) => !q || p.name.includes(q))
  const aliases = Object.entries(d.aliases || {}).filter(([k, v]) => !q || k.includes(q) || (d.roster.find((p) => p.id === v.person_id)?.name ?? "").includes(q))
  const name = (id: string) => d.roster.find((p) => p.id === id)?.name ?? id
  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const buf = await f.arrayBuffer(); let t = new TextDecoder("utf-8").decode(buf)
      if (t.includes("�")) t = new TextDecoder("euc-kr").decode(buf)
      const out = await client.post<{ count: number }>("/roster", { csv_text: t })
      toast("명부 " + out.count + "명으로 교체", "ok"); await load(d.week)
    } catch (e) { fail(e) }
  }
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <SectionHead title={"명부 " + d.roster.length + "명"} sub="세대 칸에 세대주 이름을 적어 두면 가족 명의 이체가 규칙으로 후보에 걸립니다." />
          {d.mode === "local" && !s.readonly && <label className="mb-3 grid gap-1 text-[13px] font-semibold text-muted-foreground">명부 CSV 교체 (id,이름,구역,세대,옛이름)<input type="file" id="ros-file" accept=".csv,text/csv" onChange={(e) => { void onFile(e.target.files?.[0]) }} /></label>}
          <div className="table-wrap max-h-[60vh] overflow-auto">
            <table className="data"><thead><tr><th>id</th><th>이름</th><th>구역</th><th>세대</th><th>옛이름</th></tr></thead>
              <tbody>{people.map((p) => <tr key={p.id}><td className="mono">{p.id}</td><td>{p.name}</td><td>{p.group}</td><td>{p.household}</td><td>{(p.old_names || []).join(", ")}</td></tr>)}</tbody></table>
          </div>
        </div>
        <div className="card">
          <SectionHead title={"별칭 사전 " + aliases.length + "건"} sub="확인 큐에서 고른 답이 여기 쌓입니다. 다음 주 같은 원문은 1단에서 끝납니다." />
          {aliases.length ? (
            <div className="table-wrap"><table className="data"><thead><tr><th>원문</th><th>사람</th><th>배운 날</th></tr></thead>
              <tbody>{aliases.map(([k, v]) => <tr key={k}><td className="file">{k}</td><td>{name(v.person_id)} <span className="mono text-[13px] text-muted-foreground">{v.person_id}</span></td><td className="text-muted-foreground">{fmtTs(v.learned)}</td></tr>)}</tbody></table></div>
          ) : <EmptyState text="아직 별칭이 없습니다" />}
        </div>
      </div>
      <Foot />
    </>
  )
}
```

- [ ] **Step 3: `views/index.tsx` 최종형**

```tsx
import type { ComponentType } from "react"
import type { Route } from "@/labels"
import Dashboard from "./Dashboard"
import Device from "./Device"
import Envelope from "./Envelope"
import Import from "./Import"
import Queue from "./Queue"
import Records from "./Records"
import Roster from "./Roster"

export const VIEWS: Record<Route, ComponentType> = { dashboard: Dashboard, import: Import, envelope: Envelope, queue: Queue, records: Records, roster: Roster, device: Device }
```

- [ ] **Step 4: 개발 서버 확인 — 기록 탭 3개·내보내기 활성, 명부 검색**

```bash
cd ~/Projects/03-personal/matjangbu/ui && npm run typecheck && npm test && cd .. && NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:900}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://127.0.0.1:5173/#/records',{waitUntil:'networkidle'});await p.locator('#rec-body table').waitFor({timeout:30000});await p.screenshot({path:'/tmp/claude-1000/records.png'});
for(const t of ['person','year']){await p.locator('[data-tab='+t+']').click();await p.locator('#rec-body table').waitFor({timeout:30000});console.log(t,'행',await p.locator('#rec-body tbody tr').count());}
await p.goto('http://127.0.0.1:5173/#/roster',{waitUntil:'networkidle'});await p.locator('#q').fill('김');await p.waitForTimeout(300);console.log('명부 김',await p.locator('main table').first().locator('tbody tr').count());
await p.screenshot({path:'/tmp/claude-1000/roster.png'});await b.close();if(errs.length){console.log(errs);process.exit(1)}})()"
```

Expected: 기록 표가 스켈레톤 뒤에 뜨고 person·year 행 수 ≥ 1(year 마지막 두 행 합계·미확정), 명부 검색 「김」이 표를 거른다, 콘솔 에러 0.

- [ ] **Step 5: 커밋**

```bash
cd ~/Projects/03-personal/matjangbu && git add ui/src/views && git commit -m "ui: 기록(탭·스켈레톤·CSV 내보내기)·명부·별칭 화면 — 화면 7 완성

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: 빌드 통합 — `site/try/` 산출물 · 검증 도구 한 줄 · 전체 검증 · 스크린샷

**Files:**
- Modify: `tools/site_shots.cjs`(우리상사 카드 블록), `tools/verify_funnel.cjs`(2 단계)
- Create(빌드): `site/try/index.html`(덮어씀), `site/try/assets/index-*.js`, `site/try/assets/index-*.css`
- Modify: `docs/shots/*.png`(다시 찍음)

**Interfaces:**
- Consumes: 과제 1 의 `npm run build`, 과제 6~12 의 화면, 과제 2·3 의 폰트·토큰.
- Produces: 살아 있는 체험 인스턴스(8108)와 정적 서버(8123)에서 검증 도구 3종이 0 으로 끝나는 `site/`.

- [ ] **Step 1: 검증 도구 두 개에 「다른 방법 ▾」 펼치기 한 줄**

`tools/site_shots.cjs` 의
```js
if (await card.count()) { await card.locator('select[data-any]').selectOption({ label: '김태섭 (4구역)' }); await card.locator('[data-pick-any]').click(); await page.waitForTimeout(800); }
```
을
```js
if (await card.count()) { await card.locator('[data-more]').click(); await card.locator('select[data-any]').selectOption({ label: '김태섭 (4구역)' }); await card.locator('[data-pick-any]').click(); await page.waitForTimeout(800); }
```
로. `tools/verify_funnel.cjs` 의 2) 블록 `await card.locator('select[data-any]').selectOption({ label: '김태섭 (4구역)' });` 앞 줄에 `await card.locator('[data-more]').click();` 를 넣는다. 두 파일 머리 주석에 「확인 카드는 「다른 방법 ▾」(`[data-more]`)를 펼쳐야 직접 고르기 select 가 보인다(2026-09-21 React 화면)」 한 줄.

- [ ] **Step 2: 빌드 → `site/try/`**

```bash
cd ~/Projects/03-personal/matjangbu/ui && pkill -f 'vite --port 5173' ; npm test && npm run build 2>&1 | tail -6
ls -la ../site/try ../site/try/assets && grep -oE '(matjangbu-api|pretendard|assets/index-[^"]+)' ../site/try/index.html
```

Expected: `site/try/` 에 `index.html`(meta `matjangbu-api` · 폰트 link 유지) · `recorded.json` · `sample-envelopes.json` · `assets/index-*.js`(gzip 100~130KB) · `assets/index-*.css`. 옛 단일 파일은 사라진다.

- [ ] **Step 3: 살아 있는 인스턴스(8108)에서 흐름·스크린샷 — `site_shots.cjs`**

```bash
cd ~/Projects/03-personal/matjangbu && curl -s 127.0.0.1:8108/api/health | head -c 80; echo
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/site_shots.cjs docs/shots --base http://127.0.0.1:8108
```

Expected: `찍음: 01-landing.png 02-queue.png 03-import-done.png 04-records.png 05-dashboard.png 06-drawer.png 07-envelope.png …`, 콘솔 에러 없음(exit 0). 7장을 Read 로 열어 본다 — 02 확인 큐(후보만, 접힌 「다른 방법」), 03 불러오기 끝(진행 막대 100% · 「끝 · 자동 n / 확인 m」), 06 줄 상세 패널이 본문을 밀어낸 모습.

- [ ] **Step 4: 인스턴스 붙은 상태·폴백 양쪽 검증 + pytest**

```bash
cd ~/Projects/03-personal/matjangbu
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.cjs --base http://127.0.0.1:8108
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.cjs --base http://127.0.0.1:8123 --expect-banner --allow https://omarchy.tailb0e058.ts.net
.venv/bin/python -m pytest -q 2>&1 | tail -2
```

Expected: 8108 — 네 경로 `✓`, `/try/: 배너 없음`, `표 n행`, 외부 요청 0, 콘솔 에러 0, 정적 4xx 0. 8123 — `배너 보임`(정적 서버 origin 은 인스턴스 CORS 허용 목록에 없어 폴백으로 떨어진다), 나머지 `✓`. pytest `44 passed`.

폴백 화면도 눈으로: `NODE_PATH=… node tools/dev_shot.cjs 'http://127.0.0.1:8123/try/#/queue' /tmp/claude-1000/fallback.png` → 앰버 배너, 버튼 전부 비활성.

- [ ] **Step 5: 모바일 폭 스크린샷 3장(문서용)**

```bash
cd ~/Projects/03-personal/matjangbu && for r in queue import dashboard; do NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/dev_shot.cjs "http://127.0.0.1:8108/try/#/$r" docs/shots/m-$r.png --mobile; done
```

Expected: 3장, 콘솔 에러 0. 하단 탭바·하단 고정 CTA 가 보인다.

- [ ] **Step 6: 커밋(산출물 포함)**

```bash
cd ~/Projects/03-personal/matjangbu && git add tools/site_shots.cjs tools/verify_funnel.cjs site/try docs/shots && git status --short | head -20
git commit -m "site(try): React 앱 빌드 산출물 — 토스풍 재설계 · 검증 도구 [data-more] 펼치기 · 스크린샷 갱신

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: 문서 · 배포 · 공개 검증 · 핸드오프

**Files:**
- Modify: `README.md`(폴더 표·실행 방법·라이선스), `docs/ops.md`(사이트 재배포), `docs/design-notes.md`(결정 2줄), `docs/superpowers/specs/2026-09-20-matjangbu-design.md`(§6 디자인 시스템 문단 끝 링크 1줄), `docs/handoffs/HANDOFF.md`
- Modify: `~/.claude/projects/-home-stoporder/memory/matjangbu-public-deploy.md`

- [ ] **Step 1: README**

폴더 표에 행 추가(`web/` 다음):
```
| `ui/` | `/try` 앱 화면의 React + shadcn 소스 — `npm run build` 가 `site/try/` 로 낸다. 실행 시점 의존은 없다(빌드 도구) |
```
실행 방법 절 끝에:
```bash
# 화면(/try)을 고쳤으면 다시 빌드해 site/try/ 에 넣는다 — 파이썬은 site/ 를 그대로 서빙한다
cd ui && npm ci && npm run build      # Node 26 · 산출물은 커밋한다
```
「pip 패키지 0」 문장 뒤에 「(npm 은 `/try` 화면의 빌드 도구이고 실행 시점 의존이 아니다)」. 도구·라이선스 절(있으면)에 「Pretendard(OFL-1.1, `site/assets/fonts/pretendard/LICENSE.txt`) · React·radix-ui·lucide-react·Tailwind(MIT)」 한 줄.

- [ ] **Step 2: `docs/ops.md` 「사이트 재배포」 절 맨 앞에**

```bash
cd ui && npm ci && npm run build && cd ..        # /try 화면을 고쳤을 때만. 산출물(site/try/)을 커밋한다
```
그리고 「검증」 절에 「확인 카드의 직접 고르기 select 는 `[data-more]` 를 눌러야 보인다 — 도구는 이미 그렇게 한다」 한 줄.

- [ ] **Step 3: `docs/design-notes.md` 표 끝에 두 행, 옛 스펙 §6 에 링크**

```
| /try 만 React + shadcn | 상호작용이 있는 장만 React, 랜딩·설치·기기는 순수 HTML 에 같은 토큰 | 랜딩은 인스턴스가 죽어도 살아야 한다. 정본 `docs/superpowers/specs/2026-09-21-ui-toss-redesign-design.md` |
| 그라데이션 3종 = 세 경로 | 청록→초록 규칙·자동(주색), 파랑→보라 모델, 초록→노랑 사람. 5종류 요소에만, 면에는 금지 | 색이 곧 설명이 된다. 「확인 필요」는 앰버 단색 |
```
`2026-09-20-matjangbu-design.md` §6 「디자인 시스템.」 문단 끝에 「**2026-09-21 재설계**: `docs/superpowers/specs/2026-09-21-ui-toss-redesign-design.md`(React + shadcn, 그라데이션 3종, Pretendard).」

- [ ] **Step 4: 커밋 → 푸시 → Pages subtree push → 공개 검증**

```bash
cd ~/Projects/03-personal/matjangbu && git add README.md docs/ops.md docs/design-notes.md docs/superpowers/specs/2026-09-20-matjangbu-design.md
git commit -m "docs: ui/ 빌드 절차·디자인 결정·재배포 절차

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push && git subtree push --prefix site origin gh-pages
sleep 120
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.cjs --base https://stoporder.github.io/matjangbu --allow https://omarchy.tailb0e058.ts.net --resolve omarchy.tailb0e058.ts.net=103.84.155.217
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_funnel.cjs --base https://stoporder.github.io/matjangbu --api https://omarchy.tailb0e058.ts.net/ --resolve omarchy.tailb0e058.ts.net=103.84.155.217 --out docs/shots/08-public-funnel-w11.png
```

Expected: 둘 다 exit 0(`배너 없음`, `확정 뒤 카드가 큐에서 사라짐`, `W11 결과 표에 별칭으로 맞춘 우리상사 줄 출현`). 반영이 늦으면 60초 더 기다렸다 다시 돈다(`gh api repos/StopOrder/matjangbu/pages/builds/latest --jq .status` 가 `built`).

- [ ] **Step 5: 핸드오프·메모리·보드**

`docs/handoffs/HANDOFF.md` 를 session-handoff 규격으로 갱신 — 제목 「UI 재설계 배포 완료(2026-09-21)」, 현재 상태에 이 계획의 과제 14개 체크, 남은 것은 여전히 「사용자 결정 대기」(문구·정확도 수치 검수, 계획 1~7, 폰 정리) + 새로 「다크 모드 없음(범위 밖)」. 핵심 명령에 `cd ui && npm run build` 와 `npm run dev`(5173 프록시). 메모리 `matjangbu-public-deploy.md` 에 「2026-09-21 /try React+shadcn 재설계 배포, ui/ 빌드 필수, 검증 도구는 [data-more] 클릭」 한 줄. 마지막 스크린샷 `08-public-funnel-w11.png` 커밋·푸시. 보드: `python3 ~/.claude/skills/turtle-board/scripts/turtle.py done "맞장부 웹 UI 토스풍 재설계"`.

```bash
cd ~/Projects/03-personal/matjangbu && git add docs/handoffs/HANDOFF.md docs/shots/08-public-funnel-w11.png && git commit -m "docs: 핸드오프 — UI 재설계 배포 완료, 다음은 사용자 결정 대기

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git push
```

---

## 자체 점검(작성 뒤)

- 스펙 커버리지: §0 성공 기준 1~6 → 과제 13(1·2·4·6)·13 Step 4(3)·2·3(5). §1 토큰 → 과제 1 Step 7·3. §2.1 골격·모바일 → 과제 1 CSS·6·7(LinePanel). §2.2 화면 7 → 과제 8~12. §2.3 상태·API·폴백 → 과제 5·6. §2.4 컴포넌트 → 과제 7. §3 TDS 패턴 10 → 1(한 화면 한 일: 과제 7 CandidatePicker) 2(큰 숫자: 과제 7 GradientNumber·6 h1) 3·4(피드백·되돌리기: 과제 6 store·10) 5(빈 상태: 과제 6 EmptyState·10) 6(스켈레톤: 과제 6 App·12) 7(진행 막대: 과제 7·9) 8(하단 CTA·바텀시트·탭바: 과제 1 CSS·6·7·9·11) 9(문구) 10(접근성: aria-label 전부). §4 빌드 → 과제 1·13. §5 정적 3장 → 과제 2·3. §6 검증 계약·테스트 → 과제 4·5·6·7 Vitest, 13 도구. §7 오류 → 과제 5 ApiError·6 loadError·9 실패 표시. §8 문서 → 과제 14.
- 이름 일치: `useApp/useData/useLineActions/emptyRow`(store) · `resolveState/candidateBases/BASE/metaApis`(load) · `parseHash/useHashRoute`(route) · `useMobile`(hooks) · `counts/matches/howOf`(lines) · `GradientNumber({n,tone})`·`StatTile({label,n,tone,sub})`·`ProgressBar({id,text,err,ratio})`·`LineTable({rows,week,live})`·`CandidatePicker({line,onAct})`·`SectionHead({title,sub,right})` — 정의와 사용처가 같다. `pick/addNew/hold/exclude` 는 과제 7 Step 5 이후 `Promise<boolean>`, 과제 10 이 그 값을 쓴다.
- 자리표시자 없음. `Pending` 은 과제 6 의 임시 화면이며 과제 12 Step 3 에서 사라진다.
