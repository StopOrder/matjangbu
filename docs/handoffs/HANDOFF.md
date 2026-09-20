# HANDOFF — 맞장부 공개 배포 마무리: HyperCLOVAX 반영 확인·최종 보고 (updated 2026-09-20 23:35)

## 목표
「맞장부(matjangbu)」— 모두의창업 I-009 헌금 이름 맞춤·기록 도우미를 나비(nabi-core) 방식으로 공개 배포하는 일의 **마무리**.
배포 본체(공개 저장소·GitHub Pages 사이트·노트북 체험 인스턴스·노트북 실측)는 2026-09-20 22시에, **Funnel 연결과 A31 Qwen 실측 반영은 23시 반에 끝났다.**
남은 것은 둘: ① 갤럭시 A31 HyperCLOVAX 실측이 분리 실행 스크립트로 자동 반영되는 것을 확인하고 수치를 눈으로 검수하기,
② 최종 보고와 메모리 갱신. 완료 판정: 통합 로그에 `ALL-DONE`, 공개 `/phone/` 실측표에 A31 행 2개(Qwen·HyperCLOVAX), 작업 트리 깨끗·main 이 origin 과 일치.

## 현재 상태
- [x] 저장소 https://github.com/StopOrder/matjangbu (Apache-2.0, main + gh-pages) · 사이트 https://stoporder.github.io/matjangbu/
- [x] 엔진(파이썬 표준 라이브러리만)·웹(나비 뼈대 이식)·앱 화면(삼중 폴백)·샘플·기록(`site/try/recorded.json`) · pytest 44개 통과(23:33 재확인)
- [x] 체험 인스턴스: systemd 사용자 서비스 `matjangbu-llama`(8107) · `matjangbu-web`(web --demo 8108, `--cors-origin https://stoporder.github.io`), 둘 다 active, Linger=yes. 폴백 검증 때 web 을 10초 내렸다 올렸다(23:33:48~58).
- [x] 노트북 실측 30건 반영(커밋 2dc9a57).
- [x] **A31 Qwen 8스레드 실측 30건 반영**(통합 스크립트가 23:12 자동 처리, 커밋 bc44631 · gh-pages a4e6e68): 줄당 111.5초(97.3~135.6) · pp 8.9 · tg 4.5 tok/s · 후보 1위 12/25 · 3 안 13/25 · relation 11/30 · JSON 30/30. `bench/results/SM-A315N-qwen-8t-20260920-2215.md` summary 와 공개 `/phone/` 표 일치 확인. 유형별: family 1/5 · company 4/5 · typo 1/5 · renamed 4/5 · kind_typo 2/5 · unknown 0/5(relation 은 5/5).
- [~] **A31 HyperCLOVAX 8스레드 — 폰에서 진행 중**(23:32 현재 9/30, 줄당 약 110초 → 00:10 전후 종료). 통합 스크립트(`/tmp/claude-1000/a31-integrate.sh`, pid 378116)가 30초마다 폰 로그를 보며 대기 중. 「hyperclova 끝 감지」→「hyperclova 반영 완료」→`ALL-DONE`.
- [x] **Funnel 연결 완료**(23:10, 사용자가 `sudo tailscale set --operator=stoporder` 실행 뒤): `https://omarchy.tailb0e058.ts.net/` → 127.0.0.1:8108. 공개 DNS(구글 DoH)는 103.84.155.217 · 103.84.155.153. `/api/health` 가 `"mode": "demo"`. 첫 요청만 32초(인증서 발급), 이후 로컬 14ms · 공개 인그레스 경유 0.5~3초.
- [x] `site/try/index.html` meta 에 Funnel 주소 반영 → 커밋 30540a5 · gh-pages 781a982(23:17 반영 확인).
- [x] 공개 검증: `tools/verify_site.cjs … --allow … --resolve omarchy.tailb0e058.ts.net=103.84.155.217` 배너 없음 0 · 인스턴스 내리고 `--expect-banner` 0 · 끝까지 흐름 `tools/verify_funnel.cjs`(확인 큐 우리상사→김태섭 확정 → W11 불러오기에서 「별칭사전」 자동) 0, 검증과 동시에 돌려도 0. 최종 화면 `docs/shots/08-public-funnel-w11.png`.
- [ ] 위 Funnel·검증 변경(tools 2개·docs/ops.md·스크린샷·이 문서)을 커밋·push 하는 중 — 이 문서를 쓰는 세션이 바로 이어서 한다. site/ 는 안 바뀌어 subtree push 불필요.
- [ ] 사용자 검수: 사이트 문구·실측 숫자(모델 정확도가 낮다는 것: 노트북 후보 1위 13/25·relation 12/30, A31 Qwen 12/25·11/30)를 사용자가 봤는지 아직 모른다.

