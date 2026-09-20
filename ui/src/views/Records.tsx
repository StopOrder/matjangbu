import { Download } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CsvTable } from "@/components/CsvTable"
import { EmptyState } from "@/components/EmptyState"
import { Foot } from "@/components/Foot"
import { localWeekCsv, localYearCsv } from "@/fallback"
import { won } from "@/format"
import { REASON } from "@/labels"
import { useApp, useData } from "@/store"
import type { RecTab } from "@/types"

export default function Records() {
  const d = useData(); const { s, dispatch, client } = useApp()
  const year = (d.week || "2026").slice(0, 4)
  const held = d.lines.filter((l) => l.state === "held")
  const cache = useRef(new Map<string, string>())
  const key = s.tab + "|" + d.week + "|" + s.loadSeq
  const [text, setText] = useState<string | null>(() => cache.current.get(key) ?? null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setErr(null)
    if (cache.current.has(key)) { setText(cache.current.get(key)!); return }
    setText(null)
    const tab = s.tab
    const p: Promise<string> = s.readonly
      ? Promise.resolve(tab === "week" ? localWeekCsv(d) : localYearCsv(s.recorded!, d.roster, tab))
      : client.api<string>("/export/" + tab + ".csv?" + (tab === "week" ? "week=" + encodeURIComponent(d.week) : "year=" + year))
    p.then((t) => { cache.current.set(key, t); if (alive) setText(t) }).catch((e) => { if (alive) setErr(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const download = () => {
    const t = text; if (!t) return
    const name = ({ week: "주간명단-" + d.week, person: "개인별누적-" + year, year: "연말합산-" + year } as Record<RecTab, string>)[s.tab] + ".csv"
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob(["﻿" + t.replace(/^﻿/, "")], { type: "text/csv;charset=utf-8" })); a.download = name; a.click()
  }
  const TABS: [RecTab, string][] = [["week", "주간 명단 · " + d.week], ["person", "개인별 누적 · " + year], ["year", "연말 합산 · " + year]]
  return (
    <>
      <div className="tabs mb-4 flex flex-wrap items-center gap-1.5">
        {TABS.map(([k, t]) => (
          <button key={k} type="button" data-tab={k} aria-pressed={s.tab === k} onClick={() => dispatch({ type: "tab", tab: k })}
                  className={"press rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors " + (s.tab === k ? "border-ink bg-ink text-white" : "border-line bg-white text-muted-foreground hover:text-ink")}>{t}</button>
        ))}
        <span className="ml-auto" />
        <Button id="rec-dl" variant="outline" size="sm" className="h-9 rounded-xl px-3" disabled={s.readonly || !text} onClick={download}><Download aria-hidden="true" />CSV 내보내기</Button>
        <a className="press rounded-xl px-3 py-2 text-[13px] font-semibold text-muted-foreground hover:bg-slate-100 hover:text-ink" href="#/queue">확인 목록으로</a>
      </div>
      <div className="card" id="rec-body">
        {err ? <EmptyState text={err} /> : text == null ? <div className="grid gap-2.5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 rounded-lg" />)}</div> : <CsvTable text={text} />}
      </div>
      {s.tab === "week" && held.length > 0 && (
        <div className="card mt-4"><h3 className="mb-1 text-[17px]">이 주에 아직 확인하지 않은 줄 {held.length}</h3>
          <p className="mb-3 text-[13px] text-muted-foreground">확정되기 전에는 합계에 들어가지 않습니다.</p>
          <ul className="feed">{held.map((l) => <li key={l.id}><span className="when">{won(l.amount)}</span><span className="f">{l.raw}</span><span className="text-muted-foreground">{REASON[l.reason || ""] || ""}</span></li>)}</ul>
        </div>
      )}
      <p className="foot mt-5 text-[13px] leading-relaxed text-muted-foreground">{s.tab === "week" ? "주간 명단은 사람 손이 닿은 줄부터 보여줍니다. 통장 순서대로 두면 완전일치가 앞을 다 차지해 이 도구가 한 일이 안 보이기 때문입니다." : "연말 합산은 기부금영수증 기초자료입니다. 미확정 줄은 따로 합계를 냅니다. 암호화 백업은 준비 중입니다."}</p>
      <Foot />
    </>
  )
}
