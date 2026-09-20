import { useApp } from "@/store"

export function InstanceStatus({ compact = false }: { compact?: boolean }) {
  const { s } = useApp()
  const d = s.data
  if (!d) return null
  const demo = d.mode !== "local"
  const dot = d.model_alive ? "bg-brand" : "bg-red"
  const text = d.model_alive ? "모델 서버 응답" : s.readonly ? "읽기 전용" : "모델 서버 없음"
  if (compact) return demo ? <span className="badge badge-held">예시 데이터</span> : null
  return (
    <div className="inst mt-auto border-t border-line px-4 py-4 text-[13px] leading-snug text-muted-foreground">
      <b className="block truncate text-[13px] font-semibold text-ink">{d.device || "이 PC"}</b>
      <div className="mt-1.5 flex items-center gap-1.5"><span className={"inline-block size-2 rounded-full " + dot} />{text}</div>
      {demo && (
        <div className="mt-3 grid gap-1 border-t border-dashed border-line pt-3">
          <span className="badge badge-held justify-self-start">예시 데이터</span>
          <span>가공 샘플 · 실제 단체 자료 아님</span>
        </div>
      )}
    </div>
  )
}
