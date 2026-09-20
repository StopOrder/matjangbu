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
