import { useRef, useState } from "react"
import { useApp, useData } from "@/store"
import type { Line } from "@/types"
import { Icon } from "./Icons"

/** 리스트 맨 위에 붙어 있는 봉투 입력 줄. 치면 바로 아래 줄로 들어간다.
 *  검증 계약: data-mj="entry". */
export function EntryRow() {
  const d = useData()
  const { s, client, load, toast, fail } = useApp()
  const [name, setName] = useState("")
  const [kind, setKind] = useState("")
  const [amount, setAmount] = useState("")
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  if (s.readonly) {
    return (
      <div className="entry" data-mj="entry">
        <span className="lbl"><Icon name="envelope" />봉투</span>
        <span className="hint">미리 잰 기록을 읽는 중입니다 — 여기서는 봉투를 넣을 수 없습니다.</span>
      </div>
    )
  }

  const save = async () => {
    const amt = Number(amount) || 0
    if (!name.trim() && !amt) { toast("이름과 금액을 넣으세요", "err"); nameRef.current?.focus(); return }
    setSaving(true)
    try {
      const date = d.lines[0]?.date || new Date().toISOString().slice(0, 10)
      const out = await client.post<{ rows: Line[] }>("/envelope", {
        week: d.week, date, lines: [{ name: name.trim(), kind, amount: amt }], counted_total: null,
      })
      const held = out.rows.filter((r) => r.state === "held").length
      toast(held ? "넣었습니다 · 이름을 골라 주세요" : "넣었습니다", held ? undefined : "ok")
      setName(""); setKind(""); setAmount("")
      await load(d.week)
    } catch (e) { fail(e) }
    setSaving(false)
    nameRef.current?.focus()
  }

  const onKey = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); void save() } }

  return (
    <div className="entry" data-mj="entry">
      <span className="lbl"><Icon name="envelope" />봉투</span>
      <input ref={nameRef} className="inp name" list="roster-list" placeholder="이름 — 명부에서 자동 완성"
             aria-label="봉투에 적힌 이름" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey} />
      <select className="inp kind" aria-label="헌금 종류" value={kind} onChange={(e) => setKind(e.target.value)} onKeyDown={onKey}>
        <option value="">종류</option>
        {d.kinds.map((k) => <option key={k}>{k}</option>)}
      </select>
      <input className="inp amt" type="number" min={0} step={1000} placeholder="금액"
             aria-label="금액" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={onKey} />
      <button type="button" className="btn primary" disabled={saving} onClick={() => { void save() }}>넣기</button>
      <span className="hint"><kbd>Enter</kbd> 를 치면 아래 줄로 들어갑니다</span>
    </div>
  )
}