## 계획 (전문)
설계 정본 `docs/superpowers/specs/2026-09-20-matjangbu-design.md`, 계획 정본 `docs/superpowers/plans/2026-09-20-matjangbu.md`(Task 1~16). 남은 것은 아래가 전부다.

1. **HyperCLOVAX 자동 반영 확인**
   - `cat /tmp/claude-1000/a31-integrate.log` — 「hyperclova 끝 감지」→「hyperclova 반영 완료」→`ALL-DONE`. Monitor 를 `tail -n0 -F … | grep --line-buffered '끝 감지|반영 완료|ALL-DONE|실패|rror|✗'` 로 걸어 두면 폴링이 필요 없다(30분마다 재장전).
   - 폰 진행: `ssh -o BatchMode=yes -p 8022 u0_a280@100.74.136.5 'tail -1 ~/matjangbu-bench/a31-hc.log'`. 「끝:」이 완료. **`pgrep -f`로 판정하지 말 것**(ssh 명령 문자열이 매칭된다). 스크립트 생사는 `pgrep -f a31-integrate.sh` — 단, 그 명령을 Bash 도구로 치면 자기 래퍼 명령줄도 한 줄 잡힌다. 실제 스크립트는 pid 378116 하나.
   - **`ALL-DONE` 전에는 작업 트리를 더럽히지 않는다**(스크립트가 `git add -A`). 커밋은 「qwen 반영 완료」 뒤 ~ 「hyperclova 끝 감지」 전의 빈 구간(스크립트가 sleep 30 폴링 중)에만 안전하다 — 이번 세션이 그 구간에 Funnel 변경을 커밋했다(사용자 지시). 00:05 이후엔 손대지 않는다.
   - 스크립트가 죽었거나 로그에 「scp 실패」가 있으면 수동: `scp -P 8022 'u0_a280@100.74.136.5:matjangbu-bench/bench/results/SM-A315N-*' bench/results/` → `.venv/bin/python tools/bench_table.py` → `node tools/verify_site.cjs --base http://127.0.0.1:8123 --expect-banner`(정적 서버 8123 은 pid 371329 로 떠 있음; 죽었으면 `python3 -m http.server 8123 --bind 127.0.0.1 --directory site`) → pytest → 커밋·push·`git subtree push --prefix site origin gh-pages`. 참고: 이제 meta 에 Funnel 주소가 있어 로컬 8123 검증은 CORS 차단으로 배너가 뜨고(`--expect-banner` 통과) 콘솔 오류 한 줄(127.0.0.1 출처 CORS)이 ✗ 로 찍힌다 — 스크립트는 이 결과로 커밋을 막지 않으므로 무시한다.
   - 반영 뒤 검수: `bench/results/SM-A315N-hyperclova-8t-*.md` summary(JSON 성공률·후보 1위·relation·줄당 초)를 읽고 `curl -s https://stoporder.github.io/matjangbu/phone/ | grep -o '갤럭시 A31[^<]*'` 로 공개 표와 대조. HyperCLOVAX 행에는 `tools/bench_table.py`가 「자체 약관 · 비교값」 배지를 붙인다. 기본 모델로 쓰지 않는다. JSON 실패가 많으면(truncation) `engine/model.py`의 `N_PREDICT`(320) 상향 재실측은 사용자 결정(1시간짜리).

2. **최종 보고와 메모리** — 사용자에게: 공개 주소, Funnel 주소, A31 두 모델 수치, 남은 것(암호화 백업·설치 zip·실제 은행 양식·A31 발열·구형 PC 실측). **Tailscale 이 켜진 자기 기기에서 공개 `/try/`를 열면 브라우저가 「로컬 네트워크 접근」 허용을 묻는다는 것을 알린다**(아래 결정사항). 메모리 `~/.claude/projects/-home-stoporder/memory/matjangbu-public-deploy.md`의 Funnel·A31 줄을 결과로 갱신한다.

