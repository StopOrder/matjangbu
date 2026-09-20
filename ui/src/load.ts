import { makeClient } from "./api"
import { offline } from "./fallback"
import type { AppData, Recorded } from "./types"

/** 이 화면이 있는 디렉터리(`/try/` 또는 `/matjangbu/try/`) — 같은 origin API 는 `BASE + "api/..."` */
export const BASE = typeof location === "undefined" ? "/" : location.pathname.endsWith("/") ? location.pathname : location.pathname.replace(/[^/]*$/, "")

export function metaApis(): string[] {
  const el = document.querySelector('meta[name="matjangbu-api"]') as HTMLMetaElement | null
  return (el?.content || "").split(/[\s,]+/).filter(Boolean)
}

/** 후보 base 순서: 같은 origin → meta 주소들(앞이 우선). here 는 BASE 의 절대 주소. */
export function candidateBases(base: string, here: string, metas: string[]): string[] {
  const out = [base]
  for (const m of metas) {
    const u = new URL(m.endsWith("/") ? m : m + "/", here).href
    if (u !== here && !out.includes(u)) out.push(u)
  }
  return out
}

export interface Loaded { data: AppData; readonly: boolean; apiBase: string; recorded: Recorded | null }

/** 삼중 폴백: 후보 base 를 차례로 `/state` 로 찔러 보고, 전부 실패하면 recorded.json 읽기 전용. */
export async function resolveState(week: string | undefined, cached: Recorded | null): Promise<Loaded> {
  const here = new URL(BASE, location.href).href
  const q = week ? "?week=" + encodeURIComponent(week) : ""
  for (const b of candidateBases(BASE, here, metaApis())) {
    try {
      const data = await makeClient(b, b === BASE).api<AppData>("/state" + q)
      window.matjangbuApiBase = b
      return { data, readonly: false, apiBase: b, recorded: cached }
    } catch { /* 다음 후보 */ }
  }
  window.matjangbuApiBase = null
  const rec = cached ?? ((await (await fetch(BASE + "recorded.json", { cache: "no-cache" })).json()) as Recorded)
  return { data: offline(rec, week), readonly: true, apiBase: BASE, recorded: rec }
}

declare global { interface Window { matjangbuApiBase: string | null | undefined } }
