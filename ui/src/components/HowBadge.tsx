import { howOf } from "@/lines"
import type { Line } from "@/types"

const CLS = { model: "badge-model dot-model", human: "badge-human dot-human", rule: "badge-auto dot-brand" }
export function HowBadge({ line }: { line: Line }) {
  const h = howOf(line)
  if (!h) return null
  const [badge, dot] = CLS[h.tone].split(" ")
  return <span className={"badge badge-how " + badge}><i className={dot} aria-hidden="true" />{h.text}</span>
}
