import { won } from "@/format"
import { counts } from "@/lines"
import { useApp, useData } from "@/store"
import type { Line } from "@/types"
import { EmptyState } from "./EmptyState"
import { GradientNumber } from "./GradientNumber"
import { HowBadge } from "./HowBadge"
import { SectionHead } from "./SectionHead"
import { StateBadge } from "./StateBadge"

function AnswerMark({ line }: { line: Line }) {
  const d = useData()
  if (!d.answers || !Object.keys(d.answers).length || line.state !== "auto") return null
  const want = d.answers[line.raw]
  if (!want) return null
  const p = d.roster.find((x) => x.id === want)
  return want === line.person_id ? <span className="text-[12px] text-brand-ink">정답</span> : <span className="text-[12px] text-red">정답: {p ? p.name : want}</span>
}

export function LineTable({ rows, week, live = false }: { rows: Line[]; week: string; live?: boolean }) {
  const { s, dispatch } = useApp()
  const c = counts(rows)
  const ordered = rows.slice().sort((a, b) => Number(a.state !== "held") - Number(b.state !== "held"))
  return (
    <div className="card">
      <SectionHead title={week + " 맞추기 결과" + (live ? " · 진행 중" : "")} sub="확인 필요 줄부터 보여줍니다. 줄을 누르면 근거와 후보가 열립니다." />
      <div className="split mb-4 flex flex-wrap items-baseline gap-3">
        <GradientNumber n={c.auto} tone="brand" /><span className="text-muted-foreground">자동</span>
        <span className="text-[22px] text-faint">/</span>
        <GradientNumber n={c.held} tone="amber" /><span className="text-muted-foreground">확인 필요</span>
        {c.confirmed > 0 && <span className="text-muted-foreground">· 확정 {c.confirmed}</span>}
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>상태</th><th>입금자명</th><th className="n">금액</th><th>종류</th><th>맞춘 사람</th><th>근거</th><th></th></tr></thead>
            <tbody>
              {ordered.map((l) => (
                <tr key={l.id} className="row row-click" data-id={l.id} aria-selected={s.selected === l.id} onClick={() => dispatch({ type: "select", id: l.id })}>
                  <td><StateBadge state={l.state} /></td>
                  <td className="file">{l.raw}</td>
                  <td className="n">{won(l.amount)}</td>
                  <td>{l.kind || ""}</td>
                  <td>{l.name ? <>{l.name} <span className="text-[13px] text-muted-foreground">{l.group}</span></> : l.cands.length ? <span className="text-muted-foreground">후보 {l.cands.length}</span> : ""}</td>
                  <td><HowBadge line={l} /></td>
                  <td><AnswerMark line={l} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState text="아직 줄이 없습니다" />}
    </div>
  )
}
