import { Search, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TITLES, type Route } from "@/labels"
import { useApp } from "@/store"
import { InstanceStatus } from "./InstanceStatus"
import { Logo } from "./Sidebar"

export function Topbar({ route }: { route: Route }) {
  const { s, dispatch, load, client, toast, fail } = useApp()
  const d = s.data
  const undo = async () => {
    try { const u = await client.post<{ id: string }>("/undo"); const l = d?.lines.find((x) => x.id === u.id); toast("되돌림: " + (l ? l.raw : u.id)); await load(d?.week) } catch (e) { fail(e) }
  }
  return (
    <header className="topbar flex flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-2 lg:px-6">
      <span className="flex items-center gap-2 lg:hidden"><Logo size={22} /><InstanceStatus compact /></span>
      <span className="hidden text-[13px] font-semibold text-muted-foreground lg:inline">{TITLES[route]}</span>
      <label className="search relative order-3 flex w-full items-center lg:order-none lg:w-[22rem]">
        <Search className="pointer-events-none absolute left-3 size-4 text-faint" aria-hidden="true" />
        <input type="search" id="q" className="pl-9! bg-surface! border-line!" placeholder="입금자명 · 이름" aria-label="검색"
               value={s.query} onChange={(e) => dispatch({ type: "query", q: e.target.value.trim() })} />
      </label>
      <select id="week" aria-label="주차" className="w-auto! max-w-[12rem]" value={d?.week || ""} onChange={(e) => { void load(e.target.value) }}>
        {(d?.weeks.length ? d.weeks : ["-"]).map((w) => <option key={w}>{w}</option>)}
      </select>
      <div className="actions ml-auto flex items-center gap-2">
        <Button id="undo" variant="outline" size="sm" className="h-9 rounded-xl px-3 text-[13px]" disabled={s.readonly || !d?.can_undo} onClick={() => { void undo() }}>
          <Undo2 aria-hidden="true" /><span className="hidden sm:inline">마지막 확정 되돌리기</span><span className="sm:hidden">되돌리기</span>
        </Button>
      </div>
    </header>
  )
}
