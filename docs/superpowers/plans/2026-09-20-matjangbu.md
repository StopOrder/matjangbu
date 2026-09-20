# 맞장부(matjangbu) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 헌금 이름 맞춤·기록 도우미를 나비(nabi-core)와 같은 모양으로 공개한다 — 파이썬 표준 라이브러리 엔진 + 로컬 웹앱 + GitHub Pages 제품 사이트 + 노트북 체험 인스턴스 + 갤럭시 A31 실측표.

**Architecture:** `engine/`가 명부·별칭·은행 CSV·3단 대조(규칙 2단은 결정론, 3단만 llama-server)·확인 큐·기록을 append-only 대장 위에서 처리한다. `web/`는 나비 `server.py`의 HTTP·세션·SSE·CORS 뼈대를 가져와 API만 헌금 도메인으로 바꾸고, 체험 모드는 방문자별 샌드박스를 `recorded.json`으로 즉시 채운다. `site/`는 네 경로 정적 페이지이고 `/try`는 같은 origin → meta 인스턴스 → `recorded.json` 순으로 폴백한다.

**Tech Stack:** Python 3.10+ 표준 라이브러리만(테스트는 pytest, venv), llama.cpp `llama-server`(Qwen2.5-1.5B-Instruct Q4_K_M, Apache-2.0), 바닐라 HTML/CSS/JS(외부 자원 0), GitHub Pages, Tailscale Funnel, Playwright(검증 전용, mvp-agent의 node_modules 재사용).

설계 정본: `docs/superpowers/specs/2026-09-20-matjangbu-design.md`. 참고 구현: `~/workspace/02-sandbox/nabi-core`. 정적 MVP: `~/Projects/02-hackathon/modoo-startup-2026/mvp/01-헌금이름맞춤/app`.

## Global Constraints

- 런타임 의존성 0: `engine/`·`web/`는 파이썬 표준 라이브러리만 import한다. pytest는 `.venv`에만 둔다(`.gitignore`).
- 실제 단체 자료를 한 줄도 넣지 않는다. `samples/`는 전부 `tools/make_samples.py`가 만든 가공 데이터이고 화면·랜딩에 「예시 데이터」 배지가 상시 보인다.
- 재지 않은 숫자를 사이트에 넣지 않는다. 못 잰 칸은 「예정」. 가격은 적지 않는다. 고객·후기·사용자 수를 지어내지 않는다.
- 모델 결과는 항상 `held`. 동명이인은 절대 자동 확정하지 않는다. 자동 확정 임계 `SIM_THRESHOLD = 0.85`.
- 포트: llama-server `8107`, 웹 `8108`. 쿠키 `mj_session`, 헤더 `X-Matjangbu-Session`. 작업공간 메타 폴더 `.matjangbu/`.
- 사이트: 외부 자원 0(스크립트·폰트·이미지 CDN 금지), 라이트 전용, 시스템 글꼴, 워드마크 「맞장부」(잠정명). 거북이 개인 문서 규격 금지.
- 나비 유래 코드는 `NOTICE`에 출처(Apache-2.0, Copyright 2026 Kim Jiwoo)를 적는다.
- 커밋은 작업마다 하나 이상. 메시지 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- 파일명·경로는 ASCII(샘플 CSV·내보내기 파일의 한글 이름은 작업공간 안에서만).
- 모든 CSV는 UTF-8 BOM(`utf-8-sig`)으로 쓴다. 읽을 때는 `utf-8-sig` → `cp949` 순.
- 노트북에는 llama.cpp·모델·pytest가 없다(2026-09-20 확인). Task 1과 Task 12에서 설치한다. A31에는 `llama-server`와 두 모델(`~/models/qwen1.5b.gguf`, `hyperclova1.5b.gguf`)이 있고 파이썬은 없다.

## 파일 구조

| 파일 | 책임 |
|---|---|
| `engine/hangul.py` | 자모 분해·레벤슈타인·유사도·한자 성씨 표·헌금 종류 분리·정규화 |
| `engine/roster.py` | `Person`·`Roster`(명부 CSV 읽기/쓰기·이름/옛이름/세대 색인·추가) |
| `engine/csvin.py` | 은행 CSV 파서(헤더 자동 탐지·공용 3열·인코딩·출금 제외) |
| `engine/store.py` | `Workspace`(경로·명부·별칭·`lines.jsonl`·`imports.jsonl` append-only) |
| `engine/match.py` | `Match`·`rule_match`(1·2단)·`match_one`(3단 모델 주입) |
| `engine/model.py` | llama-server 호출(`/v1/chat/completions` + json_schema)·프롬프트·파싱·health |
| `engine/pipeline.py` | `import_csv`·`confirm`·`hold`·`exclude`·`undo_last`·`add_envelopes`·`rematch` |
| `engine/report.py` | 주간 명단·개인별 누적·연말 합산·CSV 내보내기 |
| `engine/__main__.py` | CLI(`init`·`import`·`list`·`confirm`·`envelope`·`report`·`serve`) |
| `tools/make_samples.py` | 합성 명부·입금 4주·봉투·벤치 줄·정답 생성기(결정론) |
| `web/server.py` | HTTP 서버(정적+API+SSE+CORS+세션) — 나비 뼈대 |
| `web/demo.py` | 방문자 샌드박스(샘플 복사·`recorded.json` 시드·TTL) |
| `web/record.py` | 샘플 4주를 엔진 전체로 돌려 `site/try/recorded.json` 생성 |
| `web/__main__.py` | 서버 CLI(`--demo` / `--workspace`) |
| `site/assets/app.css` | 디자인 시스템(나비에서 가져와 워드마크만 교체) |
| `site/try/index.html` | 앱 화면(해시 라우팅 7화면, 삼중 폴백) |
| `site/index.html` · `site/download/index.html` · `site/phone/index.html` | 랜딩·설치·지원 기기 |
| `bench/bench.sh` · `bench/match_all.py` | 기기 실측(3단 30건, 두 모델) |
| `tools/verify_site.mjs` | Playwright: 네 경로 외부 요청 0·콘솔 에러 0·`<h1>` |
| `tests/test_*.py` | 모듈별 pytest |

---

### Task 1: 저장소 뼈대와 테스트 환경

**Files:**
- Create: `LICENSE`, `NOTICE`, `README.md`, `.gitignore`, `engine/__init__.py`, `web/__init__.py`, `tests/__init__.py`, `tests/conftest.py`, `pytest.ini`

**Interfaces:**
- Produces: `tests/conftest.py`의 `ROOT`(저장소 루트 `Path`)와 `sys.path` 삽입 — 모든 테스트가 `from engine…`으로 import한다.

- [ ] **Step 1: 파일 쓰기**

`LICENSE`: Apache License 2.0 전문(`~/workspace/02-sandbox/nabi-core/LICENSE`를 복사하고 저작권 줄만 `Copyright 2026 정지명 (Jimyeong Jeong)`으로).

`NOTICE`:
```
맞장부 (matjangbu)
Copyright 2026 정지명 (Jimyeong Jeong)

이 제품에는 나비(nabi-core, https://github.com/kingcheee/nabi-core)에서 유래한 코드가 들어 있다.
Copyright 2026 Kim Jiwoo (김지우) · Apache License 2.0
가져온 것: web/server.py 의 HTTP·세션·SSE·정적 서빙 뼈대, web/demo.py 샌드박스 구조,
engine/model.py 의 llama-server 호출 방식, engine/store.py 의 append-only 대장 방식,
site/assets/app.css 디자인 시스템, site/try/index.html 화면 골격.
```

`.gitignore`:
```
.venv/
__pycache__/
*.pyc
web/.sessions/
bench/results/*.log
.pytest_cache/
*.gguf
```

`pytest.ini`:
```ini
[pytest]
testpaths = tests
addopts = -q
```

`tests/conftest.py`:
```python
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
```

`engine/__init__.py`, `web/__init__.py`, `tests/__init__.py`: 빈 파일(`engine/__init__.py`는 `"""맞장부 엔진 — 파이썬 표준 라이브러리만."""` 한 줄).

`README.md`(초안, Task 15에서 완성):
```markdown
# 맞장부 (matjangbu) — 종교단체 헌금 이름 맞춤·기록 도우미, 온디바이스

봉투·통장에 적힌 이름을 신도 명부와 맞추고, 매주 기록하고, 연말에 합산한다. 단체 PC 안에서 끝나고 자료는 밖으로 나가지 않는다.
언어모델은 규칙이 못 푼 줄의 후보를 세우는 한 칸만 맡고, 확정은 사람이 한다.

> 시제품이다(모두의창업 시즌2 I-009). 페이지·문서의 숫자는 전부 직접 잰 값이다 — 재지 않은 숫자는 적지 않는다.
> `samples/`는 전부 가공 데이터다. 실제 단체 자료는 들어 있지 않다.
```

- [ ] **Step 2: venv와 pytest**

```bash
cd ~/Projects/03-personal/matjangbu && python3 -m venv .venv && .venv/bin/pip install -q pytest && .venv/bin/python -m pytest --version
```
Expected: `pytest 8.x`

- [ ] **Step 3: 빈 테스트로 수집 확인**

Run: `.venv/bin/python -m pytest`
Expected: `no tests ran` (수집 오류 없음)

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: 저장소 뼈대·NOTICE·pytest 환경

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `engine/hangul.py` — 자모·유사도·이표기·종류 분리

**Files:**
- Create: `engine/hangul.py`
- Test: `tests/test_hangul.py`

**Interfaces:**
- Produces: `strip_space(s)->str`, `hanja_fix(s)->str`, `norm(s)->str`, `jamo(s)->list[str]`, `lev(a,b)->int`, `sim(a,b)->float`, `strip_kind(s)->tuple[str,str]`(이름, 종류), 상수 `KINDS: list[str]`, `HANJA: dict`, `SIM_THRESHOLD = 0.85`.

- [ ] **Step 1: 실패하는 테스트**

`tests/test_hangul.py`:
```python
from engine.hangul import (HANJA, KINDS, SIM_THRESHOLD, hanja_fix, jamo, lev, norm, sim,
                           strip_kind, strip_space)


def test_strip_space_and_norm():
    assert strip_space(" 홍 길동 ") == "홍길동"
    assert hanja_fix("李순자") == "이순자"
    assert norm("金 태섭") == "김태섭"


def test_jamo_decomposes_syllables_and_keeps_others():
    assert jamo("강") == ["ㄱ", "ㅏ", "ㅇ"]
    assert jamo("가") == ["ㄱ", "ㅏ"]
    assert jamo("a1") == ["a", "1"]


def test_lev_and_sim():
    assert lev("abc", "abd") == 1
    assert sim("김정호", "김정호") == 1.0
    assert sim("김정호", "김정오") > SIM_THRESHOLD      # 받침 하나 차이
    assert sim("김정호", "박성우") < 0.5


def test_strip_kind_suffix_prefix_and_longest_first():
    assert strip_kind("박민수십일조") == ("박민수", "십일조")
    assert strip_kind("감사헌금이순자") == ("이순자", "감사헌금")
    assert strip_kind("홍길동") == ("홍길동", "")
    assert strip_kind("감사") == ("감사", "")               # 이름이 사라지면 분리하지 않는다
    assert KINDS == sorted(KINDS, key=len, reverse=True)
    assert "李" in HANJA
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_hangul.py -v`
Expected: `ModuleNotFoundError: No module named 'engine.hangul'`

- [ ] **Step 3: 구현**

`engine/hangul.py`:
```python
#!/usr/bin/env python3
"""한글 처리 — 자모 분해·레벤슈타인·유사도·한자 성씨 이표기·헌금 종류 분리. 결정론, 의존성 0.

MVP(app.js)의 jamo/lev/sim/hanjaFix/stripKind 를 그대로 옮긴 것이다.
"""
from __future__ import annotations

import re

CHO = list("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ")
JUNG = list("ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ")
JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ",
        "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]

# 한자 성씨 → 한글. 통장 입금자명에 성만 한자로 오는 경우가 있다.
HANJA = {
    "金": "김", "李": "이", "朴": "박", "崔": "최", "鄭": "정", "姜": "강", "趙": "조", "尹": "윤", "張": "장",
    "林": "임", "韓": "한", "吳": "오", "申": "신", "徐": "서", "權": "권", "黃": "황", "安": "안", "宋": "송",
    "柳": "유", "洪": "홍", "全": "전", "高": "고", "文": "문", "梁": "양", "孫": "손", "裵": "배", "曺": "조",
    "白": "백", "許": "허", "南": "남", "沈": "심", "劉": "유", "盧": "노", "河": "하", "丁": "정", "郭": "곽",
    "成": "성", "車": "차", "具": "구", "禹": "우", "朱": "주", "任": "임", "羅": "나", "辛": "신", "閔": "민",
    "兪": "유", "池": "지", "陳": "진", "嚴": "엄", "元": "원", "蔡": "채", "千": "천", "方": "방", "楊": "양",
    "孔": "공", "玄": "현", "康": "강", "咸": "함", "卞": "변", "廉": "염", "呂": "여", "秋": "추", "都": "도",
    "石": "석", "蘇": "소", "薛": "설", "宣": "선", "周": "주", "馬": "마", "魏": "위", "表": "표", "明": "명",
    "奇": "기", "王": "왕", "琴": "금", "玉": "옥", "陸": "육", "印": "인", "孟": "맹", "諸": "제", "卓": "탁",
}

# 헌금 종류 — 긴 것부터. 이름 앞뒤에 붙어 온다(「박민수십일조」「감사헌금이순자」).
KINDS = sorted([
    "십일조", "감사헌금", "주정헌금", "선교헌금", "건축헌금", "절기헌금", "특별헌금", "맥추감사", "추수감사",
    "감사", "주정", "선교", "건축", "절기", "맥추", "추수", "특별",
], key=len, reverse=True)

SIM_THRESHOLD = 0.85


def strip_space(s: str) -> str:
    return re.sub(r"\s+", "", s or "")


def hanja_fix(s: str) -> str:
    return "".join(HANJA.get(c, c) for c in s)


def norm(s: str) -> str:
    """공백 제거 + 한자 성씨 치환. 별칭 사전의 키도 이 값이다."""
    return hanja_fix(strip_space(s))


def jamo(s: str) -> list[str]:
    out: list[str] = []
    for ch in s:
        code = ord(ch) - 0xAC00
        if 0 <= code < 11172:
            out.append(CHO[code // 588])
            out.append(JUNG[(code % 588) // 28])
            if code % 28:
                out.append(JONG[code % 28])
        else:
            out.append(ch)
    return out


def lev(a, b) -> int:
    """레벤슈타인 거리. 문자열이든 자모 리스트든 시퀀스면 된다."""
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (0 if ca == cb else 1)))
        prev = cur
    return prev[-1]


def sim(a: str, b: str) -> float:
    ja, jb = jamo(a), jamo(b)
    n = max(len(ja), len(jb))
    if n == 0:
        return 1.0
    return 1.0 - lev(ja, jb) / n


def strip_kind(s: str) -> tuple[str, str]:
    """이름에 붙은 헌금 종류를 떼어 (이름, 종류)로. 이름이 2자 미만으로 남으면 떼지 않는다."""
    for k in KINDS:
        if s.endswith(k) and len(s) - len(k) >= 2:
            return s[: -len(k)], k
        if s.startswith(k) and len(s) - len(k) >= 2:
            return s[len(k):], k
    return s, ""
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_hangul.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add engine/hangul.py tests/test_hangul.py && git commit -m "feat(engine): 한글 자모·유사도·이표기·종류 분리

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `engine/roster.py` — 명부

**Files:**
- Create: `engine/roster.py`
- Test: `tests/test_roster.py`

**Interfaces:**
- Consumes: `engine.hangul.strip_space`
- Produces: `Person(id, name, group, household, old_names)` with `.row()->dict`; `Roster(people)` with `.people`, `.by_id: dict[str,Person]`, `.find(name)->list[Person]`, `.find_old(name)->list[Person]`, `.household_of(person)->list[Person]`, `.find_household(label)->list[Person]`(세대 칸이 그 값인 사람 전부), `.add(name, group="", household="", old_names=None)->Person`, `Roster.from_rows(rows)`, `Roster.from_csv_text(text)`, `Roster.load(path)`, `.to_csv_text()->str`, `.save(path)`, `COLUMNS = ["id","이름","구역","세대","옛이름"]`.

- [ ] **Step 1: 실패하는 테스트**

`tests/test_roster.py`:
```python
from engine.roster import COLUMNS, Person, Roster

CSV = "﻿id,이름,구역,세대,옛이름\np01,김정호,1구역,H01,\np02,이순자,1구역,H01,\n,박민수,5구역,,\np05,박민수,1구역,H03,\np14,김미영,3구역,,김미숙;김보라\n"


def test_from_csv_assigns_missing_ids_and_indexes():
    r = Roster.from_csv_text(CSV)
    ids = [p.id for p in r.people]
    assert ids == ["p01", "p02", "p015", "p05", "p14"]           # 빈 id 는 최대값+1 로 채운다
    assert len(r.find("박민수")) == 2                       # 동명이인
    assert r.find("김정호")[0].household == "H01"
    assert [p.name for p in r.household_of(r.by_id["p01"])] == ["이순자"]
    assert [p.id for p in r.find_household("H01")] == ["p01", "p02"] and r.find_household("없음") == []
    assert r.find_old("김보라")[0].id == "p14"
    assert r.find("없는사람") == []


