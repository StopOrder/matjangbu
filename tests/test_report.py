from engine import report as R
from engine.roster import Roster
from engine.store import Workspace

CSV = "id,이름,구역,세대,옛이름\np01,김정호,1구역,H01,\np02,이순자,1구역,H01,\np19,김태섭,4구역,H11,\n"


def seed(tmp_path):
    ws = Workspace(tmp_path)
    ws.init()
    ws.save_roster(Roster.from_csv_text(CSV))
    rows = [
        {"id": "a", "week": "2026-W10", "date": "2026-03-08", "raw": "김정호", "amount": 300000, "kind": "십일조", "path": "csv", "state": "auto", "person_id": "p01", "how": "완전일치"},
        {"id": "b", "week": "2026-W10", "date": "2026-03-08", "raw": "우리상사", "amount": 200000, "kind": "", "path": "csv", "state": "confirmed", "person_id": "p19", "how": "사람"},
        {"id": "c", "week": "2026-W10", "date": "2026-03-08", "raw": "장동철", "amount": 50000, "kind": "", "path": "csv", "state": "held", "person_id": None, "how": ""},
        {"id": "d", "week": "2026-W10", "date": "2026-03-08", "raw": "이순자", "amount": 10000, "kind": "감사헌금", "path": "envelope", "state": "excluded", "person_id": None, "how": "사람"},
        {"id": "e", "week": "2026-W11", "date": "2026-03-15", "raw": "김정호", "amount": 300000, "kind": "십일조", "path": "csv", "state": "auto", "person_id": "p01", "how": "완전일치"},
        {"id": "f", "week": "2025-W52", "date": "2025-12-28", "raw": "김정호", "amount": 1000, "kind": "", "path": "csv", "state": "auto", "person_id": "p01", "how": "완전일치"},
    ]
    for r in rows:
        ws.append_line(r)
    return ws


def test_week_list_orders_human_first(tmp_path):
    w = R.week_list(seed(tmp_path), "2026-W10")
    assert [r["name"] for r in w["rows"]] == ["김태섭", "김정호"]          # 사람 손이 닿은 줄부터
    assert w["total"] == 500000 and w["count"] == 2
    assert [r["raw"] for r in w["held"]] == ["장동철"] and [r["raw"] for r in w["excluded"]] == ["이순자"]


def test_person_totals_and_year_summary(tmp_path):
    ws = seed(tmp_path)
    p = R.person_totals(ws, 2026)
    assert p["rows"][0]["name"] == "김정호" and p["rows"][0]["total"] == 600000 and p["rows"][0]["by_kind"]["십일조"] == 600000
    assert p["rows"][1]["by_kind"][R.NO_KIND] == 200000 and p["total"] == 800000 and set(p["kinds"]) == {"십일조", R.NO_KIND}
    y = R.year_summary(ws, 2026)
    assert y["total"] == 800000 and y["count"] == 3 and y["by_kind"]["십일조"] == 600000
    assert y["unconfirmed"] == {"count": 1, "total": 50000} and y["excluded"] == {"count": 1, "total": 10000}
    assert R.year_summary(ws, 2025)["total"] == 1000


def test_export_csv_has_bom_and_file(tmp_path):
    ws = seed(tmp_path)
    name, text = R.export(ws, "week", week="2026-W10")
    assert name == "주간명단-2026-W10.csv" and text.startswith("﻿이름,") and "김태섭" in text
    assert (ws.exports / name).exists()
    name, text = R.export(ws, "year", year=2026)
    assert name == "연말합산-2026.csv" and "합계" in text
    assert R.to_csv(["a", "b"], [{"a": 1, "b": "x,y"}]) == '﻿a,b\n1,"x,y"\n'
