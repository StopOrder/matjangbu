from engine.roster import COLUMNS, Person, Roster

CSV = "﻿id,이름,구역,세대,옛이름\np01,김정호,1구역,H01,\np02,이순자,1구역,H01,\n,박민수,5구역,,\np05,박민수,1구역,H03,\np14,김미영,3구역,,김미숙;김보라\n"


def test_from_csv_assigns_missing_ids_and_indexes():
    r = Roster.from_csv_text(CSV)
    ids = [p.id for p in r.people]
    assert ids == ["p01", "p02", "p015", "p05", "p14"]           # 빈 id 는 최대값+1 로 채운다
    assert len(r.find("박민수")) == 2                       # 동명이인
    assert r.find("김정호")[0].household == "H01"
    assert [p.name for p in r.household_of(r.by_id["p01"])] == ["이순자"]
    assert [p.id for p in r.find_household("H01")] == ["p01", "p02"] and r.find_household("없음") == []
    assert r.find_old("김보라")[0].id == "p14"
    assert r.find("없는사람") == []


def test_add_and_roundtrip(tmp_path):
    r = Roster.from_csv_text(CSV)
    p = r.add("장동철", group="5구역", household="H09")
    assert p.id not in {"p01", "p02", "p05", "p14"} and r.find("장동철") == [p]
    path = tmp_path / "명부.csv"
    r.save(path)
    raw = path.read_bytes()
    assert raw.startswith("﻿".encode("utf-8"))
    again = Roster.load(path)
    assert [q.name for q in again.people] == [q.name for q in r.people]
    assert again.by_id["p14"].old_names == ["김미숙", "김보라"]
    assert list(again.people[0].row().keys()) == COLUMNS
