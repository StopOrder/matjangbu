#!/usr/bin/env python3
"""웹 서버 — 정적 사이트 + API(확인 큐·불러오기·봉투·기록) + SSE. 파이썬 표준 라이브러리만.

앱 하나, 모드 둘.
- 체험(`--demo`): 방문자마다 샌드박스 작업공간. 불러오기는 샘플 CSV 를 **실제 파이프라인**으로 돌리되 모델만
  미리 잰 기록(`recorded.json`)을 재생한다. 「지금 다시 재기」만 실제 모델을 부른다. 업로드·명부 교체는 403.
- 로컬(`--workspace`): 설치된 PC 의 화면. 작업공간 하나, 업로드·봉투·내보내기 전부 실제.

HTTP·세션·SSE·정적 서빙 뼈대는 나비(nabi-core, Apache-2.0) web/server.py 에서 가져왔다(NOTICE).
"""
from __future__ import annotations

import json
import mimetypes
import queue
import re
import secrets
import sys
import threading
import time
from dataclasses import dataclass, field
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable
from urllib.parse import parse_qs, quote, unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from engine.hangul import KINDS  # noqa: E402
from engine.match import ModelResult  # noqa: E402
from engine.model import DEFAULT_URL, health, make_model  # noqa: E402
from engine.pipeline import add_envelopes, confirm, exclude, hold, import_csv, rematch, undo_last  # noqa: E402
from engine.report import export  # noqa: E402
from engine.roster import Roster  # noqa: E402
from engine.store import Workspace  # noqa: E402
from web.demo import SessionStore  # noqa: E402

COOKIE = "mj_session"
HEADER = "X-Matjangbu-Session"
MAX_BODY = 4 * 1024 * 1024          # 은행 CSV 텍스트를 받는다
HEALTH_TTL_S = 15


@dataclass
class Config:
    site_dir: Path
    mode: str                                    # "demo" | "local"
    workspace: Path | None = None
    samples_dir: Path | None = None
    recorded_path: Path | None = None
    sessions_dir: Path | None = None
    model_url: str = DEFAULT_URL
    device: str = ""
    session_ttl_s: int = 7200
    cors_origins: list[str] = field(default_factory=list)
    model: Callable | None = None                # 주입(테스트·벤치). None 이면 make_model(model_url)
    recorded: dict = field(default_factory=dict, init=False)

    def __post_init__(self):
        self.site_dir = Path(self.site_dir).resolve()
        if self.mode == "demo":
            self.recorded = json.loads(Path(self.recorded_path).read_text(encoding="utf-8"))
            if not self.device:
                self.device = self.recorded.get("meta", {}).get("device", "")
            self.sessions_dir = Path(self.sessions_dir or (ROOT / "web" / ".sessions"))
            self.samples_dir = Path(self.samples_dir or (ROOT / "samples"))
        if self.model is None:
            self.model = make_model(self.model_url)


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def replay_model(recorded: dict) -> Callable:
    """체험용 모델 — 같은 기기에서 미리 잰 결과를 원문으로 찾아 돌려준다(여러 주차에 같은 원문이면 첫 것)."""
    table: dict[str, dict] = {}
    for key, v in recorded.get("model", {}).items():
        table.setdefault(key.split("|", 1)[1], v)

    def run(raw, cands, roster, history):
        v = table.get(raw)
        if v is None:
            return ModelResult({}, {"note": "기록에 없는 줄"}, error="기록에 없는 줄")
        return ModelResult(v["pred"], {**v["meta"], "replayed": True})
    return run


class Job:
    """한 작업 — import 또는 rematch. 이벤트는 append-only 리스트, SSE 가 커서로 읽는다."""

    def __init__(self, kind: str, token: str | None, run: Callable[["Job"], dict]):
        self.id = secrets.token_hex(6)
        self.kind = kind
        self.token = token
        self.run_fn = run
        self.state = "queued"
        self.events: list[dict] = []
        self.result: dict | None = None
        self.error = ""
        self.created = time.time()
        self.started = 0.0
        self.finished = 0.0

    def push(self, ev: dict) -> None:
        self.events.append(ev)


