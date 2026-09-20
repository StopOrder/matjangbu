export type LineState = "auto" | "held" | "confirmed" | "excluded"
export type LinePath = "bank" | "envelope"
export type RecTab = "week" | "person" | "year"

export interface Person { id: string; name: string; group: string; household: string; old_names: string[] }
export interface Cand { person_id: string; name: string; group: string; why: string; score?: number }
export interface ModelPred { relation?: string; name_part?: string; kind?: string; [k: string]: unknown }
export interface ModelInfo {
  model?: string; wall_s?: number; prompt_n?: number; pp_tps?: number; tg_tps?: number
  replayed?: boolean; note?: string; error?: string; pred?: ModelPred | null
}
export interface Line {
  id: string; raw: string; amount: number; kind: string; date: string; week: string; path: LinePath
  state: LineState; reason?: string; how?: string; person_id?: string | null
  name: string; group: string; cands: Cand[]; model?: ModelInfo | null; allow_new?: boolean
  ts?: string; human?: boolean; undo_of?: string; note?: string; alias_learned?: boolean
}
export interface Activity {
  id: string; week?: string; raw?: string; state?: LineState; ts?: string
  note?: string; alias_learned?: boolean; undo_of?: string; human?: boolean
}
export interface RecordedMeta { device: string; model: string; threads: number; url?: string; ts: string; engine_git?: string }
export interface Alias { person_id: string; learned: string; from?: string }
export interface AppData {
  mode: "demo" | "local" | "recorded"; week: string; weeks: string[]; weeks_available: string[]
  lines: Line[]; all_count: number; roster: Person[]; aliases: Record<string, Alias>; kinds: string[]
  device: string; model_alive: boolean; recorded: RecordedMeta | null; answers: Record<string, string>
  can_undo: boolean; recent?: Activity[]
}
/** recorded.json 의 줄 — name/group 없이 person_id 와 cands[{person_id, why}] 만 있다 */
export type RecordedRow = Omit<Line, "name" | "group" | "cands"> & { cands?: { person_id: string; why: string; score?: number }[] }
export interface Recorded {
  meta: RecordedMeta; weeks: Record<string, { rows: RecordedRow[] }>; roster: Person[]
  aliases: Record<string, Alias>; answers: Record<string, Record<string, string>>
}
export interface Health {
  mode: string; device: string; model_url: string; model_alive: boolean; queued: number; sessions: number; recorded: RecordedMeta | null
}
export interface Toast { id: number; msg: string; kind?: "ok" | "err"; action?: { label: string; run: () => void } }
export interface EnvRow { name: string; kind: string; amount: string }
export interface SseEvent {
  event?: "start" | "line" | string; state?: "queued" | "running" | "done" | "failed" | string
  i?: number; n?: number; skipped?: number; row?: Line; position?: number; error?: string; elapsed_s?: number
}
