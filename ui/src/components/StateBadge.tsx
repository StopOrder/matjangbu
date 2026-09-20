import { STATE } from "@/labels"
import type { LineState } from "@/types"

export const StateBadge = ({ state }: { state: LineState }) => <span className={"badge badge-" + state}>{STATE[state]}</span>
