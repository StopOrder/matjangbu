#!/usr/bin/env python3
"""3단 대조 — 1·2단은 결정론 규칙, 3단은 주입된 모델 호출.

- 1단: 별칭 사전 → 완전 일치 → 띄어쓰기. 동명이인이면 `held/dup`(자동 확정 금지, 새 이름 등록 없음).
- 2단: 한자 이표기 → 헌금 종류 분리 → 옛 이름 → 세대주 이름 → 자모 유사도(임계 이상 + 2위와 차이).
- 3단: 남은 줄만 모델. **모델 결과는 항상 held** — 후보 순서·근거·사유만 만든다.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from .hangul import KINDS, SIM_THRESHOLD, hanja_fix, norm, sim, strip_kind, strip_space
from .roster import Person, Roster

REASON_WHY = {"dup": "명부에 같은 이름이 여럿", "family": "가족 명의로 추정", "company": "회사 명의로 추정",
              "typo": "이름이 비슷함", "renamed": "개명으로 추정", "unknown": "명부에서 찾지 못함",
              "model_failed": "모델이 응답하지 않음", "parse": "줄을 읽지 못함"}


@dataclass
class ModelResult:
    pred: dict
    meta: dict
    error: str = ""

    @property
    def ok(self) -> bool:
        return not self.error and bool(self.pred)


@dataclass
class Match:
    state: str                                   # "auto" | "held"
    person_id: str | None = None
    how: str = ""
    cands: list[dict] = field(default_factory=list)   # [{"person_id", "why"}]
    reason: str = ""
    kind: str = ""
    allow_new: bool = True
    model: dict | None = None
    unresolved: bool = False                     # 규칙이 못 풀어 3단 대상인가

    def as_dict(self) -> dict:
        return {"state": self.state, "person_id": self.person_id, "how": self.how, "cands": self.cands,
                "reason": self.reason, "kind": self.kind, "allow_new": self.allow_new, "model": self.model}


Model = Callable[..., ModelResult]


def _auto(p: Person, how: str, kind: str = "") -> Match:
    return Match("auto", p.id, how, [], "", kind)


def _dup(hits: list[Person], kind: str = "") -> Match:
    return Match("held", None, "동명이인", [{"person_id": p.id, "why": f"명부에 등록된 이름 ({p.group})"} for p in hits],
                 "dup", kind, allow_new=False)


def top_similar(name: str, roster: Roster, n: int = 5) -> list[tuple[Person, float]]:
    scored = [(p, sim(name, p.name)) for p in roster.people]
    scored.sort(key=lambda t: (-t[1], t[0].id))
    return scored[:n]


def rule_match(raw: str, roster: Roster, aliases: dict) -> Match:
    spaced = strip_space(raw)
    key = norm(raw)

    a = aliases.get(key)
    if a and a.get("person_id") in roster.by_id:
        return _auto(roster.by_id[a["person_id"]], "별칭사전")

    hits = roster.find(spaced)
    if len(hits) == 1:
        return _auto(hits[0], "완전일치" if spaced == raw else "띄어쓰기")
    if len(hits) > 1:
        return _dup(hits)

    hj = hanja_fix(spaced)
    if hj != spaced:
        hits = roster.find(hj)
        if len(hits) == 1:
            return _auto(hits[0], "한자표기")
        if len(hits) > 1:
            return _dup(hits)

    name_part, kind = strip_kind(hj)
    if kind:
        hits = roster.find(name_part)
        if len(hits) == 1:
            return _auto(hits[0], "종류분리", kind)
        if len(hits) > 1:
            return _dup(hits, kind)

    hits = roster.find_old(name_part)
    if len(hits) == 1:
        return _auto(hits[0], "옛이름", kind)
    if len(hits) > 1:
        return _dup(hits, kind)

    fam = roster.find_household(name_part)
    if fam:                                      # 세대주 이름으로 들어온 가족 명의 — 규칙으로 후보를 세운다
        return Match("held", None, "세대주", [{"person_id": p.id, "why": f"세대주 「{name_part}」 세대 ({p.group})"} for p in fam],
                     "family", kind, allow_new=True)

    ranked = top_similar(name_part, roster, 3)
    if ranked:
        best, best_s = ranked[0]
        second_s = ranked[1][1] if len(ranked) > 1 else 0.0
        if best_s >= SIM_THRESHOLD and best_s > second_s:
            return _auto(best, f"유사도 {best_s:.2f}", kind)

    cands = [{"person_id": p.id, "why": f"이름이 비슷함 (유사도 {s:.2f})"} for p, s in ranked if s > 0]
    return Match("held", None, "", cands, "unknown", kind, allow_new=True, unresolved=True)


def match_one(raw: str, roster: Roster, aliases: dict, model: Model | None = None,
              history: list[dict] | None = None) -> Match:
    m = rule_match(raw, roster, aliases)
    if not m.unresolved or model is None:
        return m

    name_part, _ = strip_kind(norm(raw))
    cands5 = [p for p, _ in top_similar(name_part, roster, 5)]
    try:
        res = model(raw=raw, cands=cands5, roster=roster, history=list(history or []))
    except Exception as e:                       # 서버 없음·시간 초과 — 파이프라인은 멈추지 않는다
        m.reason, m.model = "model_failed", {"error": f"{type(e).__name__}: {e}"}
        return m
    if not res.ok:
        m.reason, m.model = "model_failed", {**res.meta, "error": res.error or "빈 응답"}
        return m

    pred = res.pred
    out, seen = [], set()
    for c in pred.get("candidates") or []:
        pid = str(c.get("id", ""))
        if pid in roster.by_id and pid not in seen:
            out.append({"person_id": pid, "why": str(c.get("why") or REASON_WHY.get(pred.get("relation", ""), ""))})
            seen.add(pid)
    if out:
        m.cands = out[:3]
    rel = pred.get("relation", "unknown")
    m.reason = rel if rel in ("family", "company", "typo", "renamed", "unknown") else "unknown"
    k = pred.get("kind") or ""
    if k in KINDS and not m.kind:
        m.kind = k
    m.how = "모델"
    m.model = {**res.meta, "pred": pred}
    return m
