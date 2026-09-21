# HANDOFF — 웹 UI 재설계(토스 TDS · 그라데이션 · `/try` React) 배포 완료 · 다음은 사용자 결정 대기 (updated 2026-09-21 03:45)

## 목표
「맞장부(matjangbu)」 사이트 네 장의 룩을 한 체계로 바꾸고, `/try` 체험 앱을 React + shadcn 으로 다시 짓는 일. 사용자 결정(2026-09-21): 색은 첨부 이미지(그라데이션 알약 3개)의 실측값, 주색 청록→초록, 폰트 Pretendard, 아이콘 Lucide, 토스 TDS 원칙·패턴 참고, **C안(React 전면 재작성)을 `/try` 한 장에만**, 데스크톱 우선·모바일은 무너지지 않게, 목업 없이 진행.
**2026-09-21 03:41 에 공개 배포까지 끝났다.** 정본 스펙 `docs/superpowers/specs/2026-09-21-ui-toss-redesign-design.md`, 계획 `docs/superpowers/plans/2026-09-21-ui-toss-redesign.md`(과제 14개, 코드 전문 포함 — 실제 구현은 이 계획의 코드 블록을 awk 로 추출해 그대로 썼다).
이 문서는 다음 세션이 **무엇을 이어서 할지 사용자에게 물어야 하는 상태**임을 알리기 위한 것이다. 스스로 다음 기능을 시작하지 않는다.

## 현재 상태
- [x] `ui/` — Vite 8 · React 19 · TypeScript 6 · Tailwind 4 · shadcn 4(radix-nova) · lucide-react · Vitest 5(테스트 20개: 폴백·CSV·주차·API SSE 파서·라우트·삼중 폴백·줄 도우미). `npm run build` → `site/try/`(index.html + `assets/index-*.js|css`, gzip JS 113KB · CSS 10KB). 산출물 커밋. `npm run dev` = 127.0.0.1:5173(`/api`·recorded.json·sample-envelopes.json·`/assets/fonts` 를 8108 로 프록시).
- [x] 화면 7 전부 옮김 — 대시보드(타일 큰 숫자 그라데이션 글자, 모델 카드 보라 선) · 불러오기(SSE 그라데이션 진행 막대 + 실시간 표, 모바일 하단 고정 「맞추기」) · 봉투 입력(계수 검산 「일치」/「차이」 배지, 하단 고정 「저장」) · 확인 큐(**한 화면 한 일**: 후보 버튼만 보이고 「다른 방법 ▾」 아래 직접 고르기·새 이름 등록, 확정하면 카드 200ms 접힘, 토스트에 「되돌리기」) · 기록(알약 탭·스켈레톤·CSV 내보내기) · 명부·별칭(검색이 두 표 다 거름) · 기기. 줄 상세는 데스크톱 = 본문을 밀어내는 우측 패널 420px, 모바일(<1100px) = 바텀시트. 사이드바 → 모바일 하단 탭바 7칸.
- [x] 삼중 폴백·`X-Matjangbu-Session`·`window.matjangbuApiBase`·해시 라우팅 그대로. 파이썬은 한 줄도 안 바꿈. pytest 44 통과(`/try/` 정적 HTML 에 `<h1` 이 있어야 해서 `<noscript><h1>` 을 둠).
- [x] 정적 3장(`/`·`/download/`·`/phone/`): `site/assets/app.css`·랜딩 인라인 CSS 토큰 교체(주색 `--brand #17A896`·`--brand-ink #0F7D71`·`--brand-bg`, 그라데이션 토큰 4개, 모서리 16/12px, Pretendard 스택; `--green*` 은 별칭으로 남김) · 로고 마크 그라데이션 · 주 버튼 그라데이션 면 · 히어로 pill 점 · h1 「맞추고」 그라데이션 글자 · 파이프라인 AI 칸 보라 테두리·사람 칸 점.
- [x] Pretendard Variable 1.3.9 자체 호스팅 `site/assets/fonts/pretendard/`(OFL, CSS 1 + woff2 92 + LICENSE, 3.1MB, 다이내믹 서브셋). 네 장 `<link>`. 외부 요청 0 유지.
- [x] 검증 전부 0: `verify_site.cjs`(8108 배너 없음 · 8123 `--expect-banner --allow …` 폴백 · 공개 `--resolve`) · `site_shots.cjs`(8108, 7장, 콘솔 에러 0) · `verify_funnel.cjs`(공개, 11개 ✓, `docs/shots/08-public-funnel-w11.png`) · pytest 44. 검증 도구 두 개에 `[data-more]` 클릭 한 줄 추가.
- [x] 배포: main 푸시 + `git subtree push --prefix site origin gh-pages`(03:41, Pages `built`). 공개 `/try/` 가 새 빌드(`assets/index-C_vx4uQ1.js`)를 서빙하고 Funnel 인스턴스에 붙는다.
- [x] 문서: README(`ui/` 행·빌드 명령·npm 은 빌드 도구·라이선스 한 줄) · `docs/ops.md`(재배포 앞에 빌드, `[data-more]` 메모) · `docs/design-notes.md`(결정 2행) · 옛 스펙 §6 링크 · 스크린샷 `docs/shots/`(01~08, landing/download/phone, 모바일 m-queue·m-import·m-dashboard).
- [x] 메모리 `~/.claude/projects/-home-stoporder/memory/matjangbu-public-deploy.md` 갱신.
- [ ] **사용자 검수 미완**: 새 룩을 사용자가 아직 못 봤다(세션 중 화면은 스크린샷으로만 확인). 사이트 문구·낮은 정확도 수치(후보 1위 약 50%·relation 약 40%)를 그대로 둘지도 여전히 미결.
- [ ] 폰 정리: A31 의 `~/matjangbu-bench/`·모델 2개(약 2GB) 그대로. 사용자 결정.

