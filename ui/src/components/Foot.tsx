import { useApp, useData } from "@/store"
export function Foot() {
  const d = useData(); const { s } = useApp()
  if (d.mode === "local") return null
  const dev = (s.recorded?.meta.device ?? d.recorded?.device) || ""
  return <p className="foot mt-5 text-[13px] leading-relaxed text-muted-foreground">예시 데이터입니다 · 실제 단체 자료가 아닙니다 · 모델 판정은 {dev}에서 미리 잰 값이고 「지금 다시 재기」만 실제로 돕니다 · 임계 유사도 0.85 · 동명이인은 자동 확정하지 않습니다</p>
}
