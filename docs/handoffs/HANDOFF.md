# HANDOFF — 시안 승인 완료, 이제 site/·ui/ 에 실제 반영 (updated 2026-09-21 저녁)

## 목표

맞장부의 **사용자 눈에 보이는 전부**를 다시 만든다. 시작은 2026-09-21 낮 사용자의 「나비랑 너무 똑같다」 판정이었다 — 사이트 지도(네 장)·랜딩 섹션 순서와 소제목 5개·앱 골격(사이드바+대시보드+카드 큐+우측 드로어)이 나비(`~/workspace/02-sandbox/nabi-core`)와 같았고, 모두의창업 신청서에 나비가 팀의 전작으로 적혀 있어 심사위원이 둘을 나란히 볼 수 있다.

**완료 판정**: 새 화면이 로컬 8108 에서 돌고, 사용자가 그 화면을 직접 보고 승인하고, 검증 도구·pytest 가 통과한 뒤 공개 배포까지 끝난 상태.

**지금 위치**: 시안 2장을 사용자가 보고 **승인했다.** 구현 계획도 써서 커밋했다. **구현은 아직 한 줄도 시작하지 않았다.** 다음 세션의 일은 계획 Task 1 부터 실행하는 것이다.

## 현재 상태

- [x] **결정 기록 확정** — 결정 16개 + 토스(TDS) 개정 7개 + PyTorch 배치 개정 4개. 정본 `docs/superpowers/specs/2026-09-21-ledger-redesign-decisions.md`. 커밋됨.
- [x] **토스 TDS 조사 완료** — `~/Projects/00-research/2026-09/w4/2026-09-21-toss-tdk/FINDINGS.md`(각주 46개). 색·타이포·간격·반경·그림자 토큰과 컴포넌트 규격 실측치가 전부 여기 있다. **구현할 때 이 파일을 편다.**
- [x] **주간 장 시안** `docs/mockups/2026-09-21-weekly-ledger.html` — TDS 리스트형. 데스크톱 1400×900 · 모바일 390px 가로 넘침 0 · 콘솔 에러 0 확인.
- [x] **랜딩 시안** `docs/mockups/2026-09-21-landing.html` — pytorch.org 배치 + TDS 색. JS 0 · 모바일 390px 가로 넘침 0 · 콘솔 에러 0 확인.
- [x] **사용자 검수 통과** — 사용자가 랜딩 화면을 캡처해 보이며 「맘에 들어 전부 다 반영해줘. 일단」이라고 했다(2026-09-21). 문장이 「일단」에서 끊겼지만 승인과 반영 지시는 분명했다. **시안을 다시 고치라는 지시는 없었다.**
- [x] **구현 계획 작성·커밋** — `docs/superpowers/plans/2026-09-21-pytorch-tds-implementation.md`, 과제 6개. 커밋 `56ceb78`.
- [~] **계획 Task 1 착수 직전에 멈춤** — 착수 전 사전 조사에서 계획과 저장소 현실이 어긋나는 것을 하나 찾았다(아래 「계획 수정이 필요한 곳」). 파일은 하나도 고치지 않았다. 작업 트리는 깨끗하다.
- [ ] Task 1~6 전부 미착수. `site/` 와 `ui/` 는 어제 새벽 토스풍 React 그대로다.
- [ ] 공개 사이트(gh-pages)는 **어제 새벽 배포본**이 그대로 떠 있다. 이번 재설계는 아직 배포하지 않았다.

## 계획 (전문)

**계획 정본은 `docs/superpowers/plans/2026-09-21-pytorch-tds-implementation.md` 다. 그 파일을 읽고 그대로 실행하면 된다.** 과제 6개 요약:

