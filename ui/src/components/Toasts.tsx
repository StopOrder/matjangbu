import { useApp } from "@/store"

export function Toasts() {
  const { s, dispatch } = useApp()
  return (
    <div className="toast-wrap" id="toasts" aria-live="polite">
      {s.toasts.map((t) => (
        <div key={t.id} className={"toast" + (t.kind ? " " + t.kind : "")}>
          <span>{t.msg}</span>
          {t.action && <button type="button" onClick={() => { t.action!.run(); dispatch({ type: "dismiss", id: t.id }) }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  )
}
