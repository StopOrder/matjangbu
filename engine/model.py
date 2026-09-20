#!/usr/bin/env python3
"""모델 호출 — llama-server `/v1/chat/completions` 에 json_schema 로 후보 JSON 을 강제한다.

모델이 하는 일은 여기까지다: 규칙이 못 푼 입금자명 한 줄을 보고 후보 순서·근거·사유를 JSON 으로 낸다.
확정은 사람이 한다(match.py 가 모델 결과를 항상 held 로 둔다).

- `--jinja` 로 띄운 서버가 모델의 채팅 템플릿을 적용하므로 Qwen·HyperCLOVAX 어느 쪽이든 같은 메시지를 보낸다.
- `cache_prompt=False`, `temperature=0` — 줄마다 KV 캐시를 새로 열고, 같은 줄이면 같은 답(나비 label.py).
- 스키마가 거부되면(구버전 서버) 스키마 없이 한 번 더 시도하고 note 에 남긴다.
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from typing import Callable

from .hangul import KINDS
from .match import ModelResult
from .roster import Person, Roster

DEFAULT_URL = "http://127.0.0.1:8107"
N_PREDICT = 160
RELATIONS = ["family", "company", "typo", "renamed", "unknown"]

SCHEMA = {
    "type": "object",
    "properties": {
        "name_part": {"type": "string"},
        "kind": {"type": "string"},
        "relation": {"type": "string", "enum": RELATIONS},
        "candidates": {"type": "array", "maxItems": 3,
                       "items": {"type": "object",
                                 "properties": {"id": {"type": "string"}, "why": {"type": "string"}},
                                 "required": ["id", "why"]}},
        "confidence": {"type": "number"},
    },
    "required": ["name_part", "kind", "relation", "candidates", "confidence"],
}

SYSTEM = ("너는 종교단체 재정 담당자를 돕는 보조원이다. 은행 입금자명 한 줄이 신도 명부의 누구인지 "
          "후보를 가능성 높은 순으로 고르고 근거를 한 줄씩 적는다. 명부에 없는 사람을 지어내지 않는다. "
          "출력은 JSON 하나뿐이다.")


def build_messages(raw: str, cands: list[Person], roster: Roster, history: list[dict]) -> list[dict]:
    lines = [f"입금자명: {raw}", f"헌금 종류 목록: {', '.join(KINDS)}", "", "후보(명부):"]
    for p in cands:
        fam = ", ".join(q.name for q in roster.household_of(p))
        extra = f" 같은 세대: {fam}" if fam else ""
        old = f" 옛이름: {', '.join(p.old_names)}" if p.old_names else ""
        lines.append(f"- {p.id} {p.name} ({p.group or '구역 없음'}, 세대 {p.household or '-'}){extra}{old}")
    if history:
        lines.append("")
        lines.append("과거 확정 이력:")
        for h in history[-5:]:
            q = roster.by_id.get(h.get("person_id", ""))
            lines.append(f"- 「{h.get('raw', '')}」 → {h.get('person_id', '')} {q.name if q else ''} ({h.get('week', '')})")
    lines += ["",
              "할 일: 입금자명에서 이름 부분(name_part)과 헌금 종류(kind, 목록에 없으면 빈 문자열)를 갈라내고, "
              "relation 을 family(가족 명의)·company(회사 명의)·typo(오타·이표기)·renamed(개명)·unknown 중 하나로 고르고, "
              "candidates 에 후보 id 를 가능성 높은 순으로 최대 3개 넣고 why 를 한 줄씩 적어라. "
              "confidence 는 0~1. JSON 만 출력하라."]
    return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": "\n".join(lines)}]


def parse_json(text: str) -> dict:
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        return {}
    try:
        d = json.loads(m.group(0))
        return d if isinstance(d, dict) else {}
    except json.JSONDecodeError:
        return {}


def _post(url: str, body: dict, timeout: int) -> dict:
    req = urllib.request.Request(url.rstrip("/") + "/v1/chat/completions",
                                 data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def rank(raw: str, cands: list[Person], roster: Roster, history: list[dict],
         url: str = DEFAULT_URL, timeout: int = 300) -> ModelResult:
    body = {"messages": build_messages(raw, cands, roster, history), "temperature": 0,
            "max_tokens": N_PREDICT, "cache_prompt": False, "stream": False,
            "response_format": {"type": "json_schema", "json_schema": {"name": "match", "schema": SCHEMA}}}
    note = ""
    t0 = time.time()
    try:
        res = _post(url, body, timeout)
    except urllib.error.HTTPError as e:
        note = f"스키마 거부(HTTP {e.code}) → 스키마 없이 재시도"
        body.pop("response_format", None)
        t0 = time.time()
        try:
            res = _post(url, body, timeout)
        except Exception as e2:
            return ModelResult({}, {"note": note, "wall_s": round(time.time() - t0, 2)}, error=f"{note} / {e2}")
    except Exception as e:
        return ModelResult({}, {"wall_s": round(time.time() - t0, 2)}, error=str(e))

    wall = round(time.time() - t0, 2)
    content = ((res.get("choices") or [{}])[0].get("message") or {}).get("content", "")
    t = res.get("timings") or {}
    meta = {"model": res.get("model", ""), "wall_s": wall, "prompt_n": t.get("prompt_n"),
            "predicted_n": t.get("predicted_n"), "pp_tps": t.get("prompt_per_second"),
            "tg_tps": t.get("predicted_per_second"), "raw": content[:400], "note": note}
    return ModelResult(parse_json(content), meta)


def health(url: str = DEFAULT_URL, timeout: int = 5) -> bool:
    try:
        with urllib.request.urlopen(url.rstrip("/") + "/health", timeout=timeout) as r:
            return r.status == 200
    except Exception:
        return False


def make_model(url: str = DEFAULT_URL, timeout: int = 300) -> Callable[..., ModelResult]:
    def run(raw: str, cands: list[Person], roster: Roster, history: list[dict]) -> ModelResult:
        return rank(raw, cands, roster, history, url=url, timeout=timeout)
    return run


def server_command(model_path: str, threads: int, port: int = 8107) -> str:
    return (f"llama-server -m {model_path} --host 127.0.0.1 --port {port} -c 2048 -ub 128 -b 512 "
            f"-t {threads} --jinja -fa on --no-warmup")
