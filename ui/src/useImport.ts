import { useCallback, useState } from "react"
import { counts } from "./lines"
import { useApp } from "./store"
import type { Line } from "./types"

export interface Prog { text: string; err: boolean; ratio: number | null }
export type ImportBody =
  | { sample_week: string }
  | { week: string; date: string; filename?: string; csv_text?: string }

/** `POST /import` + SSE 진행. 주간 장의 「줄 넣기」와 설정의 불러오기가 같이 쓴다. */
export function useImport() {
  const { s, client, load, toast, fail, dispatch } = useApp()
  const [prog, setProg] = useState<Prog>({ text: "", err: false, ratio: null })

  const run = useCallback(async (body: ImportBody, week: string) => {
    if (s.busy) return
    dispatch({ type: "busy", busy: true })
    setProg({ text: "줄을 서는 중…", err: false, ratio: 0 })
    const rows: Line[] = []
    let n = 0
    try {
      const job = await client.post<{ job: string }>("/import", body)
      await client.stream("/jobs/" + job.job + "/events", (ev) => {
        if (ev.event === "start") {
          n = ev.n || 0
          setProg({ text: "0 / " + n + " 줄 · 파일에서 " + (ev.skipped ?? 0) + "줄 제외(출금·금액 0)", err: false, ratio: 0 })
        } else if (ev.event === "line" && ev.row) {
          rows.push(ev.row)
          const i = (ev.i ?? rows.length - 1) + 1
          const N = ev.n || n
          setProg({ text: i + " / " + N + " 줄" + (ev.row.how === "모델" ? " · 모델이 본 줄: " + ev.row.raw : ""), err: false, ratio: N ? i / N : null })
        } else if (ev.state === "failed") {
          setProg({ text: ev.error || "실패", err: true, ratio: null })
        }
      })
      await load(week)
      const c = counts(rows)
      toast("줄 " + rows.length + "개 · 자동 " + c.auto + " / 채울 줄 " + c.held, c.held ? undefined : "ok")
      setProg({ text: "끝 · 자동 " + c.auto + " / 채울 줄 " + c.held, err: false, ratio: 1 })
    } catch (e) {
      setProg({ text: e instanceof Error ? e.message : String(e), err: true, ratio: null })
      fail(e)
    }
    dispatch({ type: "busy", busy: false })
  }, [client, load, toast, fail, dispatch, s.busy])

  const clear = useCallback(() => setProg({ text: "", err: false, ratio: null }), [])
  return { prog, run, clear, busy: s.busy }
}

/** 은행 CSV 는 EUC-KR 로 내려받는 은행이 많다. utf-8 로 읽어 깨지면 euc-kr 로 다시 읽는다. */
export async function readCsv(f: File): Promise<{ text: string; name: string; lines: string[] }> {
  const buf = await f.arrayBuffer()
  let text = new TextDecoder("utf-8", { fatal: false }).decode(buf)
  if (text.includes("�")) { try { text = new TextDecoder("euc-kr").decode(buf) } catch { /* utf-8 그대로 */ } }
  return { text, name: f.name, lines: text.split(/\r?\n/).filter(Boolean) }
}
