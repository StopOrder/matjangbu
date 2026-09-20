import { describe, expect, test } from "vitest"
import { parseSse, sessionKey } from "../src/api"

describe("parseSse", () => {
  test("완전한 이벤트 두 개와 남은 조각", () => {
    const { events, rest } = parseSse('data: {"event":"start","n":3}\n\ndata: {"event":"line","i":0}\n\ndata: {"ev')
    expect(events).toEqual([{ event: "start", n: 3 }, { event: "line", i: 0 }])
    expect(rest).toBe('data: {"ev')
  })
  test("JSON 이 깨진 이벤트는 건너뛴다", () => {
    const { events, rest } = parseSse("data: nope\n\ndata: {\"state\":\"done\"}\n\n")
    expect(events).toEqual([{ state: "done" }])
    expect(rest).toBe("")
  })
  test("event: 줄이 앞에 있어도 data: 만 읽는다", () => {
    expect(parseSse('event: state\ndata: {"state":"queued","position":2}\n\n').events).toEqual([{ state: "queued", position: 2 }])
  })
})

test("sessionKey 는 apiBase 별로 다르다", () => {
  expect(sessionKey("/try/")).toBe("mj.session@/try/")
  expect(sessionKey("https://x.example/")).toBe("mj.session@https://x.example/")
})
