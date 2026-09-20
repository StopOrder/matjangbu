import io
import json
import urllib.error

import pytest

from engine import model as M
from engine.roster import Roster

ROSTER = Roster.from_csv_text("id,이름,구역,세대,옛이름\np13,한수진,3구역,H07,\np27,장동현,5구역,H21,\np28,장미영,5구역,H21,\n")


def test_build_messages_mentions_candidates_household_and_history():
    msgs = M.build_messages("장동철", [ROSTER.by_id["p27"], ROSTER.by_id["p13"]], ROSTER,
                            [{"raw": "장동철", "person_id": "p13", "week": "2026-W08"}])
    assert msgs[0]["role"] == "system" and msgs[1]["role"] == "user"
    u = msgs[1]["content"]
    assert "장동철" in u and "p27 장동현" in u and "같은 세대: 장미영" in u and "2026-W08" in u and "십일조" in u


def test_parse_json_tolerates_wrapping():
    assert M.parse_json('결과: {"a": 1} 끝') == {"a": 1}
    assert M.parse_json("깨짐 {") == {}


class FakeResp(io.BytesIO):
    status = 200
    def __enter__(self): return self
    def __exit__(self, *a): return False


def test_rank_posts_chat_completion_with_schema(monkeypatch):
    seen = {}
    def fake_urlopen(req, timeout=0):
        seen["url"] = req.full_url
        seen["body"] = json.loads(req.data.decode("utf-8"))
        content = json.dumps({"name_part": "장동철", "kind": "", "relation": "family",
                              "candidates": [{"id": "p13", "why": "같은 세대"}], "confidence": 0.7})
        return FakeResp(json.dumps({"choices": [{"message": {"content": content}}],
                                    "timings": {"prompt_n": 300, "predicted_n": 40,
                                                "prompt_per_second": 25.0, "predicted_per_second": 5.5}}).encode())
    monkeypatch.setattr(M.urllib.request, "urlopen", fake_urlopen)
    r = M.rank("장동철", [ROSTER.by_id["p27"]], ROSTER, [], url="http://x:1")
    assert seen["url"] == "http://x:1/v1/chat/completions"
    assert seen["body"]["response_format"]["json_schema"]["schema"] == M.SCHEMA
    assert seen["body"]["temperature"] == 0 and seen["body"]["cache_prompt"] is False
    assert r.ok and r.pred["relation"] == "family" and r.meta["pp_tps"] == 25.0 and r.meta["prompt_n"] == 300


def test_rank_retries_without_schema_on_http_error(monkeypatch):
    calls = []
    def fake_urlopen(req, timeout=0):
        body = json.loads(req.data.decode("utf-8"))
        calls.append("response_format" in body)
        if "response_format" in body:
            raise urllib.error.HTTPError(req.full_url, 400, "bad", {}, io.BytesIO(b""))
        return FakeResp(json.dumps({"choices": [{"message": {"content": '{"candidates": []}'}}]}).encode())
    monkeypatch.setattr(M.urllib.request, "urlopen", fake_urlopen)
    r = M.rank("x", [], ROSTER, [], url="http://x:1")
    assert calls == [True, False] and "스키마 거부" in r.meta["note"] and r.ok


def test_rank_reports_error(monkeypatch):
    def fake_urlopen(req, timeout=0):
        raise ConnectionRefusedError("down")
    monkeypatch.setattr(M.urllib.request, "urlopen", fake_urlopen)
    r = M.rank("x", [], ROSTER, [], url="http://x:1")
    assert not r.ok and "down" in r.error
    assert M.health("http://127.0.0.1:1", timeout=1) is False
    assert "llama-server" in M.server_command("~/models/qwen.gguf", 4)
