import { howOf } from "@/lines"
import { REASON } from "@/labels"
import type { Line } from "@/types"
import { Badge } from "./Badge"
import { Icon } from "./Icons"

/** 장부 한 줄. 3슬롯 — 좌 아바타 / 가운데 이름·메모 / 우 금액·근거.
 *  채울 줄(state==="held")이면 앰버로 칠하고 눌러서 그 자리에 판을 편다.
 *  검증 계약: data-mj="row", 채울 줄이면 data-blank="1". */
export function Row({ line, no, open, onOpen }: { line: Line; no?: number; open: boolean; onOpen(id: string | null): void }) {
  const blank = line.state === "held"
  const path = line.path === "envelope" ? "봉투" : "통장"
  const how = howOf(line)
  const shownName = blank ? line.raw : line.name || line.raw
  // 원문이 맞춘 이름과 같으면 두 번 적지 않는다
  const raw = !blank && line.raw && line.raw !== line.name ? line.raw : ""
  const groups = line.reason === "dup"
    ? Array.from(new Set(line.cands.map((c) => c.group).filter(Boolean))).join(" · ")
    : ""

  const body = (
    <>
      <div className="av"><Icon name={line.path === "envelope" ? "envelope" : "card"} /></div>
      <div className="ct">
        <div className="t">
          {shownName}
          {blank ? <span className="need-t">이름을 고르세요</span> : line.group ? <span className="g">{line.group}</span> : null}
        </div>
        <div className="s">
          {no != null && <><span className="no num">{no}</span><span className="dot">·</span></>}
          <span>{path}</span>
          {raw && <><span className="dot">·</span><span className="raw">{raw}</span></>}
          {line.kind && <><span className="dot">·</span><Badge tone="plain">{line.kind}</Badge></>}
          {line.state === "excluded" && <><span className="dot">·</span><Badge tone="plain">제외</Badge></>}
        </div>
      </div>
      <div className="rt">
        <div className="v num">{line.amount.toLocaleString("ko-KR")}</div>
        <div className="vs">
          {blank ? (
            <>
              <Badge tone="need">{REASON[line.reason || ""] || line.reason || "확인 필요"}</Badge>
              {groups ? <Badge tone="plain">{groups}</Badge>
                : line.cands.length ? <Badge tone={line.model?.pred ? "model" : "plain"}>{(line.model?.pred ? "모델 " : "") + "후보 " + line.cands.length}</Badge>
                : line.model ? <Badge tone="plain">모델 후보 없음</Badge> : null}
            </>
          ) : how ? <Badge tone={how.tone}>{how.text}</Badge> : null}
        </div>
      </div>
      {blank && <div className="pick">고르기<Icon name={open ? "up" : "down"} /></div>}
    </>
  )

  if (!blank) {
    return <div className="row" data-mj="row" data-state={line.state}>{body}</div>
  }
  return (
    <button
      type="button"
      className={"row blank" + (open ? " open" : "")}
      data-mj="row" data-blank="1" data-state={line.state}
      aria-expanded={open}
      onClick={() => onOpen(open ? null : line.id)}
    >
      {body}
    </button>
  )
}