1. **Task 1 — 정적 사이트 세 장**: `site/index.html` 을 랜딩 시안으로 전면 교체, `site/install/index.html` 신설, `site/download/`·`site/phone/` 폐지, `tests/test_web.py:124` 페이지 목록 한 줄, `NOTICE` 정리.
2. **Task 2 — 앱 껍데기**: TDS 토큰, 어두운 GNB + 장 4개(`Shell.tsx`), 옛 컴포넌트 18개·옛 뷰 7개 파일째 삭제, `labels.ts` 의 `ROUTES` 를 `["week","year","roster","settings"]` 로, `route.ts` 기본값 `week`.
3. **Task 3 — 주간 장**: 리스트 + 맨 위 고정 봉투 입력 줄 + 그 자리 펼침 + 바닥 합계.
4. **Task 4 — 연말·명부·설정**: 옛 대시보드·확인 큐·불러오기·기기·기록 화면을 이 셋으로 흡수.
5. **Task 5 — 검증 도구 3개**를 새 DOM 계약(`data-mj="..."`)으로 재작성.
6. **Task 6 — 통합**: pytest 44개 + 타입 + Vitest 20개 + 빌드 + 8108 검증 → 사용자에게 보이고 승인 요청.

계획 문서 안에 **DOM 계약 표**가 있다(`data-mj="gnb"|"tab"|"ledger"|"row"|"panel"|"cand"|"entry"|"total"|"hero"|"matrix"|"opt"|"out"`). 검증 도구가 클래스 이름에 묶이지 않도록 일부러 `data-*` 로 고정했다. 화면과 도구가 같이 지켜야 한다.

### 계획 수정이 필요한 곳 (착수 전 반드시 반영)

**계획 Task 1 Step 1~2 가 저장소의 기존 규칙과 충돌한다.** 계획은 「시안의 `<style>` 을 떼어 `site/assets/app.css` 로 옮기고 두 정적 페이지가 공유한다」고 썼지만, 현재 `site/index.html:13-15` 에 명시된 규칙은 그 반대다:

> 랜딩은 「파일 하나」 규칙 — 체험 인스턴스가 죽어도 이 링크는 살아야 하므로 CSS를 `<link>` 대신 인라인으로 품는다.

이 규칙은 `docs/superpowers/specs/2026-09-21-ui-toss-redesign-design.md:131` 에서 **「인스턴스에 의존하지 않는다」**로 더 정확히 정의돼 있다 — 같은 출처(Pages)의 폰트 파일 링크는 허용한다.

**그래서 Task 1 을 이렇게 바꿔서 실행한다:**
- `site/index.html` 과 `site/install/index.html` **둘 다 CSS 를 인라인으로 품는다.** 약 10KB 중복이지만 규칙을 지킨다. 폰트만 `<link rel="stylesheet" href="assets/fonts/pretendard/pretendardvariable-dynamic-subset.css">`(install 은 `../assets/...`).
- **`site/assets/app.css` 는 아예 지운다.** 확인해 보니 이제 아무도 쓰지 않는다 — 참조처는 `NOTICE:8` 과 `README.md:86` 두 문서뿐이고, React 앱(`site/try/`)은 자기 CSS 를 따로 갖는다.
- 따라서 **`README.md:86` 도 같이 고쳐야 한다.** 그 줄은 나비에서 가져온 것 목록에 「디자인 시스템(`site/assets/app.css`)」과 「앱 화면 골격」을 적고 있는데, 둘 다 이번에 버려진다. `NOTICE:8` 의 `site/assets/app.css 디자인 시스템, site/try/index.html 화면 골격.` 줄과 짝을 맞춰 지운다. **파이썬 유래 항목(`web/server.py`·`web/demo.py`·`engine/model.py`·`engine/store.py`)은 그대로 남긴다** — 그 코드는 계속 쓴다.
- `site/assets/dashboard.jpg` 도 지운다. 확인 결과 문서 외에는 참조처가 없다.
- **`site/index.html` 의 `og:` 메타 태그 3개(`og:title`·`og:description`·`og:type`)는 살려서 새 문구로 옮긴다.** 시안에는 없다.

이 네 가지는 계획 파일에 아직 반영돼 있지 않다. 착수할 때 계획 파일도 같이 고쳐 두면 좋다.

## 결정사항과 이유