## 결정사항과 이유
- **배포 = 나비 방식**(공개 저장소 + Pages + 노트북 인스턴스 + 폐폰 실측). 교회 설치가 아니다. 사용자 결정 2026-09-20. A31 은 실측 기기이지 서버가 아니다.
- 이름 「맞장부」(잠정명), slug `matjangbu`, 저장소 StopOrder. 로컬 `~/Projects/03-personal/matjangbu`, main 에서 직접 작업.
- 기본 모델 Qwen2.5-1.5B-Instruct Q4_K_M(Apache-2.0). HyperCLOVAX-SEED 는 자체 약관이라 비교값만. 사이트에 가격 없음.
- 모델 결과는 항상 확인 큐(자동 확정 없음), 동명이인은 모델을 거치지 않는다. 모델이 낸 헌금 종류는 원문에 그 글자가 있을 때만 받는다.
- 체험 모드는 샘플 CSV 를 실제 규칙으로 돌리고 모델만 `recorded.json`에서 재생. 세션은 방문자마다 따로(`X-Matjangbu-Session`), 체험 인스턴스는 ThreadingHTTPServer 라 동시 방문자 가능(검증 2개 동시 실행으로 확인).
- 포트: 인스턴스 8107/8108, 벤치 8117, 정적 검증 8123.
- 사이트 실측표는 `bench/results/*.md`의 summary JSON 에서만 채운다(`tools/bench_table.py`).
- **Funnel 주소를 meta 에 넣되 인스턴스 CORS 는 Pages 출처만 허용** — 로컬 정적 서버(8123)에서는 일부러 폴백으로 떨어진다.
- **검증 도구의 `--resolve`**: 테일넷 안 머신에서는 Funnel 호스트가 MagicDNS 로 100.92.94.119 로 풀리고, Chromium 은 공개 사이트→「local 주소 공간」 fetch 를 막는다(헤드리스는 거부, 일반 브라우저는 허용 프롬프트). 공개 IP 로 고정해 외부 방문자와 같은 경로로 검증한다. `docs/ops.md`에 기록.
- **`--expect-banner`일 때 허용 출처의 CORS 차단 콘솔 오류는 정상으로 본다** — 인스턴스가 죽으면 Funnel 이 CORS 헤더 없는 502 를 주고 그 실패가 폴백의 계기다.
- **끝까지 흐름 검증(`tools/verify_funnel.cjs`)은 조건 대기만 쓴다** — 공개 인그레스 경유 요청은 0.5~3초라 고정 대기는 실패한다. `#imp-progress`의 「끝」과 토스트는 일시 표시(`load()`→`render()`가 화면을 다시 그림, 토스트 3.2초)라 기준으로 삼지 않는다. `tools/site_shots.cjs`는 아직 「끝」을 기다리므로 로컬 8108 전용.

## 시도했지만 안 된 것
- 공개 검증을 `--allow`만으로 돌리면 이 노트북에서는 「Permission was denied for this request to access the `local` address space」로 실패 → `--resolve` 추가(위).
- 흐름 테스트 첫 두 판 실패(확정 뒤 카드 1.5초 안에 안 사라짐, 「끝」 180초 대기 초과)는 앱 문제가 아니라 테스트의 고정 대기·일시 상태 단언 문제였다. curl 재현(`scratchpad/repro.sh`, 상태→확정→불러오기→SSE)으로 서버·프록시 정상을 먼저 확인하고, 계측 붙인 브라우저 흐름에서 원인을 봤다. 조건 대기로 고친 뒤 검증과 동시에 돌려도 통과.
- Playwright 에서 `<option>`은 `visible`이 될 수 없다 → `waitFor({state: 'attached'})`.
- 불러오기 화면은 열리자마자 현재 주차(W10) 표를 먼저 보여준다 → W11 결과를 기다릴 땐 「2026-W11 맞추기 결과」 머리글과 함께 기다려야 한다.
- 이전 세션의 것: `pkill -f 'llama-server.*8107'` 자기 매칭(exit 144) → `pkill -x`; Termux 에 `/tmp` 없음; llama.cpp 릴리스는 `bNNNNN` 태그 tar.gz; 폰 LAN 주소 scp 불가(Tailscale 주소로); `gh api … pages` JSON 오류는 무시; SSE 는 `EventSource` 대신 `fetch`+ReadableStream; 첫 기록의 모델 지어내기 → 프롬프트 규칙 5개·예시 3개·`N_PREDICT` 320; Playwright `.mjs`는 `NODE_PATH` 무시 → `.cjs`.

