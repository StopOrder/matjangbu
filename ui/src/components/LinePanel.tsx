import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { won } from "@/format"
import { useMobile } from "@/hooks"
import { NO_KIND, REASON } from "@/labels"
import { useApp, useData } from "@/store"
import type { Line } from "@/types"
import { CandidatePicker } from "./CandidatePicker"
import { HowBadge } from "./HowBadge"
import { StateBadge } from "./StateBadge"

function Body({ line }: { line: Line }) {
  const d = useData()
  const m = line.model || null
  const want = d.answers?.[line.raw]
  const wantName = want ? (d.roster.find((p) => p.id === want)?.name ?? want) : ""
  const meta = m ? [m.model && "모델 " + m.model, typeof m.wall_s === "number" && m.wall_s + "초", m.prompt_n && "프롬프트 " + m.prompt_n + " 토큰",
    m.pp_tps && "pp " + Number(m.pp_tps).toFixed(1) + " tok/s", m.tg_tps && "tg " + Number(m.tg_tps).toFixed(1) + " tok/s", m.replayed && "미리 잰 값", m.note, m.error && "오류 " + m.error].filter(Boolean).join(" · ") : ""
  return (
    <div className="d-body grid gap-5 text-[14px]">
      <section><h4 className="mb-2 text-[12px] font-semibold tracking-wide text-muted-foreground">판정</h4>
        <dl className="kv">
          <dt>상태</dt><dd><StateBadge state={line.state} /></dd>
          <dt>맞춘 사람</dt><dd>{line.name ? <>{line.name} <span className="text-muted-foreground">{line.group}</span></> : <span className="text-muted-foreground">없음</span>}</dd>
          <dt>근거</dt><dd><HowBadge line={line} /> {!line.how && !line.reason && <span className="text-muted-foreground">-</span>}</dd>
          <dt>종류</dt><dd>{line.kind || NO_KIND}</dd>
          {line.reason && <><dt>사유</dt><dd>{REASON[line.reason] || line.reason}</dd></>}
          {want && <><dt>샘플 정답</dt><dd>{wantName}</dd></>}
        </dl></section>
      {line.state === "held" && <section><h4 className="mb-2 text-[12px] font-semibold tracking-wide text-muted-foreground">후보</h4><CandidatePicker line={line} /></section>}
      {m && (
        <section><h4 className="mb-2 text-[12px] font-semibold tracking-wide text-muted-foreground">모델</h4>
          <div className="text-[13px] leading-relaxed text-muted-foreground">{meta}</div>
          {m.pred && <details className="mt-3 rounded-xl border border-line px-3 py-2 text-[13px]"><summary className="cursor-pointer font-semibold text-muted-foreground">모델 출력 JSON</summary>
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface p-2.5 text-[12px] text-ink">{JSON.stringify(m.pred, null, 1)}</pre></details>}
        </section>
      )}
    </div>
  )
}

export function LinePanel() {
  const { s, dispatch } = useApp()
  const mobile = useMobile()
  const line = s.data && s.selected ? s.data.lines.find((l) => l.id === s.selected) ?? null : null
  const close = () => dispatch({ type: "select", id: null })
  const subtitle = line ? won(line.amount) + " · " + line.week + " · " + (line.path === "envelope" ? "봉투" : "통장") : ""
  if (mobile) {
    return (
      <Sheet open={!!line} onOpenChange={(o) => { if (!o) close() }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-5">
          {line && <><SheetHeader className="p-0 text-left"><SheetTitle className="text-[17px] font-bold break-all">{line.raw}</SheetTitle><SheetDescription>{subtitle}</SheetDescription></SheetHeader>
            <div className="mt-4"><Body line={line} /></div></>}
        </SheetContent>
      </Sheet>
    )
  }
  return (
    <aside id="drawer" className={"panel" + (line ? " open" : "")} aria-hidden={!line} aria-label="줄 상세">
      {line && <>
        <div className="d-head flex items-start gap-3 border-b border-line px-5 pt-4 pb-3">
          <div><div className="text-[17px] font-bold leading-snug break-all">{line.raw}</div><div className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</div></div>
          <Button id="d-close" variant="ghost" size="icon-sm" className="ml-auto rounded-lg" aria-label="닫기" onClick={close}><X aria-hidden="true" /></Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-8"><Body line={line} /></div>
      </>}
    </aside>
  )
}
