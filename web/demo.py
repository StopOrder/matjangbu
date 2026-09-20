#!/usr/bin/env python3
"""체험 샌드박스 — 방문자 한 명에 작업공간 하나.

심사위원 여럿이 동시에 `/try` 를 만진다. 확정·되돌리기가 서로 섞이면 안 되므로 방문자마다 샘플 명부와
별칭을 복사한 작업공간을 만든다. 파일 업로드는 없다(집 노트북에 남의 파일을 받지 않는다).
샌드박스는 한동안 안 쓰이면 지운다. 구조는 나비(nabi-core, Apache-2.0) web/demo.py 에서 가져왔다.
"""
from __future__ import annotations

import secrets
import shutil
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

from engine.store import ALIASES, Workspace


@dataclass
class Sandbox:
    token: str
    ws: Workspace
    created: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)

    def touch(self) -> None:
        self.last_seen = time.time()


class SessionStore:
    """샌드박스 목록. 토큰 → Sandbox. 만료·상한은 여기서 본다."""

    def __init__(self, sessions_dir: Path, samples_dir: Path, ttl_s: int = 7200, max_sessions: int = 200):
        self.dir = Path(sessions_dir)
        self.samples = Path(samples_dir)
        self.ttl_s = ttl_s
        self.max_sessions = max_sessions
        self._lock = threading.Lock()
        self._live: dict[str, Sandbox] = {}
        shutil.rmtree(self.dir, ignore_errors=True)         # 지난 실행의 찌꺼기
        self.dir.mkdir(parents=True, exist_ok=True)

    # ---------------- 만들기·찾기
    def create(self) -> Sandbox:
        with self._lock:
            self._evict_locked()
            token = secrets.token_urlsafe(18)
            ws = Workspace(self.dir / token)
            ws.init()
            shutil.copy(self.samples / "roster.csv", ws.roster_path)
            shutil.copy(self.samples / "aliases.json", ws.meta / ALIASES)
            sb = Sandbox(token=token, ws=ws)
            self._live[token] = sb
            return sb

    def get(self, token: str | None) -> Sandbox | None:
        if not token:
            return None
        with self._lock:
            sb = self._live.get(token)
            if sb is None:
                return None
            if time.time() - sb.last_seen > self.ttl_s:
                self._drop_locked(token)
                return None
            sb.touch()
            return sb

    def drop(self, token: str) -> None:
        with self._lock:
            self._drop_locked(token)

    def live(self) -> list[Sandbox]:
        with self._lock:
            return list(self._live.values())

    def __len__(self) -> int:
        return len(self._live)

    # ---------------- 정리
    def _drop_locked(self, token: str) -> None:
        sb = self._live.pop(token, None)
        if sb is not None:
            shutil.rmtree(sb.ws.root, ignore_errors=True)

    def _evict_locked(self) -> None:
        now = time.time()
        for t, sb in list(self._live.items()):
            if now - sb.last_seen > self.ttl_s:
                self._drop_locked(t)
        while len(self._live) >= self.max_sessions:
            oldest = min(self._live.values(), key=lambda s: s.last_seen)
            self._drop_locked(oldest.token)
