import { useRef, useState } from "react"
import { EntryRow } from "@/components/EntryRow"
import { Icon } from "@/components/Icons"
import { Row } from "@/components/Row"
import { RowPanel } from "@/components/RowPanel"
import { localWeekCsv } from "@/fallback"
import { won } from "@/format"
import { matches } from "@/lines"
import { useApp, useData, useLineActions } from "@/store"
import { readCsv, useImport } from "@/useImport"
import type { Line } from "@/types"

const DAY = ["주일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]
function title(iso: string, week: string): string {
  if (!iso) return week || "이번 주"
  const d = new Date(iso + "T00:00:00")
  if (Number.isNaN(d.getTime())) return week
  return d.getFullYear() + "년 " + (d.getMonth() + 1) + "월 " + d.getDate() + "일 " + DAY[d.getDay()]
}
const sum = (ls: Line[]) => ls.reduce((a, l) => a + l.amount, 0)

export default function Week() {
  const d = useData()
  const { s, dispatch, client, load, toast, fail } = useApp()
  const act = useLineActions()
  const imp = useImport()
  const [onlyBlank, setOnlyBlank] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // 줄 번호는 들어온 순서대로 1부터. 화면에는 최신이 위로 오도록 뒤집어 보인다.
  const no = new Map(d.lines.map((l, i) => [l.id, i + 1]))
  const shown = d.lines.filter((l) => matches(l, s.query) && (!onlyBlank || l.state === "held"))
  const env = shown.filter((l) => l.path === "envelope").reverse()
  const bank = shown.filter((l) => l.path !== "envelope").reverse()
  const held = d.lines.filter((l) => l.state === "held")
  const auto = d.lines.filter((l) => l.state === "auto" || l.state === "confirmed")
  const total = sum(d.lines)

  // 샘플 정답 대조 — 체험 모드에만 있다
  const graded = auto.filter((l) => d.answers?.[l.raw])
  const right = graded.filter((l) => l.person_id === d.answers[l.raw])

  // 주차 넘기기
  const idx = d.weeks.indexOf(d.week)
  const go = (k: number) => { const w = d.weeks[idx + k]; if (w) void load(w) }

  // 그 자리 펼침은 한 번에 하나만 — store 의 selected 를 그대로 쓴다
  const open = (id: string | null) => dispatch({ type: "select", id })
  const nextBlank = (id: string) => {
    const order = [...env, ...bank].filter((l) => l.state === "held")
    const i = order.findIndex((l) => l.id === id)
    return i >= 0 && order[i + 1] ? order[i + 1].id : null
  }

  const download = async () => {
    try {
      const text = s.readonly ? localWeekCsv(d) : await client.api<string>("/export/week.csv?week=" + encodeURIComponent(d.week))
      const a = document.createElement("a")
      a.href = URL.createObjectURL(new Blob(["﻿" + text.replace(/^﻿/, "")], { type: "text/csv;charset=utf-8" }))
      a.download = "주간명단-" + d.week + ".csv"
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) { fail(e) }
  }

  const local = d.mode === "local"
  const sample = d.weeks_available[0] || ""
  const addLines = () => {
    if (s.readonly) { toast("미리 잰 기록을 읽는 중입니다 — 줄을 넣을 수 없습니다", "err"); return }
    if (local) { fileRef.current?.click(); return }
    if (!sample) { toast("남은 샘플 주차가 없습니다", "err"); return }
    void imp.run({ sample_week: sample }, sample)
  }
  const onFile = async (f: File | undefined) => {
    if (!f) return
    const csv = await readCsv(f)
    const date = new Date().toISOString().slice(0, 10)
    void imp.run({ week: d.week, date, filename: csv.name, csv_text: csv.text }, d.week)
  }

  // 줄이 없는 구역은 머리도 내지 않는다 — 빈 칸이 장부를 길게 만든다
  const section = (rows: Line[], icon: "envelope" | "card", label: string) => rows.length === 0 ? null : (
    <>
      <div className="sect">
        <Icon name={icon} sm /><b>{label}</b>
        <span className="amt num">{won(sum(rows))}</span>
      </div>
      {rows.map((l) => (
        <div key={l.id}>
          <Row line={l} no={no.get(l.id)} open={s.selected === l.id} onOpen={open} />
          {s.selected === l.id && l.state === "held" && (
            <RowPanel line={l} onClose={() => open(null)} onDone={() => open(nextBlank(l.id))} />
          )}
        </div>
      ))}
    </>
  )

  return (
    <>
      <div className="head">
        <button className="arrow" aria-label="지난 주" disabled={idx <= 0} onClick={() => go(-1)}><Icon name="left" /></button>
        <div>
          <h1>{title(d.lines[0]?.date || "", d.week)}</h1>
          <div className="when">{d.week} · 통장 {d.lines.filter((l) => l.path !== "envelope").length}줄 · 봉투 {d.lines.filter((l) => l.path === "envelope").length}장</div>
        </div>
        <button className="arrow" aria-label="다음 주" disabled={idx < 0 || idx >= d.weeks.length - 1} onClick={() => go(1)}><Icon name="right" /></button>
        <span className="grow" />
        <button className={"btn" + (onlyBlank ? " on" : "")} aria-pressed={onlyBlank} onClick={() => setOnlyBlank((v) => !v)}>
          <Icon name="filter" />채울 줄만 보기
        </button>
        <button className="btn" disabled={imp.busy} onClick={addLines}><Icon name="plus" />줄 넣기</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = "" }} />
        <button className="btn" onClick={() => { void download() }}><Icon name="export" />내보내기</button>
        <button className="btn ghost" disabled={!d.can_undo || s.readonly} onClick={() => { void act.undo() }}><Icon name="undo" />되돌리기</button>
      </div>

      {imp.prog.text && (
        <div className="card" style={{ padding: "16px 24px", marginBottom: 16 }}>
          <div className={"hint" + (imp.prog.err ? " err" : "")}>{imp.prog.text}</div>
          {imp.prog.ratio != null && <div className="prog"><i style={{ width: Math.round(imp.prog.ratio * 100) + "%" }} /></div>}
        </div>
      )}

      <section className="card">
        <div className="chead">
          <span className="m"><b>{d.lines.length}</b>줄</span>
          <span className="m">자동 <b>{auto.length}</b></span>
          <span className="m need">채울 줄 <b>{held.length}</b></span>
          <span className="m">합계 <b className="num">{won(total)}</b></span>
          <span className="grow" />
          {graded.length > 0 && (
            <>
              <span className="ok"><Icon name="check" sm /> 샘플 정답과 자동 {right.length}/{graded.length} 일치</span>
              <span className="faint">체험 전용 표시</span>
            </>
          )}
        </div>

        <EntryRow />

        <div data-mj="ledger">
          {section(env, "envelope", "봉투 " + env.length + "장")}
          {section(bank, "card", "통장 " + bank.length + "줄")}
          {env.length + bank.length === 0 && (
            <div className="empty">{s.query || onlyBlank ? "조건에 맞는 줄이 없습니다" : "아직 줄이 없습니다 — 「줄 넣기」로 은행 CSV 를 넣거나 위에서 봉투를 쳐 보세요"}</div>
          )}
        </div>

        <div className="cfoot" data-mj="total">
          {env.length > 0 && <div className="trow"><span className="l">봉투 {env.length}장</span><span className="r num">{won(sum(env))}</span></div>}
          {bank.length > 0 && <div className="trow"><span className="l">통장 {bank.length}줄</span><span className="r num">{won(sum(bank))}</span></div>}
          <div className="trow grand">
            <span className="l">이번 주 합계</span>
            {held.length > 0 && <span className="faint">채울 줄 {held.length} · {won(sum(held))}은 아직 이름이 없습니다</span>}
            <span className="r num">{won(total)}</span>
          </div>
        </div>
      </section>

      <p className="note">
        {d.mode === "local"
          ? "이 PC 의 작업공간을 읽고 씁니다 · 자료는 밖으로 나가지 않습니다"
          : "예시 데이터입니다 · 실제 단체 자료가 아닙니다"}
        {d.recorded && <> · 모델 판정은 {d.recorded.device} · {d.recorded.threads}스레드에서 미리 잰 값이고 「모델로 다시 재기」만 실제로 돕니다</>}
        {" "}· 동명이인은 자동으로 채우지 않습니다
      </p>
    </>
  )
}