- **「토스 TDK」는 토스 공식 명칭이 아니다** — 개발자센터 304개 문서·`github.com/toss`·npm 전수 조사에 없다. 정식은 **TDS(Toss Design System)**이고, 'TDK'는 앱인토스 미니앱 툴킷을 외부 개발자들이 「Toss Design/Development Kit」으로 줄여 부른 속칭이다. 사용자에게 알렸고 사용자도 그 전제로 진행했다. 데스크톱 웹 규격의 정본은 `toss.im`·`tossbank.com`·`tosspayments.com` 프로덕션 CSS 의 `--pc-*` 토큰이고, 색 토큰만 `@toss/tds-colors` 가 공개 npm 이다.
- **표를 버리고 리스트로 간 것은 조사를 거스른 사용자 선택이다.** 조사는 고밀도 장부에서 리스트가 깨지는 이유 넷을 댔다 — ①행·열 교차 대조 불가 ②FHD 한 화면 24행→10~12행 ③대량 입력 효율 저하 ④키보드 연속 조작 무력화. 토스 자신도 데스크톱 웹에는 별도 표 규격(thead 40px·`#f2f4f6`·양 끝 radius 12px)을 둔다. **이 근거를 전부 보인 뒤에도 사용자가 리스트를 택했다.** 다시 표로 돌리자는 말이 나오면 조사 6절이 근거다. **먼저 되돌리자고 제안하지 말 것** — 이미 한 번 제안했고 사용자가 답했다.
- **조사가 권한 「좌 65% 표 + 우 35% 상세 패널」은 채택하지 않는다.** 그것이 정확히 나비의 우측 드로어 골격이다. 조사 요청문에 나비 제약을 적지 않아 조사가 모르고 답한 부분이다.
- **주 색은 토스 파랑 `#3182f6`** — 「전면 토스」를 사용자가 두 번 골랐으니 파랑 없는 토스는 토스가 아니라고 판단해 Claude 가 정했다. 초록·보라·올리브는 세 경로(규칙·모델·사람) 의미색으로만 남겼다. **되돌리기 쉬운 지점이니 사용자가 초록을 원하면 바꾼다.**
- **배치는 PyTorch, 색은 토스** — 사용자가 둘을 나눠 지시했다. `pytorch.org` 는 agy 리서치에 넘기지 않고 직접 찍어 봤다(한 페이지를 펴면 끝나는 일이라 판단했고, 그 사실을 사용자에게 밝혔다).
- **랜딩 「고르기 판」은 설치 명령이 아니라 잰 값을 낸다.** PyTorch 는 같은 자리에서 `pip3 install …` 을 내지만 맞장부는 설치 명령이 아직 확정되지 않았다. 없는 명령을 지어내지 않고, 기기·운영체제·맞추는 방법·모델·그래픽카드를 고르면 **그 조합에서 실제로 잰 시간**을 내보낸다. 재지 않은 조합은 흐린 「측정 안 함」으로 고를 수 없게 뒀다. 설치 명령이 정해지면 그 자리에 그대로 들어간다.
- **문구를 해요체로 바꿨다** — 토스 UX 라이팅. 다만 **숫자와 출처 문장은 한 글자도 바꾸지 않았다.** 이 사용자층(교회 재정 담당 장로)에 해요체가 맞는지는 아직 사용자가 명시적으로 답하지 않았다.
- **왜 시안 먼저였나** — 2026-09-21 새벽에는 글 스펙만으로 바로 구현·배포했고, 사용자가 결과를 보기도 전에 전면 재작성이 결정됐다. 눈으로 볼 수 있는 것을 먼저 만드는 방식으로 바꿨고, 이번엔 시안 단계에서 승인이 났다.
- **왜 배포를 미루나** — 지금 공개본도 동작은 멀쩡하다. 시안·8108 두 번 눈으로 본 뒤 배포하는 것이 재작성을 또 되풀이하지 않는 장치다. 사용자 결정.

## 시도했지만 안 된 것

