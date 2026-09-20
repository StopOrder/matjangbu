#!/usr/bin/env python3
"""맞장부 엔진 CLI.

    python3 -m engine init <작업공간> [--roster 명부.csv] [--aliases aliases.json]
    python3 -m engine import <작업공간> <은행.csv> --week 2026-W10 [--date 2026-03-08] [--url http://127.0.0.1:8107] [--no-model]
    python3 -m engine list <작업공간> [--held] [--week 2026-W10]
    python3 -m engine confirm <작업공간> <줄id> (--person p19 | --new 장동철 [--group 5구역]) [--kind 십일조]
    python3 -m engine hold|exclude <작업공간> <줄id> [--why ...]
    python3 -m engine undo <작업공간>
    python3 -m engine envelope <작업공간> --week W --date D --line "이름,종류,금액" [--line ...] [--counted 730000]
    python3 -m engine report <작업공간> week --week W | person --year Y | year --year Y
    python3 -m engine serve --model ~/models/qwen1.5b.gguf [--threads 4] [--port 8107] [--run]
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from .csvin import decode
from .model import DEFAULT_URL, health, make_model, server_command
from .pipeline import add_envelopes, confirm, exclude, hold, import_csv, undo_last
from .report import export
from .roster import Roster
from .store import Workspace


def cmd_init(a):
    ws = Workspace(a.workspace)
    ws.init()
    if a.roster:
        ws.save_roster(Roster.load(a.roster))
    if a.aliases:
        ws._write_aliases(json.loads(Path(a.aliases).read_text(encoding="utf-8")))
    print(f"작업공간: {ws.root} · 명부 {len(ws.roster().people)}명 · 별칭 {len(ws.aliases())}건")
    return 0


def cmd_import(a):
    ws = Workspace(a.workspace)
    model = None if a.no_model else make_model(a.url)
    if model and not health(a.url):
        print(f"모델 서버 {a.url} 없음 — 규칙까지만 돌리고 남은 줄은 확인 큐에 둔다")
    text = decode(Path(a.csv).read_bytes())
    for ev in import_csv(ws, text, a.week, a.date or "", Path(a.csv).name, model=model):
        if ev["event"] == "line":
            r = ev["row"]
            print(f"{r['id']}  {r['state']:<9} {r['how']:<8} {r['raw']}  {r['amount']:,}")
        elif ev["event"] == "done":
            s = ev["summary"]
            print(f"자동 {s['auto']} / 확인 {s['held']} (총 {s['n']}줄, 제외 {s['skipped']})")
        elif ev["event"] in ("skipped", "failed"):
            print(ev.get("note") or ev.get("error"))
            return 1
    return 0


def cmd_list(a):
    ws = Workspace(a.workspace)
    roster = ws.roster()
    for r in ws.lines():
        if a.held and r["state"] != "held":
            continue
        if a.week and r["week"] != a.week:
            continue
        p = roster.by_id.get(r.get("person_id") or "")
        cands = " | ".join(f"{c['person_id']} {roster.by_id[c['person_id']].name}"
                           for c in r.get("cands", []) if c["person_id"] in roster.by_id)
        print(f"{r['id']}  {r['week']}  {r['state']:<9} {r['how']:<8} {r['raw']:<12} {r['amount']:>10,}  "
              f"{p.name if p else ''}  {cands}")
    return 0


def _print(out: dict) -> int:
    print(json.dumps(out, ensure_ascii=False))
    return 0 if out.get("ok") else 1


def cmd_confirm(a):
    ws = Workspace(a.workspace)
    new_person = {"name": a.new, "group": a.group or ""} if a.new else None
    return _print(confirm(ws, a.line, person_id=a.person, new_person=new_person, kind=a.kind))


def cmd_hold(a):
    return _print(hold(Workspace(a.workspace), a.line, a.why or ""))


def cmd_exclude(a):
    return _print(exclude(Workspace(a.workspace), a.line, a.why or ""))


def cmd_undo(a):
    print(json.dumps(undo_last(Workspace(a.workspace)), ensure_ascii=False))
    return 0


def cmd_envelope(a):
    lines = []
    for s in a.line:
        name, kind, amount = (s.split(",") + ["", ""])[:3]
        lines.append({"name": name, "kind": kind, "amount": int(amount or 0)})
    out = add_envelopes(Workspace(a.workspace), a.week, a.date, lines, a.counted)
    held = sum(1 for r in out["rows"] if r["state"] == "held")
    tail = f" · 계수와 차이 {out['diff']:+,}" if out["diff"] is not None else ""
    print(f"봉투 {len(out['rows'])}줄 · 확인 {held} · 합계 {out['total']:,}{tail}")
    for e in out["errors"]:
        print("  !", e)
    return 0


def cmd_report(a):
    ws = Workspace(a.workspace)
    name, text = export(ws, a.which, week=a.week, year=a.year)
    print(f"{ws.exports / name}\n" + text.lstrip("﻿"))
    return 0


def cmd_serve(a):
    cmd = server_command(os.path.expanduser(a.model), a.threads or max(1, (os.cpu_count() or 4) // 2), a.port)
    print(cmd)
    if a.run:
        if not shutil.which("llama-server"):
            print("llama-server 가 PATH 에 없다")
            return 2
        return subprocess.call(cmd.split())
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(prog="engine", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    p = sp.add_parser("init"); p.add_argument("workspace"); p.add_argument("--roster"); p.add_argument("--aliases"); p.set_defaults(f=cmd_init)
    p = sp.add_parser("import"); p.add_argument("workspace"); p.add_argument("csv"); p.add_argument("--week", required=True)
    p.add_argument("--date", default=""); p.add_argument("--url", default=DEFAULT_URL); p.add_argument("--no-model", action="store_true"); p.set_defaults(f=cmd_import)
    p = sp.add_parser("list"); p.add_argument("workspace"); p.add_argument("--held", action="store_true"); p.add_argument("--week"); p.set_defaults(f=cmd_list)
    p = sp.add_parser("confirm"); p.add_argument("workspace"); p.add_argument("line"); p.add_argument("--person"); p.add_argument("--new")
    p.add_argument("--group"); p.add_argument("--kind"); p.set_defaults(f=cmd_confirm)
    for name, f in (("hold", cmd_hold), ("exclude", cmd_exclude)):
        p = sp.add_parser(name); p.add_argument("workspace"); p.add_argument("line"); p.add_argument("--why"); p.set_defaults(f=f)
    p = sp.add_parser("undo"); p.add_argument("workspace"); p.set_defaults(f=cmd_undo)
    p = sp.add_parser("envelope"); p.add_argument("workspace"); p.add_argument("--week", required=True); p.add_argument("--date", required=True)
    p.add_argument("--line", action="append", default=[]); p.add_argument("--counted", type=int); p.set_defaults(f=cmd_envelope)
    p = sp.add_parser("report"); p.add_argument("workspace"); p.add_argument("which", choices=["week", "person", "year"])
    p.add_argument("--week"); p.add_argument("--year", type=int); p.set_defaults(f=cmd_report)
    p = sp.add_parser("serve"); p.add_argument("--model", required=True); p.add_argument("--threads", type=int)
    p.add_argument("--port", type=int, default=8107); p.add_argument("--run", action="store_true"); p.set_defaults(f=cmd_serve)
    a = ap.parse_args(argv)
    return a.f(a) or 0


if __name__ == "__main__":
    sys.exit(main())
