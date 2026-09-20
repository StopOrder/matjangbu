import { ChevronDown, RefreshCw } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { useApp, useData, useLineActions } from "@/store"
import type { Line } from "@/types"

/** onAct: 확정·보류·제외 요청의 Promise<boolean> 을 받는다(확인 큐가 카드 접힘에 쓴다) */
export function CandidatePicker({ line, onAct }: { line: Line; onAct?: (p: Promise<boolean>) => void }) {
  const d = useData(); const { s, toast } = useApp(); const act = useLineActions()
  const disabled = s.readonly
  const [more, setMore] = useState(line.cands.length === 0)
  const [newName, setNewName] = useState(line.raw.replace(/\s+/g, ""))
  const [newGroup, setNewGroup] = useState("")
  const [any, setAny] = useState("")
  const [prog, setProg] = useState<{ text: string; err: boolean }>({ text: "", err: false })
  const fire = (p: Promise<boolean>) => { if (onAct) onAct(p) }
  const canRematch = !disabled && !(d.mode === "local" && !d.model_alive)
  return (
    <div className="grid gap-3">
      {line.cands.length > 0 && (
        <div className="cands grid gap-2">
          {line.cands.map((c) => (
            <button key={c.person_id} type="button" className="cand" data-pick={line.id} data-person={c.person_id} disabled={disabled} onClick={() => fire(act.pick(line.id, c.person_id))}>
              <span className="font-semibold">{c.name}</span><span className="text-[13px] text-muted-foreground">{c.group}</span>
              <span className="ml-auto text-[13px] text-muted-foreground">{c.why}</span>
            </button>
          ))}
        </div>
      )}
      <Collapsible open={more} onOpenChange={setMore}>
        <CollapsibleTrigger asChild>
          <button type="button" data-more={line.id} className="press inline-flex items-center gap-1 rounded-lg px-1 text-[14px] font-semibold text-brand-ink" aria-expanded={more}>
            다른 방법 <ChevronDown className={"size-4 transition-transform " + (more ? "rotate-180" : "")} aria-hidden="true" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="grid gap-3 pt-3">
          <div className="anyrow grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <select data-any={line.id} disabled={disabled} value={any} onChange={(e) => setAny(e.target.value)} aria-label="명부에서 직접 고르기">
              <option value="">명부에서 직접 고르기…</option>
              {d.roster.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.group})</option>)}
            </select>
            <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl px-3.5" data-pick-any={line.id} disabled={disabled}
                    onClick={() => { if (!any) { toast("명부에서 사람을 고르세요", "err"); return } fire(act.pick(line.id, any)) }}>이 사람으로 확정</Button>
          </div>
          {line.allow_new !== false ? (
            <div className="newform grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className="grid gap-1 text-[13px] font-semibold text-muted-foreground">새 이름으로 등록
                <Input className="h-10 rounded-xl text-[15px]" data-new-name={line.id} value={newName} disabled={disabled} onChange={(e) => setNewName(e.target.value)} /></label>
              <label className="grid gap-1 text-[13px] font-semibold text-muted-foreground">구역
                <Input className="h-10 rounded-xl text-[15px]" data-new-group={line.id} placeholder="5구역" value={newGroup} disabled={disabled} onChange={(e) => setNewGroup(e.target.value)} /></label>
              <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl px-3.5" data-new={line.id} disabled={disabled}
                      onClick={() => fire(act.addNew(line.id, newName.trim(), newGroup.trim()))}>등록하고 확정</Button>
            </div>
          ) : <p className="m-0 text-[13px] text-muted-foreground">동명이인은 새 이름 등록 없이 후보 중에서 고릅니다.</p>}
        </CollapsibleContent>
      </Collapsible>
      <div className="row-actions flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-9 rounded-xl px-3" data-hold={line.id} disabled={disabled} onClick={() => fire(act.hold(line.id))}>보류</Button>
        <Button type="button" variant="ghost" size="sm" className="h-9 rounded-xl px-3" data-exclude={line.id} disabled={disabled} onClick={() => fire(act.exclude(line.id))}>제외</Button>
        <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3" data-rematch={line.id} disabled={!canRematch}
                onClick={() => { void act.rematch(line.id, (text, err) => setProg({ text, err: !!err })) }}><RefreshCw aria-hidden="true" />지금 다시 재기</Button>
        <span className={"progress text-[13px] " + (prog.err ? "err text-red" : "text-muted-foreground")} data-progress={line.id}>{prog.text}</span>
      </div>
    </div>
  )
}