class Jobs:
    """모델 작업은 한 번에 하나(CPU 하나). 나머지는 줄을 선다."""

    def __init__(self):
        self._q: queue.Queue = queue.Queue()
        self._all: dict[str, Job] = {}
        self._lock = threading.Lock()
        threading.Thread(target=self._loop, daemon=True).start()

    def submit(self, job: Job) -> Job:
        with self._lock:
            self._all[job.id] = job
            for jid, j in list(self._all.items()):          # 끝난 지 10분 지난 작업은 잊는다
                if j.finished and time.time() - j.finished > 600:
                    del self._all[jid]
        self._q.put(job)
        return job

    def get(self, job_id: str) -> Job | None:
        return self._all.get(job_id)

    def position(self, job: Job) -> int:
        return sum(1 for j in self._all.values() if j.state == "queued" and j.created < job.created)

    def queued(self) -> int:
        return sum(1 for j in self._all.values() if j.state in ("queued", "running"))

    def _loop(self) -> None:
        while True:
            job = self._q.get()
            job.state, job.started = "running", time.time()
            try:
                job.result = job.run_fn(job)
                job.state = "done"
            except Exception as e:
                job.error = getattr(e, "message", None) or f"{type(e).__name__}: {e}"
                job.state = "failed"
            job.finished = time.time()


