import { createContext, useCallback, useContext, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from "react"
import { makeClient, type Client } from "./api"
import { BASE, resolveState } from "./load"
import type { AppData, EnvRow, Recorded, RecTab, Toast } from "./types"

export interface AppState {
  data: AppData | null; readonly: boolean; apiBase: string; recorded: Recorded | null
  loading: boolean; error: string | null; loadSeq: number
  selected: string | null; query: string; tab: RecTab; busy: boolean; envRows: EnvRow[]; toasts: Toast[]
}
export type Action =
  | { type: "loading" }
  | { type: "loaded"; data: AppData; readonly: boolean; apiBase: string; recorded: Recorded | null }
  | { type: "loadError"; error: string }
  | { type: "select"; id: string | null }
  | { type: "query"; q: string }
  | { type: "tab"; tab: RecTab }
  | { type: "busy"; busy: boolean }
  | { type: "envRows"; rows: EnvRow[] }
  | { type: "toast"; toast: Toast }
  | { type: "dismiss"; id: number }

export const emptyRow = (): EnvRow => ({ name: "", kind: "", amount: "" })

const initial: AppState = {
  data: null, readonly: false, apiBase: BASE, recorded: null, loading: true, error: null, loadSeq: 0,
  selected: null, query: "", tab: "week", busy: false, envRows: [emptyRow()], toasts: [],
}

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case "loading": return { ...s, loading: true }
    case "loaded": return { ...s, data: a.data, readonly: a.readonly, apiBase: a.apiBase, recorded: a.recorded, loading: false, error: null, loadSeq: s.loadSeq + 1 }
    case "loadError": return { ...s, loading: false, error: a.error }
    case "select": return { ...s, selected: a.id }
    case "query": return { ...s, query: a.q }
    case "tab": return { ...s, tab: a.tab }
    case "busy": return { ...s, busy: a.busy }
    case "envRows": return { ...s, envRows: a.rows.length ? a.rows : [emptyRow()] }
    case "toast": return { ...s, toasts: [...s.toasts, a.toast] }
    case "dismiss": return { ...s, toasts: s.toasts.filter((t) => t.id !== a.id) }
  }
}

interface Ctx {
  s: AppState; dispatch: Dispatch<Action>; client: Client
  load(week?: string): Promise<void>
  toast(msg: string, kind?: Toast["kind"], action?: Toast["action"]): void
  fail(e: unknown): void
}
const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [s, dispatch] = useReducer(reducer, initial)
  const recRef = useRef<Recorded | null>(null)
  const seq = useRef(0)

  const toast = useCallback((msg: string, kind?: Toast["kind"], action?: Toast["action"]) => {
    const id = ++seq.current
    dispatch({ type: "toast", toast: { id, msg, kind, action } })
    setTimeout(() => dispatch({ type: "dismiss", id }), 3200)
  }, [])
  const fail = useCallback((e: unknown) => toast(e instanceof Error ? e.message : String(e), "err"), [toast])

  const load = useCallback(async (week?: string) => {
    try {
      const r = await resolveState(week, recRef.current)
      recRef.current = r.recorded
      dispatch({ type: "loaded", ...r })
    } catch (e) {
      dispatch({ type: "loadError", error: e instanceof Error ? e.message : String(e) })
    }
  }, [])

  const client = useMemo(() => makeClient(s.apiBase, s.apiBase === BASE), [s.apiBase])
  const value = useMemo<Ctx>(() => ({ s, dispatch, client, load, toast, fail }), [s, client, load, toast, fail])
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp(): Ctx {
  const c = useContext(AppCtx)
  if (!c) throw new Error("AppProvider 밖")
  return c
}
/** 화면 컴포넌트는 데이터가 있을 때만 마운트된다 */
export function useData(): AppData {
  const { s } = useApp()
  if (!s.data) throw new Error("데이터 없음")
  return s.data
}

/** 장부의 채울 줄(그 자리 펼침)이 쓰는 액션. 확정·보류·제외 토스트에 「되돌리기」(POST /undo). */
export function useLineActions() {
  const { s, client, load, toast, fail } = useApp()
  const week = s.data?.week
  const undo = useCallback(async () => {
    try {
      const u = await client.post<{ id: string }>("/undo")
      const l = s.data?.lines.find((x) => x.id === u.id)
      toast("되돌림: " + (l ? l.raw : u.id))
      await load(week); return true
    } catch (e) { fail(e); return false }
  }, [client, s.data, load, toast, fail, week])
  const withUndo = { label: "되돌리기", run: () => { void undo() } }

  const pick = useCallback(async (id: string, personId: string) => {
    try {
      const out = await client.post<{ alias_learned?: boolean }>("/lines/" + id + "/confirm", { person_id: personId })
      toast(out.alias_learned ? "별칭 사전에 저장됨 · 다음부터 자동" : "확정", "ok", withUndo)
      await load(week); return true
    } catch (e) { fail(e); return false }
  }, [client, load, toast, fail, week])
  const addNew = useCallback(async (id: string, name: string, group: string) => {
    try {
      const out = await client.post<{ new_person?: { name: string } }>("/lines/" + id + "/confirm", { new_person: { name, group } })
      toast("명부에 등록하고 확정: " + (out.new_person ? out.new_person.name : name), "ok", withUndo)
      await load(week); return true
    } catch (e) { fail(e); return false }
  }, [client, load, toast, fail, week])
  const hold = useCallback(async (id: string) => {
    try { await client.post("/lines/" + id + "/hold", {}); toast("보류", undefined, withUndo); await load(week); return true } catch (e) { fail(e); return false }
  }, [client, load, toast, fail, week])
  const exclude = useCallback(async (id: string) => {
    try { await client.post("/lines/" + id + "/exclude", { why: "" }); toast("제외했습니다", undefined, withUndo); await load(week); return true } catch (e) { fail(e); return false }
  }, [client, load, toast, fail, week])
  /** onProgress(text, err) 로 진행 문구를 준다. 끝나면 다시 불러온다. */
  const rematch = useCallback(async (id: string, onProgress: (text: string, err?: boolean) => void) => {
    onProgress("줄 서는 중…")
    let tick: ReturnType<typeof setInterval> | undefined
    try {
      const job = await client.post<{ job: string }>("/lines/" + id + "/rematch", {})
      let t0 = Date.now()
      tick = setInterval(() => onProgress("모델이 보는 중 · " + Math.round((Date.now() - t0) / 1000) + "초"), 500)
      await client.stream("/jobs/" + job.job + "/events", (ev) => {
        if (ev.state === "queued" && ev.position) { onProgress("앞에 " + ev.position + "건"); t0 = Date.now() }
        if (ev.state === "failed") onProgress(ev.error || "실패", true)
      })
      clearInterval(tick)
      toast("다시 쟀습니다", "ok")
      await load(week)
    } catch (e) { if (tick) clearInterval(tick); onProgress(e instanceof Error ? e.message : String(e), true); fail(e) }
  }, [client, load, toast, fail, week])

  return { pick, addNew, hold, exclude, rematch, undo }
}
