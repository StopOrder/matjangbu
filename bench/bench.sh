#!/usr/bin/env bash
# bench/bench.sh --model qwen|hyperclova [--threads "8,4"] [--taskset "6,7:2"] [--quick] [--device NAME] [--models-dir ~/models] [--port 8117]
# 모델 파일: qwen=qwen1.5b.gguf(Qwen2.5-1.5B-Instruct Q4_K_M, Apache-2.0) · hyperclova=hyperclova1.5b.gguf(HyperCLOVAX-SEED-1.5B Q4_K_M, 라이선스 자체 약관 — 비교값 전용)
# 스레드 설정마다 llama-server 를 새로 띄우고 match_all.py 로 30건을 잰 뒤 내린다. 포트는 체험 인스턴스(8107)와 겹치지 않게 8117.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
MODEL=qwen; THREADS="8,4"; TASKSET=""; LIMIT=""; DEVICE=""; MODELS="$HOME/models"; PORT=8117
while [ $# -gt 0 ]; do case "$1" in
  --model) MODEL="$2"; shift 2;; --threads) THREADS="$2"; shift 2;; --taskset) TASKSET="$2"; shift 2;;
  --quick) LIMIT="--limit 5"; shift;; --device) DEVICE="$2"; shift 2;; --models-dir) MODELS="$2"; shift 2;;
  --port) PORT="$2"; shift 2;; *) echo "모르는 인자 $1"; exit 2;; esac; done
case "$MODEL" in qwen) FILE="$MODELS/qwen1.5b.gguf";; hyperclova) FILE="$MODELS/hyperclova1.5b.gguf";; *) echo "모델은 qwen|hyperclova"; exit 2;; esac
[ -f "$FILE" ] || { echo "모델 파일 없음: $FILE"; exit 2; }
mkdir -p "$HERE/bench/results"
export OMP_NUM_THREADS=1
for T in ${THREADS//,/ }; do
  PIN=""
  if [ -n "$TASKSET" ] && [ "${TASKSET##*:}" = "$T" ] && command -v taskset >/dev/null; then PIN="taskset -c ${TASKSET%%:*}"; fi
  echo "== $MODEL · ${T}스레드 $PIN  $(date '+%H:%M:%S')"
  $PIN llama-server -m "$FILE" --host 127.0.0.1 --port "$PORT" -c 2048 -ub 128 -b 512 -t "$T" --jinja -fa on --no-warmup \
    > "$HERE/bench/results/server-$MODEL-$T.log" 2>&1 &
  SRV=$!
  for i in $(seq 1 120); do curl -sf "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break; sleep 2; done
  if ! curl -sf "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    echo "서버가 안 뜬다 — $HERE/bench/results/server-$MODEL-$T.log"; kill $SRV 2>/dev/null || true; exit 3
  fi
  python3 "$HERE/bench/match_all.py" --url "http://127.0.0.1:$PORT" --device "$DEVICE" --model-name "$MODEL" --threads "$T" $LIMIT || true
  kill $SRV 2>/dev/null || true; wait $SRV 2>/dev/null || true; sleep 3
done
echo "끝: $(ls -t "$HERE"/bench/results/*.md 2>/dev/null | head -2 | tr '\n' ' ')"
