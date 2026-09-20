import { Foot } from "@/components/Foot"
import { GradientNumber } from "@/components/GradientNumber"
import { StatTile } from "@/components/StatTile"
import { fmtTs } from "@/format"
import { REASON, STATE } from "@/labels"
import { counts } from "@/lines"
import { useData } from "@/store"

export default function Dashboard() {
  const d = useData()
  const c = counts(d.lines)
  const reasons: Record<string, number> = {}
  for (const l of d.lines) if (l.state === "held") { const k = l.reason || "unknown"; reasons[k] = (reasons[k] || 0) + 1 }
  const rk = Object.keys(reasons).sort((a, b) => reasons[b] - reasons[a])
  const mx = Math.max(1, ...rk.map((k) => reasons[k]))
  const walls = d.lines.map((l) => l.model?.wall_s).filter((v): v is number => typeof v === "number")
  const mean = walls.length ? (walls.reduce((a, b) => a + b, 0) / walls.length).toFixed(1) : null
  const acts = (d.recent ?? d.lines.filter((l) => l.human || l.undo_of)).slice().sort((a, b) => (b.ts || "").localeCompare(a.ts || "")).slice(0, 8)
  const autos = d.lines.filter((l) => l.state === "auto")
  const hasAnswers = d.answers && Object.keys(d.answers).length > 0
  const ok = autos.filter((l) => d.answers[l.raw] === l.person_id).length
  const dev = d.recorded?.device || d.device || ""
  return (
    <>
      <div className="stats mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="이번 주 줄" n={c.n} tone="plain" sub={d.week} />
        <StatTile label="자동 확정" n={c.auto} tone="brand" sub="규칙 1·2단" />
        <StatTile label="확인 필요" n={c.held} tone="amber" sub="사람이 고른다" />
        <StatTile label="사람이 확정" n={c.confirmed} tone="human" sub="별칭 사전에 쌓임" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card"><h3 className="mb-3 text-[17px]">확인 사유 분포</h3>
          {rk.length ? <div className="bars">{rk.map((k) => (
            <div className="b" key={k}><div><div className="mb-1 flex justify-between gap-2"><span>{REASON[k] || k}</span></div><div className="track"><div className="fill" style={{ width: Math.round((reasons[k] / mx) * 100) + "%" }} /></div></div><div className="v">{reasons[k]}</div></div>
          ))}</div> : <div className="empty text-muted-foreground">확인 필요 줄이 없습니다</div>}
        </div>
        <div className="card card-model"><h3 className="mb-3 text-[17px]">모델 처리 시간</h3>
          {walls.length ? <>
            <dl className="kv"><dt>모델이 본 줄</dt><dd>{walls.length}</dd><dt>줄당 평균</dt><dd>{mean}초</dd><dt>최소 · 최대</dt><dd>{Math.min(...walls).toFixed(1)} · {Math.max(...walls).toFixed(1)}초</dd><dt>기기</dt><dd>{dev}</dd></dl>
            {d.recorded && <p className="mt-3 mb-0 text-[13px] text-muted-foreground">미리 잰 값 · {d.recorded.model} · {fmtTs(d.recorded.ts)}</p>}
          </> : <div className="empty text-muted-foreground">이번 주에는 모델이 본 줄이 없습니다</div>}
        </div>
        <div className="card"><h3 className="mb-3 text-[17px]">최근 활동 <span className="text-[13px] font-medium text-muted-foreground">모든 주차</span></h3>
          {acts.length ? <ul className="feed">{acts.map((l) => (
            <li key={l.id + (l.ts || "")}><span className="when">{fmtTs(l.ts)} · {l.week || ""}</span><span className="f">{l.raw}</span>
              <span className="text-muted-foreground">{l.undo_of ? "되돌림" : l.note || (l.state ? STATE[l.state] : "")}{l.alias_learned ? " · 별칭 저장" : ""}</span></li>
          ))}</ul> : <div className="empty text-muted-foreground">아직 사람 손이 닿은 줄이 없습니다</div>}
        </div>
        {hasAnswers && (
          <div className="card"><h3 className="mb-1 text-[17px]">샘플 정답 대조 <span className="badge badge-gray">체험 전용</span></h3>
            <p className="text-[13px] text-muted-foreground">자동 확정한 줄의 사람이 샘플 정답과 같은가(사람이 고친 줄은 제외). 규칙이 낸 답의 정확도이지 모델의 정확도가 아니다.</p>
            <div className="flex items-baseline gap-3"><GradientNumber n={ok} tone="brand" /><span className="text-muted-foreground">/ {autos.length} 줄 일치</span></div>
          </div>
        )}
      </div>
      <Foot />
    </>
  )
}
