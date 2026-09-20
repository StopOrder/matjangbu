import { expect, test } from "vitest"
import { parseHash } from "../src/route"

test("parseHash", () => {
  expect(parseHash("")).toBe("dashboard")
  expect(parseHash("#/")).toBe("dashboard")
  expect(parseHash("#/queue")).toBe("queue")
  expect(parseHash("#queue")).toBe("queue")
  expect(parseHash("#/records/week")).toBe("records")
  expect(parseHash("#/nope")).toBe("dashboard")
})