def test_add_and_roundtrip(tmp_path):
    r = Roster.from_csv_text(CSV)
    p = r.add("장동철", group="5구역", household="H09")
    assert p.id not in {"p01", "p02", "p05", "p14"} and r.find("장동철") == [p]
    path = tmp_path / "명부.csv"
    r.save(path)
    raw = path.read_bytes()
    assert raw.startswith("﻿".encode("utf-8"))
    again = Roster.load(path)
    assert [q.name for q in again.people] == [q.name for q in r.people]
    assert again.by_id["p14"].old_names == ["김미숙", "김보라"]
    assert list(again.people[0].row().keys()) == COLUMNS
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_roster.py -v`
Expected: `ModuleNotFoundError`

- [ ] **Step 3: 구현**

`engine/roster.py`:
```python
#!/usr/bin/env python3
"""명부 — 사람이 엑셀로 편집하는 `명부.csv`(id,이름,구역,세대,옛이름)와 그 색인.

- `id` 가 비어 있으면 엔진이 `p` + 숫자로 채운다(기존 최대값 + 1).
- `세대` 는 가족 묶음 문자열. 같으면 한 세대다(가족 명의 이체의 후보 근거).
- `옛이름` 은 `;` 로 여럿(개명 이력).
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from pathlib import Path

from .hangul import strip_space

COLUMNS = ["id", "이름", "구역", "세대", "옛이름"]


@dataclass
class Person:
    id: str
    name: str
    group: str = ""
    household: str = ""
    old_names: list[str] = field(default_factory=list)

    def row(self) -> dict:
        return {"id": self.id, "이름": self.name, "구역": self.group, "세대": self.household,
                "옛이름": ";".join(self.old_names)}

    def public(self) -> dict:
        return {"id": self.id, "name": self.name, "group": self.group, "household": self.household,
                "old_names": list(self.old_names)}


class Roster:
    def __init__(self, people: list[Person] | None = None):
        self.people: list[Person] = list(people or [])
        self._index()

    def _index(self) -> None:
        self.by_id: dict[str, Person] = {}
        self.by_name: dict[str, list[Person]] = {}
        self.by_old: dict[str, list[Person]] = {}
        self.by_household: dict[str, list[Person]] = {}
        for p in self.people:
            self.by_id[p.id] = p
            self.by_name.setdefault(strip_space(p.name), []).append(p)
            for o in p.old_names:
                self.by_old.setdefault(strip_space(o), []).append(p)
            if p.household:
                self.by_household.setdefault(p.household, []).append(p)

    # ---------------- 조회
    def find(self, name: str) -> list[Person]:
        return list(self.by_name.get(strip_space(name), []))

    def find_old(self, name: str) -> list[Person]:
        return list(self.by_old.get(strip_space(name), []))

    def household_of(self, person: Person) -> list[Person]:
        if not person.household:
            return []
        return [q for q in self.by_household.get(person.household, []) if q.id != person.id]

    def find_household(self, label: str) -> list[Person]:
        """세대 칸이 이 값인 사람 전부. 세대 칸에 세대주 이름을 적어 두면 가족 명의 이체가 규칙으로 풀린다."""
        return list(self.by_household.get(strip_space(label), []))

    # ---------------- 변경
    def next_id(self) -> str:
        nums = [int(m.group(1)) for p in self.people if (m := re.fullmatch(r"p0*(\d+)", p.id))]
        return f"p{(max(nums) + 1) if nums else 1:03d}"

    def add(self, name: str, group: str = "", household: str = "", old_names: list[str] | None = None) -> Person:
        p = Person(self.next_id(), strip_space(name), group, household, list(old_names or []))
        self.people.append(p)
        self._index()
        return p

    # ---------------- CSV
    @classmethod
    def from_rows(cls, rows: list[dict]) -> "Roster":
        people: list[Person] = []
        used: set[str] = set()
        pending: list[Person] = []
        for r in rows:
            name = strip_space(r.get("이름", ""))
            if not name:
                continue
            old = [strip_space(x) for x in re.split(r"[;,]", r.get("옛이름", "") or "") if strip_space(x)]
            p = Person((r.get("id") or "").strip(), name, (r.get("구역") or "").strip(),
                       (r.get("세대") or "").strip(), old)
            people.append(p)
            if p.id:
                used.add(p.id)
            else:
                pending.append(p)
        ro = cls(people)
        for p in pending:                       # 비어 있던 id 를 채운다 — 순서대로, 겹치지 않게
            nid = ro.next_id()
            while nid in used:
                nid = f"p{int(nid[1:]) + 1:03d}"
            p.id = nid
            used.add(nid)
            ro._index()
        return ro

    @classmethod
    def from_csv_text(cls, text: str) -> "Roster":
        text = text.lstrip("﻿")
        return cls.from_rows(list(csv.DictReader(io.StringIO(text))))

    @classmethod
    def load(cls, path: Path) -> "Roster":
        data = Path(path).read_bytes()
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = data.decode("cp949")
        return cls.from_csv_text(text)

    def to_csv_text(self) -> str:
        buf = io.StringIO()
        w = csv.DictWriter(buf, fieldnames=COLUMNS, lineterminator="\n")
        w.writeheader()
        for p in self.people:
            w.writerow(p.row())
        return "﻿" + buf.getvalue()

    def save(self, path: Path) -> None:
        Path(path).write_text(self.to_csv_text(), encoding="utf-8")
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_roster.py -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add engine/roster.py tests/test_roster.py && git commit -m "feat(engine): 명부 CSV·색인·추가

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `engine/csvin.py` — 은행 CSV 파서

**Files:**
- Create: `engine/csvin.py`
- Test: `tests/test_csv.py`

**Interfaces:**
- Produces: `BankRow(date, raw, amount, memo)`, `Parsed(rows, skipped, how, warnings)`, `CsvError(Exception)`, `decode(data: bytes)->str`, `to_int(s)->int`, `parse_bank_csv(text)->Parsed`.

- [ ] **Step 1: 실패하는 테스트**

`tests/test_csv.py`:
```python
import pytest

from engine.csvin import CsvError, decode, parse_bank_csv, to_int

BANK = (
    "﻿거래일자,거래시간,적요,입금액,출금액,잔액,입금자명\n"
    "2026-03-08,09:10,타행이체,\"300,000\",,\"5,300,000\",김정호\n"
    "2026-03-08,09:12,체크카드,,\"12,000\",\"5,288,000\",마트\n"
    "2026-03-08,10:01,타행이체,150000,,\"5,438,000\",박민수십일조\n"
    "2026-03-08,10:05,이체,0,,\"5,438,000\",이상한줄\n"
)
PLAIN = "2026-03-08,이순자,100000\n2026-03-08,우리상사,200000\n"      # 헤더 없는 공용 3열


def test_header_detect_skips_withdrawals_and_zero():
    p = parse_bank_csv(BANK)
    assert p.how == "header"
    assert [(r.raw, r.amount) for r in p.rows] == [("김정호", 300000), ("박민수십일조", 150000)]
    assert p.skipped == 2
    assert p.rows[0].date == "2026-03-08"


def test_plain_three_columns():
    p = parse_bank_csv(PLAIN)
    assert p.how == "plain"
    assert [(r.raw, r.amount) for r in p.rows] == [("이순자", 100000), ("우리상사", 200000)]


def test_garbage_raises():
    with pytest.raises(CsvError):
        parse_bank_csv("아무것도,없음\n1,2\n")


def test_decode_and_to_int():
    assert decode("가나".encode("cp949")) == "가나"
    assert decode("﻿가나".encode("utf-8")) == "가나"
    assert to_int("1,234,567원") == 1234567 and to_int("") == 0 and to_int("-3") == -3
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_csv.py -v`
Expected: `ModuleNotFoundError`

- [ ] **Step 3: 구현**

`engine/csvin.py`:
```python
#!/usr/bin/env python3
"""은행 CSV 파서 — 형식은 은행마다 다르다. v0 는 두 벌만 받는다.

(a) header: 첫 30줄 안에서 날짜·입금자·입금액 열을 이름으로 찾는다(출금액 열이 있으면 출금 줄을 뺀다).
(b) plain : (a)가 안 되면 `날짜,입금자명,금액` 공용 3열.
출금 줄(출금액>0 또는 입금액 없음)과 금액 0 은 제외하고 그 수를 `skipped` 에 적는다.
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field

DATE_KEYS = ("거래일자", "거래일시", "거래일", "일자", "날짜", "date")
NAME_KEYS = ("입금자명", "입금자", "보낸분", "보내는분", "상대계좌예금주", "예금주", "기재내용", "거래내용", "내용", "적요", "name")
IN_KEYS = ("입금액", "입금", "맡기신금액", "받은금액", "amount", "금액")
OUT_KEYS = ("출금액", "출금", "찾으신금액", "보낸금액")


class CsvError(Exception):
    pass


@dataclass
class BankRow:
    date: str
    raw: str
    amount: int
    memo: str = ""


@dataclass
class Parsed:
    rows: list[BankRow]
    skipped: int = 0
    how: str = ""
    warnings: list[str] = field(default_factory=list)


def decode(data: bytes) -> str:
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("cp949")


def to_int(s: str) -> int:
    t = re.sub(r"[^\d-]", "", s or "")
    if t in ("", "-"):
        return 0
    return int(t)


def _find(header: list[str], keys: tuple[str, ...]) -> int | None:
    cells = [re.sub(r"\s+", "", h) for h in header]
    for k in keys:                                    # 키 우선순위대로 — 「입금자명」이 「적요」보다 먼저
        for i, c in enumerate(cells):
            if c == k:
                return i
    for k in keys:
        for i, c in enumerate(cells):
            if k in c:
                return i
    return None


def parse_bank_csv(text: str) -> Parsed:
    text = text.lstrip("﻿")
    rows = [r for r in csv.reader(io.StringIO(text))]
    rows = [r for r in rows if any(c.strip() for c in r)]
    if not rows:
        raise CsvError("빈 파일")

    # (a) 헤더 탐지
    for hi, header in enumerate(rows[:30]):
        i_name, i_in = _find(header, NAME_KEYS), _find(header, IN_KEYS)
        if i_name is None or i_in is None or i_name == i_in:
            continue
        i_date, i_out = _find(header, DATE_KEYS), _find(header, OUT_KEYS)
        out, skipped, warnings = [], 0, []
        for r in rows[hi + 1:]:
            if len(r) <= max(i_name, i_in):
                skipped += 1
                continue
            amount = to_int(r[i_in])
            withdrawn = to_int(r[i_out]) if i_out is not None and i_out < len(r) else 0
            if amount <= 0 or withdrawn > 0:
                skipped += 1
                continue
            raw = r[i_name].strip()
            if not raw:
                skipped += 1
                continue
            date = r[i_date].strip()[:10] if i_date is not None and i_date < len(r) else ""
            out.append(BankRow(date=date, raw=raw, amount=amount))
        if out:
            return Parsed(rows=out, skipped=skipped, how="header", warnings=warnings)

    # (b) 공용 3열
    out, skipped = [], 0
    start = 1 if rows and to_int(rows[0][2] if len(rows[0]) > 2 else "") == 0 else 0
    for r in rows[start:]:
        if len(r) < 3:
            skipped += 1
            continue
        amount = to_int(r[2])
        raw = r[1].strip()
        if amount <= 0 or not raw:
            skipped += 1
            continue
        out.append(BankRow(date=r[0].strip()[:10], raw=raw, amount=amount))
    if out:
        return Parsed(rows=out, skipped=skipped, how="plain")
    raise CsvError(f"열을 찾지 못했습니다: 첫 줄 {','.join(rows[0])[:80]}")
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_csv.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add engine/csvin.py tests/test_csv.py && git commit -m "feat(engine): 은행 CSV 파서(헤더 탐지·공용 3열)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `engine/store.py` — 작업공간과 append-only 대장

**Files:**
- Create: `engine/store.py`
- Test: `tests/test_store.py`

**Interfaces:**
- Consumes: `engine.roster.Roster`
- Produces: `now()->str`, `sha256_text(text)->str`, `line_id(week, raw, amount, n)->str`, `Workspace(root)` with properties `roster_path`·`inbox`·`exports`·`meta`, methods `init()`, `roster()->Roster`, `save_roster(r)`, `aliases()->dict[str,dict]`, `learn_alias(key, person_id, line_id)->bool`, `forget_alias(key)->bool`, `append_line(row)`, `raw_lines()->list[dict]`, `lines()->list[dict]`(id별로 접은 현재 상태, 첫 등장 순), `get(line_id)->dict|None`, `append_import(row)`, `imports()->list[dict]`, `seen_hashes()->set[str]`. 상수 `META=".matjangbu"`, `STATES=("auto","held","confirmed","excluded")`.

- [ ] **Step 1: 실패하는 테스트**

`tests/test_store.py`:
```python
from engine.roster import Roster
from engine.store import STATES, Workspace, line_id, sha256_text


def test_init_creates_layout(tmp_path):
    ws = Workspace(tmp_path / "교회")
    ws.init()
    assert ws.roster_path.exists() and ws.inbox.is_dir() and ws.exports.is_dir() and ws.meta.is_dir()
    assert ws.roster().people == [] and ws.aliases() == {}


def test_lines_fold_later_wins_and_keeps_first_order(tmp_path):
    ws = Workspace(tmp_path)
    ws.init()
    ws.append_line({"id": "a", "state": "held", "raw": "우리상사", "ts": "t1"})
    ws.append_line({"id": "b", "state": "auto", "raw": "김정호", "ts": "t1"})
    ws.append_line({"id": "a", "state": "confirmed", "person_id": "p19", "ts": "t2"})
    cur = ws.lines()
    assert [r["id"] for r in cur] == ["a", "b"]
    assert cur[0]["state"] == "confirmed" and cur[0]["raw"] == "우리상사" and cur[0]["person_id"] == "p19"
    assert ws.get("a")["state"] == "confirmed" and ws.get("zzz") is None
    assert len(ws.raw_lines()) == 3
    assert "confirmed" in STATES


def test_aliases_learn_and_forget(tmp_path):
    ws = Workspace(tmp_path)
    ws.init()
    assert ws.learn_alias("우리상사", "p19", "a") is True
    assert ws.learn_alias("우리상사", "p20", "b") is False          # 먼저 배운 것이 남는다
    assert ws.aliases()["우리상사"]["person_id"] == "p19"
    assert ws.forget_alias("우리상사") is True and ws.aliases() == {}


def test_roster_roundtrip_and_imports(tmp_path):
    ws = Workspace(tmp_path)
    ws.init()
    r = Roster()
    r.add("김정호", "1구역", "H01")
    ws.save_roster(r)
    assert ws.roster().find("김정호")[0].id == "p001"
    h = sha256_text("a,b,c")
    ws.append_import({"sha256": h, "filename": "w10.csv", "week": "2026-W10", "n_lines": 3, "ts": "t"})
    assert h in ws.seen_hashes() and ws.imports()[0]["week"] == "2026-W10"
    assert line_id("2026-W10", "김정호", 300000, 0) != line_id("2026-W10", "김정호", 300000, 1)
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_store.py -v`
Expected: `ModuleNotFoundError`

- [ ] **Step 3: 구현**

`engine/store.py`:
```python
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
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_store.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add engine/store.py tests/test_store.py && git commit -m "feat(engine): 작업공간·append-only 대장·별칭 사전

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: `engine/match.py` — 3단 대조(1·2단 규칙, 3단은 주입)

**Files:**
- Create: `engine/match.py`
- Test: `tests/test_match.py`

**Interfaces:**
- Consumes: `engine.hangul`(norm·strip_space·hanja_fix·strip_kind·sim·SIM_THRESHOLD·KINDS), `engine.roster.Roster/Person`
- Produces: `ModelResult(pred: dict, meta: dict, error: str="")` with `.ok`; `Match(state, person_id, how, cands, reason, kind, allow_new, model, unresolved)` with `.as_dict()`; `top_similar(name, roster, n=5)->list[tuple[Person,float]]`; `rule_match(raw, roster, aliases)->Match`; `match_one(raw, roster, aliases, model=None, history=None)->Match`. 모델 호출 규약: `model(raw=str, cands=list[Person], roster=Roster, history=list[dict]) -> ModelResult`. 상수 `REASON_WHY: dict[str,str]`.

- [ ] **Step 1: 실패하는 테스트**

`tests/test_match.py`:
```python
from engine.match import ModelResult, match_one, rule_match, top_similar
from engine.roster import Roster

ROSTER = Roster.from_csv_text(
    "id,이름,구역,세대,옛이름\n"
    "p01,김정호,1구역,H01,\np02,이순자,1구역,H01,\np05,박민수,1구역,H03,\np26,박민수,5구역,H20,\n"
    "p13,한수진,3구역,H07,\np27,장동현,5구역,H21,\np14,김미영,3구역,H08,\np19,김태섭,4구역,H11,\n"
    "p20,이현우,4구역,H12,\np30,최윤서,2구역,H15,최윤정\n"
)
ALIASES = {"우리상사": {"person_id": "p19", "learned": "2026-03-01T00:00:00", "from": "x"}}


def test_rule_tiers():
    assert (rule_match("김정호", ROSTER, {}).state, rule_match("김정호", ROSTER, {}).how) == ("auto", "완전일치")
    assert rule_match("김 정호", ROSTER, {}).how == "띄어쓰기"
    assert rule_match("金정호", ROSTER, {}).how == "한자표기"
    assert rule_match("우리상사", ROSTER, ALIASES).how == "별칭사전"
    m = rule_match("이순자십일조", ROSTER, {})
    assert (m.state, m.how, m.kind, m.person_id) == ("auto", "종류분리", "십일조", "p02")
    assert rule_match("최윤정", ROSTER, {}).how == "옛이름"
    m = rule_match("김정오", ROSTER, {})                       # 받침 하나 → 유사도
    assert m.state == "auto" and m.how.startswith("유사도 0.") and m.person_id == "p01"


def test_dup_is_always_held_without_new():
    m = rule_match("박민수", ROSTER, {})
    assert (m.state, m.reason, m.allow_new) == ("held", "dup", False)
    assert {c["person_id"] for c in m.cands} == {"p05", "p26"}
    m = rule_match("박민수십일조", ROSTER, {})
    assert (m.state, m.reason, m.kind) == ("held", "dup", "십일조")


def test_household_head_name_goes_to_family_queue():
    r = Roster.from_csv_text("id,이름,구역,세대,옛이름\np13,한수진,3구역,장동철,\np40,방은영,7구역,장동철,\n")
    m = rule_match("장동철", r, {})
    assert (m.state, m.reason, m.unresolved, m.allow_new, m.how) == ("held", "family", False, True, "세대주")
    assert [c["person_id"] for c in m.cands] == ["p13", "p40"] and "세대" in m.cands[0]["why"]


def test_unresolved_without_model_keeps_rule_candidates():
    m = match_one("장동철", ROSTER, {})
    assert (m.state, m.reason, m.how, m.unresolved) == ("held", "unknown", "", True)
    assert m.cands[0]["person_id"] == "p27" and len(m.cands) <= 3       # 장동현이 가장 비슷
    assert top_similar("장동철", ROSTER, 2)[0][0].id == "p27"


def test_model_ranks_candidates_but_never_auto():
    def fake(raw, cands, roster, history):
        assert raw == "장동철" and cands[0].id == "p27" and history == []
        return ModelResult(pred={"name_part": "장동철", "kind": "", "relation": "family",
                                 "candidates": [{"id": "p13", "why": "같은 세대"}, {"id": "p27", "why": "이름이 비슷함"},
                                                {"id": "p99", "why": "명부에 없음"}],
                                 "confidence": 0.6},
                           meta={"model": "fake", "wall_s": 0.1})
    m = match_one("장동철", ROSTER, {}, model=fake)
    assert m.state == "held" and m.how == "모델" and m.reason == "family"
    assert [c["person_id"] for c in m.cands] == ["p13", "p27"]           # p99 는 버린다
    assert m.model["model"] == "fake" and m.model["pred"]["relation"] == "family"


