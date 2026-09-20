# HANDOFF — 맞장부 공개 배포 마무리: Funnel 연결·A31 실측 반영 확인 (updated 2026-09-20)

## 목표
「맞장부(matjangbu)」— 모두의창업 I-009 헌금 이름 맞춤·기록 도우미를 나비(nabi-core) 방식으로 공개 배포하는 일의 **마무리**.
배포 본체(공개 저장소·GitHub Pages 사이트·노트북 체험 인스턴스·노트북 실측)는 2026-09-20에 끝났다.
남은 것은 셋: ① Tailscale Funnel 로 체험 인스턴스를 외부에 열고 사이트의 `/try`가 거기 붙게 하기(사용자 sudo 한 번 필요),
② 갤럭시 A31 실측(Qwen → HyperCLOVAX)이 분리 실행 스크립트로 자동 반영되는지 확인하고 수치를 눈으로 검수하기,
③ 반영 뒤 공개 사이트 최종 검증. 완료 판정: 공개 `/try/`가 앰버 배너 없이 인스턴스에 붙고, `/phone/` 실측표에 A31 행(2모델)이 있고,
`tools/verify_site.cjs`가 공개 주소에서 0으로 끝난다.

## 현재 상태
- [x] 저장소 https://github.com/StopOrder/matjangbu (Apache-2.0, main + gh-pages) · 사이트 https://stoporder.github.io/matjangbu/ 네 경로 200, 외부 요청 0 검증(2026-09-20 22:20)
- [x] 엔진(파이썬 표준 라이브러리만)·웹(나비 뼈대 이식)·앱 화면(삼중 폴백)·샘플·기록(`site/try/recorded.json`, 노트북 실측) · pytest 44개 통과
- [x] 체험 인스턴스: systemd 사용자 서비스 `matjangbu-llama`(llama-server 8107) · `matjangbu-web`(web --demo 8108, `--cors-origin https://stoporder.github.io`), 둘 다 active, Linger=yes
- [x] 노트북 실측 30건 반영: `bench/results/laptop-i7-10750H-qwen-4t-20260920-2212.md` → 사이트 표(커밋 2dc9a57, gh-pages 반영 확인)
- [~] **A31 실측 Qwen 8스레드 — 폰에서 진행 중**(22:15 시작, 23:05 현재 26/30, 줄당 약 100~110초). 끝나면 폰이 HyperCLOVAX 8스레드를 자동으로 이어 돌린다(약 55분).
- [~] **자동 반영 스크립트 `/tmp/claude-1000/a31-integrate.sh`가 노트북에서 분리 실행 중**(로그 `/tmp/claude-1000/a31-integrate.log`, 23:05 현재 빈 로그 = 아직 대기). 폰 로그에 「끝:」이 보이면 결과 scp → `tools/bench_table.py` → A31 배지 「실측」 → 검증·pytest → **`git add -A` 커밋 → push → `git subtree push --prefix site origin gh-pages`** 를 두 번(qwen, hyperclova) 한 뒤 `ALL-DONE`을 찍는다.
- [ ] Funnel: `tailscale funnel --bg 8108`이 「Access denied: serve config denied」— root 필요. 사용자가 `sudo tailscale set --operator=stoporder`를 한 번 실행해야 한다. 그 전까지 공개 `/try/`는 recorded.json 읽기 전용(앰버 배너)이며 이것은 설계된 폴백이다.
- [ ] Funnel 뒤: `site/try/index.html`의 `<meta name="matjangbu-api" content="">`에 Funnel 주소(끝에 `/`)를 넣고 커밋·push·subtree push, 공개 주소에서 `--allow <주소>`로 검증, 인스턴스를 껐다 켜며 폴백 확인.
- [ ] 사용자 검수: 사이트 문구·실측 숫자(특히 모델 정확도가 낮다는 것: 노트북 후보 1위 13/25·relation 12/30)를 사용자가 봤는지 아직 모른다.

## 계획 (전문)
설계 정본 `docs/superpowers/specs/2026-09-20-matjangbu-design.md`, 계획 정본 `docs/superpowers/plans/2026-09-20-matjangbu.md`(Task 1~16, 1~15 완료·16 일부). 남은 단계는 계획의 Task 14 뒷부분과 Task 16이며, 대화 속에서 정한 세부는 아래가 전부다.