## 계획 (전문)
새 작업은 없다. 다음 세션은 사용자에게 아래 중 무엇을 할지 묻는다.
1. 새 UI 검수 피드백 반영(색 강도·문구·간격 등 — `ui/src/index.css` 토큰과 각 view) 2. 사이트 문구·정확도 수치 검수 3. 암호화 백업 4. 설치 zip 5. 실제 은행 CSV 양식 6. A31 발열·장시간 실측 7. 구형 PC 실측 8. 정확도 개선(프롬프트·후보 제시) 9. 다크 모드(이번 재설계 범위 밖으로 둠).

## 결정사항과 이유
- **C안(React)을 `/try` 에만, 정적 3장은 토큰만** — 상호작용이 있는 장이 하나뿐이고 랜딩은 인스턴스가 죽어도 살아야 한다. 「파일 하나」 규칙은 「인스턴스에 의존하지 않는다」로 정확히 했고 같은 출처 폰트 파일은 `dashboard.jpg` 처럼 허용.
- **그라데이션 3종 = 규칙·모델·사람 세 경로**(청록→초록 주색 / 파랑→보라 / 초록→노랑). 5종류 요소(주 버튼 면·활성 메뉴 표시·로고·큰 숫자 글자·진행 막대/경로 점)에만, 면에는 금지. 「확인 필요」는 앰버 단색(초록→노랑과 헷갈림 방지). 흰 글자 면은 눌린 stop(`--grad-brand-deep`)으로 대비 보완.
- **토스트 자체 구현·react-router 없음·상태 라이브러리 없음** — 검증 도구 DOM 계약(`#toasts .toast.err`) 유지, 해시 라우트 7개에 라이브러리는 과함.
- **네이티브 `<select>` 유지**(주차·샘플 주차·직접 고르기) — Playwright `selectOption` 계약. shadcn 은 button·badge·card·input·sheet·collapsible·skeleton 만.
- **빌드 산출물 커밋** — 파이썬 서버·Pages·subtree push 절차를 안 바꾼다. Vite 파일명 해시는 서버 `_NO_CACHE`(.js/.css) 덕에 어느 쪽이든 안전.
- 데스크톱 패널은 본문을 **밀어내는** 동작 유지(패널 열어 둔 채 다른 줄로 옮겨 가는 확인 작업 흐름). Tailwind `lg` 경계를 1100px 로 맞춤(`--breakpoint-lg`).
- 공개 배포까지 이 세션에서 진행 — 사용자가 「이대로 승인·진행」했고 되돌리기는 revert + subtree push 로 가능.

## 시도했지만 안 된 것
- `<svg hidden>` 스프라이트 안에 `<linearGradient>` 를 두면 Chromium 이 그리지 않아 로고가 빈 자리로 나왔다 → 스프라이트를 `width="0" height="0" style="position:absolute"` 로.
- Vite 8 개발 서버는 기본이 `[::1]` 이라 `127.0.0.1:5173` 이 안 닿았다 → `server.host: "127.0.0.1"`.
- 스캐폴드의 `@types/node@20` 과 vitest 5 가 ERESOLVE 충돌 → `@types/node@^26`. `tsc --noEmit` 은 솔루션 tsconfig(`files: []`)에서 아무것도 검사하지 않는다 → `typecheck` 는 `tsc -b`.
- Tailwind 의 `sticky` 유틸과 이름이 겹쳐 하단 고정 띠 클래스를 `cta-fixed` 로. shadcn 의 `muted`(면)/`muted-foreground`(글자) 의미를 지키느라 회색 글자는 전부 `text-muted-foreground`.
- 모바일에서 토스트가 하단 고정 CTA 의 설명 문구와 겹쳤다 → 고정 띠에서는 설명을 숨기고 토스트를 `tabbar + 84px` 위로.
- pytest 가 `/try/` 정적 HTML 에 `<h1` 을 요구해 실패 → `<noscript><h1>`(JS 없는 브라우저에도 의미가 맞다).
- `pkill -f 'vite --port 5173'` 은 자기 셸을 죽인다(exit 144) → pid 로 kill, 서버는 `setsid` 로 띄움.