def test_model_failure_marks_reason_and_keeps_rule_candidates():
    def boom(raw, cands, roster, history):
        raise ConnectionError("no server")
    m = match_one("장동철", ROSTER, {}, model=boom)
    assert m.state == "held" and m.reason == "model_failed" and m.cands[0]["person_id"] == "p27"
    bad = ModelResult(pred={}, meta={}, error="timeout")
    m = match_one("장동철", ROSTER, {}, model=lambda **k: bad)
    assert m.reason == "model_failed" and m.model["error"] == "timeout"
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_match.py -v`
Expected: `ModuleNotFoundError`

- [ ] **Step 3: 구현**

`engine/match.py`:
```python
#!/usr/bin/env python3
"""3단 대조 — 1·2단은 결정론 규칙, 3단은 주입된 모델 호출.

- 1단: 별칭 사전 → 완전 일치 → 띄어쓰기. 동명이인이면 `held/dup`(자동 확정 금지, 새 이름 등록 없음).
- 2단: 한자 이표기 → 헌금 종류 분리 → 옛 이름 → 세대주 이름(명부 세대 칸과 일치하면 그 세대 구성원을 후보로 `held/family`, 모델 불필요) → 자모 유사도(임계 이상 + 2위와 차이).
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
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_match.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add engine/match.py tests/test_match.py && git commit -m "feat(engine): 3단 대조 — 규칙 2단 + 모델 주입

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: `engine/model.py` — llama-server 호출

**Files:**
- Create: `engine/model.py`
- Test: `tests/test_model.py`

**Interfaces:**
- Consumes: `engine.match.ModelResult`, `engine.hangul.KINDS`, `engine.roster.Roster/Person`
- Produces: `DEFAULT_URL="http://127.0.0.1:8107"`, `SCHEMA: dict`, `build_messages(raw, cands, roster, history)->list[dict]`, `parse_json(text)->dict`, `rank(raw, cands, roster, history, url=DEFAULT_URL, timeout=300)->ModelResult`, `health(url, timeout=5)->bool`, `make_model(url, timeout=300)->Callable`, `server_command(model_path, threads, port=8107)->str`.

- [ ] **Step 1: 실패하는 테스트**

`tests/test_model.py`:
```python
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
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_model.py -v`
Expected: `ModuleNotFoundError`

- [ ] **Step 3: 구현**

`engine/model.py`:
```python
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
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_model.py -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add engine/model.py tests/test_model.py && git commit -m "feat(engine): llama-server 후보 판정 호출(json_schema)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: `engine/pipeline.py` — 불러오기·확정·되돌리기·봉투·다시 재기

**Files:**
- Create: `engine/pipeline.py`
- Test: `tests/test_pipeline.py`

**Interfaces:**
- Consumes: Task 4~7 전부
- Produces: `history_for(lines, aliases, raw)->list[dict]`, `import_csv(ws, text, week, date, filename="", model=None, skip_seen=True)->Iterator[dict]`(이벤트 `skipped`·`start`·`line`·`done`), `confirm(ws, line_id, person_id=None, new_person=None, kind=None)->dict`, `hold(ws, line_id, why="")->dict`, `exclude(ws, line_id, why="")->dict`, `undo_last(ws)->dict|None`, `add_envelopes(ws, week, date, lines, counted_total=None)->dict`, `rematch(ws, line_id, model)->dict`, `line_row(...)->dict`.

- [ ] **Step 1: 실패하는 테스트**

`tests/test_pipeline.py`:
```python
from engine import pipeline as P
from engine.match import ModelResult
from engine.roster import Roster
from engine.store import Workspace

ROSTER_CSV = ("id,이름,구역,세대,옛이름\np01,김정호,1구역,H01,\np02,이순자,1구역,H01,\np05,박민수,1구역,H03,\n"
              "p26,박민수,5구역,H20,\np13,한수진,3구역,H07,\np27,장동현,5구역,H21,\np19,김태섭,4구역,H11,\n")
W10 = "날짜,입금자명,금액\n2026-03-08,김정호,300000\n2026-03-08,우리상사,200000\n2026-03-08,박민수십일조,150000\n2026-03-08,장동철,50000\n"


def ws_with_roster(tmp_path):
    ws = Workspace(tmp_path)
    ws.init()
    ws.save_roster(Roster.from_csv_text(ROSTER_CSV))
    return ws


def test_import_events_and_states(tmp_path):
    ws = ws_with_roster(tmp_path)
    ev = list(P.import_csv(ws, W10, "2026-W10", "2026-03-08", "w10.csv"))
    assert ev[0]["event"] == "start" and ev[0]["n"] == 4 and ev[-1]["event"] == "done"
    assert ev[-1]["summary"] == {"auto": 1, "held": 3, "n": 4, "skipped": 0}
    rows = ws.lines()
    assert [r["state"] for r in rows] == ["auto", "held", "held", "held"]
    assert rows[2]["reason"] == "dup" and rows[2]["kind"] == "십일조" and rows[1]["allow_new"] is True
    again = list(P.import_csv(ws, W10, "2026-W10", "2026-03-08", "w10.csv"))
    assert again[0]["event"] == "skipped" and len(ws.lines()) == 4          # 같은 CSV 는 다시 넣지 않는다


def test_confirm_learns_alias_and_next_week_is_auto(tmp_path):
    ws = ws_with_roster(tmp_path)
    list(P.import_csv(ws, W10, "2026-W10", "2026-03-08"))
    company = next(r for r in ws.lines() if r["raw"] == "우리상사")
    out = P.confirm(ws, company["id"], person_id="p19")
    assert out["ok"] and out["alias_learned"] == "우리상사" and ws.aliases()["우리상사"]["person_id"] == "p19"
    assert ws.get(company["id"])["state"] == "confirmed" and ws.get(company["id"])["how"] == "사람"
    assert P.confirm(ws, company["id"], person_id="p19")["ok"] is False      # 이미 확정 → 거절
    list(P.import_csv(ws, W10.replace("2026-03-08", "2026-03-15"), "2026-W11", "2026-03-15"))
    nxt = [r for r in ws.lines() if r["week"] == "2026-W11" and r["raw"] == "우리상사"][0]
    assert (nxt["state"], nxt["how"], nxt["person_id"]) == ("auto", "별칭사전", "p19")


def test_confirm_new_person_dup_kind_and_undo(tmp_path):
    ws = ws_with_roster(tmp_path)
    list(P.import_csv(ws, W10, "2026-W10", "2026-03-08"))
    unknown = next(r for r in ws.lines() if r["raw"] == "장동철")
    out = P.confirm(ws, unknown["id"], new_person={"name": "장동철", "group": "5구역"})
    assert out["ok"] and out["new_person"]["name"] == "장동철" and ws.roster().find("장동철")
    assert out["alias_learned"] is None                                       # 원문 = 이름이면 별칭 없음
    dup = next(r for r in ws.lines() if r["raw"] == "박민수십일조")
    assert P.confirm(ws, dup["id"], person_id="p05", kind="감사헌금")["ok"]
    assert ws.get(dup["id"])["kind"] == "감사헌금" and ws.aliases()["박민수십일조"]["person_id"] == "p05"
    u = P.undo_last(ws)
    assert u["id"] == dup["id"] and ws.get(dup["id"])["state"] == "held" and "박민수십일조" not in ws.aliases()
    u2 = P.undo_last(ws)
    assert u2["id"] == unknown["id"] and ws.get(unknown["id"])["state"] == "held"
    assert P.undo_last(ws) is None


def test_hold_exclude_and_errors(tmp_path):
    ws = ws_with_roster(tmp_path)
    list(P.import_csv(ws, W10, "2026-W10", "2026-03-08"))
    row = next(r for r in ws.lines() if r["raw"] == "장동철")
    assert P.exclude(ws, row["id"], "중복 입금")["ok"] and ws.get(row["id"])["state"] == "excluded"
    assert P.hold(ws, row["id"])["ok"] and ws.get(row["id"])["state"] == "held"
    assert P.confirm(ws, "nope", person_id="p01")["ok"] is False
    assert P.confirm(ws, row["id"], person_id="p99")["ok"] is False


def test_envelopes(tmp_path):
    ws = ws_with_roster(tmp_path)
    out = P.add_envelopes(ws, "2026-W10", "2026-03-08",
                          [{"name": "김정호", "kind": "십일조", "amount": 100000},
                           {"name": "박민수", "kind": "감사헌금", "amount": 50000},
                           {"name": "홍길동", "kind": "", "amount": 30000},
                           {"name": "", "kind": "", "amount": 10}], counted_total=200000)
    states = [(r["raw"], r["state"], r["how"]) for r in out["rows"]]
    assert states == [("김정호", "confirmed", "사람"), ("박민수", "held", "동명이인"), ("홍길동", "held", "")]
    assert out["total"] == 180000 and out["diff"] == -20000 and out["errors"] == ["4번째 줄: 이름 없음"]
    assert all(r["path"] == "envelope" for r in ws.lines())


def test_rematch_runs_model_only_for_held(tmp_path):
    ws = ws_with_roster(tmp_path)
    list(P.import_csv(ws, W10, "2026-W10", "2026-03-08"))
    row = next(r for r in ws.lines() if r["raw"] == "장동철")
    fake = lambda **k: ModelResult({"name_part": "장동철", "kind": "", "relation": "family",
                                    "candidates": [{"id": "p13", "why": "같은 세대"}], "confidence": 0.5},
                                   {"model": "fake", "wall_s": 1.0})
    out = P.rematch(ws, row["id"], fake)
    assert out["ok"] and out["row"]["how"] == "모델" and out["row"]["cands"][0]["person_id"] == "p13"
    auto = next(r for r in ws.lines() if r["raw"] == "김정호")
    assert P.rematch(ws, auto["id"], fake)["ok"] is False
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_pipeline.py -v`
Expected: `ModuleNotFoundError`

- [ ] **Step 3: 구현**

`engine/pipeline.py`:
```python
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
        return {"ok": False, "error": f"대장에 없다: {line_id_}"}
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
        return {"ok": False, "error": f"대장에 없다: {line_id_}"}
    return _human(ws, row, {"state": "held", "person_id": None, "how": row.get("how", "")}, why)


def exclude(ws: Workspace, line_id_: str, why: str = "") -> dict:
    row = ws.get(line_id_)
    if row is None:
        return {"ok": False, "error": f"대장에 없다: {line_id_}"}
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
        return {"ok": False, "error": f"대장에 없다: {line_id_}"}
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
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_pipeline.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add engine/pipeline.py tests/test_pipeline.py && git commit -m "feat(engine): 불러오기·확정·되돌리기·봉투 입력·다시 재기

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: `engine/report.py` — 주간·개인별·연말·CSV 내보내기

**Files:**
- Create: `engine/report.py`
- Test: `tests/test_report.py`

**Interfaces:**
- Consumes: `engine.store.Workspace`, `engine.roster.Roster`
- Produces: `NO_KIND="(종류 없음)"`, `week_list(ws, week)->dict{rows, held, excluded, total, count}`, `person_totals(ws, year)->dict{rows, kinds, total, count}`, `year_summary(ws, year)->dict{rows, kinds, by_kind, total, count, unconfirmed{count,total}, excluded{count,total}}`, `to_csv(columns, rows)->str`, `export(ws, which, week=None, year=None)->tuple[str,str]`(파일명, 본문; `내보내기/`에도 쓴다).

- [ ] **Step 1: 실패하는 테스트**

`tests/test_report.py`:
```python
from engine import report as R
from engine.roster import Roster
from engine.store import Workspace

CSV = "id,이름,구역,세대,옛이름\np01,김정호,1구역,H01,\np02,이순자,1구역,H01,\np19,김태섭,4구역,H11,\n"


def seed(tmp_path):
    ws = Workspace(tmp_path)
    ws.init()
    ws.save_roster(Roster.from_csv_text(CSV))
    rows = [
        {"id": "a", "week": "2026-W10", "date": "2026-03-08", "raw": "김정호", "amount": 300000, "kind": "십일조", "path": "csv", "state": "auto", "person_id": "p01", "how": "완전일치"},
        {"id": "b", "week": "2026-W10", "date": "2026-03-08", "raw": "우리상사", "amount": 200000, "kind": "", "path": "csv", "state": "confirmed", "person_id": "p19", "how": "사람"},
        {"id": "c", "week": "2026-W10", "date": "2026-03-08", "raw": "장동철", "amount": 50000, "kind": "", "path": "csv", "state": "held", "person_id": None, "how": ""},
        {"id": "d", "week": "2026-W10", "date": "2026-03-08", "raw": "이순자", "amount": 10000, "kind": "감사헌금", "path": "envelope", "state": "excluded", "person_id": None, "how": "사람"},
        {"id": "e", "week": "2026-W11", "date": "2026-03-15", "raw": "김정호", "amount": 300000, "kind": "십일조", "path": "csv", "state": "auto", "person_id": "p01", "how": "완전일치"},
        {"id": "f", "week": "2025-W52", "date": "2025-12-28", "raw": "김정호", "amount": 1000, "kind": "", "path": "csv", "state": "auto", "person_id": "p01", "how": "완전일치"},
    ]
    for r in rows:
        ws.append_line(r)
    return ws


def test_week_list_orders_human_first(tmp_path):
    w = R.week_list(seed(tmp_path), "2026-W10")
    assert [r["name"] for r in w["rows"]] == ["김태섭", "김정호"]          # 사람 손이 닿은 줄부터
    assert w["total"] == 500000 and w["count"] == 2
    assert [r["raw"] for r in w["held"]] == ["장동철"] and [r["raw"] for r in w["excluded"]] == ["이순자"]


def test_person_totals_and_year_summary(tmp_path):
    ws = seed(tmp_path)
    p = R.person_totals(ws, 2026)
    assert p["rows"][0]["name"] == "김정호" and p["rows"][0]["total"] == 600000 and p["rows"][0]["by_kind"]["십일조"] == 600000
    assert p["rows"][1]["by_kind"][R.NO_KIND] == 200000 and p["total"] == 800000 and set(p["kinds"]) == {"십일조", R.NO_KIND}
    y = R.year_summary(ws, 2026)
    assert y["total"] == 800000 and y["count"] == 3 and y["by_kind"]["십일조"] == 600000
    assert y["unconfirmed"] == {"count": 1, "total": 50000} and y["excluded"] == {"count": 1, "total": 10000}
    assert R.year_summary(ws, 2025)["total"] == 1000


def test_export_csv_has_bom_and_file(tmp_path):
    ws = seed(tmp_path)
    name, text = R.export(ws, "week", week="2026-W10")
    assert name == "주간명단-2026-W10.csv" and text.startswith("﻿이름,") and "김태섭" in text
    assert (ws.exports / name).exists()
    name, text = R.export(ws, "year", year=2026)
    assert name == "연말합산-2026.csv" and "합계" in text
    assert R.to_csv(["a", "b"], [{"a": 1, "b": "x,y"}]) == '﻿a,b\n1,"x,y"\n'
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_report.py -v`
Expected: `ModuleNotFoundError`

- [ ] **Step 3: 구현**

`engine/report.py`:
```python
#!/usr/bin/env python3
"""기록 — 주간 명단·개인별 누적·연말 합산. 전부 대장(`lines.jsonl`)에서 계산하고 CSV(UTF-8 BOM)로 낸다.

