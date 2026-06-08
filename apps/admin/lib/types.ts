// Domain model for the Meetspace admin control panel.
// The customer-facing product organizes work into workspaces → teams → tasks.
// Admin sits above all of that: it manages accounts, people, billing, and health.

export type PlanId = "free" | "pro" | "business" | "enterprise"

export type WorkspaceStatus = "active" | "trial" | "past_due" | "canceled"

export type UserStatus = "active" | "invited" | "suspended"

/** Platform-level role, distinct from a user's role inside a workspace. */
export type PlatformRole = "owner" | "admin" | "member"

export type StatusId = "backlog" | "todo" | "in_progress" | "in_review" | "done"

export type PriorityId = "urgent" | "high" | "medium" | "low" | "none"

export type InvoiceStatus = "paid" | "open" | "past_due" | "refunded"

export interface User {
  id: string
  name: string
  email: string
  initials: string
  /** Avatar background color (any CSS color). */
  color: string
  /** Role label as shown inside their workspace. */
  role: string
  platformRole: PlatformRole
  status: UserStatus
  workspaceId: string
  /** ISO date. */
  joinedAt: string
  /** ISO timestamp of last activity. */
  lastActiveAt: string
  taskCount: number
  /** Whether 2FA is enabled — surfaced in the security column. */
  mfa: boolean
}

export interface Workspace {
  id: string
  name: string
  slug: string
  /** Brand color (any CSS color). */
  color: string
  icon: string
  plan: PlanId
  status: WorkspaceStatus
  ownerId: string
  seatsUsed: number
  seatsTotal: number
  /** Monthly recurring revenue in whole USD. */
  mrr: number
  teamCount: number
  taskCount: number
  region: string
  createdAt: string
  /** ISO date the trial or current period ends. */
  renewsAt: string
}

export interface Team {
  id: string
  name: string
  key: string
  description: string
  color: string
  icon: string
  workspaceId: string
  memberCount: number
  leadId: string
  openTasks: number
  createdAt: string
}

export interface Task {
  id: string
  key: string
  title: string
  status: StatusId
  priority: PriorityId
  assigneeId: string
  teamId: string
  workspaceId: string
  tags: string[]
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export interface Invoice {
  id: string
  number: string
  workspaceId: string
  amount: number
  status: InvoiceStatus
  plan: PlanId
  issuedAt: string
}

export type ActivityKind =
  | "signup"
  | "upgrade"
  | "downgrade"
  | "payment"
  | "invite"
  | "suspend"
  | "cancel"
  | "flag"

export interface Activity {
  id: string
  kind: ActivityKind
  /** Pre-rendered, human sentence. */
  message: string
  actorId: string
  workspaceId: string | null
  createdAt: string
}

export interface FeatureFlag {
  id: string
  name: string
  description: string
  enabled: boolean
  /** Percentage of workspaces the flag is rolled out to. */
  rollout: number
  group: "product" | "billing" | "experimental"
}

/** A single point in a daily time series. */
export interface SeriesPoint {
  /** ISO date. */
  date: string
  value: number
}
