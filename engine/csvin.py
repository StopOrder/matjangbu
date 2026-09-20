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
