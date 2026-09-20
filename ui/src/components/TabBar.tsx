import { TITLES, type Route } from "@/labels"
import { NAV } from "./Sidebar"

export function TabBar({ route }: { route: Route }) {
  return (
    <nav className="tabbar" aria-label="메뉴">
      {NAV.map(({ route: r, Icon }) => {
        const active = r === route
        return (
          <a key={r} href={"#/" + r} aria-current={active ? "page" : "false"}
             className={"flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold " + (active ? "text-brand-ink" : "text-muted-foreground")}>
            <span className={active ? "rounded-lg p-1 bg-brand-bg" : "p-1"}><Icon className="size-5" aria-hidden="true" /></span>
            {TITLES[r].replace("·별칭", "")}
          </a>
        )
      })}
    </nav>
  )
}
