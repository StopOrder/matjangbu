import { expect, test } from "vitest"
import { counts, howOf, matches } from "../src/lines"
import { offline } from "../src/fallback"
import { loadRecorded } from "./fixtures"

const d = offline(loadRecorded())

test("counts 는 상태별 개수와 총합", () => {
  const c = counts(d.lines)
  expect(c.n).toBe(d.lines.length)
  expect(c.auto + c.held + c.confirmed + c.excluded).toBe(c.n)
})
test("matches 는 원문·이름을 대소문자 무시로 부분 일치, 빈 검색은 전부", () => {
  const l = d.lines[0]
  expect(matches(l, "")).toBe(true)
  expect(matches(l, l.raw.slice(0, 2))).toBe(true)
  expect(matches(l, "없는이름zzz")).toBe(false)
})
test("howOf: 모델 줄은 model, 사람 줄은 human, 나머지는 rule, 없으면 사유", () => {
  expect(howOf({ ...d.lines[0], how: "모델", model: { replayed: true } })).toEqual({ text: "모델 · 미리 잰 값", tone: "model" })
  expect(howOf({ ...d.lines[0], how: "사람" })).toEqual({ text: "사람", tone: "human" })
  expect(howOf({ ...d.lines[0], how: "별칭" })).toEqual({ text: "별칭", tone: "rule" })
  expect(howOf({ ...d.lines[0], how: undefined, reason: "dup" })).toEqual({ text: "동명이인", tone: "rule" })
  expect(howOf({ ...d.lines[0], how: undefined, reason: undefined })).toBeNull()
})