주간 명단은 「사람 손이 닿은 줄」부터 보여준다 — 입금 순서대로 두면 완전일치가 앞을 다 차지해
이 도구가 한 일이 안 보인다(MVP 에서 배운 것).
"""
from __future__ import annotations

import csv
import io
from collections import defaultdict

from .store import Workspace

NO_KIND = "(종류 없음)"
ACTIVE = ("auto", "confirmed")


def _year_of(r: dict) -> str:
    return (r.get("date") or r.get("week") or "")[:4]


def _view(r: dict, roster) -> dict:
    p = roster.by_id.get(r.get("person_id") or "")
    return {"id": r["id"], "raw": r.get("raw", ""), "name": p.name if p else "", "group": p.group if p else "",
            "kind": r.get("kind") or NO_KIND, "amount": int(r.get("amount") or 0), "path": r.get("path", ""),
            "how": r.get("how", ""), "state": r.get("state", ""), "date": r.get("date", "")}


def week_list(ws: Workspace, week: str) -> dict:
    roster = ws.roster()
    rows = [r for r in ws.lines() if r.get("week") == week]
    human = [_view(r, roster) for r in rows if r.get("state") == "confirmed"]
    auto = [_view(r, roster) for r in rows if r.get("state") == "auto"]
    held = [_view(r, roster) for r in rows if r.get("state") == "held"]
    excluded = [_view(r, roster) for r in rows if r.get("state") == "excluded"]
    active = human + auto
    return {"week": week, "rows": active, "held": held, "excluded": excluded,
            "total": sum(r["amount"] for r in active), "count": len(active)}


def person_totals(ws: Workspace, year: int) -> dict:
    roster = ws.roster()
    acc: dict[str, dict] = {}
    kinds: set[str] = set()
    for r in ws.lines():
        if r.get("state") not in ACTIVE or _year_of(r) != str(year) or not r.get("person_id"):
            continue
        p = roster.by_id.get(r["person_id"])
        a = acc.setdefault(r["person_id"], {"person_id": r["person_id"], "name": p.name if p else r["person_id"],
                                            "group": p.group if p else "", "by_kind": defaultdict(int),
                                            "total": 0, "count": 0})
        k = r.get("kind") or NO_KIND
        kinds.add(k)
        a["by_kind"][k] += int(r.get("amount") or 0)
        a["total"] += int(r.get("amount") or 0)
        a["count"] += 1
    rows = sorted(({**a, "by_kind": dict(a["by_kind"])} for a in acc.values()), key=lambda a: (-a["total"], a["name"]))
    return {"year": year, "rows": rows, "kinds": sorted(kinds, key=lambda k: (k == NO_KIND, k)),
            "total": sum(a["total"] for a in rows), "count": sum(a["count"] for a in rows)}


def year_summary(ws: Workspace, year: int) -> dict:
    base = person_totals(ws, year)
    by_kind: dict[str, int] = defaultdict(int)
    for a in base["rows"]:
        for k, v in a["by_kind"].items():
            by_kind[k] += v
    unc = [r for r in ws.lines() if r.get("state") == "held" and _year_of(r) == str(year)]
    exc = [r for r in ws.lines() if r.get("state") == "excluded" and _year_of(r) == str(year)]
    return {**base, "by_kind": dict(by_kind),
            "unconfirmed": {"count": len(unc), "total": sum(int(r.get("amount") or 0) for r in unc)},
            "excluded": {"count": len(exc), "total": sum(int(r.get("amount") or 0) for r in exc)}}


def to_csv(columns: list[str], rows: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=columns, lineterminator="\n", extrasaction="ignore")
    w.writeheader()
    for r in rows:
        w.writerow(r)
    return "﻿" + buf.getvalue()


def export(ws: Workspace, which: str, week: str | None = None, year: int | None = None) -> tuple[str, str]:
    if which == "week":
        d = week_list(ws, week or "")
        cols = ["이름", "구역", "종류", "금액", "경로", "근거", "원문"]
        rows = [{"이름": r["name"], "구역": r["group"], "종류": r["kind"], "금액": r["amount"],
                 "경로": "봉투" if r["path"] == "envelope" else "통장", "근거": r["how"], "원문": r["raw"]} for r in d["rows"]]
        rows.append({"이름": "합계", "금액": d["total"]})
        name = f"주간명단-{week}.csv"
    elif which == "person":
        d = person_totals(ws, int(year))
        cols = ["이름", "구역", *d["kinds"], "합계", "건수"]
        rows = [{"이름": a["name"], "구역": a["group"], **{k: a["by_kind"].get(k, 0) for k in d["kinds"]},
                 "합계": a["total"], "건수": a["count"]} for a in d["rows"]]
        rows.append({"이름": "합계", "합계": d["total"], "건수": d["count"]})
        name = f"개인별누적-{year}.csv"
    else:
        d = year_summary(ws, int(year))
        cols = ["이름", "구역", "합계", "건수", *d["kinds"]]
        rows = [{"이름": a["name"], "구역": a["group"], "합계": a["total"], "건수": a["count"],
                 **{k: a["by_kind"].get(k, 0) for k in d["kinds"]}} for a in d["rows"]]
        rows.append({"이름": "합계", "합계": d["total"], "건수": d["count"], **d["by_kind"]})
        rows.append({"이름": "미확정", "합계": d["unconfirmed"]["total"], "건수": d["unconfirmed"]["count"]})
        name = f"연말합산-{year}.csv"
    text = to_csv(cols, rows)
    ws.exports.mkdir(parents=True, exist_ok=True)
    (ws.exports / name).write_text(text, encoding="utf-8")
    return name, text
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_report.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add engine/report.py tests/test_report.py && git commit -m "feat(engine): 주간·개인별·연말 기록과 CSV 내보내기

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: 합성 샘플 생성기와 엔진 CLI

**Files:**
- Create: `tools/make_samples.py`, `samples/README.md`, `engine/__main__.py`
- Generated: `samples/roster.csv`, `samples/aliases.json`, `samples/weeks/2026-W10.csv` … `2026-W13.csv`, `samples/envelopes/2026-W10.json`, `samples/answers.json`, `samples/held_lines.json`
- Test: `tests/test_samples.py`, `tests/test_cli.py`

**Interfaces:**
- Consumes: Task 2~9
- Produces: `samples/` 파일 규격(아래) — `web/demo.py`·`web/record.py`·`bench/`가 읽는다. `python3 -m engine <cmd>` CLI.

**샘플 규격.**
- `roster.csv`: 60명. MVP 42명(id·이름·구역은 `mvp/01-헌금이름맞춤/app/data.js`의 `roster` 그대로) + 18명(p43~p60: 이재원 1구역·김수현 1구역·박지훈 2구역·최서연 2구역·정우진 2구역·김하늘 3구역·이도윤 3구역·박서준 4구역·최지우 4구역·정예린 5구역·강하은 5구역·조민재 6구역·윤지호 6구역·임채원 7구역·한지민 7구역·송민호 1구역·오하람 2구역·서지안 3구역). 세대: (p01,p02)=H01 · (p03,p04)=H02 · (p05,p06)=H03 · (p11,p12)=H04 · (p15,p18)=H05 · (p19,p23)=H06 · (p21,p24)=H08 · (p27,p29)=H09 · (p31,p32)=H10 · (p35,p36)=H11 · (p37,p38)=H12 · (p41,p42)=H13 · (p43,p44)=H31 · (p46,p47)=H32 · (p52,p53)=H33 · **p13 한수진 세대 = 「장동철」**(세대주가 비신도) · **p49 이도윤 세대 = 「박영수」** · p28 박민수(5구역)=H20. 옛이름: p30 유정민 = 「유정숙」, p55 윤지호 = 「윤지원」. p14 김미영은 개명(김보라)했지만 명부에 반영되지 않았다(옛이름 비움).
- `aliases.json`: `{"(주)한빛건설": {"person_id": "p22", "learned": "2026-02-01T10:00:00", "from": "seed"}}`.
- `weeks/2026-W10.csv`: 은행 헤더 형식(`거래일자,거래시간,적요,입금액,출금액,잔액,입금자명`), MVP `deposits` 24줄 그대로(합계 5,025,000원) + 출금 줄 1개(「체크카드」 12,000원). 정답(`answers.json["2026-W10"]`, 원문→id): 김정호 p01 · 김 영 희 p25 · 이순자 p02 · 박성우십일조 p07 · 최민준 p08 · 李현우 p20 · 한수진 p13 · (주)한빛건설 p22 · 정미경 p09 · 장동현감사 p26 · 오세훈 p15 · 구본녕 p17 · 윤서진 p03 · 김태섭선교 p19 · 강민철 p21 · 배정숙 p10 · 홍기석 p27 · 서은미 p04 · 신영철 p16 · 임재현 p11 · 장동철 p13 · 박민수십일조 p05 · 우리상사 p19 · 김보라 p14. 규칙만으로 **자동 20 / 확인 4**(장동철=세대주, 박민수십일조=동명이인, 우리상사·김보라=모델).
- `weeks/2026-W11.csv`(2026-03-15) 22줄: 김정호 300000 p01 · 이순자 150000 p02 · 崔민준 200000 p08 · 박성우십일조 220000 p07 · 우리상사 500000 p19 · 유정숙 100000 p30 · 정우짐 120000 p47 · 박영수 80000 p49 · 박서준감사헌금 50000 p50 · 강민철 500000 p21 · 대성정밀 300000 p33 · 김하늘 90000 p48 · 홍기석 130000 p27 · (주)한빛건설 400000 p22 · 김보라 170000 p14 · 윤지원 60000 p55 · 서지안 110000 p60 · 오하람 70000 p59 · 임채원 95000 p56 · 조민재 85000 p54 · 배정숙 90000 p10 · 김수현 100000 p44. 규칙만 **18 / 4**(우리상사·대성정밀·김보라=모델, 박영수=세대주).
- `weeks/2026-W12.csv`(2026-03-22) 20줄: 김정호 300000 p01 · 김 영 희 200000 p25 · 최민준 200000 p08 · 한수진 100000 p13 · 장동철 250000 p13 · 우리상사 500000 p19 · 박민수 150000 p28 · 문지훈 400000 p22 · 이재원십일조 200000 p43 · 송민호 80000 p58 · 최지우 60000 p51 · 정예린 120000 p52 · 강하은감사 50000 p53 · 김태섭 80000 p19 · 천용석 90000 p41 · 추소연 70000 p42 · 남기훈 130000 p24 · 안미라 110000 p36 · 신영철 110000 p16 · 김보라 170000 p14. 규칙만 **16 / 4**.
- `weeks/2026-W13.csv`(2026-03-29) 20줄: 김정호 300000 p01 · 이순자 150000 p02 · 李현우 170000 p20 · (주)한빛건설 400000 p22 · 우리상사 500000 p19 · 김보라 170000 p14 · 유정민 100000 p30 · 윤서진 180000 p03 · 서은미 160000 p04 · 방은영 75000 p40 · 표진우 85000 p37 · 소민경 95000 p38 · 하재호 65000 p39 · 도현아 55000 p34 · 백승기 105000 p35 · 노경환 300000 p33 · 심수정 45000 p32 · 권태호 125000 p31 · 구본영 95000 p17 · 오세훈 120000 p15. 규칙만 **18 / 2**.
- `envelopes/2026-W10.json`: `{"week":"2026-W10","date":"2026-03-08","counted_total":730000,"lines":[…12줄]}` — 김정호 십일조 100000 · 이순자 감사헌금 30000 · 박민수 십일조 50000 · 홍길동 "" 20000 · 윤서진 주정헌금 10000 · 최민준 십일조 200000 · 정미경 감사헌금 50000 · 한수진 십일조 70000 · 김태섭 선교헌금 30000 · 강민철 건축헌금 100000 · 임재현 십일조 60000 · 배정숙 주정헌금 10000(합계 730,000).
- `held_lines.json`: 벤치용 30줄, 여섯 유형 × 5: `family`(세대주 이름으로 들어온 줄, `history`에 과거 확정 1건) · `company`(상호, `history` 1~3건) · `typo`(자모 2개가 틀려 유사도 0.85 미만, `history` 없음) · `renamed`(옛 이름으로 들어온 줄인데 명부 옛이름 칸이 비어 있음, `history` 1건) · `kind_typo`(종류 접미 + 자모 2개 오타) · `unknown`(명부에 없고 이력 없음, 정답 없음). 각 줄 `{"raw","history":[{"raw","person_id","week"}],"expect":{"person_id"|null,"relation"},"category"}`. `raw`는 규칙 1·2단으로 풀리지 않아야 한다(생성기가 `rule_match`로 검증한다).

- [ ] **Step 1: 실패하는 테스트**

`tests/test_samples.py`:
```python
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

from engine import pipeline as P
from engine.match import rule_match
from engine.roster import Roster
from engine.store import Workspace
from tests.conftest import ROOT

S = ROOT / "samples"


def test_generator_is_deterministic(tmp_path):
    out = subprocess.run([sys.executable, str(ROOT / "tools" / "make_samples.py"), "--out", str(tmp_path)],
                         capture_output=True, text=True)
    assert out.returncode == 0, out.stderr
    for name in ("roster.csv", "aliases.json", "answers.json", "held_lines.json", "weeks/2026-W10.csv"):
        assert (tmp_path / name).read_bytes() == (S / name).read_bytes()


def test_roster_and_weeks_rule_only():
    r = Roster.load(S / "roster.csv")
    assert len(r.people) == 60 and r.find_household("장동철")[0].id == "p13" and r.find_old("유정숙")[0].id == "p30"
    answers = json.loads((S / "answers.json").read_text(encoding="utf-8"))
    expect = {"2026-W10": (20, 4, 5025000), "2026-W11": (18, 4, None), "2026-W12": (16, 4, None), "2026-W13": (18, 2, None)}
    for week, (auto, held, total) in expect.items():
        ws = Workspace(Path(S.parent / "web" / ".sessions" / "_test" / week))
        import shutil
        shutil.rmtree(ws.root, ignore_errors=True)
        ws.init()
        ws.save_roster(r)
        ws._write_aliases(json.loads((S / "aliases.json").read_text(encoding="utf-8")))
        text = (S / "weeks" / f"{week}.csv").read_text(encoding="utf-8-sig")
        done = list(P.import_csv(ws, text, week, "2026-03-08"))[-1]
        assert (done["summary"]["auto"], done["summary"]["held"]) == (auto, held), week
        rows = ws.lines()
        assert all(row["raw"] in answers[week] for row in rows), week
        assert all(row["person_id"] == answers[week][row["raw"]] for row in rows if row["state"] == "auto"), week
        if total:
            assert sum(row["amount"] for row in rows) == total
        shutil.rmtree(ws.root, ignore_errors=True)


def test_envelopes_and_held_lines():
    env = json.loads((S / "envelopes" / "2026-W10.json").read_text(encoding="utf-8"))
    assert len(env["lines"]) == 12 and sum(l["amount"] for l in env["lines"]) == env["counted_total"] == 730000
    held = json.loads((S / "held_lines.json").read_text(encoding="utf-8"))
    assert len(held) == 30 and Counter(h["category"] for h in held) == {k: 5 for k in ("family", "company", "typo", "renamed", "kind_typo", "unknown")}
    r = Roster.load(S / "roster.csv")
    for h in held:
        m = rule_match(h["raw"], r, {})
        assert m.state == "held" and m.unresolved, h["raw"]           # 규칙으로 풀리면 벤치 대상이 아니다
        if h["expect"]["person_id"]:
            assert h["expect"]["person_id"] in r.by_id
```

`tests/test_cli.py`:
```python
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
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_samples.py tests/test_cli.py -v`
Expected: FAIL (`tools/make_samples.py` 없음, `engine.__main__` 없음)

- [ ] **Step 3: `tools/make_samples.py`**

결정론 생성기. 위 규격의 표를 파이썬 리스트 상수로 그대로 적고 파일로 쓴다. 뼈대:
```python
#!/usr/bin/env python3
"""합성 샘플 생성기 — 명부 60명·입금 4주·봉투 1주·벤치 줄 30건·정답. 전부 가공 데이터다.

    python3 tools/make_samples.py [--out samples]

