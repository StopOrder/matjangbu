import { useEffect } from "react"
import { Shell } from "@/components/Shell"
import { useHashRoute } from "@/route"
import { AppProvider, useApp } from "@/store"
import { VIEWS } from "@/views"

function Skeleton() {
  return (
    <>
      <div className="skel" style={{ height: 34, width: 260, marginBottom: 20 }} />
      <div className="skel" style={{ height: 56, borderRadius: 20, marginBottom: 12 }} />
      <div className="skel" style={{ height: 320, borderRadius: 20 }} />
    </>
  )
}

function Screen() {
  const { s, load, dispatch } = useApp()
  const route = useHashRoute()
  useEffect(() => { void load() }, [load])
  useEffect(() => { dispatch({ type: "select", id: null }) }, [route, dispatch])
  const View = VIEWS[route]
  return (
    <Shell route={route}>
      {s.data ? <View /> : s.error ? <div className="empty">화면을 시작하지 못했습니다: {s.error}</div> : <Skeleton />}
    </Shell>
  )
}

export default function App() {
  return <AppProvider><Screen /></AppProvider>
}
