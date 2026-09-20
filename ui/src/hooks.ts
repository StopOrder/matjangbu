import { useSyncExternalStore } from "react"

export function useMediaQuery(q: string): boolean {
  return useSyncExternalStore(
    (cb) => { const m = matchMedia(q); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb) },
    () => matchMedia(q).matches,
    () => false,
  )
}
export const useMobile = () => useMediaQuery("(max-width: 1099px)")