난수 없이 표에서만 만든다(두 번 돌려도 같은 파일). 벤치 줄은 규칙 1·2단으로 풀리지 않는지 rule_match 로 검증한다.
"""
from __future__ import annotations
import argparse, csv, io, json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from engine.hangul import sim, strip_kind, norm
from engine.match import rule_match
from engine.roster import Roster

ROSTER = [  # (id, 이름, 구역, 세대, 옛이름)
    ("p01", "김정호", "1구역", "H01", ""), ("p02", "이순자", "1구역", "H01", ""), ("p03", "윤서진", "1구역", "H02", ""),
    ("p04", "서은미", "1구역", "H02", ""), ("p05", "박민수", "1구역", "H03", ""), ("p06", "황선미", "1구역", "H03", ""),
    ("p07", "박성우", "2구역", "", ""), ("p08", "최민준", "2구역", "", ""), ("p09", "정미경", "2구역", "", ""),
    ("p10", "배정숙", "2구역", "", ""), ("p11", "임재현", "2구역", "H04", ""), ("p12", "하경아", "2구역", "H04", ""),
    ("p13", "한수진", "3구역", "장동철", ""), ("p14", "김미영", "3구역", "", ""), ("p15", "오세훈", "3구역", "H05", ""),
    ("p16", "신영철", "3구역", "", ""), ("p17", "구본영", "3구역", "", ""), ("p18", "양미숙", "3구역", "H05", ""),
    ("p19", "김태섭", "4구역", "H06", ""), ("p20", "이현우", "4구역", "", ""), ("p21", "강민철", "4구역", "H08", ""),
    ("p22", "문지훈", "4구역", "", ""), ("p23", "조은숙", "4구역", "H06", ""), ("p24", "남기훈", "4구역", "H08", ""),
    ("p25", "김영희", "5구역", "", ""), ("p26", "장동현", "5구역", "", ""), ("p27", "홍기석", "5구역", "H09", ""),
    ("p28", "박민수", "5구역", "H20", ""), ("p29", "전상우", "5구역", "H09", ""), ("p30", "유정민", "5구역", "", "유정숙"),
    ("p31", "권태호", "6구역", "H10", ""), ("p32", "심수정", "6구역", "H10", ""), ("p33", "노경환", "6구역", "", ""),
    ("p34", "도현아", "6구역", "", ""), ("p35", "백승기", "6구역", "H11", ""), ("p36", "안미라", "6구역", "H11", ""),
    ("p37", "표진우", "7구역", "H12", ""), ("p38", "소민경", "7구역", "H12", ""), ("p39", "하재호", "7구역", "", ""),
    ("p40", "방은영", "7구역", "", ""), ("p41", "천용석", "7구역", "H13", ""), ("p42", "추소연", "7구역", "H13", ""),
    ("p43", "이재원", "1구역", "H31", ""), ("p44", "김수현", "1구역", "H31", ""), ("p45", "박지훈", "2구역", "", ""),
    ("p46", "최서연", "2구역", "H32", ""), ("p47", "정우진", "2구역", "H32", ""), ("p48", "김하늘", "3구역", "", ""),
    ("p49", "이도윤", "3구역", "박영수", ""), ("p50", "박서준", "4구역", "", ""), ("p51", "최지우", "4구역", "", ""),
    ("p52", "정예린", "5구역", "H33", ""), ("p53", "강하은", "5구역", "H33", ""), ("p54", "조민재", "6구역", "", ""),
    ("p55", "윤지호", "6구역", "", "윤지원"), ("p56", "임채원", "7구역", "", ""), ("p57", "한지민", "7구역", "", ""),
    ("p58", "송민호", "1구역", "", ""), ("p59", "오하람", "2구역", "", ""), ("p60", "서지안", "3구역", "", ""),
]
ALIASES = {"(주)한빛건설": {"person_id": "p22", "learned": "2026-02-01T10:00:00", "from": "seed"}}
WEEKS = {  # week: (date, [(raw, amount, answer_id), ...])   ← 위 규격 표를 그대로 옮긴다
    "2026-W10": ("2026-03-08", [("김정호", 300000, "p01"), ("김 영 희", 200000, "p25"), ("이순자", 150000, "p02"),
                                ("박성우십일조", 220000, "p07"), ("최민준", 200000, "p08"), ("李현우", 170000, "p20"),
                                ("한수진", 100000, "p13"), ("(주)한빛건설", 400000, "p22"), ("정미경", 250000, "p09"),
                                ("장동현감사", 140000, "p26"), ("오세훈", 120000, "p15"), ("구본녕", 95000, "p17"),
                                ("윤서진", 180000, "p03"), ("김태섭선교", 80000, "p19"), ("강민철", 500000, "p21"),
                                ("배정숙", 90000, "p10"), ("홍기석", 130000, "p27"), ("서은미", 160000, "p04"),
                                ("신영철", 110000, "p16"), ("임재현", 210000, "p11"), ("장동철", 250000, "p13"),
                                ("박민수십일조", 300000, "p05"), ("우리상사", 500000, "p19"), ("김보라", 170000, "p14")]),
    "2026-W11": ("2026-03-15", [...규격 표 22줄...]),
    "2026-W12": ("2026-03-22", [...20줄...]),
    "2026-W13": ("2026-03-29", [...20줄...]),
}
ENVELOPES = {"week": "2026-W10", "date": "2026-03-08", "counted_total": 730000, "lines": [
    {"name": "김정호", "kind": "십일조", "amount": 100000}, ...12줄...]}
HELD = [  # (category, raw, history[(raw, pid, week)], expect_pid, relation)
    ("family", "장동철", [("장동철", "p13", "2026-W05")], "p13", "family"),   # 벤치에서는 명부 세대 칸을 비운 사본을 쓴다
    ...
]

def bank_csv(date, lines):  # 헤더 형식 + 출금 줄 1개
    buf = io.StringIO(); w = csv.writer(buf, lineterminator="\n")
    w.writerow(["거래일자", "거래시간", "적요", "입금액", "출금액", "잔액", "입금자명"])
    bal = 5_000_000
    for i, (raw, amt, _) in enumerate(lines):
        bal += amt
        w.writerow([date, f"{9 + i // 6:02d}:{(i * 7) % 60:02d}", "타행이체", f"{amt:,}", "", f"{bal:,}", raw])
        if i == 1:
            bal -= 12000
            w.writerow([date, "09:30", "체크카드", "", "12,000", f"{bal:,}", "마트"])
    return "﻿" + buf.getvalue()

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--out", type=Path, default=ROOT / "samples"); a = ap.parse_args()
    out = a.out; (out / "weeks").mkdir(parents=True, exist_ok=True); (out / "envelopes").mkdir(exist_ok=True)
    roster = Roster.from_rows([{"id": i, "이름": n, "구역": g, "세대": h, "옛이름": o} for i, n, g, h, o in ROSTER])
    roster.save(out / "roster.csv")
    (out / "aliases.json").write_text(json.dumps(ALIASES, ensure_ascii=False, indent=1), encoding="utf-8")
    answers = {}
    for week, (date, lines) in WEEKS.items():
        (out / "weeks" / f"{week}.csv").write_text(bank_csv(date, lines), encoding="utf-8")
        answers[week] = {raw: pid for raw, _, pid in lines}
    (out / "answers.json").write_text(json.dumps(answers, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "envelopes" / "2026-W10.json").write_text(json.dumps(ENVELOPES, ensure_ascii=False, indent=1), encoding="utf-8")
    bench_roster = Roster.from_rows([{"id": i, "이름": n, "구역": g, "세대": ("" if h in ("장동철", "박영수") else h), "옛이름": ""}
                                     for i, n, g, h, o in ROSTER])   # 벤치는 세대주·옛이름 규칙을 끈 사본으로 잰다
    held = []
    for cat, raw, hist, pid, rel in HELD:
        m = rule_match(raw, bench_roster, {})
        assert m.state == "held" and m.unresolved, f"규칙으로 풀린다: {raw} → {m.how}"
        held.append({"category": cat, "raw": raw, "history": [{"raw": r, "person_id": p, "week": w} for r, p, w in hist],
                     "expect": {"person_id": pid, "relation": rel}})
    (out / "held_lines.json").write_text(json.dumps(held, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"샘플 생성: {out}")

if __name__ == "__main__":
    main()
```
HELD 30건은 실행자가 유형별 5건씩 채운다. 참고 — typo 는 자모 2개를 바꾼다(예: 구본영→「구봉형」, 강민철→「감민출」), kind_typo 는 거기에 종류를 붙인다(「구봉형십일조」), company 는 「대성정밀」「한빛식당」「(주)서진유통」「모모스토어」「푸른솔학원」, unknown 은 명부에 없는 이름(「홍길동」「이몽룡」「성춘향」「변학도」「방자」), renamed 는 원문=옛 이름·history 에 그 원문 확정 1건(예: 「유정숙」→p30), family 는 원문=비신도 세대주·history 1건. **`held_lines.json` 벤치는 세대 칸을 비운 사본(bench_roster)으로 돌린다**는 것을 `bench/match_all.py`가 그대로 따른다.

`samples/README.md`: 가공 데이터 선언(이름·금액·상호는 전부 지어낸 값, 실존 개인·단체 정보 없음), 파일 표, 재생성 명령.

- [ ] **Step 4: `engine/__main__.py`**

```python
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
import argparse, json, os, shutil, subprocess, sys
from pathlib import Path
from .csvin import decode
from .model import DEFAULT_URL, health, make_model, server_command
from .pipeline import add_envelopes, confirm, exclude, hold, import_csv, undo_last
from .report import export, week_list
from .roster import Roster
from .store import Workspace


def cmd_init(a):
    ws = Workspace(a.workspace); ws.init()
    if a.roster: ws.save_roster(Roster.load(a.roster))
    if a.aliases: ws._write_aliases(json.loads(Path(a.aliases).read_text(encoding="utf-8")))
    print(f"작업공간: {ws.root} · 명부 {len(ws.roster().people)}명 · 별칭 {len(ws.aliases())}건")

def cmd_import(a):
    ws = Workspace(a.workspace)
    model = None if a.no_model else make_model(a.url)
    if model and not health(a.url): print(f"모델 서버 {a.url} 없음 — 규칙까지만 돌리고 남은 줄은 확인 큐에 둔다")
    text = decode(Path(a.csv).read_bytes())
    for ev in import_csv(ws, text, a.week, a.date or "", Path(a.csv).name, model=model):
        if ev["event"] == "line":
            r = ev["row"]; print(f"{r['id']}  {r['state']:<9} {r['how']:<8} {r['raw']}  {r['amount']:,}")
        elif ev["event"] == "done":
            s = ev["summary"]; print(f"자동 {s['auto']} / 확인 {s['held']} (총 {s['n']}줄, 제외 {s['skipped']})")
        elif ev["event"] in ("skipped", "failed"):
            print(ev.get("note") or ev.get("error")); return 1
    return 0

def cmd_list(a):
    ws = Workspace(a.workspace); roster = ws.roster()
    for r in ws.lines():
        if a.held and r["state"] != "held": continue
        if a.week and r["week"] != a.week: continue
        p = roster.by_id.get(r.get("person_id") or "")
        cands = " | ".join(f"{c['person_id']} {roster.by_id[c['person_id']].name}" for c in r.get("cands", []) if c["person_id"] in roster.by_id)
        print(f"{r['id']}  {r['week']}  {r['state']:<9} {r['how']:<8} {r['raw']:<12} {r['amount']:>10,}  {p.name if p else ''}  {cands}")

def cmd_confirm(a):
    ws = Workspace(a.workspace)
    out = confirm(ws, a.line, person_id=a.person, new_person=({"name": a.new, "group": a.group or ""} if a.new else None), kind=a.kind)
    print(json.dumps(out, ensure_ascii=False)); return 0 if out.get("ok") else 1

def cmd_hold(a):    out = hold(Workspace(a.workspace), a.line, a.why or ""); print(json.dumps(out, ensure_ascii=False)); return 0 if out.get("ok") else 1
def cmd_exclude(a): out = exclude(Workspace(a.workspace), a.line, a.why or ""); print(json.dumps(out, ensure_ascii=False)); return 0 if out.get("ok") else 1
def cmd_undo(a):    print(json.dumps(undo_last(Workspace(a.workspace)), ensure_ascii=False)); return 0

def cmd_envelope(a):
    lines = []
    for s in a.line:
        name, kind, amount = (s.split(",") + ["", ""])[:3]
        lines.append({"name": name, "kind": kind, "amount": int(amount or 0)})
    out = add_envelopes(Workspace(a.workspace), a.week, a.date, lines, a.counted)
    held = sum(1 for r in out["rows"] if r["state"] == "held")
    print(f"봉투 {len(out['rows'])}줄 · 확인 {held} · 합계 {out['total']:,}" + (f" · 계수와 차이 {out['diff']:+,}" if out["diff"] is not None else ""))
    for e in out["errors"]: print("  !", e)
    return 0

def cmd_report(a):
    ws = Workspace(a.workspace)
    name, text = export(ws, a.which, week=a.week, year=a.year)
    print(f"{ws.exports / name}\n" + text.lstrip("﻿")); return 0

def cmd_serve(a):
    cmd = server_command(os.path.expanduser(a.model), a.threads or max(1, (os.cpu_count() or 4) // 2), a.port)
    print(cmd)
    if a.run:
        if not shutil.which("llama-server"): print("llama-server 가 PATH 에 없다"); return 2
        return subprocess.call(cmd.split())
    return 0

def main(argv=None):
    ap = argparse.ArgumentParser(prog="engine", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    p = sp.add_parser("init"); p.add_argument("workspace"); p.add_argument("--roster"); p.add_argument("--aliases"); p.set_defaults(f=cmd_init)
    p = sp.add_parser("import"); p.add_argument("workspace"); p.add_argument("csv"); p.add_argument("--week", required=True); p.add_argument("--date", default=""); p.add_argument("--url", default=DEFAULT_URL); p.add_argument("--no-model", action="store_true"); p.set_defaults(f=cmd_import)
    p = sp.add_parser("list"); p.add_argument("workspace"); p.add_argument("--held", action="store_true"); p.add_argument("--week"); p.set_defaults(f=cmd_list)
    p = sp.add_parser("confirm"); p.add_argument("workspace"); p.add_argument("line"); p.add_argument("--person"); p.add_argument("--new"); p.add_argument("--group"); p.add_argument("--kind"); p.set_defaults(f=cmd_confirm)
    for name, f in (("hold", cmd_hold), ("exclude", cmd_exclude)):
        p = sp.add_parser(name); p.add_argument("workspace"); p.add_argument("line"); p.add_argument("--why"); p.set_defaults(f=f)
    p = sp.add_parser("undo"); p.add_argument("workspace"); p.set_defaults(f=cmd_undo)
    p = sp.add_parser("envelope"); p.add_argument("workspace"); p.add_argument("--week", required=True); p.add_argument("--date", required=True); p.add_argument("--line", action="append", default=[]); p.add_argument("--counted", type=int); p.set_defaults(f=cmd_envelope)
    p = sp.add_parser("report"); p.add_argument("workspace"); p.add_argument("which", choices=["week", "person", "year"]); p.add_argument("--week"); p.add_argument("--year", type=int); p.set_defaults(f=cmd_report)
    p = sp.add_parser("serve"); p.add_argument("--model", required=True); p.add_argument("--threads", type=int); p.add_argument("--port", type=int, default=8107); p.add_argument("--run", action="store_true"); p.set_defaults(f=cmd_serve)
    a = ap.parse_args(argv)
    return a.f(a) or 0

if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 5: 생성·통과 확인**

Run: `.venv/bin/python tools/make_samples.py && .venv/bin/python -m pytest tests/test_samples.py tests/test_cli.py -v`
Expected: 4 passed. 이어서 `.venv/bin/python -m pytest` 전체 통과.

- [ ] **Step 6: Commit**

```bash
git add tools/make_samples.py samples engine/__main__.py tests/test_samples.py tests/test_cli.py && git commit -m "feat: 합성 샘플 생성기·정답·벤치 줄과 엔진 CLI

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: `web/` — 서버·샌드박스·CLI (나비 뼈대 이식)

**Files:**
- Create: `web/server.py`, `web/demo.py`, `web/__main__.py`
- Reference: `~/workspace/02-sandbox/nabi-core/web/server.py`(Handler의 정적 서빙·CORS·SSE·`_send_json`·`Server`·`make_server`), `web/demo.py`(SessionStore)
- Test: `tests/test_web.py`

**Interfaces:**
- Consumes: `engine.pipeline`, `engine.report`, `engine.store`, `engine.model`, `engine.match.ModelResult`, `samples/`
- Produces: `Config(site_dir, mode, workspace=None, samples_dir=None, recorded_path=None, sessions_dir=None, model_url=DEFAULT_URL, device="", session_ttl_s=7200, cors_origins=[], model=None)`, `App(cfg)`, `make_server(cfg, host="127.0.0.1", port=8108, quiet=True)->ThreadingHTTPServer`, `replay_model(recorded: dict)->Callable`(체험용 — 기록에서 모델 결과를 꺼내는 모델 함수), API 표(설계 §6).

**체험 모드 원리.** 방문자마다 작업공간을 만든다(`sessions_dir/<token>/`): `samples/roster.csv`→`명부.csv`, `samples/aliases.json`→별칭. 「불러오기」는 `samples/weeks/<주차>.csv`를 **실제 파이프라인**으로 돌리되 모델만 `replay_model(recorded)`로 바꾼다 — 기록에 `"<주차>|<원문>"` 키로 저장된 `ModelResult`를 돌려준다(없으면 `model_failed`). 그래서 방문자가 W10에서 우리상사를 확정하면 W11 불러오기에서 별칭 사전이 실제로 작동해 자동이 된다. 「지금 다시 재기」만 실제 모델(`cfg.model` 또는 `make_model(cfg.model_url)`)을 부른다. 샌드박스는 첫 요청 때 W10을 자동으로 불러와 둔다(화면이 비어 있지 않게).

`recorded.json` 규격(Task 12 `web/record.py`가 만든다):
```json
{"meta": {"device": "…", "model": "Qwen2.5-1.5B-Instruct Q4_K_M", "threads": 4, "url": "http://127.0.0.1:8107", "ts": "…", "engine_git": "…"},
 "weeks": {"2026-W10": {"date": "2026-03-08", "filename": "2026-W10.csv", "rows": [ …line rows… ], "summary": {"auto": 20, "held": 4, "n": 24, "skipped": 1}}, …},
 "model": {"2026-W10|우리상사": {"pred": {…}, "meta": {…}}, …},
 "roster": [ …Person.public()… ], "aliases": {…}, "answers": {…}}
```

- [ ] **Step 1: 실패하는 테스트**

`tests/test_web.py`(진짜 HTTP, 모델은 주입):
```python
import json
import shutil
import threading
import urllib.request
from http.client import HTTPConnection
from pathlib import Path

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
def recorded(tmp_path_factory):
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
    events = urllib.request.urlopen(urllib.request.Request(
        f"http://127.0.0.1:{srv.server_address[1]}/api/jobs/{job['job']}/events",
        headers={"X-Matjangbu-Session": tok}), timeout=20).read().decode()
    assert "event: state" in events and '"done"' in events
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
    st, u, _ = api(srv, "POST", "/api/undo", {}, tok)
    assert st == 200 and u["id"]
    st, r, tok2 = api(srv, "POST", "/api/reset", {}, tok)
    assert st == 200 and tok2 and tok2 != tok                    # 새 샌드박스, 새 토큰
    _, s2, _ = api(srv, "GET", "/api/state", token=tok2)
    assert all(r["path"] == "csv" for r in s2["lines"])


def test_rematch_streams_and_rejects_auto(srv):
    _, s, tok = api(srv, "GET", "/api/state")
    held = next(r for r in s["lines"] if r["raw"] == "김보라")
    st, job, _ = api(srv, "POST", f"/api/lines/{held['id']}/rematch", {}, tok)
    assert st == 202
    ev = urllib.request.urlopen(urllib.request.Request(
        f"http://127.0.0.1:{srv.server_address[1]}/api/jobs/{job['job']}/events",
        headers={"X-Matjangbu-Session": tok}), timeout=20).read().decode()
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
        urllib.request.urlopen(f"http://127.0.0.1:{s.server_address[1]}/api/jobs/{job['job']}/events", timeout=20).read()
        _, st_, _ = api(s, "GET", "/api/state")
        assert len(st_["lines"]) == 24 and (ws / "들어옴" / "w10.csv").exists()
    finally:
        s.shutdown()
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_web.py -v`
Expected: `ModuleNotFoundError: web.server`

- [ ] **Step 3: `web/server.py`**

나비 `web/server.py`를 복사해 아래만 바꾼다. **그대로 두는 것**: `ApiError`, `Handler.do_GET/do_POST/do_OPTIONS/_cors_origin/end_headers/_dispatch/_static/_send_json/log_message`, `Server`, `make_server`(포트 기본값만 8108). **바꾸는 것**:

```python
ROOT = Path(__file__).resolve().parent.parent
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
        if self.mode == "demo":
            self.recorded = json.loads(Path(self.recorded_path).read_text(encoding="utf-8"))
            if not self.device:
                self.device = self.recorded.get("meta", {}).get("device", "")
        if self.model is None:
            self.model = make_model(self.model_url)


class Job:
    """한 작업 — import 또는 rematch. 이벤트는 append-only 리스트, SSE 가 커서로 읽는다."""
    def __init__(self, kind: str, token: str | None, run: Callable[["Job"], dict]):
        self.id = secrets.token_hex(6); self.kind = kind; self.token = token; self.run_fn = run
        self.state = "queued"; self.events: list[dict] = []; self.result: dict | None = None; self.error = ""
        self.created = time.time(); self.started = 0.0; self.finished = 0.0
    def push(self, ev: dict) -> None: self.events.append(ev)


class Jobs:
    """모델 작업은 한 번에 하나(CPU 하나). 나머지는 줄을 선다."""
    def __init__(self):
        self._q: queue.Queue[Job] = queue.Queue(); self._all: dict[str, Job] = {}; self._lock = threading.Lock()
        threading.Thread(target=self._loop, daemon=True).start()
    def submit(self, job: Job) -> Job:
        with self._lock: self._all[job.id] = job
        self._q.put(job); return job
    def get(self, job_id: str) -> Job | None: return self._all.get(job_id)
    def position(self, job: Job) -> int:
        return sum(1 for j in self._all.values() if j.state == "queued" and j.created < job.created)
    def queued(self) -> int: return sum(1 for j in self._all.values() if j.state in ("queued", "running"))
    def _loop(self) -> None:
        while True:
            job = self._q.get(); job.state = "running"; job.started = time.time()
            try:
                job.result = job.run_fn(job); job.state = "done"
            except Exception as e:
                job.error = f"{type(e).__name__}: {e}"; job.state = "failed"
            job.finished = time.time()


class App:
    def __init__(self, cfg: Config):
        self.cfg = cfg; self.jobs = Jobs(); self._health_cache = (0.0, False)
        if cfg.mode == "demo":
            self.sessions = SessionStore(cfg.sessions_dir, cfg.samples_dir, cfg.recorded, ttl_s=cfg.session_ttl_s)
            self.replay = replay_model(cfg.recorded)
        else:
            self.ws = Workspace(cfg.workspace); self.ws.init()
        self.samples = cfg.samples_dir

    # 세션 → 작업공간
    def workspace(self, token: str | None) -> tuple[Workspace, str | None]:
        if self.cfg.mode == "local": return self.ws, None
        sb = self.sessions.get(token) if token else None
        if sb is None:
            sb = self.sessions.create()
            self.seed(sb.ws)
        sb.touch(); return sb.ws, sb.token

    def seed(self, ws: Workspace) -> None:
        """새 샌드박스에 W10 을 미리 불러와 둔다(모델은 기록 재생)."""
        wk = "2026-W10"; text = (self.samples / "weeks" / f"{wk}.csv").read_text(encoding="utf-8-sig")
        for _ in import_csv(ws, text, wk, self.cfg.recorded["weeks"][wk]["date"], f"{wk}.csv", model=self.replay): pass

    def model_alive(self) -> bool:
        t, ok = self._health_cache
        if time.time() - t > HEALTH_TTL_S:
            ok = health(self.cfg.model_url, timeout=2); self._health_cache = (time.time(), ok)
        return ok

    def health(self) -> dict:
        return {"mode": self.cfg.mode, "device": self.cfg.device, "model_url": self.cfg.model_url,
                "model_alive": self.model_alive(), "queued": self.jobs.queued(),
                "sessions": (len(self.sessions.live()) if self.cfg.mode == "demo" else 1),
                "recorded": self.cfg.recorded.get("meta") if self.cfg.mode == "demo" else None}

    def _view(self, r: dict, roster) -> dict:
        p = roster.by_id.get(r.get("person_id") or "")
        cands = [{**c, "name": roster.by_id[c["person_id"]].name, "group": roster.by_id[c["person_id"]].group}
                 for c in r.get("cands", []) if c.get("person_id") in roster.by_id]
        return {**r, "name": p.name if p else "", "group": p.group if p else "", "cands": cands}

    def state(self, ws: Workspace, week: str | None) -> dict:
        roster = ws.roster(); lines = ws.lines()
        weeks = sorted({r["week"] for r in lines})
        cur = week or (weeks[-1] if weeks else "")
        avail = [w for w in sorted(self.cfg.recorded.get("weeks", {})) if w not in weeks] if self.cfg.mode == "demo" else []
        return {"mode": self.cfg.mode, "week": cur, "weeks": weeks, "weeks_available": avail,
                "lines": [self._view(r, roster) for r in lines if r["week"] == cur],
                "all_count": len(lines), "roster": [p.public() for p in roster.people], "aliases": ws.aliases(),
                "kinds": KINDS, "device": self.cfg.device, "model_alive": self.model_alive(),
                "recorded": self.cfg.recorded.get("meta") if self.cfg.mode == "demo" else None,
                "answers": self.cfg.recorded.get("answers", {}).get(cur, {}) if self.cfg.mode == "demo" else {},
                "can_undo": any(r.get("human") for r in lines)}

    def submit_import(self, ws: Workspace, token: str | None, body: dict) -> Job:
        if self.cfg.mode == "demo":
            wk = body.get("sample_week", "")
            if wk not in self.cfg.recorded.get("weeks", {}): raise ApiError(400, f"샘플 주차가 아니다: {wk}")
            text = (self.samples / "weeks" / f"{wk}.csv").read_text(encoding="utf-8-sig")
            date, filename, model = self.cfg.recorded["weeks"][wk]["date"], f"{wk}.csv", self.replay
        else:
            wk, date, filename, text = body.get("week", ""), body.get("date", ""), body.get("filename", "upload.csv"), body.get("csv_text", "")
            if not wk or not text: raise ApiError(400, "week 와 csv_text 가 필요하다")
            safe = re.sub(r"[^\w.\-가-힣]", "_", Path(filename).name) or "upload.csv"
            (ws.inbox / safe).write_text(text, encoding="utf-8")
            model = self.cfg.model
        def run(job: Job) -> dict:
            last = {}
            for ev in import_csv(ws, text, wk, date, filename, model=model):
                job.push(ev); last = ev
            if last.get("event") in ("failed", "skipped"): raise ApiError(400, last.get("error") or last.get("note", ""))
            return last.get("summary", {})
        return self.jobs.submit(Job("import", token, run))

    def submit_rematch(self, ws: Workspace, token: str | None, line_id: str) -> Job:
        row = ws.get(line_id)
        if row is None: raise ApiError(404, "대장에 없다")
        if row.get("state") != "held": raise ApiError(409, "확인 필요 상태의 줄만 다시 잰다")
        def run(job: Job) -> dict:
            out = rematch(ws, line_id, self.cfg.model)
            if not out.get("ok"): raise ApiError(out.get("status", 400), out.get("error", ""))
            job.push({"event": "line", "row": self._view(out["row"], ws.roster())}); return out["row"]
        return self.jobs.submit(Job("rematch", token, run))

    def confirm(self, ws, line_id, body):   out = confirm(ws, line_id, body.get("person_id"), body.get("new_person"), body.get("kind")); return self._ok(out)
    def hold(self, ws, line_id, body):      return self._ok(hold(ws, line_id, body.get("why", "")))
    def exclude(self, ws, line_id, body):   return self._ok(exclude(ws, line_id, body.get("why", "")))
    def undo(self, ws):                     u = undo_last(ws); return u or {"ok": False, "error": "되돌릴 것이 없다"}
    def envelope(self, ws, body):
        if not body.get("week") or not body.get("date"): raise ApiError(400, "week 와 date 가 필요하다")
        return add_envelopes(ws, body["week"], body["date"], body.get("lines", []), body.get("counted_total"))
    def export(self, ws, which, week, year) -> tuple[str, str]:
        if which not in ("week", "person", "year"): raise ApiError(404, "없는 보고서")
        return export(ws, which, week=week, year=int(year) if year else None)
    def roster_replace(self, ws, body) -> dict:
        if self.cfg.mode == "demo": raise ApiError(403, "체험에서는 명부를 바꿀 수 없다")
        new = Roster.from_csv_text(body.get("csv_text", ""))
        old = ws.roster()
        for p in new.people:                                   # 같은 이름·구역이면 기존 id 유지
            m = [q for q in old.find(p.name) if q.group == p.group]
            if m and not p.id: p.id = m[0].id
        ws.save_roster(Roster.from_rows([p.row() for p in new.people]))
        return {"ok": True, "count": len(new.people)}
    def reset(self, token) -> tuple[dict, str]:
        if self.cfg.mode != "demo": raise ApiError(400, "로컬 모드에는 reset 이 없다")
        if token: self.sessions.drop(token)
        sb = self.sessions.create(); self.seed(sb.ws); return {"ok": True}, sb.token
    @staticmethod
    def _ok(out: dict) -> dict:
        if not out.get("ok"): raise ApiError(out.get("status", 400), out.get("error", ""))
        return out
```

라우트 표(`_ROUTES`, 나비와 같은 `(method, regex, handler)` 형식; `/try/api/...`도 같은 곳으로):
```python
_ROUTES = [
    ("GET",  r"^/api/health$", "_r_health"),
    ("GET",  r"^/api/state$", "_r_state"),
    ("POST", r"^/api/import$", "_r_import"),
    ("GET",  r"^/api/jobs/([0-9a-f]+)/events$", "_r_events"),
    ("GET",  r"^/api/jobs/([0-9a-f]+)$", "_r_job"),
    ("POST", r"^/api/lines/([0-9a-f]+)/confirm$", "_r_confirm"),
    ("POST", r"^/api/lines/([0-9a-f]+)/hold$", "_r_hold"),
    ("POST", r"^/api/lines/([0-9a-f]+)/exclude$", "_r_exclude"),
    ("POST", r"^/api/lines/([0-9a-f]+)/rematch$", "_r_rematch"),
    ("POST", r"^/api/envelope$", "_r_envelope"),
    ("POST", r"^/api/undo$", "_r_undo"),
    ("POST", r"^/api/reset$", "_r_reset"),
    ("GET",  r"^/api/export/(week|person|year)\.csv$", "_r_export"),
    ("POST", r"^/api/roster$", "_r_roster"),
]
```
Handler 메서드: `_r_import`는 체험에서 `csv_text`가 오면 403(`ApiError(403, "체험에서는 파일을 올릴 수 없다")`), 성공 시 202 `{"job": id, "position": n}`. `_r_events`는 `text/event-stream`으로 0.3초마다 새 이벤트를 `event: state\ndata: {"state": job.state, "position": …, **ev}\n\n`로 보내고 `done`/`failed`에서 `{"state": "done", "result": …}` 또는 `{"state": "failed", "error": …}`를 마지막으로 보낸 뒤 끝낸다(연결이 끊기면 조용히 종료). `_r_export`는 `Content-Type: text/csv; charset=utf-8` + `Content-Disposition: attachment; filename*=UTF-8''<url-encoded>`. `_token()`은 헤더 `X-Matjangbu-Session` → 쿠키 `mj_session` 순. `_send_json`은 토큰이 있으면 `Set-Cookie`와 `X-Matjangbu-Session` 헤더 둘 다 싣는다. `state`는 쿼리 `week`를 받는다.

`replay_model`:
```python
def replay_model(recorded: dict) -> Callable:
    """체험용 모델 — 같은 기기에서 미리 잰 결과를 `<주차>|<원문>` 로 찾아 돌려준다. 이 함수는 주차를 모르므로
    원문만으로 찾되, 여러 주차에 같은 원문이 있으면 첫 것을 쓴다(같은 줄은 같은 답)."""
    table: dict[str, dict] = {}
    for key, v in recorded.get("model", {}).items():
        table.setdefault(key.split("|", 1)[1], v)
    def run(raw, cands, roster, history):
        v = table.get(raw)
        if v is None:
            return ModelResult({}, {"note": "기록에 없는 줄"}, error="기록에 없는 줄")
        return ModelResult(v["pred"], {**v["meta"], "replayed": True})
    return run
```

- [ ] **Step 4: `web/demo.py`**

나비 `demo.py`의 `Sandbox`·`SessionStore`를 가져와 `Workspace`에 맞춘다: `create()`는 `sessions_dir/<token>/`에 `Workspace.init()` 후 `samples/roster.csv`→`명부.csv` 복사, `samples/aliases.json`→`.matjangbu/aliases.json` 복사. `get(token)`은 TTL 지난 것을 지운다. `drop(token)`은 그 샌드박스 폴더를 지운다. `live()`는 살아 있는 목록. 상한 200 넘으면 가장 오래된 것부터 지운다. 시작 때 `sessions_dir` 안의 남은 폴더를 전부 지운다.

- [ ] **Step 5: `web/__main__.py`**

나비 `web/__main__.py`와 같은 인자(`--demo`/`--workspace`, `--host`, `--port` 기본 8108, `--url` 기본 8107, `--device`, `--site`, `--samples`(기본 `ROOT/samples`), `--recorded`(기본 `ROOT/site/try/recorded.json`), `--sessions`, `--ttl`, `--cors-origin`, `--verbose`). 시작 메시지에 모델 서버 생존과 허용 origin 을 찍는다.

- [ ] **Step 6: 통과 확인**

`site/` 네 경로가 아직 없으므로 `test_static_cors_and_demo_forbids_upload`의 정적 부분을 위해 Task 12·13 전에 임시 `site/index.html`·`site/try/index.html`·`site/download/index.html`·`site/phone/index.html`(각각 `<h1>` 한 줄)을 만든다. `web/record.py`의 `build_recorded`는 Task 12 것이지만 테스트가 쓰므로 **이 작업에서 먼저 만든다**(아래 Task 12 Step 2 코드).

Run: `.venv/bin/python -m pytest tests/test_web.py -v`
Expected: 6 passed

- [ ] **Step 7: Commit**

```bash
git add web site tests/test_web.py && git commit -m "feat(web): 서버·체험 샌드박스·기록 재생·CLI (나비 뼈대 이식)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: 앱 화면 `site/try/index.html` · 기록 생성기 `web/record.py` · 노트북 모델 준비 · `recorded.json`

**Files:**
- Create: `site/try/index.html`, `site/assets/app.css`(나비에서 복사, 워드마크 규칙만 변경), `web/record.py`, `site/try/recorded.json`(생성물), `tools/site_shots.mjs`
- Reference: `~/workspace/02-sandbox/nabi-core/site/try/index.html`(사이드바·상단바·드로어·토스트·배지·표 골격, `apiBase` 결정 로직), `~/workspace/02-sandbox/nabi-core/web/record.py`

**Interfaces:**
- Consumes: Task 11 API, `samples/`
- Produces: `build_recorded(samples_dir, model, device, model_name, threads, url)->dict`(Task 11 테스트가 이미 쓴다), `recorded.json` 규격(Task 11), 화면 해시 7개, `<meta name="matjangbu-api" content="">`(Task 16이 채운다).

- [ ] **Step 1: 노트북에 llama.cpp 와 모델 준비(sudo 없이)**

```bash
mkdir -p ~/.local/opt ~/.local/bin ~/models
cd ~/.local/opt && gh release download -R ggml-org/llama.cpp --pattern 'llama-*-bin-ubuntu-x64.zip' -D . --clobber \
  && unzip -q -o llama-*-bin-ubuntu-x64.zip -d llama.cpp && rm llama-*-bin-ubuntu-x64.zip
ln -sf ~/.local/opt/llama.cpp/build/bin/llama-server ~/.local/bin/llama-server 2>/dev/null || ln -sf "$(find ~/.local/opt/llama.cpp -name llama-server -type f | head -1)" ~/.local/bin/llama-server
llama-server --version
# 모델 — A31 에 있는 것과 같은 파일을 가져온다(벤치 기기와 sha256 이 같아야 표가 맞다). LAN 이 빠르다.
scp -P 8022 u0_a280@172.30.1.99:models/qwen1.5b.gguf ~/models/ || scp -P 8022 u0_a280@100.74.136.5:models/qwen1.5b.gguf ~/models/
sha256sum ~/models/qwen1.5b.gguf; ssh -p 8022 u0_a280@100.74.136.5 'sha256sum ~/models/qwen1.5b.gguf'
```
Expected: 버전 출력, 두 sha256 일치. `~/.local/bin`이 PATH 에 없으면 `.venv/bin/python -m engine serve`가 알려 주는 명령을 절대 경로로 쓴다. ubuntu 빌드가 glibc 문제로 안 돌면 `cmake -B build -DGGML_NATIVE=ON && cmake --build build -j` 로 소스 빌드(`gh repo clone ggml-org/llama.cpp ~/.local/opt/llama.cpp-src`).

- [ ] **Step 2: `web/record.py`**

```python
#!/usr/bin/env python3
"""미리 잰 결과 — 샘플 4주를 엔진 전체(규칙+모델)로 돌려 `site/try/recorded.json` 을 만든다.

    python3 -m web.record --device "노트북 i7-10750H · 4스레드" --model-name "Qwen2.5-1.5B-Instruct Q4_K_M" --threads 4

