import { useEffect, useState } from "react"
import { Icon } from "@/components/Icons"
import { localWeekCsv, localYearCsv } from "@/fallback"
import { fmtTs } from "@/format"
import { useApp, useData } from "@/store"
import { readCsv, useImport } from "@/useImport"
import type { Health, RecTab } from "@/types"

/** 설정 — 이 기기·인스턴스가 어떤 상태인지, 줄을 넣고 내보내고 처음으로 되돌리는 곳.
 *  옛 「기기」·「불러오기」·「기록」 화면이 하던 일을 여기로 모았다. */
export default function Settings() {
  const d = useData()
  const { s, client, load, toast, fail } = useApp()
  const imp = useImport()
  const [h, setH] = useState<Health | null>(null)
  const [sample, setSample] = useState("")
  const [wk, setWk] = useState(d.week)
  const [date, setDate] = useState(() => d.lines[0]?.date || new Date().toISOString().slice(0, 10))
  const [csv, setCsv] = useState<{ text: string; name: string; lines: string[] } | null>(null)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (s.readonly) return
    let alive = true
    client.api<Health>("/health").then((x) => { if (alive) setH(x) }).catch(() => { /* 없으면 안 보인다 */ })
    return () => { alive = false }
  }, [client, s.readonly, s.loadSeq])

  const local = d.mode === "local"
  const weekSel = sample && d.weeks_available.includes(sample) ? sample : d.weeks_available[0] || ""

  const download = async (which: RecTab) => {
    const year = (d.week || "").slice(0, 4)
    const name = ({ week: "주간명단-" + d.week, person: "개인별누적-" + year, year: "연말합산-" + year } as Record<RecTab, string>)[which]
    try {
      const text = s.readonly
        ? (which === "week" ? localWeekCsv(d) : localYearCsv(s.recorded!, d.roster, which))
        : await client.api<string>("/export/" + which + ".csv?" + (which === "week" ? "week=" + encodeURIComponent(d.week) : "year=" + year))
      const a = document.createElement("a")
      a.href = URL.createObjectURL(new Blob(["﻿" + text.replace(/^﻿/, "")], { type: "text/csv;charset=utf-8" }))
      a.download = name + ".csv"
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) { fail(e) }
  }

  const reset = async () => {
    if (!window.confirm("체험을 처음 상태로 되돌립니다. 지금까지 고른 답과 넣은 줄이 모두 사라집니다. 계속할까요?")) return
    setResetting(true)
    try { await client.post("/reset"); toast("처음 상태로 되돌렸습니다", "ok"); await load() } catch (e) { fail(e) }
    setResetting(false)
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>설정</h1>
          <div className="when">이 화면이 무엇을 읽고 쓰는지 · 줄 넣기 · 내보내기</div>
        </div>
      </div>

      <div className="cards two" style={{ marginBottom: 16 }}>
        <section className="card pad">
          <h2>지금 어디를 읽고 있나요</h2>
          <p className="sub">화면은 같은 주소 → 체험 인스턴스 → 미리 잰 기록 순으로 찾습니다.</p>
          <dl className="kv">
            <dt>주소</dt><dd>{s.readonly ? "없음 · 미리 잰 기록을 읽는 중" : s.apiBase}</dd>
            <dt>모드</dt><dd>{local ? "이 PC(로컬)" : d.mode === "demo" ? "체험 · 가공 샘플만" : "읽기 전용"}</dd>
            <dt>기기</dt><dd>{h?.device || d.device || "—"}</dd>
            <dt>모델 서버</dt><dd>{d.model_alive ? "응답" : "없음"}{h?.model_url ? " · " + h.model_url : ""}</dd>
            {h && <><dt>대기열</dt><dd>{h.queued}</dd><dt>세션</dt><dd>{h.sessions}</dd></>}
          </dl>
        </section>

        <section className="card pad">
          <h2>미리 잰 기록</h2>
          <p className="sub">모델 서버가 없어도 화면이 도는 이유 — 잰 결과를 그대로 재생합니다.</p>
          {d.recorded ? (
            <dl className="kv">
              <dt>기기</dt><dd>{d.recorded.device}</dd>
              <dt>모델</dt><dd>{d.recorded.model}</dd>
              <dt>스레드</dt><dd>{d.recorded.threads}</dd>
              <dt>잰 때</dt><dd>{fmtTs(d.recorded.ts)}</dd>
              {d.recorded.engine_git && <><dt>엔진</dt><dd>{d.recorded.engine_git}</dd></>}
            </dl>
          ) : <p className="hint">이 PC 에서 직접 돌립니다 — 재생할 기록이 없습니다.</p>}
        </section>
      </div>

      <section className="card pad" style={{ marginBottom: 16 }}>
        <h2>줄 넣기</h2>
        <p className="sub">{local
          ? "은행 CSV 를 고르면 이 PC 의 「들어옴」 폴더에 저장하고 줄마다 3단으로 맞춥니다. 인터넷으로 나가지 않습니다."
          : "가공 샘플 은행 CSV 를 실제 규칙으로 맞춥니다. 모델 판정은 미리 잰 값을 재생합니다."}</p>

        {s.readonly ? <p className="hint">미리 잰 기록을 읽는 중입니다 — 줄을 넣을 수 없습니다.</p> : local ? (
          <div className="cands">
            <input className="inp" style={{ width: 140 }} placeholder="2026-W10" aria-label="주차" value={wk} onChange={(e) => setWk(e.target.value)} />
            <input className="inp" style={{ width: 170 }} type="date" aria-label="날짜" value={date} onChange={(e) => setDate(e.target.value)} />
            <input className="file" type="file" accept=".csv,text/csv" aria-label="은행 CSV"
                   onChange={(e) => { const f = e.target.files?.[0]; if (f) void readCsv(f).then(setCsv) }} />
            <button className="btn primary" disabled={imp.busy || !csv}
                    onClick={() => { if (csv) void imp.run({ week: wk.trim(), date, filename: csv.name, csv_text: csv.text }, wk.trim()) }}>맞추기</button>
          </div>
        ) : (
          <div className="cands">
            <select className="inp" style={{ width: 180 }} aria-label="샘플 주차" value={weekSel} disabled={!d.weeks_available.length}
                    onChange={(e) => setSample(e.target.value)}>
              {d.weeks_available.length ? d.weeks_available.map((w) => <option key={w}>{w}</option>) : <option value="">남은 샘플 주차 없음</option>}
            </select>
            <button className="btn primary" disabled={imp.busy || !weekSel}
                    onClick={() => { void imp.run({ sample_week: weekSel }, weekSel) }}>샘플 주차 넣기</button>
          </div>
        )}
        {csv && <div className="pre">{csv.lines.slice(0, 8).join("\n")}</div>}
        {imp.prog.text && (
          <>
            <p className={"hint" + (imp.prog.err ? " err" : "")} style={{ marginTop: 12 }}>{imp.prog.text}</p>
            {imp.prog.ratio != null && <div className="prog"><i style={{ width: Math.round(imp.prog.ratio * 100) + "%" }} /></div>}
          </>
        )}
      </section>

      <section className="card pad" style={{ marginBottom: 16 }}>
        <h2>내보내기</h2>
        <p className="sub">엑셀에서 그대로 열리는 CSV 입니다. 이 PC 의 「내보내기」 폴더에도 같은 파일이 쌓입니다.</p>
        <div className="links">
          <button className="btn" onClick={() => { void download("week") }}><Icon name="export" />주간 명단 · {d.week}</button>
          <button className="btn" onClick={() => { void download("person") }}><Icon name="export" />개인별 누적 · {(d.week || "").slice(0, 4)}</button>
          <button className="btn" onClick={() => { void download("year") }}><Icon name="export" />연말 합산 · {(d.week || "").slice(0, 4)}</button>
        </div>
      </section>

      {d.mode === "demo" && !s.readonly && (
        <section className="card pad">
          <h2>체험 다시 시작</h2>
          <p className="sub">고른 답과 넣은 줄을 지우고 첫 주차만 남은 상태로 되돌립니다. 이 브라우저의 체험 자료만 지워집니다.</p>
          <button className="btn" disabled={resetting} onClick={() => { void reset() }}><Icon name="refresh" />처음으로 되돌리기</button>
        </section>
      )}

      <p className="note">
        금액과 이름은 이 PC 밖으로 나가지 않습니다 · 체험 인스턴스는 가공 샘플만 다루고 파일 업로드를 받지 않습니다 ·{" "}
        <a href="../install/" style={{ color: "var(--blue)", fontWeight: 600 }}>설치·백업·인수인계 안내 →</a>
      </p>
    </>
  )
}