class App:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.jobs = Jobs()
        self._health_cache = (0.0, False)
        self.samples = cfg.samples_dir
        if cfg.mode == "demo":
            self.sessions = SessionStore(cfg.sessions_dir, cfg.samples_dir, ttl_s=cfg.session_ttl_s)
            self.replay = replay_model(cfg.recorded)
        else:
            self.ws = Workspace(cfg.workspace)
            self.ws.init()

    # ---------------- 세션 → 작업공간
    def workspace(self, token: str | None) -> tuple[Workspace, str | None]:
        """(작업공간, 새로 발급한 토큰 또는 None)"""
        if self.cfg.mode == "local":
            return self.ws, None
        sb = self.sessions.get(token) if token else None
        if sb is None:
            sb = self.sessions.create()
            self.seed(sb.ws)
            return sb.ws, sb.token
        return sb.ws, None

    def seed(self, ws: Workspace) -> None:
        """새 샌드박스에 첫 주차를 미리 불러와 둔다(모델은 기록 재생)."""
        weeks = sorted(self.cfg.recorded.get("weeks", {}))
        if not weeks:
            return
        wk = weeks[0]
        text = (self.samples / "weeks" / f"{wk}.csv").read_text(encoding="utf-8-sig")
        for _ in import_csv(ws, text, wk, self.cfg.recorded["weeks"][wk].get("date", ""), f"{wk}.csv", model=self.replay):
            pass

    def model_alive(self) -> bool:
        t, ok = self._health_cache
        if time.time() - t > HEALTH_TTL_S:
            ok = health(self.cfg.model_url, timeout=2)
            self._health_cache = (time.time(), ok)
        return ok

    def health(self) -> dict:
        return {"mode": self.cfg.mode, "device": self.cfg.device, "model_url": self.cfg.model_url,
                "model_alive": self.model_alive(), "queued": self.jobs.queued(),
                "sessions": (len(self.sessions) if self.cfg.mode == "demo" else 1),
                "recorded": self.cfg.recorded.get("meta") if self.cfg.mode == "demo" else None}

    # ---------------- 조회
    @staticmethod
    def _view(r: dict, roster: Roster) -> dict:
        p = roster.by_id.get(r.get("person_id") or "")
        cands = [{**c, "name": roster.by_id[c["person_id"]].name, "group": roster.by_id[c["person_id"]].group}
                 for c in (r.get("cands") or []) if c.get("person_id") in roster.by_id]
        return {**r, "name": p.name if p else "", "group": p.group if p else "", "cands": cands}

    def state(self, ws: Workspace, week: str | None) -> dict:
        roster, lines = ws.roster(), ws.lines()
        weeks = sorted({r["week"] for r in lines})
        cur = week or (weeks[-1] if weeks else "")
        demo = self.cfg.mode == "demo"
        avail = [w for w in sorted(self.cfg.recorded.get("weeks", {})) if w not in weeks] if demo else []
        return {"mode": self.cfg.mode, "week": cur, "weeks": weeks, "weeks_available": avail,
                "lines": [self._view(r, roster) for r in lines if r["week"] == cur],
                "all_count": len(lines), "roster": [p.public() for p in roster.people], "aliases": ws.aliases(),
                "kinds": KINDS, "device": self.cfg.device, "model_alive": self.model_alive(),
                "recorded": self.cfg.recorded.get("meta") if demo else None,
                "answers": self.cfg.recorded.get("answers", {}).get(cur, {}) if demo else {},
                "can_undo": any(r.get("human") for r in lines)}

    # ---------------- 작업(모델)
    def submit_import(self, ws: Workspace, token: str | None, body: dict) -> Job:
        if self.cfg.mode == "demo":
            if "csv_text" in body or "sample_week" not in body:
                raise ApiError(403, "체험에서는 파일을 올릴 수 없다 — 샘플 주차를 고른다")
            wk = body.get("sample_week", "")
            if wk not in self.cfg.recorded.get("weeks", {}):
                raise ApiError(400, f"샘플 주차가 아니다: {wk}")
            text = (self.samples / "weeks" / f"{wk}.csv").read_text(encoding="utf-8-sig")
            date, filename, model = self.cfg.recorded["weeks"][wk].get("date", ""), f"{wk}.csv", self.replay
        else:
            wk, date = body.get("week", ""), body.get("date", "")
            filename, text = body.get("filename") or "upload.csv", body.get("csv_text", "")
            if not wk or not text:
                raise ApiError(400, "week 와 csv_text 가 필요하다")
            safe = re.sub(r"[^\w.\-가-힣]", "_", Path(filename).name) or "upload.csv"
            (ws.inbox / safe).write_text(text, encoding="utf-8")
            model = self.cfg.model

        def run(job: Job) -> dict:
            last: dict = {}
            for ev in import_csv(ws, text, wk, date, filename, model=model):
                if ev.get("event") == "line":
                    ev = {**ev, "row": self._view(ev["row"], ws.roster())}
                job.push(ev)
                last = ev
            if last.get("event") in ("failed", "skipped"):
                raise ApiError(400, last.get("error") or last.get("note", ""))
            return last.get("summary", {})
        return self.jobs.submit(Job("import", token, run))

    def submit_rematch(self, ws: Workspace, token: str | None, line_id: str) -> Job:
        row = ws.get(line_id)
        if row is None:
            raise ApiError(404, "대장에 없다")
        if row.get("state") != "held":
            raise ApiError(409, "확인 필요 상태의 줄만 다시 잰다")

        def run(job: Job) -> dict:
            out = rematch(ws, line_id, self.cfg.model)
            if not out.get("ok"):
                raise ApiError(out.get("status", 400), out.get("error", ""))
            job.push({"event": "line", "row": self._view(out["row"], ws.roster())})
            return {"id": line_id}
        return self.jobs.submit(Job("rematch", token, run))

    # ---------------- 사람 손
    @staticmethod
    def _ok(out: dict) -> dict:
        if not out.get("ok"):
            raise ApiError(out.get("status", 400), out.get("error", ""))
        return out

    def confirm(self, ws: Workspace, line_id: str, body: dict) -> dict:
        return self._ok(confirm(ws, line_id, body.get("person_id"), body.get("new_person"), body.get("kind")))

    def hold(self, ws: Workspace, line_id: str, body: dict) -> dict:
        return self._ok(hold(ws, line_id, body.get("why", "")))

    def exclude(self, ws: Workspace, line_id: str, body: dict) -> dict:
        return self._ok(exclude(ws, line_id, body.get("why", "")))

    def undo(self, ws: Workspace) -> dict:
        u = undo_last(ws)
        if u is None:
            raise ApiError(400, "되돌릴 것이 없다")
        return {"ok": True, **u}

    def envelope(self, ws: Workspace, body: dict) -> dict:
        if not body.get("week") or not body.get("date"):
            raise ApiError(400, "week 와 date 가 필요하다")
        out = add_envelopes(ws, body["week"], body["date"], body.get("lines") or [], body.get("counted_total"))
        roster = ws.roster()
        return {**out, "rows": [self._view(r, roster) for r in out["rows"]]}

    def export(self, ws: Workspace, which: str, week: str | None, year: str | None) -> tuple[str, str]:
        if which == "week" and not week:
            raise ApiError(400, "week 가 필요하다")
        if which in ("person", "year") and not year:
            raise ApiError(400, "year 가 필요하다")
        return export(ws, which, week=week, year=int(year) if year else None)

    def roster_replace(self, ws: Workspace, body: dict) -> dict:
        if self.cfg.mode == "demo":
            raise ApiError(403, "체험에서는 명부를 바꿀 수 없다")
        new = Roster.from_csv_text(body.get("csv_text", ""))
        if not new.people:
            raise ApiError(400, "명부가 비어 있다(열: id,이름,구역,세대,옛이름)")
        old = ws.roster()
        for p in new.people:                                   # 같은 이름·구역이면 기존 id 유지
            m = [q for q in old.find(p.name) if q.group == p.group]
            if m and not p.id:
                p.id = m[0].id
        ws.save_roster(Roster.from_rows([p.row() for p in new.people]))
        return {"ok": True, "count": len(new.people)}

    def reset(self, token: str | None) -> tuple[dict, str]:
        if self.cfg.mode != "demo":
            raise ApiError(400, "로컬 모드에는 reset 이 없다")
        if token:
            self.sessions.drop(token)
        sb = self.sessions.create()
        self.seed(sb.ws)
        return {"ok": True}, sb.token