- **ollama 결 판(표 + 왼쪽 고정 목차)은 통째로 폐기됐다.** git `0b81aaa` 에 있다. 되살려 쓰지 말 것. 그때 배운 것 셋은 지금도 유효하다 — 막대에 색을 많이 쓰면 화면이 탁해진다 / 시안에 토스트를 그려 넣으면 스크린샷에서 실제 동작으로 오해된다 / 원문 칸은 폭을 고정해야 흔들리지 않는다.
- **토스 결 중앙 정렬 랜딩(1차)** 도 폐기됐다. git `573a37e` 에 있다. PyTorch 배치 지시로 대체됐다.
- **글 스펙만으로 바로 구현**(2026-09-21 새벽, 토스풍) → 사용자가 결과를 처음 본 순간 전면 재작성이 결정됐다. 그 작업물은 `docs/handoffs/HANDOFF-1.md` 와 `docs/superpowers/specs/2026-09-21-ui-toss-redesign-design.md` 에 있다. **되살려 쓰지 말 것** — 골격이 나비 것이다.
- 리스트 첫 판에서 서브라인에 원문을 늘 적었더니 봉투 줄에서 이름이 두 번 나왔다 → 원문이 맞춘 이름과 같으면 뺀다.
- 입력 줄 안내에 「쌓입니다」를 쓰니 헤드리스 렌더에서 앞 공백이 사라져 붙어 보였다 → 「아래 줄로 들어갑니다」로 바꿨다. 같은 증상이 또 보이면 문구를 바꾸는 쪽이 빠르다.
- 리스트 첫 판은 모바일 390px 에서 288px 넘쳤다(입력 줄 고정폭 + GNB 상태 칩) → 1100px 미만 미디어 쿼리를 새로 쓰고 상태 칩을 숨겨 0 으로 만들었다.
- 랜딩 고르기 판에서 「그래픽카드」 행에 선택지를 하나만 두니 파란 띠가 화면을 가로질러 시끄러웠다 → 「없음(CPU로 돕니다)」 + 흐린 「있음(측정 안 함)」 둘로 만들었다.
- 신청서 경로를 이전 핸드오프가 두 번 틀리게 적었다. 실측한 정답은 **`~/Projects/02-hackathon/modoo-startup-2026/docs/application-draft.md`**(제출본 PDF 는 같은 폴더의 `모두의창업_신청서_I009_정지명_20260916.pdf`)이다. **이 저장소 안에는 없다.**

## 핵심 파일·명령

- **계획 정본**: `docs/superpowers/plans/2026-09-21-pytorch-tds-implementation.md` ← **다음 세션이 제일 먼저 읽을 파일**
- **결정 정본**: `docs/superpowers/specs/2026-09-21-ledger-redesign-decisions.md`(결정 16개 + 개정 2절)
- **시안**: `docs/mockups/2026-09-21-landing.html` · `docs/mockups/2026-09-21-weekly-ledger.html` · `docs/mockups/assets/ledger.png`(랜딩 히어로에 쓰는 주간 장 스크린샷)
- **TDS 규격 정본**: `~/Projects/00-research/2026-09/w4/2026-09-21-toss-tdk/FINDINGS.md` — 2절 토큰 실측표, 3절 컴포넌트 규격, 6절 「쓸 것·버릴 것」, 7절 모르는 것
- **제품 설계 정본(엔진·API — 여전히 유효)**: `docs/superpowers/specs/2026-09-20-matjangbu-design.md` · `docs/design-notes.md`
- **나비 원본(닮음 판정용)**: `~/workspace/02-sandbox/nabi-core` — `site/index.html`·`site/try/index.html`·`site/assets/app.css`
- **유지되는 순수 모듈**: `ui/src/{api,load,fallback,route,lines,types,format,hooks,store}.*` · `ui/src/lib/utils.ts` · `ui/src/components/ui/{button,input,collapsible}.tsx` · `ui/test/` 8개
- **API 15개(불변)**: `web/server.py` 의 `_r_health`·`_r_state`·`_r_import`·`_r_rematch`·`_r_confirm`·`_r_hold`·`_r_exclude`·`_r_undo`·`_r_envelope`·`_r_export`·`_r_roster`·`_r_reset`·`_r_job`·`_r_events`

```bash
# 시안 열기
xdg-open docs/mockups/2026-09-21-landing.html

# 화면 찍기 (콘솔 에러가 있으면 exit 1). --mobile 은 390×844
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules \
  node tools/dev_shot.cjs "file://$PWD/docs/mockups/2026-09-21-landing.html" /tmp/x.png

# 정적 검증 서버 / 실제 인스턴스
python3 -m http.server 8123 -d site
systemctl --user status matjangbu-llama matjangbu-web
curl -s 127.0.0.1:8108/api/health        # 8108 은 작업 트리의 site/ 를 그대로 서빙한다

# 검사
.venv/bin/python -m pytest -q             # 44개, 모델 서버 불필요
cd ui && npm run typecheck && npx vitest run && npm run build   # 빌드 산출물 → site/try/

# 모바일 가로 넘침 재기
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();
const p=await b.newPage({viewport:{width:390,height:844}});
await p.goto('file://'+process.cwd()+'/docs/mockups/2026-09-21-landing.html',{waitUntil:'networkidle'});
console.log(await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth));
await b.close()})()"
```

