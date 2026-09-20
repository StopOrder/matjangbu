import { Check, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/EmptyState"
import { Foot } from "@/components/Foot"
import { LineTable } from "@/components/LineTable"
import { guessWeek } from "@/fallback"
import { won } from "@/format"
import { NO_KIND } from "@/labels"
import { BASE } from "@/load"
import { emptyRow, useApp, useData } from "@/store"
import type { EnvRow, Line } from "@/types"

const FALLBACK: EnvRow[] = [{ name: "김정호", kind: "십일조", amount: "100000" }, { name: "박민수", kind: "감사헌금", amount: "50000" }, { name: "홍길동", kind: "", amount: "20000" }]

export default function Envelope() {
  const d = useData(); const { s, dispatch, client, load, toast, fail } = useApp()
  const rows = s.envRows
  const setRows = (r: EnvRow[]) => dispatch({ type: "envRows", rows: r })
  const [wk, setWk] = useState(d.week || guessWeek())
  const [date, setDate] = useState(d.lines[0]?.date || new Date().toISOString().slice(0, 10))
  const [counted, setCounted] = useState("")
  const [result, setResult] = useState<{ rows: Line[]; week: string } | null>(null)
  if (s.readonly) return <><EmptyState text="읽기 전용에서는 봉투를 입력할 수 없습니다." /><Foot /></>

  const total = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0)
  const diff = counted === "" ? null : total - Number(counted)
  const edit = (i: number, k: keyof EnvRow, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const del = (i: number) => setRows(rows.filter((_, j) => j !== i))
  const add = () => {
    setRows([...rows, emptyRow()])
    requestAnimationFrame(() => { const ins = document.querySelectorAll<HTMLInputElement>("#env-rows input[data-k=name]"); ins[ins.length - 1]?.focus() })
  }
  const sample = async () => {
    try {
      const sm = await (await fetch(BASE + "sample-envelopes.json", { cache: "no-cache" })).json() as { lines: { name: string; kind: string; amount: number }[]; counted_total: number }
      setRows(sm.lines.map((l) => ({ name: l.name, kind: l.kind, amount: String(l.amount) })))
      setCounted(String(sm.counted_total))
    } catch { setRows(FALLBACK) }
  }
  const save = async () => {
    const lines = rows.filter((r) => r.name || r.amount).map((r) => ({ name: r.name, kind: r.kind, amount: Number(r.amount) || 0 }))
    if (!lines.length) { toast("입력한 줄이 없습니다", "err"); return }
    try {
      const out = await client.post<{ rows: Line[]; total: number; diff: number | null; errors?: string[] }>("/envelope", { week: wk.trim(), date, lines, counted_total: counted === "" ? null : Number(counted) })
      const held = out.rows.filter((r) => r.state === "held").length
      toast("봉투 " + out.rows.length + "줄 저장 · 확인 필요 " + held + (out.diff != null ? " · 계수와 차이 " + out.diff.toLocaleString("ko-KR") + "원" : ""), held ? undefined : "ok")
      if (out.errors?.length) toast(out.errors.join(" / "), "err")
      setRows([emptyRow()])
      await load(wk.trim())
      setResult({ rows: out.rows, week: out.rows[0]?.week || wk.trim() })
    } catch (e) { fail(e) }
  }
  return (
    <>
      <div className="card mb-4">
        <h3 className="mb-1 text-[17px]">봉투 입력</h3>
        <p className="mb-4 text-[13px] text-muted-foreground">봉투에 적힌 이름·종류·금액을 줄줄이 넣습니다. 명부에 있는 이름은 곧바로 확정되고, 동명이인이거나 명부에 없으면 확인 큐로 갑니다. 모델은 쓰지 않습니다.</p>
        <div className="form grid max-w-[720px] gap-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="field grid gap-1 text-[13px] font-semibold text-muted-foreground">주차<input type="text" id="env-wk" value={wk} onChange={(e) => setWk(e.target.value)} /></label>
            <label className="field grid gap-1 text-[13px] font-semibold text-muted-foreground">날짜<input type="date" id="env-date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          </div>
          <div className="env-rows grid gap-2" id="env-rows">
            {rows.map((r, i) => (
              <div key={i} className="env-row grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_auto] items-center gap-2">
                <input type="text" list="roster-list" data-i={i} data-k="name" placeholder="이름 (명부 자동완성)" value={r.name} onChange={(e) => edit(i, "name", e.target.value)} />
                <select data-i={i} data-k="kind" value={r.kind} onChange={(e) => edit(i, "kind", e.target.value)} aria-label="종류">
                  <option value="">{NO_KIND}</option>{d.kinds.map((k) => <option key={k}>{k}</option>)}
                </select>
                <input type="number" data-i={i} data-k="amount" placeholder="금액" min={0} step={1000} value={r.amount} onChange={(e) => edit(i, "amount", e.target.value)} />
                <Button type="button" variant="ghost" size="icon-sm" className="rounded-lg" aria-label="줄 삭제" onClick={() => del(i)}><X aria-hidden="true" /></Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3" id="env-add" onClick={add}>줄 추가</Button>
            <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3" id="env-sample" onClick={() => { void sample() }}>샘플 12줄 채우기</Button>
          </div>
          <div className="sum flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">
            <span>입력 합계 <b id="env-total" className="tabular-nums">{won(total)}</b></span>
            <label className="flex items-center gap-2">계수 총액 <input type="number" id="env-counted" step={1000} className="w-44!" placeholder="세어 본 총액" value={counted} onChange={(e) => setCounted(e.target.value)} /></label>
            <span id="env-diff" className={diff == null ? "text-muted-foreground" : diff === 0 ? "badge badge-auto" : "badge badge-held"}>
              {diff == null ? "" : diff === 0 ? <><Check className="size-3.5" aria-hidden="true" />일치</> : "차이 " + (diff >= 0 ? "+" : "") + diff.toLocaleString("ko-KR") + "원"}
            </span>
          </div>
          <div className="cta-row cta-fixed">
            <Button id="env-save" className="btn-grad h-11 rounded-xl px-5 text-[15px] font-bold" onClick={() => { void save() }}><Check aria-hidden="true" />저장</Button>
          </div>
        </div>
      </div>
      <div id="env-result">{result && <LineTable rows={result.rows} week={result.week} />}</div>
      <Foot />
    </>
  )
}
