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
