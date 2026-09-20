import { readFileSync } from "node:fs"
import type { Recorded } from "../src/types"

export function loadRecorded(): Recorded {
  return JSON.parse(readFileSync(new URL("../../site/try/recorded.json", import.meta.url), "utf8")) as Recorded
}