체험(/try)은 방문자가 왔을 때 모델을 부르지 않는다. 대신 이 파일에 저장된 `<주차>|<원문>` 별 모델 결과를 재생한다.
그래서 기록에는 어느 기기·언제·어떤 모델인지가 반드시 붙는다. 숫자를 지어 넣지 않는다 — 이 파일은 이 스크립트로만 만든다.
"""
from __future__ import annotations
import argparse, json, subprocess, sys, tempfile, time
from pathlib import Path
from typing import Callable
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from engine.model import DEFAULT_URL, health, make_model
from engine.pipeline import import_csv
from engine.roster import Roster
from engine.store import Workspace

OUT = ROOT / "site" / "try" / "recorded.json"


def build_recorded(samples: Path, model: Callable, device: str, model_name: str, threads: int, url: str) -> dict:
    samples = Path(samples)
    answers = json.loads((samples / "answers.json").read_text(encoding="utf-8"))
    aliases = json.loads((samples / "aliases.json").read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory() as td:
        ws = Workspace(Path(td)); ws.init()
        roster = Roster.load(samples / "roster.csv"); ws.save_roster(roster); ws._write_aliases(aliases)
        weeks, model_rows = {}, {}
        for csv in sorted((samples / "weeks").glob("*.csv")):
            wk = csv.stem; text = csv.read_text(encoding="utf-8-sig")
            date = next((r.get("date", "") for r in []), "")
            summary = {}
            for ev in import_csv(ws, text, wk, "", csv.name, model=model):
                if ev["event"] == "done": summary = ev["summary"]
            rows = [r for r in ws.lines() if r["week"] == wk]
            for r in rows:
                if r.get("model") and r.get("how") == "모델":
                    model_rows[f"{wk}|{r['raw']}"] = {"pred": r["model"].get("pred", {}), "meta": {k: v for k, v in r["model"].items() if k != "pred"}}
            weeks[wk] = {"date": rows[0]["date"] if rows else "", "filename": csv.name, "rows": rows, "summary": summary}
        try:
            git = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
        except Exception:
            git = ""
        return {"meta": {"device": device, "model": model_name, "threads": threads, "url": url,
                         "ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "engine_git": git},
                "weeks": weeks, "model": model_rows, "roster": [p.public() for p in roster.people],
                "aliases": aliases, "answers": answers}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--device", required=True); ap.add_argument("--model-name", required=True)
    ap.add_argument("--threads", type=int, required=True); ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--samples", type=Path, default=ROOT / "samples"); ap.add_argument("--out", type=Path, default=OUT)
    a = ap.parse_args()
    if not health(a.url): print(f"모델 서버 {a.url} 없음"); return 2
    rec = build_recorded(a.samples, make_model(a.url), a.device, a.model_name, a.threads, a.url)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
    n = len(rec["model"]); print(f"{a.out} — 주차 {len(rec['weeks'])} · 모델 줄 {n} · {a.device}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
```
(`date = next(...)` 줄은 삭제한다 — 날짜는 CSV 줄에서 온다.)

- [ ] **Step 3: `site/assets/app.css`**

나비 `site/assets/app.css`를 복사한다. 바꾸는 것: 주석 머리의 제품명, 로고 마크(초록 사각 안 두 삼각형 → 초록 사각 안 「장부」를 뜻하는 두 줄 인라인 SVG는 각 페이지에 있으므로 CSS 는 색·컴포넌트만). 색·컴포넌트·사이드바 240·상단바 56·드로어 420·토스트 3초 규격은 그대로.

- [ ] **Step 4: `site/try/index.html`**

바닐라 JS 한 파일, 해시 라우팅. 구조와 핵심 코드:

```html
<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>맞장부 — 앱</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="matjangbu-api" content="">   <!-- Task 16: 체험 인스턴스 주소(쉼표로 여럿) -->
<link rel="stylesheet" href="../assets/app.css"></head>
<body><svg hidden>…아이콘 스프라이트(i-dashboard i-import i-envelope i-queue i-records i-roster i-device i-search i-undo i-check i-hold i-x i-replay i-download)…</svg>
<div class="app"><aside class="sidebar">워드마크 「맞장부」<span class="badge-gray">잠정명</span> · 나브 7 · 하단 「예시 데이터」 배지(체험/읽기 전용일 때)</aside>
<header class="topbar">검색 · 현재 주차 select · 「마지막 확정 되돌리기」 · 모델 상태 점</header>
<div id="banner" hidden class="banner-amber"></div>
<main id="main"></main><aside id="drawer" class="drawer" hidden></aside><div id="toast" hidden></div></div>
<script>
(function () {
  'use strict';
  var BASE = location.pathname.replace(/[^/]*$/, '');            // …/try/
  var META = (document.querySelector('meta[name=matjangbu-api]').content || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var api = { base: null, readOnly: false, token: null, recorded: null };
  try { api.token = localStorage.getItem('mj_session'); } catch (e) {}
  var S = { state: null, week: null, screen: 'dashboard', q: '' };

  function hdrs(extra) { var h = Object.assign({ 'Content-Type': 'application/json' }, extra || {}); if (api.token) h['X-Matjangbu-Session'] = api.token; return h; }
  function remember(res) { var t = res.headers.get('X-Matjangbu-Session'); if (t) { api.token = t; try { localStorage.setItem('mj_session', t); } catch (e) {} } }
  function call(method, path, body) {
    return fetch(api.base + 'api' + path, { method: method, headers: hdrs(), body: body === undefined ? undefined : JSON.stringify(body), credentials: 'include' })
      .then(function (r) { remember(r); return r.json().then(function (j) { if (!r.ok) throw Object.assign(new Error(j.error || r.status), { status: r.status }); return j; }); });
  }
  function probe(base) { return fetch(base + 'api/health', { headers: hdrs(), credentials: 'include' }).then(function (r) { remember(r); return r.ok ? base : null; }).catch(function () { return null; }); }
  function resolve() {                                             // 삼중 폴백: 같은 origin → meta 인스턴스 → recorded.json
    return probe(BASE).then(function (b) { if (b) return b; return META.reduce(function (p, u) { return p.then(function (b) { return b || probe(u.replace(/\/?$/, '/')); }); }, Promise.resolve(null)); })
      .then(function (b) {
        if (b) { api.base = b; return; }
        api.readOnly = true;
        return fetch(BASE + 'recorded.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (rec) { api.recorded = rec; });
      });
  }
  function loadState(week) {
    if (api.readOnly) { S.state = stateFromRecorded(api.recorded, week); return Promise.resolve(S.state); }
    return call('GET', '/state' + (week ? '?week=' + encodeURIComponent(week) : '')).then(function (s) { S.state = s; S.week = s.week; return s; });
  }
  function stateFromRecorded(rec, week) { … rec.weeks[week||첫 주차].rows 에 name/group/cands.name 을 rec.roster 로 붙여 state 모양으로 … mode:'recorded' }
  function stream(path, onEvent) {                                // SSE 를 fetch 로 읽는다(헤더가 필요해 EventSource 를 못 쓴다)
    return fetch(api.base + 'api' + path, { headers: hdrs(), credentials: 'include' }).then(function (r) {
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = '';
      function pump() { return reader.read().then(function (x) {
        if (x.done) return; buf += dec.decode(x.value, { stream: true });
        var parts = buf.split('\n\n'); buf = parts.pop();
        parts.forEach(function (chunk) { var m = /data: (.*)/.exec(chunk); if (m) onEvent(JSON.parse(m[1])); });
        return pump(); }); }
      return pump(); });
  }
  // 화면 7 — 각각 render<Name>(root, state) 함수. 라우터는 hashchange 로 S.screen 을 바꾸고 render() 한다.
  // 대시보드: 타일 4 · 확인 사유 분포 막대(REASON 라벨: dup 동명이인 family 가족 명의 company 회사 명의 renamed 개명 typo 오타 unknown 모름 model_failed 모델 미실행) · 최근 활동(human/undo 줄 10개) · 모델 처리 시간(rows[].model.wall_s 평균·최소·최대) · 체험이면 「샘플 정답 대조」(auto 줄의 person_id 와 state.answers[raw] 비교, 사람이 고친 줄 제외)
  // 불러오기: 체험 → weeks_available select + 「맞추기」; 로컬 → 주차·날짜·파일(FileReader.readAsArrayBuffer → TextDecoder utf-8, U+FFFD 가 있으면 euc-kr 재시도) → 미리보기 10줄 → POST /import → stream(jobs/{id}/events): 진행 막대 i/n, 줄마다 표에 붙이고, done 이면 「자동 n / 확인 m」 대비 숫자 크게
  // 봉투 입력: 주차·날짜 · 줄 입력 행(이름 input list=roster datalist · 종류 select(state.kinds) · 금액) · 「줄 추가」 · 합계와 계수 총액 input 의 차이 · 「저장」 → POST /envelope → 결과 표(확정/확인)
  // 확인 큐: held 줄 카드 — 원문·금액·종류·사유(REASON 라벨)·후보 버튼(이름·구역·why)·「새 이름으로 등록」(allow_new 일 때, 이름·구역 폼)·「보류」·「제외」·「지금 다시 재기」(stream, 진행 중 표시) · 확정 시 토스트 「별칭 사전에 저장됨 · 다음부터 자동」(alias_learned 있을 때) 또는 「확정」
  // 기록: 탭 3(주간 명단·개인별 누적·연말 합산) — 주간은 state.lines 에서 계산해 표(사람 손 줄 먼저), 개인별·연말은 GET export 대신 화면 계산은 state.lines 의 현재 주차만 있으므로 서버 계산이 필요 → GET /export/{which}.csv 를 fetch(헤더) → 텍스트를 파싱해 표로, 「CSV 내보내기」는 같은 텍스트를 Blob 으로 다운로드. 읽기 전용이면 주간만.
  // 명부·별칭: 명부 표(id·이름·구역·세대·옛이름) · 별칭 사전 표(원문→사람·배운 날·출처 줄) · 로컬이면 명부 CSV 파일 → POST /roster
  // 기기: health(mode·device·model_url·model_alive·queued·sessions) · recorded.meta · /phone 링크
  // 드로어: 줄 클릭 → 원문·금액·종류·경로·상태·근거·후보(why)·모델 메타(model/wall_s/prompt_n/pp/tg/note, replayed 면 「미리 잰 값」)·체험이면 정답 · 액션 버튼(큐와 동일)
  // 상단바 검색은 lines 를 raw/name 으로 필터. 「마지막 확정 되돌리기」는 state.can_undo 일 때만.
  // 읽기 전용(api.readOnly): 배너 「체험 인스턴스가 응답하지 않습니다 · <기기>에서 <시각>에 미리 잰 기록을 보여줍니다」, 액션 버튼 전부 disabled, 주차 select 는 recorded.weeks 로.
  resolve().then(function () { return loadState(); }).then(render).catch(function (e) { showBanner('화면을 시작하지 못했습니다: ' + e.message); });
})();
</script></body></html>
```
`[data-demo=…]` 훅은 필요 없다(녹화 없음). 모든 `id` 는 `data-*` 대신 `id`. 화면 아래 각주(체험): 「예시 데이터입니다 · 실제 단체 자료가 아닙니다 · 모델 판정은 <기기>에서 미리 잰 값이고 「지금 다시 재기」만 실제로 돕니다」.

- [ ] **Step 5: 기록 생성(노트북)**

```bash
cd ~/Projects/03-personal/matjangbu
(setsid nohup llama-server -m ~/models/qwen1.5b.gguf --host 127.0.0.1 --port 8107 -c 2048 -ub 128 -b 512 -t 4 --jinja -fa on --no-warmup > /tmp/claude-1000/llama-8107.log 2>&1 < /dev/null &)
until curl -sf http://127.0.0.1:8107/health >/dev/null; do sleep 2; done
.venv/bin/python -m web.record --device "노트북 $(lscpu | sed -n 's/Model name: *//p' | head -1) · 4스레드" --model-name "Qwen2.5-1.5B-Instruct Q4_K_M" --threads 4
.venv/bin/python -c "import json;d=json.load(open('site/try/recorded.json'));print({w:v['summary'] for w,v in d['weeks'].items()}, len(d['model']))"
```
Expected: 주차 4, 요약 W10 20/4 · W11 18/4 · W12 16/4 · W13 18/2, 모델 줄 9~11개(우리상사·김보라·대성정밀이 주차마다).

- [ ] **Step 6: 화면 검수(Playwright)**

`tools/site_shots.mjs`: `NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/site_shots.mjs <out> [--base http://127.0.0.1:8108]` — 1600×900 으로 `01-landing`·`02-queue-drawer`(대표)·`03-import-done`·`04-records`·`05-dashboard` 를 찍는다. 체험 서버를 띄운 뒤(`.venv/bin/python -m web --demo`) 실행해 다섯 장을 눈으로 본다(넘침·빈 표·깨진 글자). 읽기 전용 확인: `python3 -m http.server 8123 --bind 127.0.0.1 --directory site` 로 띄워 `/try/`에 앰버 배너와 W10 표가 보이는지 스크린샷 1장.

- [ ] **Step 7: 통과 확인·Commit**

Run: `.venv/bin/python -m pytest` 전체 통과.
```bash
git add site web/record.py tools/site_shots.mjs && git commit -m "feat(site): 앱 화면(삼중 폴백)·기록 생성기·노트북 기록

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: 랜딩·설치·지원 기기 페이지와 사이트 검증

**Files:**
- Create: `site/index.html`, `site/download/index.html`, `site/phone/index.html`, `site/assets/dashboard.jpg`, `tools/verify_site.mjs`
- Reference: `~/workspace/02-sandbox/nabi-core/site/index.html`(섹션 구조·인라인 CSS 방식), `site/download/index.html`, `site/phone/index.html`; `~/Projects/02-hackathon/modoo-startup-2026/docs/application-draft.md`(문구 근거), `docs/application-notes.md`의 수치 대장

**Interfaces:**
- Produces: 네 경로 정적 페이지, `verify_site.mjs`(종료 코드 0/1).

- [ ] **Step 1: `site/index.html`(랜딩, 파일 하나, CSS 인라인, 외부 자원 0)**

섹션과 문구(재지 않은 숫자 없음):
1. **히어로** — 워드마크 「맞장부」+「잠정명」 배지 · 한 줄 「봉투와 통장의 이름을 명부와 맞추고, 매주 기록하고, 연말에 합산합니다. 단체 PC 안에서 끝납니다.」 · 버튼 「체험하기 →/try/」「설치 →/download/」 · 스크린샷 `assets/dashboard.jpg`(`02-queue-drawer`를 1600 폭 JPG, Playwright `screenshot({type:'jpeg',quality:82})`) · 「예시 데이터」 배지.
2. **문제 한 줄** — 수거→계수→이름 대조→기록→전산 입력→연말 기부금영수증 사슬. 사람 손에 걸리는 두 칸(통장 입금자명, 봉투 이름 치기). 신청서 Q3-1 문장에서 가져오되 인터뷰 수치(「거의 매주 한 번」)는 「한 교회 인터뷰(2026-09-16)」 출처를 붙여 적는다.
3. **작동 방식** — 인라인 SVG 도식 4칸: 불러오기(은행 CSV·봉투 입력) → 3단 대조(규칙 2단·모델 1단) → 확인 큐(사람이 고름·별칭 사전 적립) → 기록(주간·개인별·연말·엑셀). 각 칸 아래 「결정론 / 모델 / 사람 / 결정론」.
4. **기능 6** — 은행 CSV 불러오기 · 봉투 입력(명부 자동완성) · 별칭 사전(고른 답이 다음 주부터 자동) · 확인 큐(확신이 낮으면 묻는다) · 기록 3종 · 엑셀로 열리는 내보내기.
5. **AI 활용 방식** — 「언어모델이 하는 일은 한 칸뿐입니다」: 규칙이 못 푼 줄의 후보 순서와 근거. 결과는 항상 확인 큐. 동명이인은 자동 확정하지 않음. 기본 모델 Qwen2.5-1.5B-Instruct(Apache-2.0), llama.cpp.
6. **실측** — 표: 기기 · 모델 · 스레드 · 확인 줄 1건당 초 · pp/tg tok/s · 후보 1위 정답률(30건). 행은 `bench/results/`에서만 가져온다(Task 14 뒤에 채운다; 그 전에는 「측정 예정」 한 행).
7. **지원 기기** — 폐폰(갤럭시 A31 4GB) · 노트북 · 「2013년 이전 PC는 측정 예정」.
8. **요금** — 「구독형으로 준비 중입니다. 가격은 다섯 곳 이상 인터뷰 뒤 정합니다.」 가격 숫자 없음.
9. **FAQ** — PC가 고장 나면? (명부·별칭·대장이 엑셀로 열리는 파일과 JSON 이라 복사해 두면 된다 · 암호화 백업은 준비 중) · 인터넷이 필요한가? (아니오) · 실제 자료를 올리나? (이 사이트의 체험은 가공 데이터만 · 설치형은 단체 PC 안) · 후임자가 이어받을 수 있나? (별칭 사전과 대장이 파일로 남는다).
10. **도구·라이선스** — Python 표준 라이브러리 · llama.cpp(MIT) · Qwen2.5-1.5B-Instruct(Apache-2.0) · 나비(nabi-core, Apache-2.0)에서 가져온 코드 · 이 저장소 Apache-2.0 · 링크는 `https://github.com/StopOrder/matjangbu` 만.
푸터: 「모두의창업 시즌2 도전 과제(I-009) · 시제품 · 정지명」.

- [ ] **Step 2: `site/download/index.html`**

요구 사양(파이썬 3.10+, llama-server, RAM 4GB 이상, 인터넷 불필요) · 설치 절차(저장소 받기 → 모델 파일 한 개 → `python3 -m engine init ~/맞장부 --roster 명부.csv` → `python3 -m engine serve --model … --run` → `python3 -m web --workspace ~/맞장부` → 브라우저 `http://127.0.0.1:8108/try/`) · 설치하면 생기는 것(작업공간 폴더 구조 표) · 개발자 명령(테스트·벤치·기록) · 「설치 프로그램·zip: 준비 중」 · 로컬 모드는 `127.0.0.1`에만 열라는 경고.

- [ ] **Step 3: `site/phone/index.html`**

기기 카드: 갤럭시 A31(SM-A315N · 4GB · Helio P65 · A55×6 + A75×2 · Android 12 · 2020년) — 「동생이 쓰던 폰」 같은 개인 서사는 쓰지 않는다. 실측표(Task 14 결과로 채움: 모델×스레드 행, 줄당 초·pp·tg·후보 1위 정답률·후보 3 안 비율·JSON 실패율) · 노트북 대조 행 · Termux 절차(`pkg install llama-cpp python` → 모델 파일 → `bench/bench.sh`) · 「발열·장시간: 측정 예정」 · 「A31 은 실측 기기이지 서버가 아닙니다」 한 줄.

- [ ] **Step 4: `tools/verify_site.mjs`**

```js
// NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.mjs --base http://127.0.0.1:8123 [--expect-banner]
// 네 경로: 외부 요청 0 · 콘솔 에러 0 · <h1> 존재. --expect-banner 면 /try/ 에 앰버 배너가 보여야 하고, 아니면 보이면 안 된다.
import { chromium } from 'playwright';
const args = process.argv.slice(2); const base = (args[args.indexOf('--base') + 1] || 'http://127.0.0.1:8123').replace(/\/$/, '');
const expectBanner = args.includes('--expect-banner');
const origin = new URL(base).origin;
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const external = [], errors = [];
page.on('request', r => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:')) external.push(r.url()); });
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
let bad = 0;
for (const p of ['/', '/try/', '/download/', '/phone/']) {
  await page.goto(base + p, { waitUntil: 'networkidle' });
  const h1 = await page.locator('h1').count();
  if (h1 < 1) { console.log(`✗ ${p}: <h1> 없음`); bad++; } else console.log(`✓ ${p}: h1 ${h1}`);
  if (p === '/try/') {
    await page.waitForTimeout(1500);
    const banner = await page.locator('#banner:not([hidden])').count();
    if (expectBanner !== (banner > 0)) { console.log(`✗ /try/: 배너 ${banner > 0 ? '보임' : '없음'} (기대: ${expectBanner ? '보임' : '없음'})`); bad++; }
    const rows = await page.locator('main table tbody tr').count();
    if (rows < 1) { console.log('✗ /try/: 표가 비어 있다'); bad++; } else console.log(`✓ /try/: 표 ${rows}행`);
  }
}
const ext = external.filter(u => !u.startsWith('https://stoporder.github.io') || !u.startsWith(origin));
if (ext.length) { console.log('✗ 외부 요청:', [...new Set(ext)]); bad++; } else console.log('✓ 외부 요청 0');
if (errors.length) { console.log('✗ 콘솔 에러:', errors); bad++; } else console.log('✓ 콘솔 에러 0');
await browser.close(); process.exit(bad ? 1 : 0);
```
주의: 인스턴스 주소(meta)가 채워진 뒤에는 `/try/`가 그 주소를 부르는 것이 정상이다. 그때는 `--allow <인스턴스 origin>` 인자를 받아 그 origin 을 외부에서 제외한다(구현 시 `args` 에서 읽어 `external` 필터에 넣는다).

- [ ] **Step 5: 검증**

```bash
cd ~/Projects/03-personal/matjangbu
(python3 -m http.server 8123 --bind 127.0.0.1 --directory site >/dev/null 2>&1 &) ; sleep 1
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.mjs --base http://127.0.0.1:8123 --expect-banner
# 체험 서버로도
(.venv/bin/python -m web --demo --port 8108 >/dev/null 2>&1 &) ; sleep 1
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.mjs --base http://127.0.0.1:8108
```
Expected: 둘 다 종료 코드 0. `.venv/bin/python -m pytest` 전체 통과(정적 `<h1>` 검사 포함).

- [ ] **Step 6: Commit**

```bash
git add site tools/verify_site.mjs && git commit -m "feat(site): 랜딩·설치·지원 기기 페이지와 외부 요청 0 검증

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: 벤치 — 노트북과 갤럭시 A31 실측

**Files:**
- Create: `bench/bench.sh`, `bench/match_all.py`, `bench/README.md`, `bench/results/<기기>-<모델>-<스레드>t-<시각>.md/.jsonl`
- Modify: `site/index.html`(실측 표), `site/phone/index.html`(실측 표), `site/try/index.html`(기기 화면 링크 확인)

**Interfaces:**
- Consumes: `samples/held_lines.json`, `samples/roster.csv`, `engine.match.rule_match/top_similar`, `engine.model.rank/health`
- Produces: 결과 파일 규격(아래). 사이트 표의 모든 숫자는 이 파일에서만 온다.

- [ ] **Step 1: `bench/match_all.py`**

```python
#!/usr/bin/env python3
"""3단(모델)만 30건 잰다 — held_lines.json 의 줄마다 규칙이 세운 상위 후보 5명과 이력을 주고 모델의 후보 JSON 을 받는다.

    python3 bench/match_all.py --url http://127.0.0.1:8107 --device "SM-A315N" --model-name qwen --threads 8 [--limit 5]

