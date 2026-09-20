# HANDOFF — 맞장부 공개 배포 완료·다음 단계는 사용자 결정 대기 (updated 2026-09-21 00:15)

## 목표
「맞장부(matjangbu)」— 모두의창업 I-009 헌금 이름 맞춤·기록 도우미를 나비(nabi-core) 방식으로 공개 배포하는 일.
**2026-09-21 00:10 에 전부 끝났다.** 완료 판정(공개 `/try/`가 배너 없이 인스턴스에 붙음 · `/phone/`에 A31 행 2개 · `tools/verify_site.cjs` 공개 주소 0 · 통합 로그 `ALL-DONE` · 작업 트리 깨끗)을 모두 확인했다.
이 문서는 다음 세션이 **무엇을 이어서 할지 사용자에게 물어야 하는 상태**임을 알리기 위한 것이다. 스스로 다음 기능을 시작하지 않는다.

## 현재 상태
- [x] 저장소 https://github.com/StopOrder/matjangbu (Apache-2.0, main + gh-pages) · 사이트 https://stoporder.github.io/matjangbu/ · main 은 origin 과 일치, 작업 트리 깨끗.
- [x] 체험 인스턴스: systemd 사용자 서비스 `matjangbu-llama`(8107) · `matjangbu-web`(web --demo 8108, cors Pages 출처만), Linger=yes. Funnel `https://omarchy.tailb0e058.ts.net/` → 8108(공개 DNS 103.84.155.217/153).
- [x] 공개 `/try/`: meta 에 Funnel 주소(커밋 30540a5). 검증 0(배너 없음), 인스턴스 내리면 배너 0, 끝까지 흐름(`tools/verify_funnel.cjs`) 0. 최종 화면 `docs/shots/08-public-funnel-w11.png`.
- [x] 실측 3종 반영(사이트 `/`·`/phone/` 표 = `bench/results/*.md` summary):
  - 노트북 i7-10750H 4스레드 Qwen — 줄당 14.7초, 후보 1위 13/25, relation 12/30, JSON 30/30(커밋 2dc9a57)
  - A31 Qwen 8스레드 — 줄당 111.5초(97.3~135.6), pp 8.9 · tg 4.5, 1위 12/25, 3 안 13/25, relation 11/30, JSON 30/30(커밋 bc44631, 23:12 자동)
  - A31 HyperCLOVAX-SEED 8스레드(비교값 배지) — 줄당 106.8초(84.6~129.7), pp 8.8 · tg 3.8, 1위 12/25, 3 안 14/25, relation 12/30, JSON 28/30(커밋 29e4cde, 00:09 자동, `ALL-DONE 00:09:41`)
  - HyperCLOVAX JSON 실패 2건(family 김상철, renamed 유정숙)은 320 토큰 상한까지 같은 문구를 반복한 퇴행. 성공한 줄의 최대 생성 토큰은 175 라 `N_PREDICT` 상향으로는 안 풀린다 → 재실측 불필요(보고만).
- [x] 도구·문서: `tools/verify_site.cjs --resolve`(테일넷 안 머신의 로컬 네트워크 접근 차단 우회) · `--expect-banner` 시 허용 출처 CORS 오류 예외 · `tools/verify_funnel.cjs` · `docs/ops.md` Funnel·검증·폴백 절차(커밋 ca162d3).
- [x] 메모리 `~/.claude/projects/-home-stoporder/memory/matjangbu-public-deploy.md` 갱신(Funnel·A31 두 모델·검증 함정).
- [ ] **사용자 검수 미완**: 사이트 문구, 낮은 모델 정확도(세 실측 모두 후보 1위 약 50%·relation 약 40%)를 사용자가 봤는지 모른다. 사용자가 이 수치를 사이트에 그대로 두는 데 동의했는지 확인이 필요하다.
- [ ] 폰 정리: A31 의 `~/matjangbu-bench/`·모델 2개(약 2GB)는 그대로 두었다. 지울지는 사용자 결정.

