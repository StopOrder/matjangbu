import type { ReactNode } from "react"
import { TITLES, type Route } from "@/labels"
import { useApp } from "@/store"
import { Banner } from "./Banner"
import { LinePanel } from "./LinePanel"
import { Sidebar } from "./Sidebar"
import { TabBar } from "./TabBar"
import { Toasts } from "./Toasts"
import { Topbar } from "./Topbar"

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  const { s } = useApp()
  return (
    <div className={"app" + (s.selected ? " panel-open" : "")}>
      <Sidebar route={route} />
      <Banner />
      <Topbar route={route} />
      <main id="main" className="main min-w-0 overflow-y-auto p-4 lg:p-6">
        <section className="max-w-[1400px]">
          <h1 className="mb-4 text-[22px] font-bold">{TITLES[route]}</h1>
          {children}
        </section>
      </main>
      <TabBar route={route} />
      <LinePanel />
      <Toasts />
      <datalist id="roster-list">{s.data?.roster.map((p) => <option key={p.id} value={p.name}>{p.group}</option>)}</datalist>
    </div>
  )
}
