from engine.roster import Roster
from engine.store import STATES, Workspace, line_id, sha256_text


def test_init_creates_layout(tmp_path):
    ws = Workspace(tmp_path / "교회")
    ws.init()
    assert ws.roster_path.exists() and ws.inbox.is_dir() and ws.exports.is_dir() and ws.meta.is_dir()
    assert ws.roster().people == [] and ws.aliases() == {}


def test_lines_fold_later_wins_and_keeps_first_order(tmp_path):
    ws = Workspace(tmp_path)
    ws.init()
    ws.append_line({"id": "a", "state": "held", "raw": "우리상사", "ts": "t1"})
    ws.append_line({"id": "b", "state": "auto", "raw": "김정호", "ts": "t1"})
    ws.append_line({"id": "a", "state": "confirmed", "person_id": "p19", "ts": "t2"})
    cur = ws.lines()
    assert [r["id"] for r in cur] == ["a", "b"]
    assert cur[0]["state"] == "confirmed" and cur[0]["raw"] == "우리상사" and cur[0]["person_id"] == "p19"
    assert ws.get("a")["state"] == "confirmed" and ws.get("zzz") is None
    assert len(ws.raw_lines()) == 3
    assert "confirmed" in STATES


def test_aliases_learn_and_forget(tmp_path):
    ws = Workspace(tmp_path)
    ws.init()
    assert ws.learn_alias("우리상사", "p19", "a") is True
    assert ws.learn_alias("우리상사", "p20", "b") is False          # 먼저 배운 것이 남는다
    assert ws.aliases()["우리상사"]["person_id"] == "p19"
    assert ws.forget_alias("우리상사") is True and ws.aliases() == {}


def test_roster_roundtrip_and_imports(tmp_path):
    ws = Workspace(tmp_path)
    ws.init()
    r = Roster()
    r.add("김정호", "1구역", "H01")
    ws.save_roster(r)
    assert ws.roster().find("김정호")[0].id == "p001"
    h = sha256_text("a,b,c")
    ws.append_import({"sha256": h, "filename": "w10.csv", "week": "2026-W10", "n_lines": 3, "ts": "t"})
    assert h in ws.seen_hashes() and ws.imports()[0]["week"] == "2026-W10"
    assert line_id("2026-W10", "김정호", 300000, 0) != line_id("2026-W10", "김정호", 300000, 1)