## 핵심 파일·명령
- `ui/` — `src/{store,load,api,fallback,route,lines,labels,format,types}.ts(x)` · `src/components/`(Layout·Sidebar·Topbar·TabBar·Banner·Toasts·LinePanel·CandidatePicker·LineTable·CsvTable·StateBadge·HowBadge·GradientNumber·StatTile·ProgressBar·SectionHead·Foot·EmptyState·`ui/` shadcn) · `src/views/`(7) · `src/index.css`(토큰·골격·컴포넌트 클래스) · `test/`.
- 빌드·테스트: `cd ui && npm ci && npm run build`(→ `site/try/`) · `npm test` · `npm run typecheck`(= `tsc -b`) · `npm run dev`(5173).
- 검증(`NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules`): `node tools/verify_site.cjs --base http://127.0.0.1:8108` · `… --base http://127.0.0.1:8123 --expect-banner --allow https://omarchy.tailb0e058.ts.net` · 공개 `… --base https://stoporder.github.io/matjangbu --allow https://omarchy.tailb0e058.ts.net --resolve omarchy.tailb0e058.ts.net=103.84.155.217` · `node tools/verify_funnel.cjs --base … --api https://omarchy.tailb0e058.ts.net/ --resolve … --out docs/shots/08-public-funnel-w11.png` · `node tools/site_shots.cjs docs/shots --base http://127.0.0.1:8108` · `node tools/dev_shot.cjs <url> <png> [--mobile]`.
- 인스턴스: `systemctl --user status matjangbu-llama matjangbu-web` · `curl -s 127.0.0.1:8108/api/health`. **8108 은 작업 트리의 `site/` 를 그대로 서빙한다** — `site/try/` 를 빌드하면 Funnel 의 `/try/` 도 즉시 바뀐다(공개 Pages 는 subtree push 전까지 그대로).
- 재배포: `git push && git subtree push --prefix site origin gh-pages`(1~2분). 정적 검증 서버 8123 은 `python3 -m http.server 8123 -d site`.
- 메모리: `~/.claude/projects/-home-stoporder/memory/matjangbu-public-deploy.md`.

## 다음 액션
<!-- NEXT-ACTIONS -->
- [ ] 사용자에게 새 룩을 보게 하고(공개 `https://stoporder.github.io/matjangbu/` · `/try/`) 검수 피드백을 받기 — 고칠 곳은 `ui/src/index.css` 토큰·해당 view, 고친 뒤 빌드→검증→커밋→subtree push
- [ ] 사용자에게 묻기: 문구·정확도 수치를 그대로 둘지, 「계획」 1~9 중 무엇을 이어갈지, 폰의 벤치 폴더·모델을 지울지. 스스로 시작하지 않는다
<!-- /NEXT-ACTIONS -->

## 추천 스킬·도구
- 이어갈 기능이 정해지면 brainstorming → writing-plans(이번처럼 계획에 코드 전문을 넣고 awk 로 추출하는 방식이 잘 맞았다). 화면 확인은 `tools/dev_shot.cjs`(개발 서버) → `site_shots.cjs`(빌드 뒤).

## 주의사항
- `/try` 를 고치면 **반드시 `npm run build`** 하고 산출물을 커밋한다. `ui/node_modules/` 는 커밋하지 않는다.
- 실제 단체 자료를 저장소·인스턴스에 넣지 않는다. 사이트에 재지 않은 숫자·가격·고객 수를 적지 않는다.
- 그라데이션은 5종류 요소에만. 면(카드·배경·표 머리)에 쓰지 않는다. 「확인 필요」는 앰버 단색.
- 검증·흐름 스크립트를 폴백 검증(인스턴스 내림)과 동시에 돌리지 않는다. `pkill -f`·`pgrep -f` 로 vite·llama·bench 를 판정하지 않는다.
- 커밋 메시지 끝: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
