#!/usr/bin/env python3
"""파이프라인 — CSV → 3단 대조 → 대장 → (사람) 확정·보류·제외·되돌리기 → 별칭 학습.

불러오기는 파일을 만지지 않고 대장에 줄을 붙일 뿐이다. 확정은 사람이 한다. 사람 손이 닿은 전이는
`human: True` + `tx` + `prev` 를 가진 줄로 남고, 되돌리기는 `prev` 를 다시 덧붙이며 `undo_of: tx` 를 적는다.
"""
from __future__ import annotations

import secrets
from typing import Iterator

from .csvin import CsvError, parse_bank_csv
from .hangul import norm, strip_kind, strip_space
from .match import Match, Model, match_one, rule_match
from .store import Workspace, line_id, now, sha256_text


def line_row(m: Match, *, id: str, week: str, date: str, raw: str, amount: int, path: str) -> dict:
    return {"id": id, "week": week, "date": date, "raw": raw, "amount": int(amount), "kind": m.kind, "path": path,
            "state": m.state, "person_id": m.person_id, "how": m.how, "cands": m.cands, "reason": m.reason,
            "allow_new": m.allow_new, "model": m.model, "ts": now()}


def history_for(lines: list[dict], aliases: dict, raw: str) -> list[dict]:
    key = norm(raw)
    hist = [{"raw": r["raw"], "person_id": r["person_id"], "week": r.get("week", "")}
            for r in lines if r.get("state") == "confirmed" and r.get("person_id") and norm(r.get("raw", "")) == key]
    return hist[-5:]


def import_csv(ws: Workspace, text: str, week: str, date: str, filename: str = "",
               model: Model | None = None, skip_seen: bool = True) -> Iterator[dict]:
    ws.init()
    digest = sha256_text(text)
    if skip_seen and digest in ws.seen_hashes():
        yield {"event": "skipped", "note": "이미 불러온 파일", "sha256": digest}
        return
    try:
        parsed = parse_bank_csv(text)
    except CsvError as e:
        yield {"event": "failed", "error": str(e)}
        return
    ws.append_import({"sha256": digest, "filename": filename, "week": week, "date": date,
                      "n_lines": len(parsed.rows), "skipped": parsed.skipped, "how": parsed.how, "ts": now()})
    roster, aliases, lines = ws.roster(), ws.aliases(), ws.lines()
    n = len(parsed.rows)
    yield {"event": "start", "n": n, "skipped": parsed.skipped, "how": parsed.how}
    summary = {"auto": 0, "held": 0, "n": n, "skipped": parsed.skipped}
    for i, br in enumerate(parsed.rows):
        m = match_one(br.raw, roster, aliases, model=model, history=history_for(lines, aliases, br.raw))
        row = line_row(m, id=line_id(week, br.raw, br.amount, i), week=week, date=br.date or date,
                       raw=br.raw, amount=br.amount, path="csv")
        ws.append_line(row)
        summary[m.state] += 1
        yield {"event": "line", "i": i, "n": n, "row": row}
    yield {"event": "done", "summary": summary}


def _human(ws: Workspace, row: dict, patch: dict, note: str = "", alias_learned: str | None = None) -> dict:
    prev = {k: row.get(k) for k in ("state", "person_id", "how", "kind")}
    tx = secrets.token_hex(4)
    ws.append_line({"id": row["id"], "ts": now(), **patch, "human": True, "tx": tx, "prev": prev,
                    "alias_learned": alias_learned, "note": note})
    return {"ok": True, "id": row["id"], "tx": tx, **patch, "alias_learned": alias_learned}


def confirm(ws: Workspace, line_id_: str, person_id: str | None = None, new_person: dict | None = None,
            kind: str | None = None) -> dict:
    row = ws.get(line_id_)
    if row is None:
        return {"ok": False, "error": f"대장에 없다: {line_id_}", "status": 404}
    if row.get("state") == "confirmed":
        return {"ok": False, "error": "이미 확정된 줄이다. 먼저 되돌려라", "status": 409}
    roster = ws.roster()
    note, created = "", None
    if new_person:
        name = strip_space(new_person.get("name", ""))
        if not name:
            return {"ok": False, "error": "새 이름이 비어 있다"}
        p = roster.add(name, new_person.get("group", ""), new_person.get("household", ""))
        ws.save_roster(roster)
        person_id, note, created = p.id, "새 이름 등록", p.public()
    if not person_id or person_id not in roster.by_id:
        return {"ok": False, "error": f"명부에 없는 사람: {person_id}"}
    person = roster.by_id[person_id]
    key = norm(row["raw"])
    alias = None
    if key != strip_space(person.name) and ws.learn_alias(key, person_id, row["id"]):
        alias = key
    patch = {"state": "confirmed", "person_id": person_id, "how": "사람",
             "kind": kind if kind is not None else row.get("kind", "")}
    out = _human(ws, row, patch, note, alias)
    out["new_person"] = created
    return out


