# bench — 3단(모델) 실측

규칙 1·2단이 못 풀어 모델이 보는 「확인 필요 줄」 30건(`samples/held_lines.json`, 여섯 유형 × 5)을 같은 스크립트로 기기마다 잰다.
결과는 `bench/results/<기기>-<모델>-<스레드>t-<시각>.md`(표 + summary JSON)와 `.jsonl`(원자료). **사이트의 실측표는 이 파일에서만 채운다**(`tools/bench_table.py`).

- 모델: `qwen` = Qwen2.5-1.5B-Instruct Q4_K_M(Apache-2.0, 기본) · `hyperclova` = HyperCLOVAX-SEED-1.5B Q4_K_M(라이선스 자체 약관 — 비교값 전용)
- 명부는 세대주·옛이름 규칙을 끈 사본으로 돈다(그 규칙이 풀어 버리면 벤치 대상이 아니다). 이력이 필요한 유형(가족·회사·개명)에는 과거 확정 이력을 준다.
- 채점: 후보 1위 정답 · 후보 3 안 정답(정답이 있는 25건) · relation 정답(30건) · JSON 성공. 시간은 줄당 wall·pp·tg·프롬프트 토큰.
- 공통 설정: `-c 2048 -ub 128 -b 512 --jinja -fa on`, 온도 0, json_schema 강제, 줄 사이 2초.

```bash
bench/bench.sh --model qwen --threads 4 --device laptop-i7-10750H      # 노트북
bench/bench.sh --model qwen --threads 8,4 --device SM-A315N            # 폰(Termux)
bench/bench.sh --model hyperclova --threads 8 --device SM-A315N        # 비교
bench/bench.sh --quick …                                                # 5건만 먼저
```

## 갤럭시 A31 — PC 에서 ssh 로

```bash
A31="ssh -p 8022 u0_a280@100.74.136.5"
$A31 'pkg install -y python'                                           # 파이썬만 있으면 된다(의존성 0)
tar czf - engine bench/bench.sh bench/match_all.py samples/roster.csv samples/held_lines.json \
  | $A31 'mkdir -p ~/matjangbu-bench && cd ~/matjangbu-bench && tar xzf - && chmod +x bench/bench.sh && echo OK'
$A31 'cd ~/matjangbu-bench && termux-wake-lock; (setsid nohup bash bench/bench.sh --model qwen --threads 8 --device SM-A315N > a31-qwen.log 2>&1 < /dev/null &)'
$A31 'tail -3 ~/matjangbu-bench/a31-qwen.log'                           # 마지막 줄 「끝:」 이면 완료
scp -P 8022 'u0_a280@100.74.136.5:matjangbu-bench/bench/results/SM-A315N-*' bench/results/
```

함정 셋(나비 bench/README 에서 배운 것 + 이 폰에서 확인한 것):
1. `nohup … &` 만으로는 ssh 가 끊길 때 같이 죽는다 — `setsid` 로 새 세션을 만들고 `< /dev/null` 로 stdin 을 끊어야 살아남는다.
2. `pgrep -f` 로 생존을 판정하지 마라 — ssh 원격 명령 문자열 자체가 매칭된다. 로그 마지막 줄로 판정한다. 같은 이유로 `pkill -f 'llama-server'` 는 자기 셸을 죽인다(`pkill -x llama-server`).
3. 화면 꺼짐·절전이 프로세스를 죽인다 — 충전기 + `termux-wake-lock`. 다른 모델 프로세스가 떠 있으면 메모리가 모자라 LMK 가 Termux 째로 죽인다(sshd 까지) — 벤치 전에 반드시 내린다.
