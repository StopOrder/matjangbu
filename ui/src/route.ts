import { useSyncExternalStore } from "react"
import { ROUTES, type Route } from "./labels"

export function parseHash(hash: string): Route {
  const r = (hash || "#/dashboard").replace(/^#\/?/, "").split("/")[0] || "dashboard"
  return (ROUTES as readonly string[]).includes(r) ? (r as Route) : "dashboard"
}

const subscribe = (cb: () => void) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb) }
export function useHashRoute(): Route {
  return useSyncExternalStore(subscribe, () => parseHash(location.hash), () => "dashboard")
}
