import type { ReactNode } from "react"

/** 근거 뱃지. tone 다섯: 규칙(초록)·모델(보라)·사람(올리브)·확인 필요(앰버)·그 밖(회색).
 *  `howOf()` 는 rule|model|human 만 내고, need·plain 은 화면이 직접 준다. */
export type Tone = "rule" | "model" | "human" | "need" | "plain"

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={"b " + tone}>{children}</span>
}
