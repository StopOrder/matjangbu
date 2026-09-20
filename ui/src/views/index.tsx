import type { ComponentType } from "react"
import type { Route } from "@/labels"
import Dashboard from "./Dashboard"
import Device from "./Device"
import Envelope from "./Envelope"
import Import from "./Import"
import Queue from "./Queue"
import Records from "./Records"
import Roster from "./Roster"

export const VIEWS: Record<Route, ComponentType> = { dashboard: Dashboard, import: Import, envelope: Envelope, queue: Queue, records: Records, roster: Roster, device: Device }
