import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/Icons"
import { localYearCsv, parseCsv } from "@/fallback"
import { won } from "@/format"
import { NO_KIND } from "@/labels"
import { useApp, useData } from "@/store"

/** 연말 — 사람별 누적. 숫자는 서버(또는 읽기 전용 폴백)가 내는 연말 합산 CSV 를 그대로 읽어 그린다.
 *  화면에서 다시 더하지 않는다 — 내보낸 CSV 와 화면이 어긋날 자리를 만들지 않기 위해서다. */
export default function Year() {
  const d = useData()
  const { s, client } = useApp()
  const years = Array.from(new Set(d.weeks.map((w) => w.slice(0, 4)))).sort()
  const [year, setYear] = useState(() => d.week.slice(0, 4) || years[years.length - 1] || String(new Date().getFullYear()))
  const [csv, setCsv] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const cache = useRef(new Map<string, string>())

  const key = year + "|" + s.loadSeq + "|" + (s.readonly ? "ro" : "live")
  useEffect(() => {
    let alive = true
    setErr(null)
    const hit = cache.current.get(key)
    if (hit != null) { setCsv(hit); return }
    setCsv(null)
    const p = s.readonly
      ? Promise.resolve(localYearCsv(s.recorded!, d.roster, "year"))
      : client.api<string>("/export/year.csv?year=" + encodeURIComponent(year))
    p.then((t) => { cache.current.set(key, t); if (alive) setCsv(t) })
     .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const table = csv ? parseCsv(csv) : null
  const head = table?.[0] ?? []
  const body = (table?.slice(1) ?? []).filter((r) => r.length > 1)
  const people = body.filter((r) => r[0] !== "합계" && r[0] !== "미확정")
  const grand = body.find((r) => r[0] === "합계")
  const unconf = body.find((r) => r[0] === "미확정")
  const kindCols = head.slice(4)     // 이름·구역·합계·건수 다음이 종류별 열
  const n = (v: string | undefined) => Number(v || 0)

  const download = () => {
    if (!csv) return
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob(["﻿" + csv.replace(/^﻿/, "")], { type: "text/csv;charset=utf-8" }))
    a.download = "연말합산-" + year + ".csv"
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const i = years.indexOf(year)
  const go = (k: number) => { const y = years[i + k]; if (y) setYear(y) }

  return (
    <>
      <div className="head">
        <button className="arrow" aria-label="지난 해" disabled={i <= 0} onClick={() => go(-1)}><Icon name="left" /></button>
        <div>
          <h1>{year}년 누적</h1>
          <div className="when">사람별 합산 · 기부금영수증 기초자료</div>
        </div>
        <button className="arrow" aria-label="다음 해" disabled={i < 0 || i >= years.length - 1} onClick={() => go(1)}><Icon name="right" /></button>
        <span className="grow" />
        <button className="btn" disabled={!csv} onClick={download}><Icon name="export" />CSV 로 내보내기</button>
      </div>

      {unconf && n(unconf[3]) > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row" style={{ cursor: "default" }}>
            <div className="av" style={{ background: "var(--amber-weak)", color: "var(--amber-text)" }}><Icon name="filter" /></div>
            <div className="ct">
              <div className="t">아직 이름이 없는 줄 {n(unconf[3])}개<span className="need-t">확정 전에는 합계에 들어가지 않습니다</span></div>
              <div className="s"><a href="#/week" style={{ color: "var(--blue)", fontWeight: 600 }}>이번 주 장부에서 채우기 →</a></div>
            </div>
            <div className="rt"><div className="v num">{won(n(unconf[2]))}</div></div>
          </div>
        </div>
      )}

      <section className="card">
        <div className="chead">
          <span className="m"><b>{people.length}</b>명</span>
          {grand && <><span className="m">건수 <b>{n(grand[3])}</b></span><span className="m">합계 <b className="num">{won(n(grand[2]))}</b></span></>}
        </div>
        {err ? <div className="empty">{err}</div>
          : csv == null ? <div className="skel" style={{ height: 240, borderRadius: 0 }} />
          : people.length === 0 ? <div className="empty">{year}년에 확정된 줄이 없습니다</div>
          : people.map((r, idx) => {
              // 「(종류 없음)」은 합계와 같은 말이라 적지 않는다
              const kinds = kindCols.map((k, j) => (k !== NO_KIND && n(r[4 + j]) ? k + " " + n(r[4 + j]).toLocaleString("ko-KR") : "")).filter(Boolean)
              return (
                <div className="row" key={r[0] + "-" + idx} data-mj="row">
                  <div className="av"><Icon name="user" /></div>
                  <div className="ct">
                    <div className="t">{r[0]}{r[1] && <span className="g">{r[1]}</span>}</div>
                    <div className="s">
                      <span>{n(r[3])}건</span>
                      {kinds.map((k) => <span key={k}><span className="dot">·</span> {k}</span>)}
                    </div>
                  </div>
                  <div className="rt"><div className="v num">{won(n(r[2]))}</div></div>
                </div>
              )
            })}
        {grand && (
          <div className="cfoot" data-mj="total">
            <div className="trow grand">
              <span className="l">{year}년 합계</span>
              {unconf && n(unconf[3]) > 0 && <span className="faint">미확정 {n(unconf[3])}건 · {won(n(unconf[2]))}은 빠져 있습니다</span>}
              <span className="r num">{won(n(grand[2]))}</span>
            </div>
          </div>
        )}
      </section>

      <p className="note">
        {s.readonly
          ? "미리 잰 기록 4주를 합산한 값입니다 · 실제 단체 자료가 아닙니다"
          : "연말 합산은 기부금영수증 기초자료입니다 · 미확정 줄은 따로 셉니다 · 암호화 백업은 준비 중입니다"}
      </p>
    </>
  )
}
