/** 인라인 SVG 스프라이트. 외부 자원 0 규칙 때문에 아이콘 폰트·CDN 을 쓰지 않는다.
 *  시안(docs/mockups/2026-09-21-weekly-ledger.html)의 symbol 정의를 그대로 옮겼다. */
export const ICONS = [
  "book", "card", "envelope", "search", "left", "right", "down", "up",
  "plus", "undo", "export", "filter", "refresh", "user", "check", "gear", "upload", "x",
] as const
export type IconName = (typeof ICONS)[number]

export function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <symbol id="i-book" viewBox="0 0 24 24"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="m9 9 2 2 4-4" /></symbol>
      <symbol id="i-card" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20" /></symbol>
      <symbol id="i-envelope" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="3" /><path d="m3 6 9 7 9-7" /></symbol>
      <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></symbol>
      <symbol id="i-left" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></symbol>
      <symbol id="i-right" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></symbol>
      <symbol id="i-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></symbol>
      <symbol id="i-up" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6" /></symbol>
      <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
      <symbol id="i-undo" viewBox="0 0 24 24"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></symbol>
      <symbol id="i-export" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></symbol>
      <symbol id="i-filter" viewBox="0 0 24 24"><path d="M22 3H2l8 9.5V19l4 2v-8.5z" /></symbol>
      <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path d="M3 21v-5h5" /><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" /><path d="M21 3v5h-5" /></symbol>
      <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12 5 5L20 7" /></symbol>
      <symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" /></symbol>
      <symbol id="i-upload" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 8 5-5 5 5" /><path d="M12 3v12" /></symbol>
      <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></symbol>
    </svg>
  )
}

export function Icon({ name, sm, className }: { name: IconName; sm?: boolean; className?: string }) {
  return (
    <svg className={"i" + (sm ? " sm" : "") + (className ? " " + className : "")} aria-hidden="true">
      <use href={"#i-" + name} />
    </svg>
  )
}
