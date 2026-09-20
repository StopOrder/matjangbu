import { describe, expect, test } from "vitest"
import { guessWeek, localWeekCsv, localYearCsv, offline, parseCsv } from "../src/fallback"
import { loadRecorded } from "./fixtures"

const rec = loadRecorded()

describe("guessWeek", () => {
  test("ISO week: 2026-01-01(목) → W01, 2026-09-21(월) → W39", () => {
    expect(guessWeek(new Date(2026, 0, 1))).toBe("2026-W01")
    expect(guessWeek(new Date(2026, 8, 21))).toBe("2026-W39")
  })
})

describe("parseCsv", () => {
  test("따옴표·이스케이프·BOM·CRLF", () => {
    expect(parseCsv('﻿이름,금액\r\n"김,정호","1,000"\r\n"a""b",2\n')).toEqual([["이름", "금액"], ["김,정호", "1,000"], ['a"b', "2"]])
  })
  test("빈 줄은 버린다", () => {
    expect(parseCsv("a,b\n\n1,2\n")).toEqual([["a", "b"], ["1", "2"]])
  })
})

describe("offline", () => {
  test("주차 미지정이면 첫 주차, mode recorded, 액션 불가", () => {
    const d = offline(rec)
    const weeks = Object.keys(rec.weeks).sort()
    expect(d.mode).toBe("recorded")
    expect(d.week).toBe(weeks[0])
    expect(d.weeks).toEqual(weeks)
    expect(d.lines.length).toBe(rec.weeks[weeks[0]].rows.length)
    expect(d.model_alive).toBe(false)
    expect(d.can_undo).toBe(false)
    expect(d.recorded).toEqual(rec.meta)
    expect(d.all_count).toBe(weeks.reduce((n, w) => n + rec.weeks[w].rows.length, 0))
  })
  test("있는 주차를 주면 그 주차, 없는 주차면 첫 주차", () => {
    const weeks = Object.keys(rec.weeks).sort()
    expect(offline(rec, weeks[1]).week).toBe(weeks[1])
    expect(offline(rec, "1999-W01").week).toBe(weeks[0])
  })
  test("줄의 name/group 과 후보의 name/group 을 명부에서 붙인다", () => {
    const d = offline(rec)
    const byId = new Map(rec.roster.map((p) => [p.id, p]))
    for (const l of d.lines) {
      if (l.person_id && byId.has(l.person_id)) expect(l.name).toBe(byId.get(l.person_id)!.name)
      else expect(l.name).toBe("")
      for (const c of l.cands) expect(c.name).toBe(byId.get(c.person_id)!.name)
    }
    const withCands = d.lines.find((l) => l.cands.length > 0)
    expect(withCands).toBeDefined()
  })
})

describe("localWeekCsv / localYearCsv", () => {
  test("주간: 확정+자동 줄, 머리글 7칸, 마지막은 합계", () => {
    const d = offline(rec)
    const rows = parseCsv(localWeekCsv(d))
    expect(rows[0]).toEqual(["이름", "구역", "종류", "금액", "경로", "근거", "원문"])
    const n = d.lines.filter((l) => l.state === "confirmed" || l.state === "auto").length
    expect(rows.length).toBe(n + 2)
    expect(rows[rows.length - 1][0]).toBe("합계")
    const sum = d.lines.filter((l) => l.state === "confirmed" || l.state === "auto").reduce((a, l) => a + l.amount, 0)
    expect(rows[rows.length - 1][3]).toBe(String(sum))
  })
  test("연말: 합계 다음에 미확정 줄, 개인별: 머리글이 이름·구역·종류들·합계·건수", () => {
    const d = offline(rec)
    const year = parseCsv(localYearCsv(rec, d.roster, "year"))
    expect(year[year.length - 1][0]).toBe("미확정")
    expect(year[year.length - 2][0]).toBe("합계")
    expect(year[0].slice(0, 4)).toEqual(["이름", "구역", "합계", "건수"])
    const person = parseCsv(localYearCsv(rec, d.roster, "person"))
    expect(person[0][0]).toBe("이름")
    expect(person[0].slice(-2)).toEqual(["합계", "건수"])
    expect(person[person.length - 1][0]).toBe("합계")
  })
})
