from engine.match import ModelResult, match_one, rule_match, top_similar
from engine.roster import Roster

ROSTER = Roster.from_csv_text(
    "id,이름,구역,세대,옛이름\n"
    "p01,김정호,1구역,H01,\np02,이순자,1구역,H01,\np05,박민수,1구역,H03,\np26,박민수,5구역,H20,\n"
    "p13,한수진,3구역,H07,\np27,장동현,5구역,H21,\np14,김미영,3구역,H08,\np19,김태섭,4구역,H11,\n"
    "p20,이현우,4구역,H12,\np30,최윤서,2구역,H15,최윤정\n"
)
ALIASES = {"우리상사": {"person_id": "p19", "learned": "2026-03-01T00:00:00", "from": "x"}}


def test_rule_tiers():
    assert (rule_match("김정호", ROSTER, {}).state, rule_match("김정호", ROSTER, {}).how) == ("auto", "완전일치")
    assert rule_match("김 정호", ROSTER, {}).how == "띄어쓰기"
    assert rule_match("金정호", ROSTER, {}).how == "한자표기"
    assert rule_match("우리상사", ROSTER, ALIASES).how == "별칭사전"
    m = rule_match("이순자십일조", ROSTER, {})
    assert (m.state, m.how, m.kind, m.person_id) == ("auto", "종류분리", "십일조", "p02")
    assert rule_match("최윤정", ROSTER, {}).how == "옛이름"
    m = rule_match("김정오", ROSTER, {})                       # 받침 하나 → 유사도
    assert m.state == "auto" and m.how.startswith("유사도 0.") and m.person_id == "p01"


def test_dup_is_always_held_without_new():
    m = rule_match("박민수", ROSTER, {})
    assert (m.state, m.reason, m.allow_new) == ("held", "dup", False)
    assert {c["person_id"] for c in m.cands} == {"p05", "p26"}
    m = rule_match("박민수십일조", ROSTER, {})
    assert (m.state, m.reason, m.kind) == ("held", "dup", "십일조")


def test_household_head_name_goes_to_family_queue():
    r = Roster.from_csv_text("id,이름,구역,세대,옛이름\np13,한수진,3구역,장동철,\np40,방은영,7구역,장동철,\n")
    m = rule_match("장동철", r, {})
    assert (m.state, m.reason, m.unresolved, m.allow_new, m.how) == ("held", "family", False, True, "세대주")
    assert [c["person_id"] for c in m.cands] == ["p13", "p40"] and "세대" in m.cands[0]["why"]


def test_unresolved_without_model_keeps_rule_candidates():
    m = match_one("장동철", ROSTER, {})
    assert (m.state, m.reason, m.how, m.unresolved) == ("held", "unknown", "", True)
    assert m.cands[0]["person_id"] == "p27" and len(m.cands) <= 3       # 장동현이 가장 비슷
    assert top_similar("장동철", ROSTER, 2)[0][0].id == "p27"


def test_model_ranks_candidates_but_never_auto():
    def fake(raw, cands, roster, history):
        assert raw == "장동철" and cands[0].id == "p27" and history == []
        return ModelResult(pred={"name_part": "장동철", "kind": "", "relation": "family",
                                 "candidates": [{"id": "p13", "why": "같은 세대"}, {"id": "p27", "why": "이름이 비슷함"},
                                                {"id": "p99", "why": "명부에 없음"}],
                                 "confidence": 0.6},
                           meta={"model": "fake", "wall_s": 0.1})
    m = match_one("장동철", ROSTER, {}, model=fake)
    assert m.state == "held" and m.how == "모델" and m.reason == "family"
    assert [c["person_id"] for c in m.cands] == ["p13", "p27"]           # p99 는 버린다
    assert m.model["model"] == "fake" and m.model["pred"]["relation"] == "family"
    hallucinated = lambda **k: ModelResult({"name_part": "장동철", "kind": "감사", "relation": "unknown", "candidates": [], "confidence": 0.1}, {})
    m = match_one("장동철", ROSTER, {}, model=hallucinated)
    assert m.kind == "" and m.reason == "unknown" and m.cands[0]["person_id"] == "p27"   # 지어낸 종류는 버리고 규칙 후보는 남는다


def test_model_failure_marks_reason_and_keeps_rule_candidates():
    def boom(raw, cands, roster, history):
        raise ConnectionError("no server")
    m = match_one("장동철", ROSTER, {}, model=boom)
    assert m.state == "held" and m.reason == "model_failed" and m.cands[0]["person_id"] == "p27"
    bad = ModelResult(pred={}, meta={}, error="timeout")
    m = match_one("장동철", ROSTER, {}, model=lambda **k: bad)
    assert m.reason == "model_failed" and m.model["error"] == "timeout"
