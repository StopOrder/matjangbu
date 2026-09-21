import type { LineState } from "./types"

export const ROUTES = ["week", "year", "roster", "settings"] as const
export type Route = (typeof ROUTES)[number]
export const TITLES: Record<Route, string> = {
  week: "이번 주", year: "연말", roster: "명부", settings: "설정",
}
export const STATE: Record<LineState, string> = { auto: "자동 확정", held: "확인 필요", confirmed: "확정", excluded: "제외" }
export const REASON: Record<string, string> = {
  dup: "동명이인", family: "가족 명의", company: "회사 명의", renamed: "개명", typo: "오타·이표기",
  unknown: "명부에 없음", model_failed: "모델 미실행", parse: "읽지 못함",
}
export const NO_KIND = "(종류 없음)"
