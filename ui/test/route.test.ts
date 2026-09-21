import { expect, test } from "vitest"
import { parseHash } from "../src/route"

test("parseHash", () => {
  expect(parseHash("")).toBe("week")
  expect(parseHash("#/")).toBe("week")
  expect(parseHash("#/year")).toBe("year")
  expect(parseHash("#roster")).toBe("roster")
  expect(parseHash("#/settings/x")).toBe("settings")
  expect(parseHash("#/dashboard")).toBe("week")
  expect(parseHash("#/nope")).toBe("week")
})
