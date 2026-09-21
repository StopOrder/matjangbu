import { useApp } from "@/store"

/** 화면 아래 가운데. 되돌리기 단추가 붙는 토스트가 있다. */
export function Toasts() {
  const { s, dispatch } = useApp()
  if (!s.toasts.length) return null
  return (
    <div className="toast-wrap" aria-live="polite">
      {s.toasts.map((t) => (
        <div key={t.id} className={"toast" + (t.kind ? " " + t.kind : "")}>
          <span>{t.msg}</span>
          {t.action && (
            <button type="button" onClick={() => { t.action!.run(); dispatch({ type: "dismiss", id: t.id }) }}>
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
