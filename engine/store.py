#!/usr/bin/env python3
"""작업공간과 대장 — 단체 하나가 폴더 하나다.

    <작업공간>/
      명부.csv              id,이름,구역,세대,옛이름   ← 사람이 엑셀로 편집
      들어옴/               은행 CSV 를 넣는 곳
      내보내기/             주간·개인별·연말 CSV
      .matjangbu/
        aliases.json        정규화한 원문 → {person_id, learned, from}
        lines.jsonl         줄 대장 append-only — 나중 줄이 이긴다
        imports.jsonl       불러온 CSV 대장(sha256) — 같은 내용은 다시 넣지 않는다

대장은 지우지 않는다. 상태 변화는 새 줄을 덧붙이는 것이고, 되돌리기도 새 줄이다(나비 store.py 방식).
"""
from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from pathlib import Path

from .roster import Roster

META = ".matjangbu"
LINES = "lines.jsonl"
IMPORTS = "imports.jsonl"
ALIASES = "aliases.json"
STATES = ("auto", "held", "confirmed", "excluded")


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def line_id(week: str, raw: str, amount: int, n: int) -> str:
    return hashlib.sha256(f"{week}|{raw}|{amount}|{n}".encode("utf-8")).hexdigest()[:12]


@dataclass
class Workspace:
    root: Path

    def __post_init__(self):
        self.root = Path(self.root).expanduser().resolve()

    # ---------------- 경로
    @property
    def roster_path(self) -> Path:
        return self.root / "명부.csv"

    @property
    def inbox(self) -> Path:
        return self.root / "들어옴"

    @property
    def exports(self) -> Path:
        return self.root / "내보내기"

    @property
    def meta(self) -> Path:
        return self.root / META

    def init(self) -> None:
        for p in (self.inbox, self.exports, self.meta):
            p.mkdir(parents=True, exist_ok=True)
        if not self.roster_path.exists():
            Roster().save(self.roster_path)
        if not (self.meta / ALIASES).exists():
            self._write_aliases({})

    # ---------------- 명부
    def roster(self) -> Roster:
        return Roster.load(self.roster_path) if self.roster_path.exists() else Roster()

    def save_roster(self, r: Roster) -> None:
        r.save(self.roster_path)

    # ---------------- 별칭 사전
    def aliases(self) -> dict[str, dict]:
        p = self.meta / ALIASES
        if not p.exists():
            return {}
        return json.loads(p.read_text(encoding="utf-8"))

    def _write_aliases(self, d: dict) -> None:
        self.meta.mkdir(parents=True, exist_ok=True)
        (self.meta / ALIASES).write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")

    def learn_alias(self, key: str, person_id: str, from_line: str) -> bool:
        """사람이 확인 큐에서 고른 답은 별칭이 되어 다음 주 1단에서 끝난다. 이미 있으면 그대로 둔다."""
        d = self.aliases()
        if not key or not person_id or key in d:
            return False
        d[key] = {"person_id": person_id, "learned": now(), "from": from_line}
        self._write_aliases(d)
        return True

    def forget_alias(self, key: str) -> bool:
        d = self.aliases()
        if key not in d:
            return False
        del d[key]
        self._write_aliases(d)
        return True

    # ---------------- 대장 (append only)
    def _append(self, name: str, row: dict) -> None:
        self.meta.mkdir(parents=True, exist_ok=True)
        with (self.meta / name).open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    def _read(self, name: str) -> list[dict]:
        p = self.meta / name
        if not p.exists():
            return []
        return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]

    def append_line(self, row: dict) -> None:
        self._append(LINES, row)

    def raw_lines(self) -> list[dict]:
        return self._read(LINES)

    def lines(self) -> list[dict]:
        """대장을 접어 현재 상태를 만든다. 나중 줄이 이기고, 순서는 첫 등장 순이다."""
        cur: dict[str, dict] = {}
        for row in self.raw_lines():
            i = row.get("id")
            if not i:
                continue
            cur[i] = {**cur[i], **row} if i in cur else dict(row)
        return list(cur.values())

    def get(self, line_id_: str) -> dict | None:
        for r in self.lines():
            if r["id"] == line_id_:
                return r
        return None

    def append_import(self, row: dict) -> None:
        self._append(IMPORTS, row)

    def imports(self) -> list[dict]:
        return self._read(IMPORTS)

    def seen_hashes(self) -> set[str]:
        return {r["sha256"] for r in self.imports() if r.get("sha256")}