1. **A31 자동 반영 확인(먼저 볼 것)**
   - `cat /tmp/claude-1000/a31-integrate.log` — 「qwen 끝 감지」→「qwen 반영 완료」→(약 55분 뒤)「hyperclova 끝 감지」→「hyperclova 반영 완료」→`ALL-DONE`.
   - 폰 진행: `ssh -o BatchMode=yes -p 8022 u0_a280@100.74.136.5 'tail -2 ~/matjangbu-bench/a31-qwen.log; tail -2 ~/matjangbu-bench/a31-hc.log'`. 마지막 줄 「끝:」이 완료 표시. **`pgrep -f`로 판정하지 말 것**(ssh 명령 문자열 자체가 매칭된다).
   - 스크립트가 살아 있는지: `pgrep -f a31-integrate.sh`(이건 노트북 로컬이라 괜찮다).
   - **스크립트가 `ALL-DONE`을 찍기 전에는 이 repo 에서 커밋·push·subtree push 를 하지 않는다.** 스크립트가 `git add -A`를 쓰므로 작업 중 파일이 섞여 들어가고, push 가 겹치면 non-fast-forward 로 실패한다. 꼭 고칠 것이 있으면 작업 트리에 두지 말고 기다렸다가 한다.
   - 스크립트가 죽었거나(`pgrep` 없음) 로그에 「scp 실패」가 있으면 수동으로: `scp -P 8022 'u0_a280@100.74.136.5:matjangbu-bench/bench/results/SM-A315N-*' bench/results/` → `.venv/bin/python tools/bench_table.py` → `site/index.html`·`site/phone/index.html`의 A31 배지를 `badge-soon 측정 예정`→`badge-ready 실측`으로(sed 두 줄은 스크립트 본문 참고) → `node tools/verify_site.cjs --base http://127.0.0.1:8123 --expect-banner`(정적 서버 `python3 -m http.server 8123 --bind 127.0.0.1 --directory site`가 떠 있어야 한다; 없으면 띄운다) → 커밋·push·`git subtree push --prefix site origin gh-pages`.
   - 반영 뒤 검수: `bench/results/SM-A315N-*.md`의 summary(JSON 성공률·후보 1위·relation·줄당 초)를 읽고 공개 `/phone/`에 그대로 나왔는지 `curl -s https://stoporder.github.io/matjangbu/phone/ | grep -o '갤럭시 A31[^<]*'`. 폰에서 JSON 실패가 많으면(스키마 미지원 서버가 아니라 truncation) `engine/model.py`의 `N_PREDICT`(320)를 올려 다시 재야 하는데, 이건 사용자에게 보고하고 결정을 받는다(재실측은 1시간짜리다).
   - HyperCLOVAX 행에는 `tools/bench_table.py`가 「자체 약관 · 비교값」 배지를 붙인다. 기본 모델로 쓰지 않는다.

2. **Funnel(사용자 sudo 뒤)**
   - 사용자가 `sudo tailscale set --operator=stoporder`를 했다고 하면: `tailscale funnel --bg 8108 && tailscale funnel status`. 주소는 `https://omarchy.<테일넷>.ts.net` 형태(`tailscale status --self`의 호스트명이 omarchy).
   - `curl -sf "<주소>/api/health"`가 `"mode": "demo"`를 주는지 확인.
   - `sed -i 's|<meta name="matjangbu-api" content="[^"]*">|<meta name="matjangbu-api" content="<주소>/">|' site/try/index.html`(끝의 `/` 필수).
   - 커밋·`git push`·`git subtree push --prefix site origin gh-pages` → 60~90초 뒤 `NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.cjs --base https://stoporder.github.io/matjangbu --allow "<주소>"` → 배너 없음으로 0.
   - 폴백 확인: `systemctl --user stop matjangbu-web` → 같은 명령에 `--expect-banner` 붙여 0 → `systemctl --user start matjangbu-web`.
   - 브라우저로 공개 `/try/`를 열어 확인 큐에서 「우리상사」를 「명부에서 직접 고르기 → 김태섭 (4구역)」으로 확정하고 불러오기에서 W11을 맞춰 「별칭사전」 자동이 되는지 본다(스크린샷 1장을 `docs/shots/`에).
   - Funnel 이 테일넷 정책으로 거부되면(「funnel is not enabled」류) meta 를 비운 채 두고 사용자에게 보고한다. 읽기 전용 폴백이 그대로 공개 상태다.

3. **최종 보고** — 사용자에게: 공개 주소, A31 두 모델 수치, Funnel 여부, 남은 것(암호화 백업·설치 zip·실제 은행 양식·A31 발열·구형 PC 실측). 메모리 `~/.claude/projects/-home-stoporder/memory/matjangbu-public-deploy.md`의 「미완: Funnel」·A31 줄을 결과로 갱신한다.

