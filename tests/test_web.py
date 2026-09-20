import json
import threading
import urllib.error
import urllib.request
from http.client import HTTPConnection

import pytest

from engine.match import ModelResult
from tests.conftest import ROOT
from web.server import Config, make_server

S = ROOT / "samples"


def fake_model(raw, cands, roster, history):
    return ModelResult({"name_part": raw, "kind": "", "relation": "company" if "상사" in raw else "unknown",
                        "candidates": [{"id": cands[0].id, "why": "테스트"}] if cands else [], "confidence": 0.4},
                       {"model": "fake", "wall_s": 0.01, "prompt_n": 10, "pp_tps": 1.0, "tg_tps": 1.0})


@pytest.fixture(scope="module")
def recorded():
    """기록은 record.py 가 만드는 것이지만 테스트는 가짜 모델로 같은 규격을 직접 만든다."""
    from web.record import build_recorded
    return build_recorded(S, fake_model, device="테스트", model_name="fake", threads=1, url="")


@pytest.fixture()
def srv(tmp_path, recorded):
    rec = tmp_path / "recorded.json"
    rec.write_text(json.dumps(recorded, ensure_ascii=False), encoding="utf-8")
    cfg = Config(site_dir=ROOT / "site", mode="demo", samples_dir=S, recorded_path=rec,
                 sessions_dir=tmp_path / "sessions", device="테스트", cors_origins=["https://stoporder.github.io"], model=fake_model)
    s = make_server(cfg, port=0)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()
    yield s
    s.shutdown()


def api(srv, method, path, body=None, token=None):
    c = HTTPConnection("127.0.0.1", srv.server_address[1], timeout=10)
    headers = {"Content-Type": "application/json"}
    if token:
        headers["X-Matjangbu-Session"] = token
    c.request(method, path, body=json.dumps(body).encode() if body is not None else None, headers=headers)
    r = c.getresponse()
    data = r.read()
    tok = r.getheader("X-Matjangbu-Session")
    return r.status, (json.loads(data) if r.getheader("Content-Type", "").startswith("application/json") else data), tok


def events(srv, job_id, tok):
    req = urllib.request.Request(f"http://127.0.0.1:{srv.server_address[1]}/api/jobs/{job_id}/events",
                                 headers={"X-Matjangbu-Session": tok} if tok else {})
    return urllib.request.urlopen(req, timeout=20).read().decode()


def test_health_and_state_seed_w10(srv):
    st, h, _ = api(srv, "GET", "/api/health")
    assert st == 200 and h["mode"] == "demo" and h["device"] == "테스트"
    st, s, tok = api(srv, "GET", "/api/state")
    assert st == 200 and tok and s["week"] == "2026-W10" and len(s["roster"]) == 60
    rows = s["lines"]
    assert sum(r["state"] == "auto" for r in rows) == 20 and sum(r["state"] == "held" for r in rows) == 4
    assert all("name" in r for r in rows) and s["weeks_available"] == ["2026-W11", "2026-W12", "2026-W13"]
    st2, s2, tok2 = api(srv, "GET", "/api/state")
    assert tok2 != tok                                         # 세션 격리


def test_confirm_then_import_next_week_uses_alias(srv):
    _, s, tok = api(srv, "GET", "/api/state")
    company = next(r for r in s["lines"] if r["raw"] == "우리상사")
    st, out, _ = api(srv, "POST", f"/api/lines/{company['id']}/confirm", {"person_id": "p19"}, tok)
    assert st == 200 and out["ok"] and out["alias_learned"] == "우리상사"
    st, job, _ = api(srv, "POST", "/api/import", {"sample_week": "2026-W11"}, tok)
    assert st == 202 and job["job"]
    ev = events(srv, job["job"], tok)
    assert "event: state" in ev and '"done"' in ev
    _, s, _ = api(srv, "GET", "/api/state?week=2026-W11", token=tok)
    nxt = next(r for r in s["lines"] if r["raw"] == "우리상사")
    assert (nxt["state"], nxt["how"]) == ("auto", "별칭사전")
    st, _, _ = api(srv, "POST", f"/api/lines/{company['id']}/confirm", {"person_id": "p19"}, tok)
    assert st == 409