_ROUTES = [
    ("GET", re.compile(r"^/api/health$"), "health"),
    ("GET", re.compile(r"^/api/state$"), "state"),
    ("POST", re.compile(r"^/api/import$"), "import"),
    ("GET", re.compile(r"^/api/jobs/(?P<id>[0-9a-f]+)/events$"), "events"),
    ("GET", re.compile(r"^/api/jobs/(?P<id>[0-9a-f]+)$"), "job"),
    ("POST", re.compile(r"^/api/lines/(?P<id>[0-9a-f]+)/confirm$"), "confirm"),
    ("POST", re.compile(r"^/api/lines/(?P<id>[0-9a-f]+)/hold$"), "hold"),
    ("POST", re.compile(r"^/api/lines/(?P<id>[0-9a-f]+)/exclude$"), "exclude"),
    ("POST", re.compile(r"^/api/lines/(?P<id>[0-9a-f]+)/rematch$"), "rematch"),
    ("POST", re.compile(r"^/api/envelope$"), "envelope"),
    ("POST", re.compile(r"^/api/undo$"), "undo"),
    ("POST", re.compile(r"^/api/reset$"), "reset"),
    ("GET", re.compile(r"^/api/export/(?P<which>week|person|year)\.csv$"), "export"),
    ("POST", re.compile(r"^/api/roster$"), "roster"),
]

_NO_CACHE = {".html", ".json", ".css", ".js"}


