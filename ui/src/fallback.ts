import { NO_KIND } from "./labels"
import type { AppData, Cand, Line, Person, Recorded } from "./types"

/** ISO 주차 문자열 `YYYY-Www` */
export function guessWeek(d: Date = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return t.getUTCFullYear() + "-W" + String(Math.ceil(((t.getTime() - y0.getTime()) / 864e5 + 1) / 7)).padStart(2, "0")
}

/** RFC 4180 대로 — 따옴표 안의 쉼표·줄바꿈·"" 이스케이프, BOM·CR 제거, 빈 줄 버림 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cur = "", q = false
  text = text.replace(/^﻿/, "")
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false }
      else cur += ch
    } else if (ch === '"') q = true
    else if (ch === ",") { row.push(cur); cur = "" }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = "" }
    else if (ch !== "\r") cur += ch
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows.filter((r) => r.length > 1 || r[0])
}

/** recorded.json → 읽기 전용 화면 상태(삼중 폴백의 마지막 단) */
export function offline(rec: Recorded, week?: string): AppData {
  const weeks = Object.keys(rec.weeks).sort()
  const cur = week && rec.weeks[week] ? week : weeks[0]
  const byId = new Map<string, Person>(rec.roster.map((p) => [p.id, p]))
  const view = (row: Recorded["weeks"][string]["rows"][number]): Line => {
    const p = row.person_id ? byId.get(row.person_id) : undefined
    const cands: Cand[] = (row.cands || [])
      .filter((c) => byId.has(c.person_id))
      .map((c) => ({ ...c, name: byId.get(c.person_id)!.name, group: byId.get(c.person_id)!.group }))
    return { ...row, name: p ? p.name : "", group: p ? p.group : "", cands }
  }
  return {
    mode: "recorded", week: cur, weeks, weeks_available: [],
    lines: cur ? rec.weeks[cur].rows.map(view) : [],
    all_count: weeks.reduce((n, w) => n + rec.weeks[w].rows.length, 0),
    roster: rec.roster, aliases: rec.aliases, kinds: [], device: rec.meta.device, model_alive: false,
    recorded: rec.meta, answers: rec.answers[cur] || {}, can_undo: false,
  }
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)
const csvLines = (rows: string[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\n")

/** 읽기 전용: 현재 주차 줄에서 주간 명단을 직접 만든다(서버의 export/week.csv 와 같은 열) */
export function localWeekCsv(data: AppData): string {
  const rows = data.lines.filter((l) => l.state === "confirmed").concat(data.lines.filter((l) => l.state === "auto"))
  const out: string[][] = [["이름", "구역", "종류", "금액", "경로", "근거", "원문"]]
  for (const l of rows) out.push([l.name, l.group, l.kind || NO_KIND, String(l.amount), l.path === "envelope" ? "봉투" : "통장", l.how || "", l.raw])
  out.push(["합계", "", "", String(rows.reduce((a, l) => a + l.amount, 0)), "", "", ""])
  return csvLines(out)
}

/** 읽기 전용: 기록의 모든 주차에서 개인별 누적(person) 또는 연말 합산(year, 미확정 줄 포함) */
export function localYearCsv(rec: Recorded, roster: Person[], which: "person" | "year"): string {
  const byId = new Map<string, Person>(roster.map((p) => [p.id, p]))
  const acc: Record<string, { total: number; count: number; k: Record<string, number> }> = {}
  const kinds = new Set<string>()
  let unc = 0, uncN = 0
  for (const w of Object.values(rec.weeks)) for (const l of w.rows) {
    if (l.state === "held") { unc += l.amount; uncN++ }
    if (!(l.state === "auto" || l.state === "confirmed") || !l.person_id) continue
    const k = l.kind || NO_KIND
    kinds.add(k)
    const a = (acc[l.person_id] = acc[l.person_id] || { total: 0, count: 0, k: {} })
    a.total += l.amount; a.count++; a.k[k] = (a.k[k] || 0) + l.amount
  }
  const ks = Array.from(kinds).sort((a, b) => Number(a === NO_KIND) - Number(b === NO_KIND) || a.localeCompare(b))
  const rows = Object.keys(acc).map((id) => ({ id, ...acc[id] })).sort((a, b) => b.total - a.total)
  const nm = (id: string) => byId.get(id)?.name ?? id
  const gp = (id: string) => byId.get(id)?.group ?? ""
  const head = which === "person" ? ["이름", "구역", ...ks, "합계", "건수"] : ["이름", "구역", "합계", "건수", ...ks]
  const line = (r: (typeof rows)[number]) =>
    which === "person"
      ? [nm(r.id), gp(r.id), ...ks.map((k) => String(r.k[k] || 0)), String(r.total), String(r.count)]
      : [nm(r.id), gp(r.id), String(r.total), String(r.count), ...ks.map((k) => String(r.k[k] || 0))]
  const out: string[][] = [head, ...rows.map(line)]
  const tot = rows.reduce((a, r) => a + r.total, 0), cnt = rows.reduce((a, r) => a + r.count, 0)
  out.push(which === "person"
    ? ["합계", "", ...ks.map(() => ""), String(tot), String(cnt)]
    : ["합계", "", String(tot), String(cnt), ...ks.map((k) => String(rows.reduce((a, r) => a + (r.k[k] || 0), 0)))])
  if (which === "year") out.push(["미확정", "", String(unc), String(uncN)])
  return csvLines(out)
}
