import { useEffect } from "react"
import { Layout } from "@/components/Layout"
import { Skeleton } from "@/components/ui/skeleton"
import { useHashRoute } from "@/route"
import { AppProvider, useApp } from "@/store"
import { VIEWS } from "@/views"

function LoadingSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-56 rounded-2xl" /><Skeleton className="h-56 rounded-2xl" /></div>
    </div>
  )
}

function Shell() {
  const { s, load, dispatch } = useApp()
  const route = useHashRoute()
  useEffect(() => { void load() }, [load])
  useEffect(() => { dispatch({ type: "select", id: null }) }, [route, dispatch])
  const View = VIEWS[route]
  return (
    <Layout route={route}>
      {s.data ? <View /> : s.error ? <div className="empty text-muted-foreground">화면을 시작하지 못했습니다: {s.error}</div> : <LoadingSkeleton />}
    </Layout>
  )
}

export default function App() {
  return <AppProvider><Shell /></AppProvider>
}