## 결정사항과 이유
- **배포 = 나비 방식**(공개 저장소 + Pages + 노트북 인스턴스 + 폐폰 실측). 교회 설치가 아니다. 사용자 결정 2026-09-20. A31 은 실측 기기이지 서버가 아니다(Wi-Fi 콤보칩 냉납 이력·상시 충전 위험).
- 이름 「맞장부」(잠정명), slug `matjangbu`, 저장소는 사용자 계정 StopOrder(nabi-core 에 푸시 권한 없음). 로컬 `~/Projects/03-personal/matjangbu`, main 에서 직접 작업(보호할 다른 브랜치 없음).
- 기본 모델 Qwen2.5-1.5B-Instruct Q4_K_M(Apache-2.0). HyperCLOVAX-SEED 는 라이선스가 자체 약관이라 비교값만. 사이트에 가격 없음(신청서의 월 5만 원은 인터뷰 1건).
- 모델 결과는 항상 확인 큐(자동 확정 없음), 동명이인은 모델을 거치지 않는다. 모델이 낸 헌금 종류는 원문에 그 글자가 있을 때만 받는다(첫 기록에서 「감사」를 지어냈다).
- 체험 모드는 샘플 CSV 를 실제 규칙으로 돌리고 모델만 `recorded.json`에서 재생 — 방문자가 W10 에서 확정한 별칭이 W11 에서 실제로 작동하게 하기 위함.
- 포트: 인스턴스 8107/8108, 벤치 8117(같은 노트북에서 겹치지 않게).
- 사이트 실측표는 `bench/results/*.md`의 summary JSON 에서만 채운다(`tools/bench_table.py`). 재지 않은 숫자는 「측정 예정」.

## 시도했지만 안 된 것
- `pkill -f 'llama-server.*8107'` → Bash 명령줄 자체가 매칭돼 셸이 죽었다(exit 144). `pkill -x llama-server` 또는 `fuser -k 8107/tcp`를 쓴다.
- Termux 에 `/tmp`가 없다 → `pkg install … > /tmp/x.log`가 통째로 실패했다. 폰에서는 `~/…` 경로로 리다이렉트.
- llama.cpp 릴리스: `latest` 태그(v0.4.1)는 `nightly-tag.txt`뿐. 바이너리는 `bNNNNN` 태그의 `llama-bNNNNN-bin-ubuntu-x64.tar.gz`(zip 아님). 설치본 `~/.local/opt/llama.cpp/llama-b11063/`, 링크 `~/.local/bin/llama-server`.
- 폰 LAN 주소(172.30.1.99)로 scp 는 「Connection closed」. Tailscale 주소(100.74.136.5)로는 된다(986MB, sha256 일치 확인).
- `gh api -X POST repos/…/pages`는 「unexpected end of JSON input」— gh-pages 브랜치를 push 하자 Pages 가 자동으로 켜져 있었다. 무시해도 된다.
- `tailscale funnel --bg 8108` → 「Access denied: serve config denied」. root 가 필요하고 이 세션은 sudo 를 못 친다(사용자 몫).
- 앱 화면의 SSE 를 `EventSource`로 받으려 했으나 세션 헤더를 못 실어 `fetch` + ReadableStream 으로 파싱한다(`site/try/index.html`의 `stream()`).
- 첫 기록(프롬프트에 판정 규칙 없음)에서 모델이 「우리상사」를 가족 명의(relation family)로, `kind`를 「감사」로 지어냈고 「대성정밀」은 160토큰에 잘려 JSON 실패 → 프롬프트에 판정 규칙 5개·예시 3개, `N_PREDICT` 320, kind 원문 검사로 고친 뒤 재기록.
- Playwright 스크립트를 ESM(.mjs)으로 쓰면 `NODE_PATH`를 무시해 `playwright`를 못 찾는다 → `.cjs`(require)로.

