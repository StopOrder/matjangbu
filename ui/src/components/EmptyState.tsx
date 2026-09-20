import { ArrowRight } from "lucide-react"

export function EmptyState({ text, action }: { text: string; action?: { label: string; href: string } }) {
  return (
    <div className="empty rounded-2xl border border-dashed border-line-2 bg-white px-6 py-10 text-center text-muted-foreground">
      <p className="m-0">{text}</p>
      {action && (
        <a href={action.href} className="press mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[15px] font-bold text-brand-ink hover:bg-brand-bg">
          {action.label} <ArrowRight className="size-4" aria-hidden="true" />
        </a>
      )}
    </div>
  )
}
