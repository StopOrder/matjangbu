import { parseCsv } from "@/fallback"
import { EmptyState } from "./EmptyState"

export function CsvTable({ text }: { text: string }) {
  const rows = parseCsv(text)
  if (!rows.length) return <EmptyState text="비어 있습니다" />
  const [head, ...body] = rows
  const numCol = (i: number) => i > 1 && /^[\d,]*$/.test((body[0] || [])[i] || "")
  return (
    <div className="table-wrap">
      <table className="data">
        <thead><tr>{head.map((h, i) => <th key={i} className={numCol(i) ? "n" : ""}>{h}</th>)}</tr></thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri} className={/^(합계|미확정)$/.test(r[0]) ? "total" : ""}>
              {r.map((v, i) => /^-?\d+$/.test(v) && i > 1 ? <td key={i} className="n">{Number(v).toLocaleString("ko-KR")}</td> : <td key={i}>{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
