#!/usr/bin/env python3
"""명부 — 사람이 엑셀로 편집하는 `명부.csv`(id,이름,구역,세대,옛이름)와 그 색인.

- `id` 가 비어 있으면 엔진이 `p` + 숫자로 채운다(기존 최대값 + 1).
- `세대` 는 가족 묶음 문자열. 같으면 한 세대다(가족 명의 이체의 후보 근거). 세대주 이름을 적어 두면
  그 이름으로 들어온 입금이 규칙으로 가족 후보에 걸린다.
- `옛이름` 은 `;` 로 여럿(개명 이력).
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from pathlib import Path

from .hangul import strip_space

COLUMNS = ["id", "이름", "구역", "세대", "옛이름"]


@dataclass
class Person:
    id: str
    name: str
    group: str = ""
    household: str = ""
    old_names: list[str] = field(default_factory=list)

    def row(self) -> dict:
        return {"id": self.id, "이름": self.name, "구역": self.group, "세대": self.household,
                "옛이름": ";".join(self.old_names)}

    def public(self) -> dict:
        return {"id": self.id, "name": self.name, "group": self.group, "household": self.household,
                "old_names": list(self.old_names)}


class Roster:
    def __init__(self, people: list[Person] | None = None):
        self.people: list[Person] = list(people or [])
        self._index()

    def _index(self) -> None:
        self.by_id: dict[str, Person] = {}
        self.by_name: dict[str, list[Person]] = {}
        self.by_old: dict[str, list[Person]] = {}
        self.by_household: dict[str, list[Person]] = {}
        for p in self.people:
            self.by_id[p.id] = p
            self.by_name.setdefault(strip_space(p.name), []).append(p)
            for o in p.old_names:
                self.by_old.setdefault(strip_space(o), []).append(p)
            if p.household:
                self.by_household.setdefault(strip_space(p.household), []).append(p)

    # ---------------- 조회
    def find(self, name: str) -> list[Person]:
        return list(self.by_name.get(strip_space(name), []))

    def find_old(self, name: str) -> list[Person]:
        return list(self.by_old.get(strip_space(name), []))

    def household_of(self, person: Person) -> list[Person]:
        if not person.household:
            return []
        return [q for q in self.by_household.get(strip_space(person.household), []) if q.id != person.id]

    def find_household(self, label: str) -> list[Person]:
        """세대 칸이 이 값인 사람 전부. 세대 칸에 세대주 이름을 적어 두면 가족 명의 이체가 규칙으로 풀린다."""
        return list(self.by_household.get(strip_space(label), []))

    # ---------------- 변경
    def next_id(self) -> str:
        nums = [int(m.group(1)) for p in self.people if (m := re.fullmatch(r"p0*(\d+)", p.id))]
        return f"p{(max(nums) + 1) if nums else 1:03d}"

    def add(self, name: str, group: str = "", household: str = "", old_names: list[str] | None = None) -> Person:
        p = Person(self.next_id(), strip_space(name), group, household, list(old_names or []))
        self.people.append(p)
        self._index()
        return p

    # ---------------- CSV
    @classmethod
    def from_rows(cls, rows: list[dict]) -> "Roster":
        people: list[Person] = []
        used: set[str] = set()
        pending: list[Person] = []
        for r in rows:
            name = strip_space(r.get("이름", ""))
            if not name:
                continue
            old = [strip_space(x) for x in re.split(r"[;,]", r.get("옛이름", "") or "") if strip_space(x)]
            p = Person((r.get("id") or "").strip(), name, (r.get("구역") or "").strip(),
                       (r.get("세대") or "").strip(), old)
            people.append(p)
            if p.id:
                used.add(p.id)
            else:
                pending.append(p)
        ro = cls(people)
        for p in pending:                       # 비어 있던 id 를 채운다 — 순서대로, 겹치지 않게
            nid = ro.next_id()
            while nid in used:
                nid = f"p{int(nid[1:]) + 1:03d}"
            p.id = nid
            used.add(nid)
            ro._index()
        return ro

    @classmethod
    def from_csv_text(cls, text: str) -> "Roster":
        text = text.lstrip("﻿")
        return cls.from_rows(list(csv.DictReader(io.StringIO(text))))

    @classmethod
    def load(cls, path: Path) -> "Roster":
        data = Path(path).read_bytes()
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = data.decode("cp949")
        return cls.from_csv_text(text)

    def to_csv_text(self) -> str:
        buf = io.StringIO()
        w = csv.DictWriter(buf, fieldnames=COLUMNS, lineterminator="\n")
        w.writeheader()
        for p in self.people:
            w.writerow(p.row())
        return "﻿" + buf.getvalue()

    def save(self, path: Path) -> None:
        Path(path).write_text(self.to_csv_text(), encoding="utf-8")
