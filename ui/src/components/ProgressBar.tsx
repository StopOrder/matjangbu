export function ProgressBar({ id, text, err = false, ratio }: { id?: string; text: string; err?: boolean; ratio?: number | null }) {
  return (
    <div className="progress-wrap grid gap-1.5">
      {typeof ratio === "number" && (
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
          <div className="bar-fill h-full rounded-full" style={{ width: Math.round(ratio * 100) + "%" }} />
        </div>
      )}
      <p id={id} className={"progress m-0 min-h-5 text-[13px] " + (err ? "err text-red" : "text-muted-foreground")}>{text}</p>
    </div>
  )
}