## 핵심 파일·명령
- `~/Projects/03-personal/matjangbu/` — `engine/` · `web/` · `site/` · `bench/` · `samples/` · `tests/` · `tools/`(verify_site.cjs · verify_funnel.cjs · site_shots.cjs · bench_table.py) · `docs/ops.md`(운영 절차 정본, Funnel·검증·폴백 절차 포함).
- 테스트: `.venv/bin/python -m pytest -q`(44개). 공개 검증(전부 `NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules` 필요):
  - `node tools/verify_site.cjs --base https://stoporder.github.io/matjangbu --allow https://omarchy.tailb0e058.ts.net --resolve omarchy.tailb0e058.ts.net=103.84.155.217 [--expect-banner]`
  - `node tools/verify_funnel.cjs --base https://stoporder.github.io/matjangbu --api https://omarchy.tailb0e058.ts.net/ --resolve omarchy.tailb0e058.ts.net=103.84.155.217 --out docs/shots/08-public-funnel-w11.png [--trace]`
- 인스턴스: `systemctl --user status matjangbu-llama matjangbu-web` · `curl -s 127.0.0.1:8108/api/health` · Funnel: `tailscale funnel status`, 끄기 `tailscale funnel --https=443 off`.
- 재배포: `git push && git subtree push --prefix site origin gh-pages`(1~2분 뒤 반영).
- 폰: `ssh -o BatchMode=yes -p 8022 u0_a280@100.74.136.5`, 벤치 폴더 `~/matjangbu-bench/`, 로그 `a31-qwen.log`·`a31-hc.log`.
- 통합 스크립트 `/tmp/claude-1000/a31-integrate.sh`, 로그 `/tmp/claude-1000/a31-integrate.log`.
- 메모리: `~/.claude/projects/-home-stoporder/memory/matjangbu-public-deploy.md`.

## 다음 액션
<!-- NEXT-ACTIONS -->
- [ ] HyperCLOVAX 반영 확인(00:10 전후) — 통합 로그에 「hyperclova 반영 완료」·`ALL-DONE`. 스크립트가 죽었으면 계획 1의 수동 절차로. 반영 뒤 `SM-A315N-hyperclova-8t-*.md` summary 와 공개 `/phone/` 표 대조
- [ ] 최종 보고(공개 주소·Funnel 주소·A31 두 모델 수치·로컬 네트워크 접근 프롬프트 안내·남은 것)와 메모리 갱신
- [ ] 사용자 검수 대기: 사이트 문구·낮은 모델 정확도 수치
<!-- /NEXT-ACTIONS -->

## 추천 스킬·도구
- 특별한 스킬 불필요. Monitor 로 통합 로그를 걸어 두면 폴링하지 않아도 된다.
- 화면을 다시 찍을 땐 `node tools/site_shots.cjs docs/shots --base http://127.0.0.1:8108`(로컬 체험 서버), 공개 흐름 최종 화면은 `tools/verify_funnel.cjs --out`.

## 주의사항
- 실제 단체 자료를 저장소·인스턴스에 넣지 않는다. 사이트에 재지 않은 숫자·가격·고객 수를 적지 않는다.
- `ALL-DONE` 전에는 작업 트리를 더럽히지 않는다(통합 스크립트가 `git add -A`). 커밋은 경로 지정 add.
- 폰에서 벤치가 도는 동안 다른 llama 프로세스를 띄우지 않는다(LMK 가 Termux·sshd 까지 죽인다).
- `pkill -f`·`pgrep -f`로 llama-server·bench 를 판정하지 않는다.
- 검증·흐름 스크립트를 폴백 검증(인스턴스 내림)과 동시에 돌리지 않는다.
- 커밋 메시지 끝: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
