import { expect, test } from "vitest"
import { fmtTs, won } from "../src/format"

test("won formats with ko-KR grouping and suffix", () => {
  expect(won(250000)).toBe("250,000원")
  expect(won("12000")).toBe("12,000원")
  expect(won(null)).toBe("0원")
})
test("fmtTs shows minute precision without T", () => {
  expect(fmtTs("2026-09-20T21:59:11")).toBe("2026-09-20 21:59")
  expect(fmtTs(undefined)).toBe("")
})
