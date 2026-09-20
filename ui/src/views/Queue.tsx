import { useState } from "react"
import { CandidatePicker } from "@/components/CandidatePicker"
import { EmptyState } from "@/components/EmptyState"
import { Foot } from "@/components/Foot"
import { HowBadge } from "@/components/HowBadge"
import { SectionHead } from "@/components/SectionHead"
import { won } from "@/format"
import { REASON } from "@/labels"
import { matches } from "@/lines"
import { useApp, useData } from "@/store"
import type { Line } from "@/types"

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function why(l: Line): string {
  const rel = l.model?.pred?.relation
  if (rel) return "모델 판단: " + (REASON[rel] || rel) + (l.model?.pred?.name_part ? " · 이름 부분 「" + l.model.pred.name_part + "」" : "")
  if (l.reason === "model_failed") return "모델이 응답하지 않아 규칙이 세운 후보만 있습니다"
  return "규칙이 세운 후보"
}

export default function Queue() {
  const d = useData(); const { s } = useApp()
  const [leaving, setLeaving] = useState<Set<string>>(() => new Set())
  const held = d.lines.filter((l) => l.state === "held" && matches(l, s.query))
  /** 확정·보류·제외가 시작되면 카드를 200ms 접고, 결과와 무관하게 표시를 되돌린다(성공이면 이미 사라진 뒤다) */
  const onAct = (id: string) => async (p: Promise<boolean>) => {
    setLeaving((prev) => new Set(prev).add(id))
    await Promise.all([p, sleep(200)])
    setLeaving((prev) => { const n = new Set(prev); n.delete(id); return n })
  }
  const next = d.mode === "local" ? { label: "불러오기로", href: "#/import" } : d.weeks_available.length ? { label: "다음 주 불러오기", href: "#/import" } : undefined
  return (
    <>
      <SectionHead title={"확인 필요 " + held.length + "줄"} sub="확신이 낮으면 맞추지 않고 묻습니다. 고른 답은 별칭 사전에 쌓여 다음 주 같은 줄은 자동이 됩니다." />
      {held.length ? (
        <div className="grid gap-3">
          {held.map((l) => (
            <div key={l.id} id={"q-" + l.id} className={"qcard" + (leaving.has(l.id) ? " leaving" : "")}>
              <div className="head flex flex-wrap items-center gap-2.5">
                <span className="raw text-[17px] font-bold">{l.raw}</span>
                <span className="amt tabular-nums text-muted-foreground">{won(l.amount)}</span>
                {l.kind && <span className="badge badge-gray">{l.kind}</span>}
                <span className="badge badge-held">{REASON[l.reason || ""] || l.reason || ""}</span>
                <HowBadge line={l} />
              </div>
              <div className="why text-[13px] text-muted-foreground">{why(l)}</div>
              <CandidatePicker line={l} onAct={onAct(l.id)} />
            </div>
          ))}
        </div>
      ) : <EmptyState text={"확인할 줄이 없습니다" + (s.query ? " (검색: " + s.query + ")" : "")} action={next} />}
      <Foot />
    </>
  )
}
