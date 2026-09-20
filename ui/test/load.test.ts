import { expect, test } from "vitest"
import { candidateBases } from "../src/load"

test("같은 origin 이 먼저, meta 주소는 슬래시를 붙여 뒤에, 자기 자신·중복은 뺀다", () => {
  const here = "https://stoporder.github.io/matjangbu/try/"
  expect(candidateBases("/matjangbu/try/", here, ["https://a.example", "https://a.example/", "https://stoporder.github.io/matjangbu/try"]))
    .toEqual(["/matjangbu/try/", "https://a.example/"])
})
