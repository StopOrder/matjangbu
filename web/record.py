#!/usr/bin/env python3
"""미리 잰 결과 — 샘플 4주를 엔진 전체(규칙+모델)로 돌려 `site/try/recorded.json` 을 만든다.

    python3 -m web.record --device "노트북 i7-10750H · 4스레드" --model-name "Qwen2.5-1.5B-Instruct Q4_K_M" --threads 4

체험(/try)은 방문자가 왔을 때 모델을 부르지 않는다. 대신 이 파일에 저장된 `<주차>|<원문>` 별 모델 결과를 재생한다.
그래서 기록에는 어느 기기·언제·어떤 모델인지가 반드시 붙는다. 숫자를 지어 넣지 않는다 — 이 파일은 이 스크립트로만 만든다.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from engine.model import DEFAULT_URL, health, make_model  # noqa: E402
from engine.pipeline import import_csv  # noqa: E402
from engine.roster import Roster  # noqa: E402
from engine.store import Workspace  # noqa: E402

OUT = ROOT / "site" / "try" / "recorded.json"


def build_recorded(samples: Path, model: Callable, device: str, model_name: str, threads: int, url: str) -> dict:
    samples = Path(samples)
    answers = json.loads((samples / "answers.json").read_text(encoding="utf-8"))
    aliases = json.loads((samples / "aliases.json").read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory() as td:
        ws = Workspace(Path(td))
        ws.init()
        roster = Roster.load(samples / "roster.csv")
        ws.save_roster(roster)
        ws._write_aliases(aliases)
        weeks, model_rows = {}, {}
        for csv in sorted((samples / "weeks").glob("*.csv")):
            wk = csv.stem
            text = csv.read_text(encoding="utf-8-sig")
            summary: dict = {}
            for ev in import_csv(ws, text, wk, "", csv.name, model=model):
                if ev["event"] == "done":
                    summary = ev["summary"]
            rows = [r for r in ws.lines() if r["week"] == wk]
            for r in rows:
                if r.get("model") and r.get("how") == "모델":
                    model_rows[f"{wk}|{r['raw']}"] = {"pred": r["model"].get("pred", {}),
                                                      "meta": {k: v for k, v in r["model"].items() if k != "pred"}}
            weeks[wk] = {"date": rows[0]["date"] if rows else "", "filename": csv.name, "rows": rows, "summary": summary}
        try:
            git = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
        except Exception:
            git = ""
        return {"meta": {"device": device, "model": model_name, "threads": threads, "url": url,
                         "ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "engine_git": git},
                "weeks": weeks, "model": model_rows, "roster": [p.public() for p in roster.people],
                "aliases": aliases, "answers": answers}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--device", required=True)
    ap.add_argument("--model-name", required=True)
    ap.add_argument("--threads", type=int, required=True)
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--samples", type=Path, default=ROOT / "samples")
    ap.add_argument("--out", type=Path, default=OUT)
    a = ap.parse_args()
    if not health(a.url):
        print(f"모델 서버 {a.url} 없음")
        return 2
    rec = build_recorded(a.samples, make_model(a.url), a.device, a.model_name, a.threads, a.url)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{a.out} — 주차 {len(rec['weeks'])} · 모델 줄 {len(rec['model'])} · {a.device}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