def test_envelope_export_undo_reset(srv):
    _, s, tok = api(srv, "GET", "/api/state")
    st, out, _ = api(srv, "POST", "/api/envelope", {"week": "2026-W10", "date": "2026-03-08", "counted_total": 150000,
                                                     "lines": [{"name": "김정호", "kind": "십일조", "amount": 100000},
                                                               {"name": "박민수", "kind": "", "amount": 50000}]}, tok)
    assert st == 200 and out["total"] == 150000 and out["diff"] == 0 and [r["state"] for r in out["rows"]] == ["confirmed", "held"]
    st, body, _ = api(srv, "GET", "/api/export/week.csv?week=2026-W10", token=tok)
    assert st == 200 and body.decode("utf-8-sig").startswith("이름,")
    st, _, _ = api(srv, "POST", "/api/undo", {}, tok)
    assert st == 400                                             # 아직 사람 손 전이가 없다
    dup = next(r for r in out["rows"] if r["raw"] == "박민수")
    st, c, _ = api(srv, "POST", f"/api/lines/{dup['id']}/confirm", {"person_id": "p05"}, tok)
    assert st == 200 and c["ok"]
    st, u, _ = api(srv, "POST", "/api/undo", {}, tok)
    assert st == 200 and u["id"] == dup["id"]
    st, r, tok2 = api(srv, "POST", "/api/reset", {}, tok)
    assert st == 200 and tok2 and tok2 != tok                    # 새 샌드박스, 새 토큰
    _, s2, _ = api(srv, "GET", "/api/state", token=tok2)
    assert all(r["path"] == "csv" for r in s2["lines"])


def test_rematch_streams_and_rejects_auto(srv):
    _, s, tok = api(srv, "GET", "/api/state")
    held = next(r for r in s["lines"] if r["raw"] == "김보라")
    st, job, _ = api(srv, "POST", f"/api/lines/{held['id']}/rematch", {}, tok)
    assert st == 202
    ev = events(srv, job["job"], tok)
    assert '"done"' in ev and "모델" in ev
    auto = next(r for r in s["lines"] if r["raw"] == "김정호")
    st, _, _ = api(srv, "POST", f"/api/lines/{auto['id']}/rematch", {}, tok)
    assert st == 409


def test_static_cors_and_demo_forbids_upload(srv):
    port = srv.server_address[1]
    for path in ("/", "/try/", "/download/", "/phone/"):
        r = urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=5)
        assert r.status == 200 and b"<h1" in r.read()
    with pytest.raises(urllib.error.HTTPError) as e:
        urllib.request.urlopen(f"http://127.0.0.1:{port}/../pytest.ini", timeout=5)
    assert e.value.code == 404
    req = urllib.request.Request(f"http://127.0.0.1:{port}/api/health", method="OPTIONS",
                                 headers={"Origin": "https://stoporder.github.io", "Access-Control-Request-Method": "POST"})
    r = urllib.request.urlopen(req, timeout=5)
    assert r.headers["Access-Control-Allow-Origin"] == "https://stoporder.github.io"
    _, s, tok = api(srv, "GET", "/api/state")
    st, _, _ = api(srv, "POST", "/api/import", {"week": "2026-W14", "date": "", "filename": "x.csv", "csv_text": "a,b,1"}, tok)
    assert st == 403
    st, _, _ = api(srv, "POST", "/api/roster", {"csv_text": "id,이름\n,x"}, tok)
    assert st == 403


def test_local_mode_imports_text(tmp_path):
    ws = tmp_path / "교회"
    cfg = Config(site_dir=ROOT / "site", mode="local", workspace=ws, model=fake_model)
    s = make_server(cfg, port=0)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    try:
        st, out, _ = api(s, "POST", "/api/roster", {"csv_text": (S / "roster.csv").read_text(encoding="utf-8-sig")})
        assert st == 200 and out["count"] == 60
        st, job, _ = api(s, "POST", "/api/import", {"week": "2026-W10", "date": "2026-03-08", "filename": "w10.csv",
                                                    "csv_text": (S / "weeks" / "2026-W10.csv").read_text(encoding="utf-8-sig")})
        assert st == 202
        events(s, job["job"], None)
        _, st_, _ = api(s, "GET", "/api/state")
        assert len(st_["lines"]) == 24 and (ws / "들어옴" / "w10.csv").exists()
    finally:
        s.shutdown()
