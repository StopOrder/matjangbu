export type NumTone = "brand" | "human" | "amber" | "plain"
const CLS: Record<NumTone, string> = { brand: "grad-text", human: "grad-text-human", amber: "text-amber", plain: "text-ink" }
export function GradientNumber({ n, tone = "plain", size = "text-[32px]" }: { n: number | string; tone?: NumTone; size?: string }) {
  return <span className={size + " font-extrabold leading-none tabular-nums tracking-[-0.03em] " + CLS[tone]}>{n}</span>
}
