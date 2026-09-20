#!/usr/bin/env python3
"""bench/results/*.md 의 summary JSON 으로 사이트 실측표를 채운다 — 손으로 옮기지 않는다.

    python3 tools/bench_table.py            # site/index.html · site/phone/index.html 의 <!-- bench:rows --> 사이를 바꾼다
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "bench" / "results"
DEVICE = {"SM-A315N": "갤럭시 A31 (4GB)", "laptop-i7-10750H": "노트북 i7-10750H"}
MODEL = {"qwen": "Qwen2.5-1.5B-Instruct Q4_K_M", "hyperclova": "HyperCLOVAX-SEED-1.5B Q4_K_M <span class=\"badge badge-gray\">자체 약관 · 비교값</span>"}


def summaries() -> list[dict]:
    out = []
    for md in sorted(RES.glob("*.md")):
        m = re.search(r"```json\n(.*?)\n```", md.read_text(encoding="utf-8"), re.S)
        if m:
            out.append(json.loads(m.group(1)))
    # 같은 (기기·모델·스레드)는 가장 최근 것만
    latest: dict[tuple, dict] = {}
    for s in out:
        latest[(s["device"], s["model"], s["threads"])] = s
    order = {"SM-A315N": 0, "laptop-i7-10750H": 1}
    return sorted(latest.values(), key=lambda s: (order.get(s["device"], 9), s["model"] != "qwen", -s["threads"]))


def pct(a: int, b: int) -> str:
    return f"{a}/{b} ({round(a / b * 100) if b else 0}%)"


def rows(with_relation: bool) -> str:
    out = []
    for s in summaries():
        cells = [DEVICE.get(s["device"], s["device"]), MODEL.get(s["model"], s["model"]), str(s["threads"]),
                 f"{s['wall_mean']}<span class=\"muted\"> ({s['wall_min']}~{s['wall_max']})</span>", str(s["pp_mean"]), str(s["tg_mean"]),
                 pct(s["top1"], s["scored"]), pct(s["top3"], s["scored"])]
        if with_relation:
            cells.append(pct(s["relation_ok"], s["n"]))
        cells.append(pct(s["json_ok"], s["n"]))
        out.append("            <tr>" + "".join(f"<td{' class=\"n\"' if i >= 2 else ''}>{c}</td>" for i, c in enumerate(cells)) + "</tr>")
    if not out:
        return "            <tr><td colspan=\"10\" class=\"muted\">측정 예정</td></tr>"
    return "\n".join(out)


def patch(path: Path, with_relation: bool) -> None:
    s = path.read_text(encoding="utf-8")
    new = re.sub(r"(<!-- bench:rows -->\n).*?(\n\s*<!-- /bench:rows -->)", lambda m: m.group(1) + rows(with_relation) + m.group(2), s, flags=re.S)
    path.write_text(new, encoding="utf-8")
    print(f"{path.relative_to(ROOT)}: {len(summaries())}행")


def main() -> int:
    patch(ROOT / "site" / "index.html", with_relation=False)
    patch(ROOT / "site" / "phone" / "index.html", with_relation=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
