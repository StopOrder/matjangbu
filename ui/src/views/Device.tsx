import { useEffect, useState } from "react"
import { Foot } from "@/components/Foot"
import { fmtTs } from "@/format"
import { useApp, useData } from "@/store"
import type { Health } from "@/types"

export default function Device() {
  const d = useData(); const { s, client } = useApp()
  const [h, setH] = useState<Health | null>(null)
  useEffect(() => {
    if (s.readonly) return
    let alive = true
    client.api<Health>("/health").then((x) => { if (alive) setH(x) }).catch(() => {})
    return () => { alive = false }
  }, [client, s.readonly, s.loadSeq])
  const r = d.recorded
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card"><h3 className="mb-3 text-[17px]">인스턴스</h3>
          <dl className="kv" id="dev-kv">
            <dt>주소</dt><dd>{s.readonly ? "(없음 · 읽기 전용)" : s.apiBase}</dd>
            {h && <><dt>모드</dt><dd>{h.mode === "demo" ? "체험" : "로컬"}</dd><dt>기기</dt><dd>{h.device}</dd>
              <dt>모델 서버</dt><dd>{h.model_alive ? "응답" : "없음"} <span className="font-mono text-[13px] text-muted-foreground">{h.model_url}</span></dd>
              <dt>대기열</dt><dd>{h.queued}</dd><dt>세션</dt><dd>{h.sessions}</dd></>}
          </dl></div>
        <div className="card"><h3 className="mb-3 text-[17px]">미리 잰 기록</h3>
          {r ? <dl className="kv"><dt>기기</dt><dd>{r.device}</dd><dt>모델</dt><dd>{r.model}</dd><dt>스레드</dt><dd>{r.threads}</dd><dt>시각</dt><dd>{fmtTs(r.ts)}</dd><dt>엔진</dt><dd className="font-mono">{r.engine_git || ""}</dd></dl>
             : <div className="empty text-muted-foreground">로컬 모드</div>}
          <p className="mt-3 mb-0 text-[13px] text-muted-foreground"><a className="text-brand-ink hover:underline" href="../phone/">지원 기기 · 갤럭시 A31 실측표 →</a></p>
        </div>
      </div>
      <Foot />
    </>
  )
}
