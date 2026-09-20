import subprocess
import sys

from tests.conftest import ROOT

S = ROOT / "samples"


def run(*args):
    return subprocess.run([sys.executable, "-m", "engine", *map(str, args)], cwd=ROOT, capture_output=True, text=True)


def test_cli_roundtrip(tmp_path):
    ws = tmp_path / "교회"
    assert run("init", ws, "--roster", S / "roster.csv", "--aliases", S / "aliases.json").returncode == 0
    out = run("import", ws, S / "weeks" / "2026-W10.csv", "--week", "2026-W10", "--date", "2026-03-08", "--no-model")
    assert out.returncode == 0 and "자동 20" in out.stdout and "확인 4" in out.stdout
    held = run("list", ws, "--held").stdout
    assert "우리상사" in held and "박민수십일조" in held
    line_id = [l for l in held.splitlines() if "우리상사" in l][0].split()[0]
    assert run("confirm", ws, line_id, "--person", "p19").returncode == 0
    rep = run("report", ws, "week", "--week", "2026-W10")
    assert rep.returncode == 0 and (ws / "내보내기" / "주간명단-2026-W10.csv").exists()
    env = run("envelope", ws, "--week", "2026-W10", "--date", "2026-03-08", "--line", "김정호,십일조,100000", "--line", "박민수,,50000")
    assert env.returncode == 0 and "확인 1" in env.stdout
    assert "llama-server" in run("serve", "--model", "~/models/qwen1.5b.gguf").stdout
