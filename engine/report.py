#!/usr/bin/env python3
"""기록 — 주간 명단·개인별 누적·연말 합산. 전부 대장(`lines.jsonl`)에서 계산하고 CSV(UTF-8 BOM)로 낸다.

주간 명단은 「사람 손이 닿은 줄」부터 보여준다 — 입금 순서대로 두면 완전일치가 앞을 다 차지해
이 도구가 한 일이 안 보인다(MVP 에서 배운 것).
"""
from __future__ import annotations

import csv
import io
from collections import defaultdict

from .store import Workspace

NO_KIND = "(종류 없음)"
ACTIVE = ("auto", "confirmed")


def _year_of(r: dict) -> str:
    return (r.get("date") or r.get("week") or "")[:4]


def _view(r: dict, roster) -> dict:
    p = roster.by_id.get(r.get("person_id") or "")
    return {"id": r["id"], "raw": r.get("raw", ""), "name": p.name if p else "", "group": p.group if p else "",
            "kind": r.get("kind") or NO_KIND, "amount": int(r.get("amount") or 0), "path": r.get("path", ""),
            "how": r.get("how", ""), "state": r.get("state", ""), "date": r.get("date", "")}


def week_list(ws: Workspace, week: str) -> dict:
    roster = ws.roster()
    rows = [r for r in ws.lines() if r.get("week") == week]
    human = [_view(r, roster) for r in rows if r.get("state") == "confirmed"]
    auto = [_view(r, roster) for r in rows if r.get("state") == "auto"]
    held = [_view(r, roster) for r in rows if r.get("state") == "held"]
    excluded = [_view(r, roster) for r in rows if r.get("state") == "excluded"]
    active = human + auto
    return {"week": week, "rows": active, "held": held, "excluded": excluded,
            "total": sum(r["amount"] for r in active), "count": len(active)}


def person_totals(ws: Workspace, year: int) -> dict:
    roster = ws.roster()
    acc: dict[str, dict] = {}
    kinds: set[str] = set()
    for r in ws.lines():
        if r.get("state") not in ACTIVE or _year_of(r) != str(year) or not r.get("person_id"):
            continue
        p = roster.by_id.get(r["person_id"])
        a = acc.setdefault(r["person_id"], {"person_id": r["person_id"], "name": p.name if p else r["person_id"],
                                            "group": p.group if p else "", "by_kind": defaultdict(int),
                                            "total": 0, "count": 0})
        k = r.get("kind") or NO_KIND
        kinds.add(k)
        a["by_kind"][k] += int(r.get("amount") or 0)
        a["total"] += int(r.get("amount") or 0)
        a["count"] += 1
    rows = sorted(({**a, "by_kind": dict(a["by_kind"])} for a in acc.values()), key=lambda a: (-a["total"], a["name"]))
    return {"year": year, "rows": rows, "kinds": sorted(kinds, key=lambda k: (k == NO_KIND, k)),
            "total": sum(a["total"] for a in rows), "count": sum(a["count"] for a in rows)}


def year_summary(ws: Workspace, year: int) -> dict:
    base = person_totals(ws, year)
    by_kind: dict[str, int] = defaultdict(int)
    for a in base["rows"]:
        for k, v in a["by_kind"].items():
            by_kind[k] += v
    unc = [r for r in ws.lines() if r.get("state") == "held" and _year_of(r) == str(year)]
    exc = [r for r in ws.lines() if r.get("state") == "excluded" and _year_of(r) == str(year)]
    return {**base, "by_kind": dict(by_kind),
            "unconfirmed": {"count": len(unc), "total": sum(int(r.get("amount") or 0) for r in unc)},
            "excluded": {"count": len(exc), "total": sum(int(r.get("amount") or 0) for r in exc)}}


def to_csv(columns: list[str], rows: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=columns, lineterminator="\n", extrasaction="ignore")
    w.writeheader()
    for r in rows:
        w.writerow(r)
    return "﻿" + buf.getvalue()


def export(ws: Workspace, which: str, week: str | None = None, year: int | None = None) -> tuple[str, str]:
    if which == "week":
        d = week_list(ws, week or "")
        cols = ["이름", "구역", "종류", "금액", "경로", "근거", "원문"]
        rows = [{"이름": r["name"], "구역": r["group"], "종류": r["kind"], "금액": r["amount"],
                 "경로": "봉투" if r["path"] == "envelope" else "통장", "근거": r["how"], "원문": r["raw"]} for r in d["rows"]]
        rows.append({"이름": "합계", "금액": d["total"]})
        name = f"주간명단-{week}.csv"
    elif which == "person":
        d = person_totals(ws, int(year))
        cols = ["이름", "구역", *d["kinds"], "합계", "건수"]
        rows = [{"이름": a["name"], "구역": a["group"], **{k: a["by_kind"].get(k, 0) for k in d["kinds"]},
                 "합계": a["total"], "건수": a["count"]} for a in d["rows"]]
        rows.append({"이름": "합계", "합계": d["total"], "건수": d["count"]})
        name = f"개인별누적-{year}.csv"
    else:
        d = year_summary(ws, int(year))
        cols = ["이름", "구역", "합계", "건수", *d["kinds"]]
        rows = [{"이름": a["name"], "구역": a["group"], "합계": a["total"], "건수": a["count"],
                 **{k: a["by_kind"].get(k, 0) for k in d["kinds"]}} for a in d["rows"]]
        rows.append({"이름": "합계", "합계": d["total"], "건수": d["count"], **d["by_kind"]})
        rows.append({"이름": "미확정", "합계": d["unconfirmed"]["total"], "건수": d["unconfirmed"]["count"]})
        name = f"연말합산-{year}.csv"
    text = to_csv(cols, rows)
    ws.exports.mkdir(parents=True, exist_ok=True)
    (ws.exports / name).write_text(text, encoding="utf-8")
    return name, text
