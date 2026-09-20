import { GradientNumber, type NumTone } from "./GradientNumber"

export function StatTile({ label, n, tone, sub }: { label: string; n: number | string; tone: NumTone; sub?: string }) {
  return (
    <div className="card stat px-5 py-4">
      <div className="text-[13px] font-semibold text-muted-foreground">{label}</div>
      <div className="mt-2 mb-1"><GradientNumber n={n} tone={tone} /></div>
      {sub && <div className="text-[13px] text-muted-foreground">{sub}</div>}
    </div>
  )
}
