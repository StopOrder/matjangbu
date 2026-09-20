import { EmptyState } from "@/components/EmptyState"
import { Foot } from "@/components/Foot"
import { SectionHead } from "@/components/SectionHead"
import { fmtTs } from "@/format"
import { useApp, useData } from "@/store"

export default function Roster() {
  const d = useData(); const { s, client, load, toast, fail } = useApp()
  const q = s.query
  const people = d.roster.filter((p) => !q || p.name.includes(q))
  const aliases = Object.entries(d.aliases || {}).filter(([k, v]) => !q || k.includes(q) || (d.roster.find((p) => p.id === v.person_id)?.name ?? "").includes(q))
  const name = (id: string) => d.roster.find((p) => p.id === id)?.name ?? id
  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const buf = await f.arrayBuffer(); let t = new TextDecoder("utf-8").decode(buf)
      if (t.includes("�")) t = new TextDecoder("euc-kr").decode(buf)
      const out = await client.post<{ count: number }>("/roster", { csv_text: t })
      toast("명부 " + out.count + "명으로 교체", "ok"); await load(d.week)
    } catch (e) { fail(e) }
  }
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <SectionHead title={"명부 " + d.roster.length + "명"} sub="세대 칸에 세대주 이름을 적어 두면 가족 명의 이체가 규칙으로 후보에 걸립니다." />
          {d.mode === "local" && !s.readonly && <label className="mb-3 grid gap-1 text-[13px] font-semibold text-muted-foreground">명부 CSV 교체 (id,이름,구역,세대,옛이름)<input type="file" id="ros-file" accept=".csv,text/csv" onChange={(e) => { void onFile(e.target.files?.[0]) }} /></label>}
          <div className="table-wrap max-h-[60vh] overflow-auto">
            <table className="data"><thead><tr><th>id</th><th>이름</th><th>구역</th><th>세대</th><th>옛이름</th></tr></thead>
              <tbody>{people.map((p) => <tr key={p.id}><td className="mono">{p.id}</td><td>{p.name}</td><td>{p.group}</td><td>{p.household}</td><td>{(p.old_names || []).join(", ")}</td></tr>)}</tbody></table>
          </div>
        </div>
        <div className="card">
          <SectionHead title={"별칭 사전 " + aliases.length + "건"} sub="확인 큐에서 고른 답이 여기 쌓입니다. 다음 주 같은 원문은 1단에서 끝납니다." />
          {aliases.length ? (
            <div className="table-wrap"><table className="data"><thead><tr><th>원문</th><th>사람</th><th>배운 날</th></tr></thead>
              <tbody>{aliases.map(([k, v]) => <tr key={k}><td className="file">{k}</td><td>{name(v.person_id)} <span className="mono text-[13px] text-muted-foreground">{v.person_id}</span></td><td className="text-muted-foreground">{fmtTs(v.learned)}</td></tr>)}</tbody></table></div>
          ) : <EmptyState text="아직 별칭이 없습니다" />}
        </div>
      </div>
      <Foot />
    </>
  )
}
