import { useEffect, useRef, useState } from "react"
import { REASON } from "@/labels"
import { useApp, useData, useLineActions } from "@/store"
import type { Line } from "@/types"
import { Icon } from "./Icons"

/** 왜 이 줄이 사람에게 왔는지 한 줄로. 지어내지 않고 모델·규칙이 실제로 준 것만 적는다. */
function lead(line: Line): { text: string; strong?: string } {
  if (line.reason === "dup") return { strong: line.raw, text: "명부에 「{}」가 둘 이상입니다. 동명이인은 자동으로 채우지 않습니다 — 고르는 사람은 담당자입니다." }
  const rel = line.model?.pred?.relation
  if (rel) {
    const part = line.model?.pred?.name_part
    return { text: "모델 판단: " + (REASON[rel] || rel) + (part ? " · 이름 부분 「" + part + "」" : "") + ". 확정은 사람이 합니다." }
  }
  if (line.reason === "model_failed") return { text: "모델이 응답하지 않아 규칙이 세운 후보만 있습니다." }
  if (line.reason === "unknown") return { text: "명부에서 맞는 이름을 찾지 못했습니다. 직접 고르거나 새 이름으로 등록하세요." }
  return { text: "규칙이 세운 후보입니다. 확정은 사람이 합니다." }
}

/** 빈 줄을 눌렀을 때 그 자리에서 펼쳐지는 판. 드로어도 팝업도 만들지 않는다.
 *  검증 계약: data-mj="panel", 후보 단추는 data-mj="cand". */
export function RowPanel({ line, onClose, onDone }: { line: Line; onClose(): void; onDone?(): void }) {
  const d = useData()
  const { s, toast } = useApp()
  const act = useLineActions()
  const ro = s.readonly
  const [find, setFind] = useState("")
  const [newMode, setNewMode] = useState(false)
  const [newName, setNewName] = useState(() => line.raw.replace(/\s+/g, ""))
  const [newGroup, setNewGroup] = useState("")
  const [prog, setProg] = useState<{ text: string; err: boolean }>({ text: "", err: false })
  const findRef = useRef<HTMLInputElement>(null)
  const canRematch = !ro && !(d.mode === "local" && !d.model_alive)
  const l = lead(line)

  const done = (ok: boolean) => { if (ok && onDone) onDone() }
  const pick = (personId: string) => { void act.pick(line.id, personId).then(done) }

  // 숫자 키로 후보 고르기 · Esc 로 닫기. 입력 칸 안에서는 가로채지 않는다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return
      if (e.key === "Escape") { e.preventDefault(); onClose(); return }
      if (ro) return
      const n = Number(e.key)
      if (n >= 1 && n <= line.cands.length) { e.preventDefault(); pick(line.cands[n - 1].person_id) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }) // 후보·줄이 바뀔 때마다 새로 건다 — 목록이 짧아 비용이 없다

  const confirmFind = () => {
    const name = find.trim()
    if (!name) { findRef.current?.focus(); return }
    const hit = d.roster.filter((p) => p.name === name)
    if (hit.length === 1) { pick(hit[0].id); setFind(""); return }
    if (hit.length > 1) { toast("명부에 「" + name + "」가 둘 이상입니다. 위 후보에서 고르세요", "err"); return }
    toast("명부에 없는 이름입니다. 「새 이름으로 등록」을 쓰세요", "err")
  }

  return (
    <div className="panel" data-mj="panel">
      <p className="lead">
        {l.strong
          ? <>{l.text.split("{}")[0]}<b>{l.strong}</b>{l.text.split("{}")[1]}</>
          : l.text}
      </p>

      {line.cands.length > 0 && (
        <div className="cands">
          {line.cands.map((c, i) => (
            <button key={c.person_id} type="button" className="cand" data-mj="cand" data-person={c.person_id}
                    disabled={ro} onClick={() => pick(c.person_id)}>
              <span className="key">{i + 1}</span>
              <span className="cn"><span className="n">{c.name}</span><span className="w">{c.why}</span></span>
              <span className="g">{c.group}</span>
            </button>
          ))}
        </div>
      )}

      <div className="cands">
        <label className="find">
          <Icon name="search" />
          <input ref={findRef} className="inp bare" list="roster-list" disabled={ro}
                 placeholder="명부에서 직접 고르기 — 이름을 치면 자동 완성"
                 value={find} onChange={(e) => setFind(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmFind() } }} />
        </label>
        {find.trim() && <button type="button" className="btn" disabled={ro} onClick={confirmFind}><Icon name="check" />이 사람으로 확정</button>}
        {line.allow_new !== false
          ? <button type="button" className="btn" disabled={ro} onClick={() => setNewMode((v) => !v)}><Icon name="user" />새 이름으로 등록</button>
          : <span className="hint">동명이인은 새 이름 등록 없이 후보 중에서 고릅니다.</span>}
      </div>

      {newMode && line.allow_new !== false && (
        <div className="cands">
          <input className="inp" style={{ minWidth: 160 }} placeholder="이름" value={newName} disabled={ro} onChange={(e) => setNewName(e.target.value)} />
          <input className="inp" style={{ width: 140 }} placeholder="구역" value={newGroup} disabled={ro} onChange={(e) => setNewGroup(e.target.value)} />
          <button type="button" className="btn primary" disabled={ro || !newName.trim()}
                  onClick={() => { void act.addNew(line.id, newName.trim(), newGroup.trim()).then(done) }}>등록하고 확정</button>
          <button type="button" className="btn ghost" onClick={() => setNewMode(false)}>취소</button>
        </div>
      )}

      <div className="pfoot">
        <button type="button" className="btn ghost" disabled={ro} onClick={() => { void act.hold(line.id).then(done) }}>보류</button>
        <button type="button" className="btn ghost" disabled={ro} onClick={() => { void act.exclude(line.id).then(done) }}>제외</button>
        <button type="button" className="btn ghost" disabled={!canRematch}
                onClick={() => { void act.rematch(line.id, (text, err) => setProg({ text, err: !!err })) }}>
          <Icon name="refresh" />모델로 다시 재기
        </button>
        {prog.text && <span className={"hint" + (prog.err ? " err" : "")}>{prog.text}</span>}
        <span className="grow" />
        <span className="hint">
          {line.cands.length > 0 && <>{line.cands.map((_, i) => <kbd key={i}>{i + 1}</kbd>)} 후보 고르기 · </>}
          <kbd>Esc</kbd> 닫기
        </span>
      </div>
      {ro && <p className="hint" style={{ marginTop: 8 }}>미리 잰 기록을 읽는 중입니다 — 여기서는 고를 수 없습니다.</p>}
    </div>
  )
}