def hold(ws: Workspace, line_id_: str, why: str = "") -> dict:
    row = ws.get(line_id_)
    if row is None:
        return {"ok": False, "error": f"대장에 없다: {line_id_}", "status": 404}
    return _human(ws, row, {"state": "held", "person_id": None, "how": row.get("how", "")}, why)


def exclude(ws: Workspace, line_id_: str, why: str = "") -> dict:
    row = ws.get(line_id_)
    if row is None:
        return {"ok": False, "error": f"대장에 없다: {line_id_}", "status": 404}
    return _human(ws, row, {"state": "excluded", "person_id": None, "how": "사람"}, why)


def undo_last(ws: Workspace) -> dict | None:
    """마지막 사람 손 전이를 되돌린다. 별칭을 배웠다면 그것도 잊는다."""
    raw = ws.raw_lines()
    undone = {r["undo_of"] for r in raw if r.get("undo_of")}
    for r in reversed(raw):
        if r.get("human") and r.get("tx") and r["tx"] not in undone:
            ws.append_line({"id": r["id"], "ts": now(), **r["prev"], "human": False, "undo_of": r["tx"],
                            "note": "되돌림"})
            if r.get("alias_learned"):
                ws.forget_alias(r["alias_learned"])
            return {"id": r["id"], "undo_of": r["tx"], "restored": r["prev"]}
    return None


def add_envelopes(ws: Workspace, week: str, date: str, lines: list[dict], counted_total: int | None = None) -> dict:
    ws.init()
    roster, aliases = ws.roster(), ws.aliases()
    rows, errors, total = [], [], 0
    for i, e in enumerate(lines):
        name = strip_space(str(e.get("name", "")))
        try:
            amount = int(e.get("amount") or 0)
        except (TypeError, ValueError):
            amount = 0
        if not name:
            errors.append(f"{i + 1}번째 줄: 이름 없음")
            continue
        if amount <= 0:
            errors.append(f"{i + 1}번째 줄: 금액 없음")
            continue
        kind = str(e.get("kind") or "")
        hits = roster.find(name)
        if len(hits) == 1:
            m = Match("confirmed", hits[0].id, "사람", [], "", kind)
        else:
            m = rule_match(name, roster, aliases)
            if kind and not m.kind:
                m.kind = kind
        row = line_row(m, id=line_id(week, name, amount, 1000 + i), week=week, date=date,
                       raw=name, amount=amount, path="envelope")
        ws.append_line(row)
        rows.append(row)
        total += amount
    diff = (total - counted_total) if counted_total is not None else None
    return {"ok": True, "rows": rows, "total": total, "counted_total": counted_total, "diff": diff, "errors": errors}


def rematch(ws: Workspace, line_id_: str, model: Model) -> dict:
    row = ws.get(line_id_)
    if row is None:
        return {"ok": False, "error": f"대장에 없다: {line_id_}", "status": 404}
    if row.get("state") != "held":
        return {"ok": False, "error": "확인 필요 상태의 줄만 다시 잰다", "status": 409}
    roster, aliases = ws.roster(), ws.aliases()
    m = match_one(row["raw"], roster, aliases, model=model, history=history_for(ws.lines(), aliases, row["raw"]))
    if m.state == "auto":                        # 그새 별칭을 배웠다면 규칙이 풀 수 있다
        patch = {"state": "auto", "person_id": m.person_id, "how": m.how, "kind": m.kind or row.get("kind", "")}
    else:
        patch = {"state": "held", "person_id": None, "how": m.how, "cands": m.cands, "reason": m.reason,
                 "kind": m.kind or row.get("kind", ""), "model": m.model}
    ws.append_line({"id": row["id"], "ts": now(), **patch, "note": "다시 잼"})
    return {"ok": True, "row": ws.get(row["id"])}
