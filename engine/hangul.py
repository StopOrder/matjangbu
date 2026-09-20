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
