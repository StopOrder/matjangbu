import type { ReactNode } from "react"
import { ROUTES, TITLES, type Route } from "@/labels"
import { useApp } from "@/store"
import { Icon, Sprite } from "./Icons"
import { Toasts } from "./Toasts"

/** 흰 GNB(로고 · 장 4개 · 찾기 · 상태) + 그 아래 페이지. 사이드바도 드로어도 없다.
 *  검증 도구가 보는 계약: 루트에 data-mj="gnb", 탭마다 data-mj="tab" data-route="…". */
export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { s, dispatch } = useApp()
  const d = s.data
  const need = d ? d.lines.filter((l) => l.state === "held").length : 0
  const mode = d ? (d.mode === "local" ? "이 PC" : d.mode === "demo" ? "예시 데이터" : "미리 잰 기록") : ""

  return (
    <>
      <Sprite />
      <header className="gnb" data-mj="gnb">
        <a className="brand" href="#/week"><Icon name="book" />맞장부 <span className="tag">잠정명</span></a>
        <nav className="tabs">
          {ROUTES.map((r) => (
            <a key={r} className={r === route ? "on" : undefined} href={"#/" + r} data-mj="tab" data-route={r}>
              {TITLES[r]}
              {r === "week" && need > 0 && <span className="cnt">{need}</span>}
            </a>
          ))}
        </nav>
        <span className="grow" />
        <label className="search">
          <Icon name="search" />
          <input
            placeholder="입금자명 · 이름 찾기"
            aria-label="입금자명이나 이름으로 찾기"
            value={s.query}
            onChange={(e) => dispatch({ type: "query", q: e.target.value })}
          />
        </label>
        <div className="state">
          {mode && <span className="tag">{mode}</span>}
          <span>
            <i className={"dot" + (d?.model_alive ? "" : " off")} />{" "}
            {d?.model_alive ? "모델 서버 응답" : "모델 서버 없음"}
          </span>
        </div>
      </header>
      <main className="page">{children}</main>
      <Toasts />
      {/* 봉투 입력·직접 고르기의 이름 자동 완성 */}
      <datalist id="roster-list">
        {d?.roster.map((p) => <option key={p.id} value={p.name}>{p.group}</option>)}
      </datalist>
    </>
  )
}