## 핵심 파일·명령
- `~/Projects/03-personal/matjangbu/` — 저장소. `engine/`(규칙·모델·파이프라인·기록·CLI) · `web/`(server·demo·record) · `site/`(index·try·download·phone·assets/app.css) · `bench/`(bench.sh·match_all.py·results/) · `samples/`(생성기 `tools/make_samples.py`) · `tests/` · `tools/`(verify_site.cjs·site_shots.cjs·bench_table.py) · `docs/ops.md`(운영 절차 정본).
- 테스트: `.venv/bin/python -m pytest -q`(44개). 사이트 검증: `NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.cjs --base <주소> [--expect-banner] [--allow <origin>]`.
- 인스턴스: `systemctl --user status matjangbu-llama matjangbu-web` · `curl -s 127.0.0.1:8108/api/health` · 유닛 `~/.config/systemd/user/matjangbu-*.service`.
- 정적 검증 서버(이 세션이 setsid 로 띄워 둔 것, 죽어 있을 수 있음): `python3 -m http.server 8123 --bind 127.0.0.1 --directory site`.
- 재배포: `git push && git subtree push --prefix site origin gh-pages`(1~2분 뒤 반영, `curl -sI https://stoporder.github.io/matjangbu/ | head -1`).
- 기록 재생성(프롬프트·규칙을 고쳤을 때만): `.venv/bin/python -m web.record --device "노트북 Intel Core i7-10750H @ 2.60GHz · 4스레드" --model-name "Qwen2.5-1.5B-Instruct Q4_K_M" --threads 4` 뒤 `systemctl --user restart matjangbu-web`.
- 폰: `ssh -o BatchMode=yes -p 8022 u0_a280@100.74.136.5`, 벤치 폴더 `~/matjangbu-bench/`(engine·bench·samples 사본, 로그 `a31-qwen.log`·`a31-hc.log`), 모델 `~/models/qwen1.5b.gguf`·`hyperclova1.5b.gguf`. 절차·함정은 `bench/README.md`.
- 참고 구현 `~/workspace/02-sandbox/nabi-core`(읽기 전용, 남의 저장소). 아이디어 정본 `~/Projects/02-hackathon/modoo-startup-2026/docs/application-draft.md`, 이번 배포 링크는 같은 폴더 `application-notes.md` 끝에 추가됨.
- 메모리: `~/.claude/projects/-home-stoporder/memory/matjangbu-public-deploy.md`.

## 다음 액션
<!-- NEXT-ACTIONS -->
- [~] A31 실측 자동 반영 확인 — `cat /tmp/claude-1000/a31-integrate.log`와 폰 로그 `tail -2 ~/matjangbu-bench/a31-qwen.log`(23:05 현재 26/30). 「qwen 반영 완료」가 찍히면 `bench/results/SM-A315N-qwen-8t-*.md` summary 와 공개 `/phone/` 표를 대조. `ALL-DONE` 전에는 이 repo 에서 커밋·push 금지
- [ ] HyperCLOVAX 반영 확인(qwen 완료 뒤 약 55분) — 같은 로그에 「hyperclova 반영 완료」·`ALL-DONE`. 스크립트가 죽었으면 계획 1의 수동 절차로
- [ ] Funnel — 사용자가 `sudo tailscale set --operator=stoporder`를 했다고 알리면 `tailscale funnel --bg 8108` → 주소를 `site/try/index.html` meta 에 넣고 push·subtree push → 공개 주소 `--allow` 검증·폴백 검증·브라우저 확인 스크린샷
- [ ] 최종 보고와 메모리 갱신(`matjangbu-public-deploy.md`의 Funnel·A31 줄)
<!-- /NEXT-ACTIONS -->

## 추천 스킬·도구
- 특별한 스킬 불필요. Monitor 도구(최대 30분, 재장전)로 `/tmp/claude-1000/a31-integrate.log`를 `tail -F | grep --line-buffered "반영 완료|ALL-DONE|실패|rror"`로 걸어 두면 폴링하지 않아도 된다.
- 화면을 다시 찍을 땐 `node tools/site_shots.cjs docs/shots --base http://127.0.0.1:8108`(체험 서버 필요).

## 주의사항
- 실제 단체 자료를 저장소·인스턴스에 넣지 않는다. 체험은 가공 샘플만. 사이트에 재지 않은 숫자·가격·고객 수를 적지 않는다.
- 통합 스크립트가 `git add -A`로 커밋한다 — `ALL-DONE` 전에는 작업 트리를 더럽히지 않는다. 스크립트가 끝난 뒤의 커밋은 이 세션 규칙대로 경로 지정 add.
- Funnel 의 sudo 는 사용자 몫. 대신 실행하려 하지 말 것(비대화형 sudo 불가, 사용자 확인 필요).
- 폰에서 벤치가 도는 동안 다른 llama 프로세스를 띄우지 않는다(메모리 부족 → LMK 가 Termux·sshd 까지 죽인다).
- `pkill -f`·`pgrep -f`로 llama-server·bench 를 판정하지 않는다(자기 명령줄 매칭).
- 커밋 메시지 끝: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