## 계획 (전문)
새 작업은 없다. 다음 세션은 사용자에게 아래 중 무엇을 할지 묻는다(모두 사용자 결정 사항, 설계 정본 `docs/superpowers/specs/2026-09-20-matjangbu-design.md`의 「남은 것」).
1. 암호화 백업(로컬 자료 보호) 2. 설치 zip(비개발자 설치) 3. 실제 은행 CSV 양식 대응(지금은 가공 샘플 양식) 4. A31 발열·장시간 실측 5. 구형 PC 실측 6. 사이트 문구·수치 검수 반영 7. 정확도 개선(프롬프트·후보 제시 방식) — 실측상 모델 단독 정확도는 낮고 규칙 2단이 실질 성능을 낸다.

## 결정사항과 이유
- **배포 = 나비 방식**(공개 저장소 + Pages + 노트북 인스턴스 + 폐폰 실측). 교회 설치가 아니다. 사용자 결정 2026-09-20. A31 은 실측 기기이지 서버가 아니다.
- 이름 「맞장부」(잠정명), slug `matjangbu`, 저장소 StopOrder. 로컬 `~/Projects/03-personal/matjangbu`, main 에서 직접 작업.
- 기본 모델 Qwen2.5-1.5B-Instruct Q4_K_M(Apache-2.0). HyperCLOVAX-SEED 는 자체 약관이라 비교값만(`tools/bench_table.py`가 배지를 붙인다). 사이트에 가격 없음.
- 모델 결과는 항상 확인 큐(자동 확정 없음), 동명이인은 모델을 거치지 않는다. 모델이 낸 헌금 종류는 원문에 그 글자가 있을 때만 받는다.
- 체험 모드는 샘플 CSV 를 실제 규칙으로 돌리고 모델만 `recorded.json`에서 재생. 세션은 방문자마다 따로(`X-Matjangbu-Session`), ThreadingHTTPServer 라 동시 방문자 가능.
- 포트: 인스턴스 8107/8108, 벤치 8117, 정적 검증 8123(pid 371329, 죽어도 무방).
- 사이트 실측표는 `bench/results/*.md`의 summary JSON 에서만 채운다. 재지 않은 숫자는 「측정 예정」.
- **Funnel 주소를 meta 에 넣되 인스턴스 CORS 는 Pages 출처만 허용** — 로컬 정적 서버(8123)에서는 일부러 폴백으로 떨어진다.
- **검증 도구 `--resolve`**: 테일넷 안 머신은 Funnel 호스트가 MagicDNS 로 100.92.94.119 로 풀리고 Chromium 이 공개 사이트→「local 주소 공간」 fetch 를 막는다. 공개 IP 로 고정해 외부 방문자 경로로 검증. **사용자 자신의 Tailscale 켜진 기기에서 공개 `/try/`를 열면 브라우저가 로컬 네트워크 접근 허용을 한 번 묻는다**(거부하면 읽기 전용 폴백).
- **`--expect-banner`일 때 허용 출처의 CORS 차단 콘솔 오류는 정상** — 인스턴스가 죽으면 Funnel 이 CORS 헤더 없는 502 를 주고 그 실패가 폴백의 계기다.
- **끝까지 흐름 검증은 조건 대기만** — 공개 인그레스 경유 요청은 0.5~3초. `#imp-progress`의 「끝」과 토스트는 일시 표시라 기준 아님. `tools/site_shots.cjs`는 「끝」을 기다리므로 로컬 8108 전용.

