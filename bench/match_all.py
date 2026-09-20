#!/usr/bin/env python3
"""3단(모델)만 30건 잰다 — held_lines.json 의 줄마다 규칙이 세운 상위 후보 5명과 이력을 주고 모델의 후보 JSON 을 받는다.

    python3 bench/match_all.py --url http://127.0.0.1:8117 --device SM-A315N --model-name qwen --threads 8 [--limit 5]

측정: 줄당 wall_s · prompt_n · pp_tps · tg_tps · JSON 성공 · 후보 1위 정답 · 후보 3 안 정답 · relation 정답.
결과: bench/results/<device>-<model>-<threads>t-<YYYYMMDD-HHMM>.jsonl(원자료) + .md(표).
세대주·옛이름 규칙은 끈 명부 사본으로 돈다(make_samples 와 같은 조건) — 규칙으로 풀리는 줄은 벤치 대상이 아니다.
"""
from __future__ import annotations

import argparse
import json
import platform
import statistics
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from engine.hangul import norm, strip_kind  # noqa: E402
from engine.match import rule_match, top_similar  # noqa: E402
from engine.model import health, rank  # noqa: E402
from engine.roster import Roster  # noqa: E402


def bench_roster(path: Path) -> Roster:
    r = Roster.load(path)
    return Roster.from_rows([{"id": p.id, "이름": p.name, "구역": p.group,
                              "세대": ("" if p.household and not p.household.startswith("H") else p.household),
                              "옛이름": ""} for p in r.people])


def device_name(given: str) -> str:
    if given:
        return given
    try:
        out = subprocess.run(["getprop", "ro.product.model"], capture_output=True, text=True, timeout=3).stdout.strip()
        if out:
            return out
    except Exception:
        pass
    return platform.node()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default="http://127.0.0.1:8117")
    ap.add_argument("--device", default="")
    ap.add_argument("--model-name", required=True)
    ap.add_argument("--threads", type=int, required=True)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--samples", type=Path, default=ROOT / "samples")
    ap.add_argument("--out", type=Path, default=ROOT / "bench" / "results")
    ap.add_argument("--sleep", type=float, default=2.0)
    ap.add_argument("--timeout", type=int, default=600)
    a = ap.parse_args()
    if not health(a.url):
        print(f"모델 서버 {a.url} 없음")
        return 2
    roster = bench_roster(a.samples / "roster.csv")
    lines = json.loads((a.samples / "held_lines.json").read_text(encoding="utf-8"))[: a.limit or None]
    dev = device_name(a.device)
    stamp = time.strftime("%Y%m%d-%H%M")
    a.out.mkdir(parents=True, exist_ok=True)
    base = a.out / f"{dev}-{a.model_name}-{a.threads}t-{stamp}"
    rows = []
    for i, h in enumerate(lines):
        m = rule_match(h["raw"], roster, {})
        assert m.state == "held" and m.unresolved, h["raw"]
        name_part, _ = strip_kind(norm(h["raw"]))
        cands = [p for p, _ in top_similar(name_part, roster, 5)]
        res = rank(h["raw"], cands, roster, h.get("history", []), url=a.url, timeout=a.timeout)
        ids = [str(c.get("id")) for c in (res.pred.get("candidates") or [])] if res.ok else []
        want = h["expect"]["person_id"]
        row = {"i": i, "category": h["category"], "raw": h["raw"], "ok": res.ok, "error": res.error, "pred": res.pred, **res.meta,
               "want": want, "top1": (ids[:1] == [want]) if want else None, "top3": (want in ids[:3]) if want else None,
               "relation_ok": (res.pred.get("relation") == h["expect"]["relation"]) if res.ok else False}
        rows.append(row)
        with base.with_suffix(".jsonl").open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
        mark = "✓" if row["top1"] else ("·" if row["top1"] is None else "✗")
        print(f"{i + 1:2}/{len(lines)} {h['category']:<9} {h['raw']:<12} {row.get('wall_s') or 0:6.1f}s "
              f"pp {row.get('pp_tps') or 0:5.1f} tg {row.get('tg_tps') or 0:4.1f} {mark} rel {'✓' if row['relation_ok'] else '✗'}"
              + ("" if res.ok else f"  ! {res.error[:60]}"), flush=True)
        time.sleep(a.sleep)
    ok = [r for r in rows if r["ok"]]
    scored = [r for r in rows if r["top1"] is not None]
    walls = [r["wall_s"] for r in ok if r.get("wall_s")] or [0]
    summary = {"device": dev, "model": a.model_name, "threads": a.threads, "n": len(rows), "json_ok": len(ok),
               "top1": sum(1 for r in scored if r["top1"]), "top3": sum(1 for r in scored if r["top3"]), "scored": len(scored),
               "relation_ok": sum(1 for r in rows if r["relation_ok"]),
               "wall_mean": round(statistics.mean(walls), 1), "wall_min": round(min(walls), 1), "wall_max": round(max(walls), 1),
               "pp_mean": round(statistics.mean([r["pp_tps"] for r in ok if r.get("pp_tps")] or [0]), 1),
               "tg_mean": round(statistics.mean([r["tg_tps"] for r in ok if r.get("tg_tps")] or [0]), 1),
               "prompt_n_mean": round(statistics.mean([r["prompt_n"] for r in ok if r.get("prompt_n")] or [0])),
               "ts": stamp, "url": a.url}
    by_cat: dict[str, dict] = {}
    for r in rows:
        c = by_cat.setdefault(r["category"], {"n": 0, "top1": 0, "rel": 0})
        c["n"] += 1
        c["top1"] += bool(r["top1"])
        c["rel"] += bool(r["relation_ok"])
    md = [f"# {dev} · {a.model_name} · {a.threads}스레드 · {stamp}", "",
          f"- 줄 {summary['n']}건 · JSON 성공 {summary['json_ok']} · 후보 1위 정답 {summary['top1']}/{summary['scored']} · "
          f"후보 3 안 {summary['top3']}/{summary['scored']} · relation 정답 {summary['relation_ok']}/{summary['n']}",
          f"- 줄당 {summary['wall_mean']}초(최소 {summary['wall_min']} · 최대 {summary['wall_max']}) · pp {summary['pp_mean']} tok/s · "
          f"tg {summary['tg_mean']} tok/s · 프롬프트 평균 {summary['prompt_n_mean']} 토큰", "",
          "| 유형 | 건수 | 1위 정답 | relation 정답 |", "|---|---|---|---|"]
    md += [f"| {c} | {v['n']} | {v['top1']} | {v['rel']} |" for c, v in by_cat.items()]
    md += ["", "```json", json.dumps(summary, ensure_ascii=False), "```"]
    base.with_suffix(".md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"끝: {base.with_suffix('.md')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
