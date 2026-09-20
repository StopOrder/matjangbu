import { AlertTriangle } from "lucide-react"
import { fmtTs } from "@/format"
import { useApp } from "@/store"

export function Banner() {
  const { s } = useApp()
  const meta = s.recorded?.meta
  return (
    <div id="banner" className="banner flex items-center gap-2.5 border-b border-line bg-amber-bg px-5 py-2.5 text-[14px] text-[#78350f]" hidden={!s.readonly}>
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <span id="banner-text">
        체험 인스턴스가 응답하지 않습니다 — {meta?.device || "기기"}에서 {fmtTs(meta?.ts)}에 미리 잰 기록을 읽기 전용으로 보여드립니다. 확정·불러오기·다시 재기는 지금 할 수 없습니다.
      </span>
    </div>
  )
}
