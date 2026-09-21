import type { ComponentType } from "react"
import type { Route } from "@/labels"
import Roster from "./Roster"
import Settings from "./Settings"
import Week from "./Week"
import Year from "./Year"

export const VIEWS: Record<Route, ComponentType> = { week: Week, year: Year, roster: Roster, settings: Settings }
