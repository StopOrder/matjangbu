import { Clock, Cpu, Download, FileText, LayoutDashboard, Mail, Users, type LucideIcon } from "lucide-react"
import { TITLES, type Route } from "@/labels"
import { useApp } from "@/store"
import { InstanceStatus } from "./InstanceStatus"

export const NAV: { route: Route; Icon: LucideIcon }[] = [
  { route: "dashboard", Icon: LayoutDashboard }, { route: "import", Icon: Download }, { route: "envelope", Icon: Mail },
  { route: "queue", Icon: Clock }, { route: "records", Icon: FileText }, { route: "roster", Icon: Users }, { route: "device", Icon: Cpu },
]

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs><linearGradient id="g-logo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1DB5AB" /><stop offset=".55" stopColor="#5FC884" /><stop offset="1" stopColor="#9EDC5F" /></linearGradient></defs>
      <rect width="32" height="32" rx="9" fill="url(#g-logo)" />
      <path d="M8 9h16M8 15h16M8 21h10" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M21 19l2.5 2.5L28 17" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Sidebar({ route }: { route: Route }) {
  const { s } = useApp()
  const held = s.data ? s.data.lines.filter((l) => l.state === "held").length : 0
  return (
    <aside className="sidebar flex min-h-0 flex-col border-r border-line bg-white" aria-label="메뉴">
      <a className="brand flex h-14 items-center gap-2.5 border-b border-line px-4 text-[17px] font-extrabold text-ink" href="../">
        <Logo /> 맞장부 <span className="badge badge-gray">잠정명</span>
      </a>
      <nav id="nav" className="flex flex-col gap-0.5 overflow-y-auto p-2.5">
        {NAV.map(({ route: r, Icon }) => {
          const active = r === route
          return (
            <a key={r} href={"#/" + r} data-route={r} aria-current={active ? "page" : "false"}
               className={"relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] transition-colors " + (active ? "nav-active bg-brand-bg font-bold text-brand-ink" : "text-muted-foreground hover:bg-surface hover:text-ink")}>
              <Icon className="size-5" aria-hidden="true" />{TITLES[r]}
              {r === "queue" && <span className="cnt badge badge-held ml-auto" id="n-queue" hidden={!held}>{held}</span>}
            </a>
          )
        })}
      </nav>
      <InstanceStatus />
    </aside>
  )
}