**실측 숫자 출처**: `bench/results/*.md` · 현재 `site/index.html` 의 `#measured` 절. 화면에 쓴 값 — 샘플 4주 86줄 중 규칙 77·모델 9, 줄당 노트북 14.7초(12.7~21.3)·A31 111.5초(97.3~135.6), 1순위 정답 노트북 13/25·A31 12/25, 2013년 이전 PC 측정 예정.

## 다음 액션

<!-- NEXT-ACTIONS -->
- [ ] `docs/superpowers/plans/2026-09-21-pytorch-tds-implementation.md` 를 읽고, 그 안의 Task 1 을 위 「계획 수정이 필요한 곳」 네 가지(CSS 인라인 유지 · `site/assets/app.css` 삭제 · `README.md:86` 수정 · `og:` 메타 보존)로 고친 뒤 Task 1 을 실행한다
- [ ] Task 2~4 — `ui/` 화면 계층 재작성. 순수 모듈과 `web/`·`engine/` 은 건드리지 않는다
- [ ] Task 5 — `tools/verify_site.cjs`·`verify_funnel.cjs`·`site_shots.cjs` 를 `data-mj` 계약으로 재작성
- [ ] Task 6 — pytest 44 + 타입 + Vitest 20 + 빌드 + 8108 검증을 모두 통과시킨 뒤, 사용자에게 8108 을 직접 열어 보라고 요청한다. **승인 전에 `git subtree push` 금지**
- [x] 시안 2장 사용자 승인 (2026-09-21)
- [x] 구현 계획 작성·커밋 (2026-09-21, `56ceb78`)
<!-- /NEXT-ACTIONS -->

## 추천 스킬·도구

- 구현은 계획이 이미 있으므로 `superpowers:executing-plans`(같은 세션에서 인라인 실행) 로 간다. `subagent-driven-development` 는 이 사용자의 전역 설정이 서브에이전트 사용을 막고 있으므로 사용자가 먼저 요청할 때만 쓴다.
- 화면 확인은 `tools/dev_shot.cjs`(개발·시안) → 구현 뒤 `tools/site_shots.cjs`(8108).
- 밖(웹)을 봐야 하는 일이 생기면 `agy-research`. 단, 「한 페이지를 펴면 끝나는」 화면 참조는 직접 찍고 그 사실을 밝힌다(이 세션이 pytorch.org 로 그렇게 했다).
- 사용자가 부르면 `/web-design`. 부르지 않으면 쓰지 않는다.

## 주의사항

- **공개 배포 금지** — 사용자가 로컬 8108 에서 새 화면을 직접 보고 승인하기 전에는 `git push && git subtree push --prefix site origin gh-pages` 를 하지 않는다. 사용자 결정(2026-09-21).
- **파이썬은 한 줄도 바꾸지 않는다.** `engine/`·`web/` 불변. 예외는 `tests/test_web.py:124` 의 페이지 목록 한 줄뿐.
- **`ui/` 순수 모듈과 Vitest 20개는 유지.** 바꾸는 것은 `components/`·`views/`·`index.css`·`labels.ts`·`route.ts` 뿐이다.
- **외부 자원 0 · 삼중 폴백(같은 origin → meta 인스턴스 → `recorded.json`) · `X-Matjangbu-Session` · `window.matjangbuApiBase` · 해시 라우팅** 전부 유지.
- **재지 않은 숫자·가격·고객 수를 화면에 적지 않는다.** 계산으로 얻은 값은 계산값이라고 밝힌다. 설치 명령처럼 아직 없는 것을 그럴듯하게 지어내지 않는다.
- **실제 단체 자료를 저장소·인스턴스에 넣지 않는다.** 체험은 가공 샘플만.
- `/try` 를 고치면 반드시 `cd ui && npm run build`(→ `site/try/`) 하고 산출물을 커밋한다. `ui/node_modules/` 는 커밋하지 않는다.
- 커밋 메시지 끝: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
