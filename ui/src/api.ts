import type { SseEvent } from "./types"

export const HEADER = "X-Matjangbu-Session"
export const sessionKey = (apiBase: string) => "mj.session@" + apiBase

export function savedSession(apiBase: string): string {
  try { return localStorage.getItem(sessionKey(apiBase)) || "" } catch { return "" }
}
export function remember(apiBase: string, tok: string | null): void {
  if (!tok) return
  try { localStorage.setItem(sessionKey(apiBase), tok) } catch { /* 저장 못 해도 쿠키로 간다 */ }
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.name = "ApiError"; this.status = status }
}

/** `data: {...}\n\n` 단위로 자른다. 마지막 미완 조각은 rest 로 돌려준다. */
export function parseSse(buf: string): { events: SseEvent[]; rest: string } {
  const parts = buf.split("\n\n")
  const rest = parts.pop() ?? ""
  const events: SseEvent[] = []
  for (const chunk of parts) {
    const m = /(?:^|\n)data: (.*)/.exec(chunk)
    if (!m) continue
    try { events.push(JSON.parse(m[1]) as SseEvent) } catch { /* 깨진 이벤트는 버린다 */ }
  }
  return { events, rest }
}

export interface Client {
  api<T = unknown>(path: string, opts?: RequestInit): Promise<T>
  post<T = unknown>(path: string, data?: unknown): Promise<T>
  stream(path: string, onEvent: (ev: SseEvent) => void): Promise<void>
}

export function makeClient(apiBase: string, sameOrigin: boolean): Client {
  const credentials: RequestCredentials = sameOrigin ? "same-origin" : "omit"
  const sessionHeaders = (): Record<string, string> => { const t = savedSession(apiBase); return t ? { [HEADER]: t } : {} }

  async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
    const r = await fetch(apiBase + "api" + path, { credentials, ...opts, headers: { ...(opts.headers as Record<string, string> | undefined), ...sessionHeaders() } })
    remember(apiBase, r.headers.get(HEADER))
    const ct = r.headers.get("Content-Type") || ""
    if (ct.startsWith("text/csv")) {
      if (!r.ok) throw new ApiError("HTTP " + r.status, r.status)
      return (await r.text()) as unknown as T
    }
    let body: { ok?: boolean; error?: string } | null = null
    try { body = await r.json() } catch { body = null }
    if (!r.ok) throw new ApiError((body && body.error) || "HTTP " + r.status, r.status)
    return body as unknown as T
  }

  const post = <T = unknown>(path: string, data?: unknown) =>
    api<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data ?? {}) })

  async function stream(path: string, onEvent: (ev: SseEvent) => void): Promise<void> {
    const r = await fetch(apiBase + "api" + path, { credentials, headers: sessionHeaders() })
    if (!r.ok || !r.body) throw new ApiError("HTTP " + r.status, r.status)
    const reader = r.body.getReader(), dec = new TextDecoder()
    let buf = ""
    for (;;) {
      const x = await reader.read()
      if (x.done) break
      buf += dec.decode(x.value, { stream: true })
      const { events, rest } = parseSse(buf)
      buf = rest
      for (const ev of events) onEvent(ev)
    }
  }

  return { api, post, stream }
}
