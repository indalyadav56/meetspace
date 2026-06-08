import {
  ACTIVITY,
  DAU_SERIES,
  INVOICES,
  MRR_SERIES,
  SIGNUPS_SERIES,
  TASKS,
  TEAMS,
  THROUGHPUT_SERIES,
  USERS,
  WORKSPACES,
} from "./mock-data"
import type {
  PlanId,
  SeriesPoint,
  StatusId,
  User,
  Workspace,
} from "./types"

// ── Lookups ──────────────────────────────────────────────────────────────────

const userById = new Map(USERS.map((u) => [u.id, u]))
const workspaceById = new Map(WORKSPACES.map((w) => [w.id, w]))
const teamById = new Map(TEAMS.map((t) => [t.id, t]))

export function getUser(id: string): User | undefined {
  return userById.get(id)
}
export function getWorkspace(id: string): Workspace | undefined {
  return workspaceById.get(id)
}
export function getTeam(id: string) {
  return teamById.get(id)
}

// ── Series math ──────────────────────────────────────────────────────────────

export function seriesTotal(series: SeriesPoint[]): number {
  return series.reduce((sum, p) => sum + p.value, 0)
}

/** Percent change of the last point vs the first point of a series. */
export function seriesTrend(series: SeriesPoint[]): number {
  if (series.length < 2) return 0
  const first = series[0].value
  const last = series[series.length - 1].value
  if (first === 0) return 0
  return ((last - first) / first) * 100
}

/** Compare the sum of the most recent half of a series to the prior half. */
export function periodTrend(series: SeriesPoint[]): number {
  const mid = Math.floor(series.length / 2)
  const prev = seriesTotal(series.slice(0, mid))
  const curr = seriesTotal(series.slice(mid))
  if (prev === 0) return 0
  return ((curr - prev) / prev) * 100
}

// ── Aggregate KPIs ───────────────────────────────────────────────────────────

export const totalMrr = WORKSPACES.reduce((sum, w) => sum + w.mrr, 0)
export const totalArr = totalMrr * 12
export const activeWorkspaces = WORKSPACES.filter((w) => w.status === "active").length
export const trialWorkspaces = WORKSPACES.filter((w) => w.status === "trial").length
export const payingWorkspaces = WORKSPACES.filter((w) => w.mrr > 0).length
export const totalSeats = WORKSPACES.reduce((sum, w) => sum + w.seatsUsed, 0)
export const totalUsers = USERS.length
export const activeUsers = USERS.filter((u) => u.status === "active").length
export const totalTasksManaged = WORKSPACES.reduce((sum, w) => sum + w.taskCount, 0)

export function planBreakdown(): { plan: PlanId; count: number }[] {
  const order: PlanId[] = ["free", "pro", "business", "enterprise"]
  const counts = new Map<PlanId, number>()
  for (const w of WORKSPACES) counts.set(w.plan, (counts.get(w.plan) ?? 0) + 1)
  return order.map((plan) => ({ plan, count: counts.get(plan) ?? 0 }))
}

export function taskStatusBreakdown(): { status: StatusId; count: number }[] {
  const order: StatusId[] = ["backlog", "todo", "in_progress", "in_review", "done"]
  const counts = new Map<StatusId, number>()
  for (const t of TASKS) counts.set(t.status, (counts.get(t.status) ?? 0) + 1)
  return order.map((status) => ({ status, count: counts.get(status) ?? 0 }))
}

/** Workspaces ranked by MRR for the leaderboard on the dashboard. */
export function topWorkspaces(limit = 5): Workspace[] {
  return [...WORKSPACES].sort((a, b) => b.mrr - a.mrr).slice(0, limit)
}

// Re-export the raw collections so pages have a single import surface.
export {
  ACTIVITY,
  DAU_SERIES,
  INVOICES,
  MRR_SERIES,
  SIGNUPS_SERIES,
  TASKS,
  TEAMS,
  THROUGHPUT_SERIES,
  USERS,
  WORKSPACES,
}
