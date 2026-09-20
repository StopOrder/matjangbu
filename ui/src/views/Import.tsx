import { Zap } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/EmptyState"
import { Foot } from "@/components/Foot"
import { LineTable } from "@/components/LineTable"
import { ProgressBar } from "@/components/ProgressBar"
import { guessWeek } from "@/fallback"
import { counts } from "@/lines"
import { useApp, useData } from "@/store"
import type { Line } from "@/types"

type Prog = { text: string; err: boolean; ratio: number | null }

export default function Import() {
  const d = useData(); const { s, client, load, toast, fail, dispatch } = useApp()
  const demo = d.mode !== "local"
  const [sampleWeek, setSampleWeek] = useState("")
  const weekSel = sampleWeek && d.weeks_available.includes(sampleWeek) ? sampleWeek : d.weeks_available[0] || ""
  const [wk, setWk] = useState(guessWeek())
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [csv, setCsv] = useState<{ text: string; name: string; lines: string[] } | null>(null)
  const [prog, setProg] = useState<Prog>({ text: "", err: false, ratio: null })
  const [live, setLive] = useState<{ rows: Line[]; week: string } | null>(null)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    const buf = await f.arrayBuffer()
    let text = new TextDecoder("utf-8", { fatal: false }).decode(buf)
    if (text.includes("�")) { try { text = new TextDecoder("euc-kr").decode(buf) } catch { /* utf-8 그대로 */ } }
    setCsv({ text, name: f.name, lines: text.split(/\r?\n/).filter(Boolean) })
  }

  const run = async () => {
    if (s.busy) return
    dispatch({ type: "busy", busy: true })
    setProg({ text: "줄을 서는 중…", err: false, ratio: 0 })
    const rows: Line[] = []; let n = 0
    const week = demo ? weekSel : wk.trim()
    const body = demo ? { sample_week: weekSel } : { week, date, filename: csv?.name, csv_text: csv?.text }
    try {
      const job = await client.post<{ job: string }>("/import", body)
      await client.stream("/jobs/" + job.job + "/events", (ev) => {
        if (ev.event === "start") { n = ev.n || 0; setProg({ text: "0 / " + n + " 줄 · 파일에서 " + (ev.skipped ?? 0) + "줄 제외(출금·금액 0)", err: false, ratio: 0 }) }
        else if (ev.event === "line" && ev.row) {
          rows.push(ev.row); const i = (ev.i ?? rows.length - 1) + 1; const N = ev.n || n
          setProg({ text: i + " / " + N + " 줄" + (ev.row.how === "모델" ? " · 모델이 본 줄: " + ev.row.raw : ""), err: false, ratio: N ? i / N : null })
          setLive({ rows: rows.slice(), week })
        }
        else if (ev.state === "failed") setProg({ text: ev.error || "실패", err: true, ratio: null })
        else if (ev.state === "done") setProg((p) => ({ ...p, text: "끝", ratio: 1 }))
      })
      await load(week)
      const c = counts(rows)
      toast("자동 " + c.auto + " / 확인 " + c.held, "ok")
      setProg({ text: "끝 · 자동 " + c.auto + " / 확인 " + c.held, err: false, ratio: 1 })
      setLive(null)
    } catch (e) { setProg({ text: e instanceof Error ? e.message : String(e), err: true, ratio: null }); fail(e) }
    dispatch({ type: "busy", busy: false })
  }

  const canRun = !s.busy && (demo ? !!weekSel : !!csv)
  return (
    <>
      <div className="card mb-4">
        <h3 className="mb-3 text-[17px]">불러오기</h3>
        {s.readonly ? <EmptyState text={"읽기 전용에서는 불러올 수 없습니다. 아래 표는 " + d.week + " 의 미리 잰 결과입니다."} /> : (
          <div className="form grid max-w-[720px] gap-3.5">
            {demo ? (
              <label className="field grid gap-1 text-[13px] font-semibold text-muted-foreground">샘플 주차
                <select id="imp-week" value={weekSel} onChange={(e) => setSampleWeek(e.target.value)} disabled={!d.weeks_available.length}>
                  {d.weeks_available.length ? d.weeks_available.map((w) => <option key={w}>{w}</option>) : <option value="">(남은 샘플 주차 없음)</option>}
                </select></label>
            ) : (
              <>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <label className="field grid gap-1 text-[13px] font-semibold text-muted-foreground">주차<input type="text" id="imp-wk" placeholder="2026-W10" value={wk} onChange={(e) => setWk(e.target.value)} /></label>
                  <label className="field grid gap-1 text-[13px] font-semibold text-muted-foreground">날짜<input type="date" id="imp-date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                </div>
                <label className="field grid gap-1 text-[13px] font-semibold text-muted-foreground">은행 CSV<input type="file" id="imp-file" accept=".csv,text/csv" onChange={(e) => { void onFile(e.target.files?.[0]) }} /></label>
                {csv && <div id="imp-preview" className="text-[13px] text-muted-foreground"><b>{csv.name}</b> · {csv.lines.length}줄 미리보기
                  <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-ink p-3 text-[12px] leading-relaxed text-slate-200">{csv.lines.slice(0, 8).join("\n")}</pre></div>}
              </>
            )}
            <div className="cta-row cta-fixed">
              <Button id="imp-run" className="btn-grad h-11 rounded-xl px-5 text-[15px] font-bold" disabled={!canRun} onClick={() => { void run() }}><Zap aria-hidden="true" />맞추기</Button>
              <span className="text-[13px] text-muted-foreground">{demo ? "샘플 은행 CSV 를 실제 규칙으로 맞춥니다. 모델 판정은 미리 잰 값을 재생합니다." : "파일은 이 PC 의 「들어옴」 폴더에 저장됩니다. 인터넷으로 나가지 않습니다."}</span>
            </div>
            <ProgressBar id="imp-progress" text={prog.text} err={prog.err} ratio={prog.ratio} />
          </div>
        )}
        {s.readonly && <p id="imp-progress" className="progress m-0 min-h-5 text-[13px] text-muted-foreground" />}
      </div>
      <div id="imp-result">{live ? <LineTable rows={live.rows} week={live.week} live /> : <LineTable rows={d.lines} week={d.week} />}</div>
      <Foot />
    </>
  )
}
