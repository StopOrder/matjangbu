import { REASON } from "./labels"
import type { Line } from "./types"

export function counts(lines: Line[]) {
  const c = { n: lines.length, auto: 0, held: 0, confirmed: 0, excluded: 0 }
  for (const l of lines) c[l.state] += 1
  return c
}
export const matches = (l: Line, query: string): boolean =>
  !query || [l.raw, l.name].some((v) => v && v.toLowerCase().includes(query.toLowerCase()))

export type HowTone = "model" | "human" | "rule"
export function howOf(l: Line): { text: string; tone: HowTone } | null {
  const h = l.how || (l.reason ? REASON[l.reason] || l.reason : "")
  if (!h) return null
  if (l.how === "모델") return { text: "모델" + (l.model?.replayed ? " · 미리 잰 값" : ""), tone: "model" }
  if (l.how === "사람") return { text: "사람", tone: "human" }
  return { text: h, tone: "rule" }
}
