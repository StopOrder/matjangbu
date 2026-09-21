import { useSyncExternalStore } from "react"
import { ROUTES, type Route } from "./labels"

export function parseHash(hash: string): Route {
  const r = (hash || "#/week").replace(/^#\/?/, "").split("/")[0] || "week"
  return (ROUTES as readonly string[]).includes(r) ? (r as Route) : "week"
}

const subscribe = (cb: () => void) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb) }
export function useHashRoute(): Route {
  return useSyncExternalStore(subscribe, () => parseHash(location.hash), () => "week")
}
