import { useState } from "react"
import { Icon } from "@/components/Icons"
import { fmtTs } from "@/format"
import { readCsv } from "@/useImport"
import { useApp, useData } from "@/store"

/** 명부와 별칭 사전. 사람이 고른 답이 어디에 쌓이는지 한 화면에서 보인다. */
export default function Roster() {
  const d = useData()
  const { s, client, load, toast, fail } = useApp()
  const [tab, setTab] = useState<"people" | "alias">("people")
  const q = s.query.trim()

  const people = d.roster.filter((p) => !q || p.name.includes(q) || p.group.includes(q) || (p.old_names || []).some((o) => o.includes(q)))
  const nameOf = (id: string) => d.roster.find((p) => p.id === id)?.name ?? id
  const aliases = Object.entries(d.aliases || {}).filter(([k, v]) => !q || k.includes(q) || nameOf(v.person_id).includes(q))

  const canReplace = d.mode === "local" && !s.readonly
  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const csv = await readCsv(f)
      const out = await client.post<{ count: number }>("/roster", { csv_text: csv.text })
      toast("명부 " + out.count + "명으로 교체", "ok")
      await load(d.week)
    } catch (e) { fail(e) }
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>명부</h1>
          <div className="when">명부 {d.roster.length}명 · 별칭 사전 {Object.keys(d.aliases || {}).length}건</div>
        </div>
        <span className="grow" />
        <button className={"btn" + (tab === "people" ? " on" : "")} onClick={() => setTab("people")}>명부</button>
        <button className={"btn" + (tab === "alias" ? " on" : "")} onClick={() => setTab("alias")}>별칭 사전</button>
      </div>

      {tab === "people" ? (
        <section className="card">
          <div className="chead">
            <span className="m"><b>{people.length}</b>명{q && <span className="faint"> · 「{q}」으로 거른 결과</span>}</span>
            <span className="grow" />
            {canReplace
              ? <label className="btn" style={{ cursor: "pointer" }}>
                  <Icon name="upload" />명부 CSV 로 교체
                  <input type="file" accept=".csv,text/csv" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = "" }} />
                </label>
              : <span className="faint">{d.mode === "demo" ? "체험에서는 명부를 바꿀 수 없습니다" : "읽기 전용입니다"}</span>}
          </div>
          <div className="mini">
            {people.length === 0 ? <div className="empty">찾는 이름이 없습니다</div> : people.map((p) => (
              <div className="mrow" key={p.id}>
                <span className="nm">{p.name}</span>
                <span className="sub">{p.group}{p.household ? " · 세대 " + p.household : ""}</span>
                {(p.old_names || []).length > 0 && <span className="sub">옛이름 {(p.old_names || []).join(", ")}</span>}
                <span className="rr">{p.id}</span>
              </div>
            ))}
          </div>
          <div className="cfoot">
            <p className="hint">세대 칸에 세대주 이름을 적어 두면 가족 명의 이체가 규칙으로 후보에 걸립니다. 엑셀에서 「명부.csv」를 고치면 그대로 반영돼요.</p>
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="chead">
            <span className="m"><b>{aliases.length}</b>건{q && <span className="faint"> · 「{q}」으로 거른 결과</span>}</span>
            <span className="grow" />
            <span className="faint">고른 답이 여기 쌓여 다음 주 같은 원문은 1단에서 끝납니다</span>
          </div>
          <div className="mini">
            {aliases.length === 0 ? <div className="empty">아직 별칭이 없습니다 — 채울 줄에서 이름을 고르면 여기 쌓입니다</div> : aliases.map(([raw, v]) => (
              <div className="mrow" key={raw}>
                <span className="nm">{raw}</span>
                <span className="sub">→ {nameOf(v.person_id)}</span>
                <span className="rr">{fmtTs(v.learned)}</span>
              </div>
            ))}
          </div>
          <div className="cfoot">
            <p className="hint">별칭 사전은 작업공간의 <code>.matjangbu/aliases.json</code> 에 있습니다. 담당자가 바뀌어도 이 파일이 그대로 넘어갑니다.</p>
          </div>
        </section>
      )}
    </>
  )
}
