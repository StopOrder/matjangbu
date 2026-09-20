from engine import pipeline as P
from engine.match import ModelResult
from engine.roster import Roster
from engine.store import Workspace

ROSTER_CSV = ("id,이름,구역,세대,옛이름\np01,김정호,1구역,H01,\np02,이순자,1구역,H01,\np05,박민수,1구역,H03,\n"
              "p26,박민수,5구역,H20,\np13,한수진,3구역,H07,\np27,장동현,5구역,H21,\np19,김태섭,4구역,H11,\n")
W10 = "날짜,입금자명,금액\n2026-03-08,김정호,300000\n2026-03-08,우리상사,200000\n2026-03-08,박민수십일조,150000\n2026-03-08,장동철,50000\n"


def ws_with_roster(tmp_path):
    ws = Workspace(tmp_path)
    ws.init()
    ws.save_roster(Roster.from_csv_text(ROSTER_CSV))
    return ws


def test_import_events_and_states(tmp_path):
    ws = ws_with_roster(tmp_path)
    ev = list(P.import_csv(ws, W10, "2026-W10", "2026-03-08", "w10.csv"))
    assert ev[0]["event"] == "start" and ev[0]["n"] == 4 and ev[-1]["event"] == "done"
    assert ev[-1]["summary"] == {"auto": 1, "held": 3, "n": 4, "skipped": 0}
    rows = ws.lines()
    assert [r["state"] for r in rows] == ["auto", "held", "held", "held"]
    assert rows[2]["reason"] == "dup" and rows[2]["kind"] == "십일조" and rows[1]["allow_new"] is True
    again = list(P.import_csv(ws, W10, "2026-W10", "2026-03-08", "w10.csv"))
    assert again[0]["event"] == "skipped" and len(ws.lines()) == 4          # 같은 CSV 는 다시 넣지 않는다


def test_confirm_learns_alias_and_next_week_is_auto(tmp_path):
    ws = ws_with_roster(tmp_path)
    list(P.import_csv(ws, W10, "2026-W10", "2026-03-08"))
    company = next(r for r in ws.lines() if r["raw"] == "우리상사")
    out = P.confirm(ws, company["id"], person_id="p19")
    assert out["ok"] and out["alias_learned"] == "우리상사" and ws.aliases()["우리상사"]["person_id"] == "p19"
    assert ws.get(company["id"])["state"] == "confirmed" and ws.get(company["id"])["how"] == "사람"
    assert P.confirm(ws, company["id"], person_id="p19")["ok"] is False      # 이미 확정 → 거절
    list(P.import_csv(ws, W10.replace("2026-03-08", "2026-03-15"), "2026-W11", "2026-03-15"))
    nxt = [r for r in ws.lines() if r["week"] == "2026-W11" and r["raw"] == "우리상사"][0]
    assert (nxt["state"], nxt["how"], nxt["person_id"]) == ("auto", "별칭사전", "p19")


def test_confirm_new_person_dup_kind_and_undo(tmp_path):
    ws = ws_with_roster(tmp_path)
    list(P.import_csv(ws, W10, "2026-W10", "2026-03-08"))
    unknown = next(r for r in ws.lines() if r["raw"] == "장동철")
    out = P.confirm(ws, unknown["id"], new_person={"name": "장동철", "group": "5구역"})
    assert out["ok"] and out["new_person"]["name"] == "장동철" and ws.roster().find("장동철")
    assert out["alias_learned"] is None                                       # 원문 = 이름이면 별칭 없음
    dup = next(r for r in ws.lines() if r["raw"] == "박민수십일조")
    assert P.confirm(ws, dup["id"], person_id="p05", kind="감사헌금")["ok"]
    assert ws.get(dup["id"])["kind"] == "감사헌금" and ws.aliases()["박민수십일조"]["person_id"] == "p05"
    u = P.undo_last(ws)
    assert u["id"] == dup["id"] and ws.get(dup["id"])["state"] == "held" and "박민수십일조" not in ws.aliases()
    u2 = P.undo_last(ws)
    assert u2["id"] == unknown["id"] and ws.get(unknown["id"])["state"] == "held"
    assert P.undo_last(ws) is None


def test_hold_exclude_and_errors(tmp_path):
    ws = ws_with_roster(tmp_path)
    list(P.import_csv(ws, W10, "2026-W10", "2026-03-08"))
    row = next(r for r in ws.lines() if r["raw"] == "장동철")
    assert P.exclude(ws, row["id"], "중복 입금")["ok"] and ws.get(row["id"])["state"] == "excluded"
    assert P.hold(ws, row["id"])["ok"] and ws.get(row["id"])["state"] == "held"
    assert P.confirm(ws, "nope", person_id="p01")["ok"] is False
    assert P.confirm(ws, row["id"], person_id="p99")["ok"] is False


def test_envelopes(tmp_path):
    ws = ws_with_roster(tmp_path)
    out = P.add_envelopes(ws, "2026-W10", "2026-03-08",
                          [{"name": "김정호", "kind": "십일조", "amount": 100000},
                           {"name": "박민수", "kind": "감사헌금", "amount": 50000},
                           {"name": "홍길동", "kind": "", "amount": 30000},
                           {"name": "", "kind": "", "amount": 10}], counted_total=200000)
    states = [(r["raw"], r["state"], r["how"]) for r in out["rows"]]
    assert states == [("김정호", "confirmed", "사람"), ("박민수", "held", "동명이인"), ("홍길동", "held", "")]
    assert out["total"] == 180000 and out["diff"] == -20000 and out["errors"] == ["4번째 줄: 이름 없음"]
    assert all(r["path"] == "envelope" for r in ws.lines())


def test_rematch_runs_model_only_for_held(tmp_path):
    ws = ws_with_roster(tmp_path)
    list(P.import_csv(ws, W10, "2026-W10", "2026-03-08"))
    row = next(r for r in ws.lines() if r["raw"] == "장동철")
    fake = lambda **k: ModelResult({"name_part": "장동철", "kind": "", "relation": "family",
                                    "candidates": [{"id": "p13", "why": "같은 세대"}], "confidence": 0.5},
                                   {"model": "fake", "wall_s": 1.0})
    out = P.rematch(ws, row["id"], fake)
    assert out["ok"] and out["row"]["how"] == "모델" and out["row"]["cands"][0]["person_id"] == "p13"
    auto = next(r for r in ws.lines() if r["raw"] == "김정호")
    assert P.rematch(ws, auto["id"], fake)["ok"] is False
