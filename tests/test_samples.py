import json
import subprocess
import sys
from collections import Counter

from engine import pipeline as P
from engine.match import rule_match
from engine.roster import Roster
from engine.store import Workspace
from tests.conftest import ROOT

S = ROOT / "samples"


def test_generator_is_deterministic(tmp_path):
    out = subprocess.run([sys.executable, str(ROOT / "tools" / "make_samples.py"), "--out", str(tmp_path)],
                         capture_output=True, text=True)
    assert out.returncode == 0, out.stderr
    for name in ("roster.csv", "aliases.json", "answers.json", "held_lines.json", "weeks/2026-W10.csv"):
        assert (tmp_path / name).read_bytes() == (S / name).read_bytes()


def test_roster_and_weeks_rule_only(tmp_path):
    r = Roster.load(S / "roster.csv")
    assert len(r.people) == 60 and r.find_household("장동철")[0].id == "p13" and r.find_old("유정숙")[0].id == "p30"
    answers = json.loads((S / "answers.json").read_text(encoding="utf-8"))
    expect = {"2026-W10": (20, 4, 5025000), "2026-W11": (18, 4, None), "2026-W12": (16, 4, None), "2026-W13": (18, 2, None)}
    for week, (auto, held, total) in expect.items():
        ws = Workspace(tmp_path / week)
        ws.init()
        ws.save_roster(r)
        ws._write_aliases(json.loads((S / "aliases.json").read_text(encoding="utf-8")))
        text = (S / "weeks" / f"{week}.csv").read_text(encoding="utf-8-sig")
        done = list(P.import_csv(ws, text, week, "2026-03-08"))[-1]
        assert (done["summary"]["auto"], done["summary"]["held"]) == (auto, held), week
        rows = ws.lines()
        assert all(row["raw"] in answers[week] for row in rows), week
        assert all(row["person_id"] == answers[week][row["raw"]] for row in rows if row["state"] == "auto"), week
        if total:
            assert sum(row["amount"] for row in rows) == total


def test_envelopes_and_held_lines():
    env = json.loads((S / "envelopes" / "2026-W10.json").read_text(encoding="utf-8"))
    assert len(env["lines"]) == 12 and sum(l["amount"] for l in env["lines"]) == env["counted_total"] == 730000
    held = json.loads((S / "held_lines.json").read_text(encoding="utf-8"))
    assert len(held) == 30 and Counter(h["category"] for h in held) == {k: 5 for k in ("family", "company", "typo", "renamed", "kind_typo", "unknown")}
    r = Roster.load(S / "roster.csv")
    bench = Roster.from_rows([{"id": p.id, "이름": p.name, "구역": p.group,
                               "세대": ("" if p.household and not p.household.startswith("H") else p.household), "옛이름": ""} for p in r.people])
    for h in held:
        m = rule_match(h["raw"], bench, {})
        assert m.state == "held" and m.unresolved, h["raw"]           # 규칙으로 풀리면 벤치 대상이 아니다
        if h["expect"]["person_id"]:
            assert h["expect"]["person_id"] in r.by_id
