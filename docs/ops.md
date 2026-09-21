# 운영 절차 — 체험 인스턴스·사이트·실측

## 구조

| 조각 | 어디 | 상태 확인 |
|---|---|---|
| 정적 사이트 | GitHub Pages — `gh-pages` 브랜치 = `site/` 폴더 그대로 | `curl -sI https://stoporder.github.io/matjangbu/ \| head -1` |
| 체험 인스턴스 | 이 노트북, systemd 사용자 서비스 `matjangbu-llama`(8107) · `matjangbu-web`(8108) | `systemctl --user status matjangbu-llama matjangbu-web` · `curl -s 127.0.0.1:8108/api/health` |
| HTTPS 노출 | Tailscale Funnel → 8108 | `tailscale funnel status` |
| `/try` 폴백 | 같은 origin → `<meta name="matjangbu-api">` 주소 → `recorded.json` 읽기 전용(앰버 배너) | 인스턴스를 끄고 공개 주소를 열면 배너가 보여야 한다 |
| 폰 | 갤럭시 A31 은 실측 기기. 서버 아님 | `ssh -p 8022 u0_a280@100.74.136.5` |

노트북이 꺼지면 체험은 읽기 전용으로 내려앉는다. 링크는 죽지 않는다.

## 인스턴스 켜기·끄기

```bash
systemctl --user restart matjangbu-llama matjangbu-web      # 둘 다
systemctl --user stop matjangbu-web                          # 읽기 전용 폴백 시험
journalctl --user -u matjangbu-web -n 50 --no-pager
loginctl show-user "$USER" -p Linger                         # Linger=yes 여야 로그아웃 뒤에도 산다
```

유닛 파일: `~/.config/systemd/user/matjangbu-llama.service` · `matjangbu-web.service`. 모델 파일 `~/models/qwen1.5b.gguf`(A31 과 sha256 동일). llama-server 는 `~/.local/opt/llama.cpp/`(릴리스 b11063 ubuntu-x64 바이너리, sudo 없이 설치).

## Funnel (처음 한 번은 root)

```bash
sudo tailscale set --operator=$USER      # 한 번만 — 이후 사용자 권한으로 funnel 을 만진다
tailscale funnel --bg 8108
tailscale funnel status                  # https://<이 노트북>.<테일넷>.ts.net
```

주소가 나오면 `site/try/index.html`의 `<meta name="matjangbu-api" content="https://…/">`에 넣고 재배포한다(아래).
공개 사이트가 인스턴스에 붙는지: `node tools/verify_site.cjs --base https://stoporder.github.io/matjangbu --allow https://<주소> --resolve <호스트>=<공개 IP>` (0 = 통과).
- 세 경로(`/`·`/install/`·`/try/`)의 DOM 계약(`data-mj=…`)·외부 요청 0·콘솔 에러 0·정적 4xx 0·390px 가로 넘침 0 을 한 번에 본다.
- `--resolve`가 필요한 이유: 테일넷에 들어 있는 머신에서는 Funnel 호스트가 MagicDNS 로 100.x 로 풀리고, Chromium 은 공개 사이트가 「local 주소 공간」에 fetch 하는 것을 막는다(헤드리스는 그냥 거부, 일반 브라우저는 「로컬 네트워크 접근」 허용을 묻는다). 공개 IP 는 `curl -s 'https://dns.google/resolve?name=<호스트>&type=A'`로 본다(2026-09-20 현재 103.84.155.217 · 103.84.155.153).
- 같은 이유로 **Tailscale 이 켜진 자기 기기**에서 공개 `/try/`를 열면 브라우저가 로컬 네트워크 접근 허용을 한 번 묻는다. 허용하지 않으면 읽기 전용 폴백(GNB 에 「미리 잰 기록」 칩)으로 떨어진다. 외부 방문자·Tailscale 을 끈 기기는 해당 없음.

끝까지 동작하는지(랜딩 「체험하기」 → 장부 → 빈 줄 펼침 → 후보 확정): `node tools/verify_funnel.cjs --base https://stoporder.github.io/matjangbu --api https://<주소>/ --resolve <호스트>=<공개 IP> --out docs/shots/10-public-funnel.png` (0 = 통과, `--out` 을 주면 최종 화면을 찍는다).
- 이 스크립트의 대기는 전부 조건 대기다. 공개 인그레스 경유는 요청당 0.5~3초라 고정 시간 대기는 실패한다. 토스트는 3.2초 뒤 사라지는 일시 표시라 기준으로 쓰지 않는다 — 「채울 줄 수가 하나 줄었다」를 기다린다.
- 읽기 전용(미리 잰 기록)으로 떨어진 경우에는 고르기가 막히므로 판이 열리는 데까지만 단언하고 통과시킨다.

폴백 확인: `systemctl --user stop matjangbu-web` → 위 `verify_site.cjs` 명령에 `--expect-recorded`를 붙여 0 → `systemctl --user start matjangbu-web`. (옛 이름 `--expect-banner` 도 아직 받는다.)

## 사이트 재배포

```bash
cd ~/Projects/03-personal/matjangbu
cd ui && npm ci && npm run build && cd ..        # /try 화면(ui/)을 고쳤을 때만. 산출물(site/try/)을 커밋한다
.venv/bin/python -m pytest -q
git add -A && git commit -m "site: …" && git push
git subtree push --prefix site origin gh-pages          # 1~2분 뒤 반영
curl -sI https://stoporder.github.io/matjangbu/ | head -1
```

화면과 검증 도구가 같이 지키는 것은 `data-mj` 속성뿐이다 — `gnb`·`tab`·`ledger`·`row`(+`data-blank`)·`panel`·`cand`·`entry`·`total`·`hero`·`matrix`·`opt`(+`data-on`)·`out`. 클래스 이름은 바꿔도 되지만 이 속성은 화면과 도구를 함께 고쳐야 한다(계약표: `docs/superpowers/plans/2026-09-21-pytorch-tds-implementation.md`).

화면 다시 찍기: `node tools/site_shots.cjs docs/shots --base http://127.0.0.1:8108` (9장, 콘솔 에러가 있으면 1 로 끝난다).

## 기록(recorded.json) 다시 만들기

프롬프트·규칙·샘플을 고쳤으면 기록을 다시 만든다. 숫자는 이 명령으로만 생긴다.

```bash
curl -sf 127.0.0.1:8107/health && .venv/bin/python -m web.record \
  --device "노트북 Intel Core i7-10750H @ 2.60GHz · 4스레드" --model-name "Qwen2.5-1.5B-Instruct Q4_K_M" --threads 4
systemctl --user restart matjangbu-web
```

## 실측(bench)

```bash
bench/bench.sh --model qwen --threads 4 --device laptop-i7-10750H --port 8117    # 노트북(인스턴스와 포트 분리)
python3 tools/bench_table.py                                                        # 사이트 표를 결과 파일에서 채운다
```

A31 절차와 함정은 `bench/README.md`. 폰에서 돌릴 땐 다른 모델 프로세스를 먼저 내린다(메모리).

## 남은 것

- 암호화 백업 · 설치 프로그램/zip · 실제 은행 양식 추가(1라운드 인터뷰에서 받는다) · A31 발열 측정 · 2013년 이전 PC 실측.