## 시도했지만 안 된 것
- 공개 검증을 `--allow`만으로: 「Permission was denied for this request to access the `local` address space」 → `--resolve`.
- 흐름 테스트 첫 두 판 실패는 앱이 아니라 테스트의 고정 대기·일시 상태 단언 탓. curl 재현(상태→확정→불러오기→SSE)으로 서버·프록시 정상을 먼저 확인하고 계측 붙인 브라우저 흐름에서 원인을 봤다. 고친 뒤 검증과 동시에 돌려도 통과.
- Playwright `<option>`은 `visible`이 될 수 없다 → `waitFor({state: 'attached'})`. 불러오기 화면은 열리자마자 현재 주차(W10) 표를 먼저 보여준다 → W11 결과는 머리글과 함께 기다린다.
- `pgrep -f a31-integrate.sh`를 Bash 도구로 치면 자기 래퍼 명령줄도 잡힌다(실제 스크립트는 1개였다).
- 이전 세션의 것: `pkill -f 'llama-server…'` 자기 매칭(exit 144) → `pkill -x`; Termux 에 `/tmp` 없음; llama.cpp 릴리스는 `bNNNNN` 태그 tar.gz; 폰 LAN 주소 scp 불가(Tailscale 주소로); `gh api … pages` JSON 오류는 무시; SSE 는 `EventSource` 대신 `fetch`+ReadableStream; 첫 기록의 모델 지어내기 → 프롬프트 규칙 5개·예시 3개·`N_PREDICT` 320; Playwright `.mjs`는 `NODE_PATH` 무시 → `.cjs`.

## 핵심 파일·명령
- `~/Projects/03-personal/matjangbu/` — `engine/` · `web/` · `site/` · `bench/` · `samples/` · `tests/` · `tools/`(verify_site.cjs · verify_funnel.cjs · site_shots.cjs · bench_table.py) · `docs/ops.md`(운영 절차 정본).
- 테스트: `.venv/bin/python -m pytest -q`(44개). 공개 검증(`NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules` 필요):
  - `node tools/verify_site.cjs --base https://stoporder.github.io/matjangbu --allow https://omarchy.tailb0e058.ts.net --resolve omarchy.tailb0e058.ts.net=103.84.155.217 [--expect-banner]`
  - `node tools/verify_funnel.cjs --base https://stoporder.github.io/matjangbu --api https://omarchy.tailb0e058.ts.net/ --resolve omarchy.tailb0e058.ts.net=103.84.155.217 --out docs/shots/08-public-funnel-w11.png [--trace]`
- 인스턴스: `systemctl --user status matjangbu-llama matjangbu-web` · `curl -s 127.0.0.1:8108/api/health` · `tailscale funnel status`, 끄기 `tailscale funnel --https=443 off`.
- 재배포: `git push && git subtree push --prefix site origin gh-pages`(1~2분 뒤 반영).
- 폰: `ssh -o BatchMode=yes -p 8022 u0_a280@100.74.136.5`, 벤치 폴더 `~/matjangbu-bench/`(결과·로그), 모델 `~/models/`.
- 통합 스크립트 `/tmp/claude-1000/a31-integrate.sh`·로그(끝남, 재부팅 때 사라짐). 수동 절차는 `bench/README.md`·`docs/ops.md`.
- 메모리: `~/.claude/projects/-home-stoporder/memory/matjangbu-public-deploy.md`.

## 다음 액션
<!-- NEXT-ACTIONS -->
- [ ] 사용자에게 묻기: 사이트 문구·낮은 정확도 수치를 그대로 둘지, 「계획」의 1~7 중 무엇을 이어갈지, 폰의 벤치 폴더·모델을 지울지
- [ ] 사용자가 고른 항목만 새 계획으로(brainstorming → 설계 → 계획). 스스로 시작하지 않는다
<!-- /NEXT-ACTIONS -->

## 추천 스킬·도구
- 이어갈 기능이 정해지면 brainstorming → writing-plans. 화면을 다시 찍을 땐 `node tools/site_shots.cjs docs/shots --base http://127.0.0.1:8108`(로컬), 공개 흐름 최종 화면은 `tools/verify_funnel.cjs --out`.

## 주의사항
- 실제 단체 자료를 저장소·인스턴스에 넣지 않는다. 사이트에 재지 않은 숫자·가격·고객 수를 적지 않는다.
- 폰에서 벤치를 다시 돌릴 땐 다른 llama 프로세스를 띄우지 않는다(LMK 가 Termux·sshd 까지 죽인다). `pkill -f`·`pgrep -f`로 llama-server·bench 를 판정하지 않는다.
- 검증·흐름 스크립트를 폴백 검증(인스턴스 내림)과 동시에 돌리지 않는다.
- 커밋 메시지 끝: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