class Handler(BaseHTTPRequestHandler):
    server: "Server"
    protocol_version = "HTTP/1.0"

    # ---------------- 진입
    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def do_OPTIONS(self):                                    # CORS 프리플라이트 — 허용 origin 에만
        if not self._cors_origin():
            self.send_response(403)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", f"Content-Type, {HEADER}")
        self.send_header("Access-Control-Max-Age", "86400")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _cors_origin(self) -> str | None:
        headers = getattr(self, "headers", None)
        origin = headers.get("Origin") if headers else None
        return origin if origin and origin in self.server.app.cfg.cors_origins else None

    def end_headers(self):                                   # 모든 응답(JSON·SSE·정적·오류)에 같은 CORS 헤더
        origin = self._cors_origin()
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Expose-Headers", f"{HEADER}, Content-Disposition")
            self.send_header("Vary", "Origin")
        super().end_headers()

    def _dispatch(self, method: str) -> None:
        path = urlsplit(self.path).path
        api = path[4:] if path.startswith("/try/api/") else path
        if api.startswith("/api/"):
            self._api(method, api)
            return
        if method != "GET":
            self._send_json(405, {"ok": False, "error": "GET 만"})
            return
        self._static(unquote(path))

    # ---------------- API
    def _api(self, method: str, path: str) -> None:
        for m, rx, name in _ROUTES:
            mt = rx.match(path)
            if not mt:
                continue
            if m != method:
                self._send_json(405, {"ok": False, "error": f"{m} 만"})
                return
            try:
                getattr(self, "_r_" + name)(**mt.groupdict())
            except ApiError as e:
                self._send_json(e.status, {"ok": False, "error": e.message})
            except (BrokenPipeError, ConnectionResetError):
                pass
            except Exception as e:                       # 예상 못 한 것 — 500 으로 이유를 남긴다
                self.log_error("500 %s %s: %r", method, path, e)
                self._send_json(500, {"ok": False, "error": f"{type(e).__name__}: {e}"})
            return
        self._send_json(404, {"ok": False, "error": "없는 API"})

    def _query(self) -> dict[str, str]:
        return {k: v[0] for k, v in parse_qs(urlsplit(self.path).query).items() if v}

    def _token(self) -> str | None:
        """세션 토큰 — 헤더 → 쿼리 → 쿠키 순. 정적 호스팅에서 온 방문자는 제3자 쿠키가 막힐 수 있어 헤더로 되돌려 준다."""
        h = (self.headers.get(HEADER) or "").strip()
        if h:
            return h
        q = self._query().get("session", "").strip()
        if q:
            return q
        raw = self.headers.get("Cookie")
        if not raw:
            return None
        c = SimpleCookie()
        try:
            c.load(raw)
        except Exception:
            return None
        return c[COOKIE].value if COOKIE in c else None

    def _ws(self) -> tuple[Workspace, str | None, str | None]:
        """(작업공간, 지금 세션 토큰, 새로 발급한 토큰)"""
        token = self._token()
        ws, fresh = self.server.app.workspace(token)
        return ws, (fresh or token), fresh

    def _body(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            raise ApiError(413, "본문이 너무 크다")
        raw = self.rfile.read(n) if n else b""
        if not raw.strip():
            return {}
        try:
            body = json.loads(raw)
        except ValueError:
            raise ApiError(400, "JSON 이 아니다")
        if not isinstance(body, dict):
            raise ApiError(400, "JSON 객체여야 한다")
        return body

    def _r_health(self):
        self._send_json(200, self.server.app.health())

    def _r_state(self):
        ws, _, fresh = self._ws()
        self._send_json(200, self.server.app.state(ws, self._query().get("week")), cookie=fresh)

    def _r_import(self):
        body = self._body()
        ws, token, fresh = self._ws()
        app = self.server.app
        job = app.submit_import(ws, token, body)
        self._send_json(202, {"ok": True, "job": job.id, "position": app.jobs.position(job)}, cookie=fresh)

    def _r_rematch(self, id):
        self._body()
        ws, token, fresh = self._ws()
        app = self.server.app
        job = app.submit_rematch(ws, token, id)
        self._send_json(202, {"ok": True, "job": job.id, "position": app.jobs.position(job)}, cookie=fresh)

    def _r_confirm(self, id):
        body = self._body()
        ws, _, fresh = self._ws()
        self._send_json(200, self.server.app.confirm(ws, id, body), cookie=fresh)

    def _r_hold(self, id):
        body = self._body()
        ws, _, fresh = self._ws()
        self._send_json(200, self.server.app.hold(ws, id, body), cookie=fresh)

    def _r_exclude(self, id):
        body = self._body()
        ws, _, fresh = self._ws()
        self._send_json(200, self.server.app.exclude(ws, id, body), cookie=fresh)

    def _r_envelope(self):
        body = self._body()
        ws, _, fresh = self._ws()
        self._send_json(200, self.server.app.envelope(ws, body), cookie=fresh)

    def _r_undo(self):
        self._body()
        ws, _, fresh = self._ws()
        self._send_json(200, self.server.app.undo(ws), cookie=fresh)

    def _r_reset(self):
        self._body()
        out, token = self.server.app.reset(self._token())
        self._send_json(200, out, cookie=token)

    def _r_roster(self):
        body = self._body()
        ws, _, fresh = self._ws()
        self._send_json(200, self.server.app.roster_replace(ws, body), cookie=fresh)

    def _r_export(self, which):
        ws, _, _ = self._ws()
        q = self._query()
        name, text = self.server.app.export(ws, which, q.get("week"), q.get("year"))
        data = text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{quote(name)}")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _job(self, job_id: str) -> Job:
        job = self.server.app.jobs.get(job_id)
        if job is None:
            raise ApiError(404, "없는 작업(또는 10분이 지나 잊었다)")
        return job

    def _r_job(self, id):
        job = self._job(id)
        self._send_json(200, {"id": job.id, "kind": job.kind, "state": job.state,
                              "position": self.server.app.jobs.position(job), "events": len(job.events),
                              "result": job.result, "error": job.error})

    def _r_events(self, id):
        job = self._job(id)
        jobs = self.server.app.jobs
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        def send(d: dict) -> None:
            self.wfile.write(f"event: state\ndata: {json.dumps(d, ensure_ascii=False)}\n\n".encode())
            self.wfile.flush()

        cursor, last_state, beat = 0, None, time.time()
        while True:
            state = job.state
            if state != last_state and state in ("queued", "running"):
                send({"state": state, "position": jobs.position(job),
                      "elapsed_s": round(time.time() - job.started, 1) if job.started else 0})
                last_state = state
            while cursor < len(job.events):
                send({"state": job.state, **job.events[cursor]})
                cursor += 1
            if state == "done":
                send({"state": "done", "result": job.result})
                break
            if state == "failed":
                send({"state": "failed", "error": job.error})
                break
            if time.time() - beat > 10:
                self.wfile.write(b": ping\n\n")
                self.wfile.flush()
                beat = time.time()
            time.sleep(0.3)

    # ---------------- 정적
    def _static(self, path: str) -> None:
        site = self.server.app.cfg.site_dir
        parts = [p for p in path.split("/") if p]
        if any(p in ("..", ".") or p.startswith("..") for p in parts):
            self._send_json(404, {"ok": False, "error": "없는 경로"})
            return
        target = site.joinpath(*parts) if parts else site
        try:
            resolved = target.resolve()
            resolved.relative_to(site)
        except (ValueError, OSError):
            self._send_json(404, {"ok": False, "error": "없는 경로"})
            return
        if resolved.is_dir():
            resolved = resolved / "index.html"
        if not resolved.is_file():
            self.send_response(404)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write("없는 페이지\n".encode())
            return
        ctype, _ = mimetypes.guess_type(str(resolved))
        ctype = ctype or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/json", "application/javascript"):
            ctype += "; charset=utf-8"
        data = resolved.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache" if resolved.suffix in _NO_CACHE else "max-age=3600")
        self.end_headers()
        self.wfile.write(data)

    # ---------------- 응답
    def _send_json(self, status: int, body: dict, cookie: str | None = None) -> None:
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        if cookie:
            self.send_header("Set-Cookie", f"{COOKIE}={cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400")
            self.send_header(HEADER, cookie)
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):                   # 정적·이벤트 스트림은 조용히
        if self.server.quiet or "/events" in self.path or not self.path.split("?")[0].startswith("/api/"):
            return
        sys.stderr.write("%s  %s\n" % (time.strftime("%H:%M:%S"), fmt % args))


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, addr, app: App, quiet: bool = True):
        super().__init__(addr, Handler)
        self.app = app
        self.quiet = quiet


def make_server(cfg: Config, host: str = "127.0.0.1", port: int = 8108, quiet: bool = True) -> Server:
    mimetypes.add_type("application/javascript", ".js")
    return Server((host, port), App(cfg), quiet=quiet)