측정: 줄당 wall_s · prompt_n · pp_tps · tg_tps · JSON 성공 · 후보 1위 정답 · 후보 3 안 정답 · relation 정답.
결과: bench/results/<device>-<model>-<threads>t-<YYYYMMDD-HHMM>.jsonl(원자료) + .md(표). 세대주·옛이름 규칙은 끈 명부 사본으로 돈다(make_samples 와 같은 조건).
"""
from __future__ import annotations
import argparse, json, platform, statistics, subprocess, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from engine.hangul import norm, strip_kind
from engine.match import rule_match, top_similar
from engine.model import health, rank
from engine.roster import Roster


def bench_roster(path: Path) -> Roster:
    r = Roster.load(path)
    return Roster.from_rows([{"id": p.id, "이름": p.name, "구역": p.group,
                              "세대": ("" if p.household and not p.household.startswith("H") else p.household), "옛이름": ""} for p in r.people])


def device_name(given: str) -> str:
    if given: return given
    try: return subprocess.run(["getprop", "ro.product.model"], capture_output=True, text=True, timeout=3).stdout.strip() or platform.node()
    except Exception: return platform.node()


def main() -> int:
    ap = argparse.ArgumentParser(); ap.add_argument("--url", default="http://127.0.0.1:8107"); ap.add_argument("--device", default="")
    ap.add_argument("--model-name", required=True); ap.add_argument("--threads", type=int, required=True); ap.add_argument("--limit", type=int)
    ap.add_argument("--samples", type=Path, default=ROOT / "samples"); ap.add_argument("--out", type=Path, default=ROOT / "bench" / "results")
    ap.add_argument("--sleep", type=float, default=2.0); a = ap.parse_args()
    if not health(a.url): print(f"모델 서버 {a.url} 없음"); return 2
    roster = bench_roster(a.samples / "roster.csv")
    lines = json.loads((a.samples / "held_lines.json").read_text(encoding="utf-8"))[: a.limit or None]
    dev = device_name(a.device); stamp = time.strftime("%Y%m%d-%H%M")
    a.out.mkdir(parents=True, exist_ok=True)
    base = a.out / f"{dev}-{a.model_name}-{a.threads}t-{stamp}"
    rows = []
    for i, h in enumerate(lines):
        m = rule_match(h["raw"], roster, {}); assert m.state == "held" and m.unresolved, h["raw"]
        name_part, _ = strip_kind(norm(h["raw"]))
        cands = [p for p, _ in top_similar(name_part, roster, 5)]
        res = rank(h["raw"], cands, roster, h.get("history", []), url=a.url)
        ids = [str(c.get("id")) for c in (res.pred.get("candidates") or [])] if res.ok else []
        want = h["expect"]["person_id"]
        row = {"i": i, "category": h["category"], "raw": h["raw"], "ok": res.ok, "error": res.error, "pred": res.pred, **res.meta,
               "want": want, "top1": (ids[:1] == [want]) if want else None, "top3": (want in ids[:3]) if want else None,
               "relation_ok": (res.pred.get("relation") == h["expect"]["relation"]) if res.ok else False}
        rows.append(row); (base.with_suffix(".jsonl")).open("a", encoding="utf-8").write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"{i + 1:2}/{len(lines)} {h['category']:<9} {h['raw']:<12} {row.get('wall_s', 0):6.1f}s pp {row.get('pp_tps') or 0:5.1f} tg {row.get('tg_tps') or 0:4.1f} "
              f"{'✓' if row['top1'] else ('·' if row['top1'] is None else '✗')} rel {'✓' if row['relation_ok'] else '✗'}", flush=True)
        time.sleep(a.sleep)
    ok = [r for r in rows if r["ok"]]; scored = [r for r in rows if r["top1"] is not None]
    walls = [r["wall_s"] for r in ok] or [0]
    summary = {"device": dev, "model": a.model_name, "threads": a.threads, "n": len(rows), "json_ok": len(ok),
               "top1": sum(1 for r in scored if r["top1"]), "top3": sum(1 for r in scored if r["top3"]), "scored": len(scored),
               "relation_ok": sum(1 for r in rows if r["relation_ok"]),
               "wall_mean": round(statistics.mean(walls), 1), "wall_min": round(min(walls), 1), "wall_max": round(max(walls), 1),
               "pp_mean": round(statistics.mean([r["pp_tps"] for r in ok if r.get("pp_tps")] or [0]), 1),
               "tg_mean": round(statistics.mean([r["tg_tps"] for r in ok if r.get("tg_tps")] or [0]), 1),
               "prompt_n_mean": round(statistics.mean([r["prompt_n"] for r in ok if r.get("prompt_n")] or [0])), "ts": stamp, "url": a.url}
    by_cat = {}
    for r in rows: c = by_cat.setdefault(r["category"], {"n": 0, "top1": 0, "rel": 0}); c["n"] += 1; c["top1"] += bool(r["top1"]); c["rel"] += bool(r["relation_ok"])
    md = [f"# {dev} · {a.model_name} · {a.threads}스레드 · {stamp}", "", f"- 줄 {summary['n']}건 · JSON 성공 {summary['json_ok']} · 후보 1위 정답 {summary['top1']}/{summary['scored']} · 후보 3 안 {summary['top3']}/{summary['scored']} · relation 정답 {summary['relation_ok']}/{summary['n']}",
          f"- 줄당 {summary['wall_mean']}초(최소 {summary['wall_min']} · 최대 {summary['wall_max']}) · pp {summary['pp_mean']} tok/s · tg {summary['tg_mean']} tok/s · 프롬프트 평균 {summary['prompt_n_mean']} 토큰", "",
          "| 유형 | 건수 | 1위 정답 | relation 정답 |", "|---|---|---|---|"] + [f"| {c} | {v['n']} | {v['top1']} | {v['rel']} |" for c, v in by_cat.items()] + ["", "```json", json.dumps(summary, ensure_ascii=False), "```"]
    base.with_suffix(".md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"끝: {base.with_suffix('.md')}"); return 0

if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: `bench/bench.sh`**

```bash
#!/usr/bin/env bash
# bench/bench.sh --model qwen|hyperclova [--threads "8,4"] [--taskset "6,7:2"] [--quick] [--device NAME] [--models-dir ~/models]
# 모델 파일: qwen=qwen1.5b.gguf(Qwen2.5-1.5B-Instruct Q4_K_M, Apache-2.0) · hyperclova=hyperclova1.5b.gguf(HyperCLOVAX-SEED-1.5B Q4_K_M, 라이선스 자체 약관 — 비교값 전용)
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"; MODEL=qwen; THREADS="8,4"; TASKSET=""; LIMIT=""; DEVICE=""; MODELS="$HOME/models"; PORT=8107
while [ $# -gt 0 ]; do case "$1" in
  --model) MODEL="$2"; shift 2;; --threads) THREADS="$2"; shift 2;; --taskset) TASKSET="$2"; shift 2;;
  --quick) LIMIT="--limit 5"; shift;; --device) DEVICE="$2"; shift 2;; --models-dir) MODELS="$2"; shift 2;; *) echo "모르는 인자 $1"; exit 2;; esac; done
case "$MODEL" in qwen) FILE="$MODELS/qwen1.5b.gguf";; hyperclova) FILE="$MODELS/hyperclova1.5b.gguf";; *) echo "모델은 qwen|hyperclova"; exit 2;; esac
[ -f "$FILE" ] || { echo "모델 파일 없음: $FILE"; exit 2; }
export OMP_NUM_THREADS=1
for T in ${THREADS//,/ }; do
  PIN=""; if [ -n "$TASKSET" ] && [ "${TASKSET##*:}" = "$T" ]; then PIN="taskset -c ${TASKSET%%:*}"; fi
  echo "== $MODEL · ${T}스레드 $PIN"
  $PIN llama-server -m "$FILE" --host 127.0.0.1 --port $PORT -c 2048 -ub 128 -b 512 -t "$T" --jinja -fa on --no-warmup > "$HERE/bench/results/server-$MODEL-$T.log" 2>&1 &
  SRV=$!
  for i in $(seq 1 90); do curl -sf "http://127.0.0.1:$PORT/health" >/dev/null && break; sleep 2; done
  curl -sf "http://127.0.0.1:$PORT/health" >/dev/null || { echo "서버가 안 뜬다 — $HERE/bench/results/server-$MODEL-$T.log"; kill $SRV || true; exit 3; }
  python3 "$HERE/bench/match_all.py" --url "http://127.0.0.1:$PORT" --device "$DEVICE" --model-name "$MODEL" --threads "$T" $LIMIT || true
  kill $SRV || true; wait $SRV 2>/dev/null || true; sleep 3
done
echo "끝: $(ls -t "$HERE"/bench/results/*.md | head -2 | tr '\n' ' ')"
```
`bench/README.md`: 절차(노트북·A31), 함정 3개(setsid 필요 · pgrep 판정 금지 · 화면 꺼짐은 wakelock), 결과 읽는 법, 모델 라이선스 표기.

- [ ] **Step 3: 노트북 실측**

```bash
cd ~/Projects/03-personal/matjangbu && mkdir -p bench/results && chmod +x bench/bench.sh
pkill -f 'llama-server.*8107' || true
.venv/bin/python -c "print(1)" && PATH=~/.local/bin:$PATH bash bench/bench.sh --model qwen --threads 4 --device "노트북-$(lscpu | sed -n 's/Model name: *//p' | head -1 | tr ' ' '-')"
```
Expected: `bench/results/노트북-…-qwen-4t-….md` 생성, 30건 전부 JSON 성공 여부와 정답률이 찍힌다. (파이썬은 `.venv` 가 아니라 시스템 `python3` 로도 돈다 — 의존성 0.)

- [ ] **Step 4: A31 실측(폰에 파이썬 설치·전송·분리 실행)**

```bash
A31="ssh -p 8022 u0_a280@100.74.136.5"
$A31 'pkg install -y python >/dev/null 2>&1; python3 --version; pkill -f "llama-cli -m" || true; free -m | sed -n 2p'   # 유휴 llama-cli 종료(사용자 승인 2026-09-20)
cd ~/Projects/03-personal/matjangbu && $A31 'mkdir -p ~/matjangbu-bench/bench/results'
tar czf - engine bench/bench.sh bench/match_all.py samples/roster.csv samples/held_lines.json | $A31 'cd ~/matjangbu-bench && tar xzf - && chmod +x bench/bench.sh && echo OK'
$A31 'cd ~/matjangbu-bench && termux-wake-lock; (setsid nohup bash bench/bench.sh --model qwen --threads 8,4 --taskset 6,7:2 --device SM-A315N > a31-qwen.log 2>&1 < /dev/null &)'
# 진행: $A31 'tail -3 ~/matjangbu-bench/a31-qwen.log'  — 마지막 줄 「끝:」 이면 완료(pgrep 으로 판정하지 않는다)
# 완료 뒤 HyperCLOVAX 비교:
$A31 'cd ~/matjangbu-bench && (setsid nohup bash bench/bench.sh --model hyperclova --threads 8 --device SM-A315N > a31-hc.log 2>&1 < /dev/null &)'
scp -P 8022 'u0_a280@100.74.136.5:matjangbu-bench/bench/results/SM-A315N-*' bench/results/
```
주의: 스레드 8 → 4 순서로 돌고, `--taskset 6,7:2`는 스레드 2일 때만 빅코어 고정이므로 `--threads 8,4,2`로 늘려 2도 잰다(A75 두 개 고정 조건). 한 줄에 60초를 넘기면 `--quick`으로 먼저 5건을 재고 판단한다. 폰 메모리 부족(LMK)으로 sshd 가 죽으면 폰 화면에서 Termux 를 다시 열어야 한다 — 그래서 실행 전 llama-cli 를 반드시 내린다.

- [ ] **Step 5: 표 채우기와 검증**

`site/index.html`·`site/phone/index.html`의 실측 표를 `bench/results/*.md`의 summary JSON 값으로 채운다(기기·모델·스레드·줄당 초·pp·tg·1위 정답률·3 안 비율·JSON 성공률). HyperCLOVAX 행에는 「라이선스: 자체 약관 · 비교값」을 적는다. `python3 -c` 로 md 의 summary 를 읽어 HTML 표 행을 찍는 짧은 스크립트(`tools/bench_table.py`)를 두어 손으로 옮기지 않는다.

Run: `NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.mjs --base http://127.0.0.1:8123 --expect-banner`
Expected: 0

- [ ] **Step 6: Commit**

```bash
git add bench site tools/bench_table.py && git commit -m "bench: 노트북·갤럭시 A31 3단 실측과 사이트 표

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: GitHub 공개 저장소와 GitHub Pages

**Files:**
- Modify: `README.md`(완성: 무엇을 하나·실행 방법·테스트·실측·샘플 선언·라이선스, 나비 README 구조), `docs/design-notes.md`(설계 결정 요약 — 스펙 §12)

- [ ] **Step 1: README 완성·커밋**

```bash
git add README.md docs/design-notes.md && git commit -m "docs: README·설계 노트

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 2: 저장소 생성·푸시**

```bash
cd ~/Projects/03-personal/matjangbu
gh repo create StopOrder/matjangbu --public --source=. --remote=origin --push \
  --description "맞장부 — 종교단체 헌금 이름 맞춤·기록 도우미, 온디바이스 sLLM (Apache-2.0)"
git subtree push --prefix site origin gh-pages
gh api -X POST repos/StopOrder/matjangbu/pages -f 'source[branch]=gh-pages' -f 'source[path]=/' 2>/dev/null || gh api -X PUT repos/StopOrder/matjangbu/pages -f 'source[branch]=gh-pages' -f 'source[path]=/'
for i in $(seq 1 30); do curl -sI https://stoporder.github.io/matjangbu/ | head -1 | grep -q 200 && break; sleep 10; done
curl -sI https://stoporder.github.io/matjangbu/ | head -1; curl -sI https://stoporder.github.io/matjangbu/try/ | head -1
```
Expected: `HTTP/2 200` 둘 다. `git subtree`가 없으면 `git worktree add /tmp/mj-ghp --orphan gh-pages` 뒤 `rsync -a --delete --exclude .git site/ /tmp/mj-ghp/` → 커밋·푸시.

- [ ] **Step 3: 공개 주소로 검증**

```bash
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.mjs --base https://stoporder.github.io/matjangbu --expect-banner
```
Expected: 0 (아직 인스턴스가 없으니 `/try/`는 읽기 전용 배너).

---

### Task 16: 체험 인스턴스(노트북) · Tailscale Funnel · meta 갱신 · 마무리

**Files:**
- Create: `~/.config/systemd/user/matjangbu-llama.service`, `~/.config/systemd/user/matjangbu-web.service`, `docs/ops.md`(운영 절차)
- Modify: `site/try/index.html`(meta), `~/Projects/02-hackathon/modoo-startup-2026/docs/application-notes.md`(링크 한 줄), 메모리 파일

- [ ] **Step 1: 사용자 서비스 둘**

```ini
# ~/.config/systemd/user/matjangbu-llama.service
[Unit]
Description=맞장부 모델 서버 (llama-server 8107)
[Service]
ExecStart=%h/.local/bin/llama-server -m %h/models/qwen1.5b.gguf --host 127.0.0.1 --port 8107 -c 2048 -ub 128 -b 512 -t 4 --jinja -fa on --no-warmup
Restart=on-failure
[Install]
WantedBy=default.target
```
```ini
# ~/.config/systemd/user/matjangbu-web.service
[Unit]
Description=맞장부 체험 인스턴스 (web --demo 8108)
After=matjangbu-llama.service
[Service]
WorkingDirectory=%h/Projects/03-personal/matjangbu
ExecStart=/usr/bin/python3 -m web --demo --host 127.0.0.1 --port 8108 --cors-origin https://stoporder.github.io --device "노트북 · 4스레드"
Restart=on-failure
[Install]
WantedBy=default.target
```
```bash
systemctl --user daemon-reload && systemctl --user enable --now matjangbu-llama matjangbu-web
sleep 5; curl -sf http://127.0.0.1:8108/api/health | head -c 300
```
Expected: `{"mode": "demo", … "model_alive": true …}`.

- [ ] **Step 2: Funnel**

```bash
tailscale funnel --bg 8108
tailscale funnel status
URL=$(tailscale funnel status 2>/dev/null | grep -oE 'https://[a-z0-9.-]+\.ts\.net' | head -1); echo "$URL"
curl -sf "$URL/api/health" | head -c 200
```
Expected: `https://omarchy.<tailnet>.ts.net` 주소와 health 응답. Funnel 이 거부되면(테일넷 정책) `tailscale serve` 로는 외부 노출이 안 되므로 그 사실을 사용자에게 보고하고 meta 를 비운 채로 둔다(읽기 전용 폴백이 그대로 제출 상태).

- [ ] **Step 3: meta 갱신·재배포·검증**

```bash
cd ~/Projects/03-personal/matjangbu
sed -i "s|<meta name=\"matjangbu-api\" content=\"[^\"]*\">|<meta name=\"matjangbu-api\" content=\"$URL/\">|" site/try/index.html
git add site/try/index.html && git commit -m "site: 체험 인스턴스 주소

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git push && git subtree push --prefix site origin gh-pages
sleep 60
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.mjs --base https://stoporder.github.io/matjangbu --allow "$URL"
systemctl --user stop matjangbu-web; sleep 2
NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.mjs --base https://stoporder.github.io/matjangbu --allow "$URL" --expect-banner
systemctl --user start matjangbu-web
```
Expected: 인스턴스가 살아 있으면 배너 없음(0), 끄면 배너(0), 다시 켬. 브라우저에서 `https://stoporder.github.io/matjangbu/try/`를 열어 확인 큐에서 「우리상사」를 확정하고 W11 을 불러와 자동이 되는지 눈으로 본다(스크린샷 1장 `docs/shots/`).

- [ ] **Step 4: 문서·메모리**

- `docs/ops.md`: 인스턴스 켜기/끄기, Funnel, 기록 다시 만들기, gh-pages 재배포, A31 벤치 절차, 「노트북이 꺼지면 읽기 전용으로 내려앉는다」.
- `~/Projects/02-hackathon/modoo-startup-2026/docs/application-notes.md` 끝에 「2026-09-20 맞장부 공개: 저장소·Pages·인스턴스 주소」 한 줄.
- 메모리 `~/.claude/projects/-home-stoporder/memory/matjangbu-public-deploy.md`(project): 저장소·주소·인스턴스 서비스 이름·포트·A31 벤치 결과 요약·남은 것(암호화 백업·설치 zip·실제 은행 양식). `MEMORY.md`에 한 줄.
- 거북이 보드 카드 완료: `python3 ~/.claude/skills/turtle-board/scripts/turtle.py done "헌금 도우미 나비형 공개 배포"`.

- [ ] **Step 5: 최종 커밋·푸시**

```bash
git add docs && git commit -m "docs: 운영 절차

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git push
```

---

## 계획 자체 점검

- 스펙 §0 성공 기준 1~5 ↔ Task 15(Pages·외부 요청 0), Task 16(삼중 폴백·재기), Task 14(A31 표), Task 1~12(pytest), Task 12·16(SSE). §1 구조 ↔ Task 1·11·12·13·14. §2 데이터 ↔ Task 3·4·5. §3 대조 ↔ Task 6·7. §4 큐 ↔ Task 8. §5 기록 ↔ Task 9. §6 웹 ↔ Task 11·12. §7 사이트 ↔ Task 13. §8 벤치 ↔ Task 14. §9 오류 ↔ Task 4(CsvError)·6(model_failed)·8(409·중복)·11(403·404·큐). §10 테스트 ↔ 각 Task. §11 순서 ↔ Task 순서. §12 결정 ↔ Task 1 NOTICE·Task 7 기본 모델·Task 13 가격 없음.
- 이름 일관성: `Workspace.lines()/get()/append_line()/learn_alias()/forget_alias()/_write_aliases()`, `Roster.find/find_old/find_household/household_of/add/public()`, `rule_match/match_one/top_similar/ModelResult`, `rank/make_model/health/server_command`, `import_csv/confirm/hold/exclude/undo_last/add_envelopes/rematch`, `week_list/person_totals/year_summary/export/to_csv`, `Config/App/Job/Jobs/replay_model/make_server`, `build_recorded` — 뒤 작업이 앞 작업의 이름을 그대로 쓴다.
- 자리표시자: Task 10 의 `WEEKS`·`HELD` 표는 규격 문단에 값이 전부 있으므로 실행자가 옮겨 적는다(「…규격 표…」 표시가 그 뜻이다). 그 외 TBD 없음.
