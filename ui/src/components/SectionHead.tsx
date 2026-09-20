import type { ReactNode } from "react"
export function SectionHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="sec-head mb-3.5 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="m-0 text-[17px] font-bold">{title}</h2>{sub && <p className="sub m-0 mt-0.5 text-[13px] text-muted-foreground">{sub}</p>}</div>
      {right}
    </div>
  )
}
