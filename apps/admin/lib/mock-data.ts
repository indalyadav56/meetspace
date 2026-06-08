import type {
  Activity,
  FeatureFlag,
  Invoice,
  SeriesPoint,
  Task,
  Team,
  User,
  Workspace,
} from "./types"

// Everything here is static and deterministic so server and client render
// identically. "Today" is pinned to keep relative dates stable in the demo.
export const TODAY = "2026-06-08"

const DAY_MS = 1000 * 60 * 60 * 24

function isoDaysAgo(days: number): string {
  const base = new Date(TODAY + "T00:00:00Z").getTime()
  return new Date(base - days * DAY_MS).toISOString().slice(0, 10)
}

function isoHoursAgo(hours: number): string {
  const base = new Date(TODAY + "T09:30:00Z").getTime()
  return new Date(base - hours * 60 * 60 * 1000).toISOString()
}

/** Deterministic PRNG so generated series never shift between renders. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Build a daily series ending today with a gentle upward drift + noise. */
function buildDailySeries(
  points: number,
  start: number,
  growth: number,
  noise: number,
  seed: number,
): SeriesPoint[] {
  const rand = mulberry32(seed)
  const out: SeriesPoint[] = []
  for (let i = 0; i < points; i++) {
    const trend = start + growth * i
    const wobble = (rand() - 0.5) * 2 * noise
    out.push({
      date: isoDaysAgo(points - 1 - i),
      value: Math.max(0, Math.round(trend + wobble)),
    })
  }
  return out
}

// ── Admin (the person using this panel) ──────────────────────────────────────

export const ADMIN_USER = {
  id: "admin",
  name: "Indal Yadav",
  email: "indal@meetspace.app",
  initials: "IY",
  color: "#6366f1",
  role: "Platform Admin",
}

// ── Workspaces (customer accounts) ───────────────────────────────────────────

export const WORKSPACES: Workspace[] = [
  {
    id: "w-northwind", name: "Northwind Labs", slug: "northwind", color: "#6366f1", icon: "🧪",
    plan: "business", status: "active", ownerId: "u1", seatsUsed: 42, seatsTotal: 50,
    mrr: 1008, teamCount: 6, taskCount: 1284, region: "us-east", createdAt: "2025-09-12", renewsAt: "2026-07-01",
  },
  {
    id: "w-acme", name: "Acme Corp", slug: "acme", color: "#f43f5e", icon: "🚀",
    plan: "enterprise", status: "active", ownerId: "u4", seatsUsed: 180, seatsTotal: 200,
    mrr: 4200, teamCount: 14, taskCount: 6120, region: "us-west", createdAt: "2025-06-03", renewsAt: "2026-09-15",
  },
  {
    id: "w-lumen", name: "Lumen Studio", slug: "lumen", color: "#8b5cf6", icon: "🎨",
    plan: "pro", status: "active", ownerId: "u2", seatsUsed: 11, seatsTotal: 15,
    mrr: 132, teamCount: 3, taskCount: 418, region: "eu-west", createdAt: "2025-11-20", renewsAt: "2026-06-20",
  },
  {
    id: "w-cobalt", name: "Cobalt Health", slug: "cobalt", color: "#0ea5e9", icon: "🩺",
    plan: "business", status: "past_due", ownerId: "u5", seatsUsed: 28, seatsTotal: 30,
    mrr: 672, teamCount: 4, taskCount: 902, region: "us-east", createdAt: "2025-08-01", renewsAt: "2026-06-04",
  },
  {
    id: "w-orbit", name: "Orbit Logistics", slug: "orbit", color: "#10b981", icon: "🛰️",
    plan: "pro", status: "trial", ownerId: "u8", seatsUsed: 7, seatsTotal: 10,
    mrr: 0, teamCount: 2, taskCount: 96, region: "ap-south", createdAt: "2026-05-28", renewsAt: "2026-06-11",
  },
  {
    id: "w-fable", name: "Fable Media", slug: "fable", color: "#f59e0b", icon: "📚",
    plan: "free", status: "active", ownerId: "u6", seatsUsed: 4, seatsTotal: 5,
    mrr: 0, teamCount: 1, taskCount: 73, region: "eu-west", createdAt: "2026-01-09", renewsAt: "2026-07-09",
  },
  {
    id: "w-vertex", name: "Vertex Robotics", slug: "vertex", color: "#06b6d4", icon: "🤖",
    plan: "business", status: "active", ownerId: "u3", seatsUsed: 33, seatsTotal: 40,
    mrr: 792, teamCount: 5, taskCount: 1140, region: "us-west", createdAt: "2025-10-15", renewsAt: "2026-06-30",
  },
  {
    id: "w-pinepoint", name: "Pinepoint", slug: "pinepoint", color: "#d946ef", icon: "🌲",
    plan: "pro", status: "canceled", ownerId: "u7", seatsUsed: 0, seatsTotal: 12,
    mrr: 0, teamCount: 0, taskCount: 0, region: "us-east", createdAt: "2025-07-22", renewsAt: "2026-05-22",
  },
]

// ── Users (people across all workspaces) ─────────────────────────────────────

export const USERS: User[] = [
  { id: "u1", name: "Indal Yadav", email: "indal@northwind.io", initials: "IY", color: "#6366f1", role: "Product Lead", platformRole: "owner", status: "active", workspaceId: "w-northwind", joinedAt: "2025-09-12", lastActiveAt: isoHoursAgo(1), taskCount: 142, mfa: true },
  { id: "u2", name: "Maya Chen", email: "maya@lumen.studio", initials: "MC", color: "#8b5cf6", role: "Design Lead", platformRole: "owner", status: "active", workspaceId: "w-lumen", joinedAt: "2025-11-20", lastActiveAt: isoHoursAgo(3), taskCount: 88, mfa: true },
  { id: "u3", name: "Arjun Patel", email: "arjun@vertex.dev", initials: "AP", color: "#0ea5e9", role: "Frontend Engineer", platformRole: "owner", status: "active", workspaceId: "w-vertex", joinedAt: "2025-10-15", lastActiveAt: isoHoursAgo(6), taskCount: 211, mfa: false },
  { id: "u4", name: "Sofia Rossi", email: "sofia@acme.com", initials: "SR", color: "#f43f5e", role: "Product Manager", platformRole: "owner", status: "active", workspaceId: "w-acme", joinedAt: "2025-06-03", lastActiveAt: isoHoursAgo(2), taskCount: 305, mfa: true },
  { id: "u5", name: "Leo Nakamura", email: "leo@cobalt.health", initials: "LN", color: "#10b981", role: "Backend Engineer", platformRole: "owner", status: "active", workspaceId: "w-cobalt", joinedAt: "2025-08-01", lastActiveAt: isoHoursAgo(28), taskCount: 176, mfa: false },
  { id: "u6", name: "Priya Sharma", email: "priya@fable.media", initials: "PS", color: "#f59e0b", role: "Product Designer", platformRole: "owner", status: "active", workspaceId: "w-fable", joinedAt: "2026-01-09", lastActiveAt: isoHoursAgo(10), taskCount: 41, mfa: false },
  { id: "u7", name: "Daniel Kim", email: "daniel@pinepoint.co", initials: "DK", color: "#06b6d4", role: "QA Engineer", platformRole: "owner", status: "suspended", workspaceId: "w-pinepoint", joinedAt: "2025-07-22", lastActiveAt: isoDaysAgo(31) + "T12:00:00Z", taskCount: 64, mfa: false },
  { id: "u8", name: "Hannah Weber", email: "hannah@orbit.io", initials: "HW", color: "#d946ef", role: "Growth Marketer", platformRole: "owner", status: "active", workspaceId: "w-orbit", joinedAt: "2026-05-28", lastActiveAt: isoHoursAgo(5), taskCount: 12, mfa: false },
  { id: "u9", name: "Marcus Holt", email: "marcus@acme.com", initials: "MH", color: "#ef4444", role: "Engineering Manager", platformRole: "admin", status: "active", workspaceId: "w-acme", joinedAt: "2025-06-10", lastActiveAt: isoHoursAgo(4), taskCount: 198, mfa: true },
  { id: "u10", name: "Yuki Tanaka", email: "yuki@northwind.io", initials: "YT", color: "#14b8a6", role: "Data Scientist", platformRole: "member", status: "active", workspaceId: "w-northwind", joinedAt: "2025-09-30", lastActiveAt: isoHoursAgo(8), taskCount: 73, mfa: true },
  { id: "u11", name: "Emma Johnson", email: "emma@vertex.dev", initials: "EJ", color: "#a855f7", role: "Designer", platformRole: "member", status: "active", workspaceId: "w-vertex", joinedAt: "2025-11-02", lastActiveAt: isoHoursAgo(20), taskCount: 56, mfa: false },
  { id: "u12", name: "Noah Schmidt", email: "noah@cobalt.health", initials: "NS", color: "#f97316", role: "DevOps", platformRole: "admin", status: "active", workspaceId: "w-cobalt", joinedAt: "2025-08-14", lastActiveAt: isoHoursAgo(13), taskCount: 134, mfa: true },
  { id: "u13", name: "Ava Martin", email: "ava@acme.com", initials: "AM", color: "#ec4899", role: "Content Strategist", platformRole: "member", status: "active", workspaceId: "w-acme", joinedAt: "2025-12-01", lastActiveAt: isoHoursAgo(30), taskCount: 47, mfa: false },
  { id: "u14", name: "Oliver Brown", email: "oliver@lumen.studio", initials: "OB", color: "#3b82f6", role: "Illustrator", platformRole: "member", status: "active", workspaceId: "w-lumen", joinedAt: "2025-12-12", lastActiveAt: isoHoursAgo(48), taskCount: 33, mfa: false },
  { id: "u15", name: "Isla Murphy", email: "isla@orbit.io", initials: "IM", color: "#84cc16", role: "Operations", platformRole: "member", status: "invited", workspaceId: "w-orbit", joinedAt: isoDaysAgo(2), lastActiveAt: isoDaysAgo(2) + "T10:00:00Z", taskCount: 0, mfa: false },
  { id: "u16", name: "Liam Anderson", email: "liam@northwind.io", initials: "LA", color: "#22c55e", role: "Backend Engineer", platformRole: "member", status: "active", workspaceId: "w-northwind", joinedAt: "2025-10-08", lastActiveAt: isoHoursAgo(16), taskCount: 121, mfa: true },
  { id: "u17", name: "Sophia Lee", email: "sophia@vertex.dev", initials: "SL", color: "#eab308", role: "PM", platformRole: "admin", status: "active", workspaceId: "w-vertex", joinedAt: "2025-10-20", lastActiveAt: isoHoursAgo(9), taskCount: 162, mfa: true },
  { id: "u18", name: "Ethan Wright", email: "ethan@acme.com", initials: "EW", color: "#0d9488", role: "Security Engineer", platformRole: "member", status: "active", workspaceId: "w-acme", joinedAt: "2025-07-19", lastActiveAt: isoHoursAgo(22), taskCount: 89, mfa: true },
  { id: "u19", name: "Mia Davis", email: "mia@fable.media", initials: "MD", color: "#c026d3", role: "Editor", platformRole: "member", status: "invited", workspaceId: "w-fable", joinedAt: isoDaysAgo(4), lastActiveAt: isoDaysAgo(4) + "T14:00:00Z", taskCount: 0, mfa: false },
  { id: "u20", name: "Lucas Garcia", email: "lucas@cobalt.health", initials: "LG", color: "#dc2626", role: "Frontend Engineer", platformRole: "member", status: "suspended", workspaceId: "w-cobalt", joinedAt: "2025-09-05", lastActiveAt: isoDaysAgo(12) + "T11:00:00Z", taskCount: 78, mfa: false },
]

// ── Teams (a representative sample across workspaces) ─────────────────────────

export const TEAMS: Team[] = [
  { id: "t-eng", name: "Engineering", key: "ENG", description: "Platform, APIs, and infrastructure.", color: "#6366f1", icon: "💻", workspaceId: "w-northwind", memberCount: 9, leadId: "u1", openTasks: 34, createdAt: "2025-09-15" },
  { id: "t-design", name: "Design", key: "DSN", description: "Product experience and design system.", color: "#8b5cf6", icon: "🎨", workspaceId: "w-lumen", memberCount: 4, leadId: "u2", openTasks: 12, createdAt: "2025-11-22" },
  { id: "t-product", name: "Product", key: "PRD", description: "Roadmap, specs, and prioritization.", color: "#f43f5e", icon: "🧭", workspaceId: "w-acme", memberCount: 7, leadId: "u4", openTasks: 21, createdAt: "2025-06-05" },
  { id: "t-growth", name: "Growth", key: "GRW", description: "Acquisition and lifecycle.", color: "#10b981", icon: "📈", workspaceId: "w-orbit", memberCount: 3, leadId: "u8", openTasks: 7, createdAt: "2026-05-29" },
  { id: "t-platform", name: "Platform", key: "PLT", description: "Core services and reliability.", color: "#06b6d4", icon: "⚙️", workspaceId: "w-vertex", memberCount: 6, leadId: "u3", openTasks: 28, createdAt: "2025-10-18" },
  { id: "t-data", name: "Data", key: "DAT", description: "Analytics, ML, and reporting.", color: "#f59e0b", icon: "📊", workspaceId: "w-northwind", memberCount: 5, leadId: "u10", openTasks: 15, createdAt: "2025-10-01" },
  { id: "t-security", name: "Security", key: "SEC", description: "AppSec, compliance, and audits.", color: "#ef4444", icon: "🔐", workspaceId: "w-acme", memberCount: 4, leadId: "u18", openTasks: 9, createdAt: "2025-07-20" },
  { id: "t-clinical", name: "Clinical", key: "CLN", description: "Care workflows and integrations.", color: "#0ea5e9", icon: "🩺", workspaceId: "w-cobalt", memberCount: 6, leadId: "u5", openTasks: 19, createdAt: "2025-08-05" },
]

// ── Tasks (sample of recent work platform-wide) ──────────────────────────────

export const TASKS: Task[] = [
  { id: "k1", key: "ENG-128", title: "Build real-time task board with optimistic updates", status: "in_progress", priority: "high", assigneeId: "u1", teamId: "t-eng", workspaceId: "w-northwind", tags: ["feature", "infra"], dueDate: "2026-06-12", createdAt: "2026-05-28", updatedAt: isoDaysAgo(2) },
  { id: "k2", key: "ENG-131", title: "Rate-limit the public API gateway", status: "todo", priority: "urgent", assigneeId: "u16", teamId: "t-eng", workspaceId: "w-northwind", tags: ["infra", "bug"], dueDate: "2026-06-09", createdAt: "2026-06-01", updatedAt: isoDaysAgo(4) },
  { id: "k3", key: "PLT-117", title: "Migrate auth sessions to edge-cached tokens", status: "in_review", priority: "medium", assigneeId: "u3", teamId: "t-platform", workspaceId: "w-vertex", tags: ["infra"], dueDate: "2026-06-10", createdAt: "2026-05-20", updatedAt: isoDaysAgo(2) },
  { id: "k4", key: "ENG-140", title: "Fix avatar upload crash on Safari", status: "backlog", priority: "high", assigneeId: "u16", teamId: "t-eng", workspaceId: "w-northwind", tags: ["bug"], dueDate: null, createdAt: "2026-06-03", updatedAt: isoDaysAgo(5) },
  { id: "k5", key: "SEC-101", title: "SOC 2 evidence collection automation", status: "in_progress", priority: "high", assigneeId: "u18", teamId: "t-security", workspaceId: "w-acme", tags: ["infra", "docs"], dueDate: "2026-06-15", createdAt: "2026-05-10", updatedAt: isoDaysAgo(1) },
  { id: "k6", key: "PLT-145", title: "Webhook delivery retries with backoff", status: "backlog", priority: "low", assigneeId: "u3", teamId: "t-platform", workspaceId: "w-vertex", tags: ["feature", "infra"], dueDate: "2026-06-24", createdAt: "2026-06-04", updatedAt: isoDaysAgo(4) },
  { id: "k7", key: "DSN-150", title: "Dark mode token audit", status: "todo", priority: "low", assigneeId: "u2", teamId: "t-design", workspaceId: "w-lumen", tags: ["ux", "design"], dueDate: "2026-06-18", createdAt: "2026-06-05", updatedAt: isoDaysAgo(3) },
  { id: "k8", key: "DSN-064", title: "Redesign the task detail panel", status: "in_progress", priority: "high", assigneeId: "u14", teamId: "t-design", workspaceId: "w-lumen", tags: ["design", "ux"], dueDate: "2026-06-11", createdAt: "2026-05-26", updatedAt: isoDaysAgo(2) },
  { id: "k9", key: "PRD-070", title: "Q3 roadmap planning doc", status: "in_review", priority: "medium", assigneeId: "u4", teamId: "t-product", workspaceId: "w-acme", tags: ["docs"], dueDate: "2026-06-08", createdAt: "2026-05-22", updatedAt: isoDaysAgo(2) },
  { id: "k10", key: "DAT-058", title: "Churn prediction model v2", status: "in_progress", priority: "medium", assigneeId: "u10", teamId: "t-data", workspaceId: "w-northwind", tags: ["research"], dueDate: "2026-06-20", createdAt: "2026-05-08", updatedAt: isoDaysAgo(1) },
  { id: "k11", key: "CLN-075", title: "HL7 integration for lab results", status: "todo", priority: "urgent", assigneeId: "u5", teamId: "t-clinical", workspaceId: "w-cobalt", tags: ["feature", "infra"], dueDate: "2026-06-13", createdAt: "2026-06-02", updatedAt: isoDaysAgo(3) },
  { id: "k12", key: "GRW-019", title: "Lifecycle email onboarding sequence", status: "todo", priority: "medium", assigneeId: "u8", teamId: "t-growth", workspaceId: "w-orbit", tags: ["growth"], dueDate: "2026-06-16", createdAt: "2026-05-30", updatedAt: isoDaysAgo(2) },
  { id: "k13", key: "PRD-082", title: "Pricing page A/B test", status: "done", priority: "medium", assigneeId: "u13", teamId: "t-product", workspaceId: "w-acme", tags: ["growth"], dueDate: "2026-06-01", createdAt: "2026-05-12", updatedAt: isoDaysAgo(7) },
  { id: "k14", key: "SEC-110", title: "Rotate signing keys for JWT issuer", status: "done", priority: "high", assigneeId: "u18", teamId: "t-security", workspaceId: "w-acme", tags: ["infra"], dueDate: "2026-06-02", createdAt: "2026-05-18", updatedAt: isoDaysAgo(6) },
  { id: "k15", key: "DAT-061", title: "Self-serve analytics dashboard", status: "in_review", priority: "high", assigneeId: "u10", teamId: "t-data", workspaceId: "w-northwind", tags: ["feature"], dueDate: "2026-06-19", createdAt: "2026-05-25", updatedAt: isoDaysAgo(1) },
  { id: "k16", key: "CLN-080", title: "Patient consent audit trail", status: "backlog", priority: "high", assigneeId: "u12", teamId: "t-clinical", workspaceId: "w-cobalt", tags: ["infra", "docs"], dueDate: "2026-06-28", createdAt: "2026-06-06", updatedAt: isoDaysAgo(2) },
]

// ── Invoices ─────────────────────────────────────────────────────────────────

export const INVOICES: Invoice[] = [
  { id: "i1", number: "INV-2061", workspaceId: "w-acme", amount: 4200, status: "paid", plan: "enterprise", issuedAt: isoDaysAgo(3) },
  { id: "i2", number: "INV-2060", workspaceId: "w-northwind", amount: 1008, status: "paid", plan: "business", issuedAt: isoDaysAgo(5) },
  { id: "i3", number: "INV-2059", workspaceId: "w-vertex", amount: 792, status: "paid", plan: "business", issuedAt: isoDaysAgo(6) },
  { id: "i4", number: "INV-2058", workspaceId: "w-cobalt", amount: 672, status: "past_due", plan: "business", issuedAt: isoDaysAgo(9) },
  { id: "i5", number: "INV-2057", workspaceId: "w-lumen", amount: 132, status: "paid", plan: "pro", issuedAt: isoDaysAgo(11) },
  { id: "i6", number: "INV-2056", workspaceId: "w-acme", amount: 4200, status: "paid", plan: "enterprise", issuedAt: isoDaysAgo(33) },
  { id: "i7", number: "INV-2055", workspaceId: "w-northwind", amount: 1008, status: "paid", plan: "business", issuedAt: isoDaysAgo(35) },
  { id: "i8", number: "INV-2054", workspaceId: "w-pinepoint", amount: 144, status: "refunded", plan: "pro", issuedAt: isoDaysAgo(38) },
  { id: "i9", number: "INV-2053", workspaceId: "w-cobalt", amount: 672, status: "open", plan: "business", issuedAt: isoDaysAgo(1) },
  { id: "i10", number: "INV-2052", workspaceId: "w-vertex", amount: 792, status: "paid", plan: "business", issuedAt: isoDaysAgo(36) },
]

// ── Activity feed ────────────────────────────────────────────────────────────

export const ACTIVITY: Activity[] = [
  { id: "a1", kind: "upgrade", message: "Acme Corp upgraded to Enterprise", actorId: "u4", workspaceId: "w-acme", createdAt: isoHoursAgo(2) },
  { id: "a2", kind: "signup", message: "Orbit Logistics started a Pro trial", actorId: "u8", workspaceId: "w-orbit", createdAt: isoHoursAgo(5) },
  { id: "a3", kind: "payment", message: "Cobalt Health payment failed — card declined", actorId: "u5", workspaceId: "w-cobalt", createdAt: isoHoursAgo(9) },
  { id: "a4", kind: "invite", message: "Isla Murphy was invited to Orbit Logistics", actorId: "u8", workspaceId: "w-orbit", createdAt: isoHoursAgo(11) },
  { id: "a5", kind: "flag", message: "Enabled “AI task suggestions” for 25% of workspaces", actorId: "admin", workspaceId: null, createdAt: isoHoursAgo(14) },
  { id: "a6", kind: "suspend", message: "Lucas Garcia was suspended for policy violation", actorId: "admin", workspaceId: "w-cobalt", createdAt: isoHoursAgo(26) },
  { id: "a7", kind: "payment", message: "Northwind Labs paid invoice INV-2060", actorId: "u1", workspaceId: "w-northwind", createdAt: isoHoursAgo(30) },
  { id: "a8", kind: "cancel", message: "Pinepoint canceled their subscription", actorId: "u7", workspaceId: "w-pinepoint", createdAt: isoDaysAgo(2) + "T16:20:00Z" },
  { id: "a9", kind: "upgrade", message: "Vertex Robotics added 8 seats", actorId: "u3", workspaceId: "w-vertex", createdAt: isoDaysAgo(2) + "T10:05:00Z" },
  { id: "a10", kind: "signup", message: "Fable Media created a workspace", actorId: "u6", workspaceId: "w-fable", createdAt: isoDaysAgo(3) + "T08:40:00Z" },
]

// ── Feature flags ────────────────────────────────────────────────────────────

export const FEATURE_FLAGS: FeatureFlag[] = [
  { id: "f1", name: "AI task suggestions", description: "Surface suggested next tasks based on team activity.", enabled: true, rollout: 25, group: "experimental" },
  { id: "f2", name: "Real-time presence", description: "Show live cursors and who's viewing a task.", enabled: true, rollout: 100, group: "product" },
  { id: "f3", name: "Annual billing", description: "Offer discounted annual plans at checkout.", enabled: true, rollout: 100, group: "billing" },
  { id: "f4", name: "Usage-based add-ons", description: "Metered billing for API calls beyond plan limits.", enabled: false, rollout: 0, group: "billing" },
  { id: "f5", name: "Guest access", description: "Invite external collaborators with read-only access.", enabled: true, rollout: 60, group: "product" },
  { id: "f6", name: "Workflow automations", description: "Trigger actions when a task changes status.", enabled: false, rollout: 10, group: "experimental" },
]

// ── Time series for charts ───────────────────────────────────────────────────

/** Daily new signups over the last 30 days. */
export const SIGNUPS_SERIES = buildDailySeries(30, 14, 0.5, 7, 1337)

/** Daily active users over the last 30 days. */
export const DAU_SERIES = buildDailySeries(30, 2100, 22, 140, 9001)

/** Daily tasks completed over the last 30 days. */
export const THROUGHPUT_SERIES = buildDailySeries(30, 540, 6, 90, 4242)

/** Monthly recurring revenue over the last 12 months. */
export const MRR_SERIES: SeriesPoint[] = [
  { date: "2025-07-01", value: 4820 },
  { date: "2025-08-01", value: 5240 },
  { date: "2025-09-01", value: 5910 },
  { date: "2025-10-01", value: 6380 },
  { date: "2025-11-01", value: 6720 },
  { date: "2025-12-01", value: 7150 },
  { date: "2026-01-01", value: 7480 },
  { date: "2026-02-01", value: 7610 },
  { date: "2026-03-01", value: 8090 },
  { date: "2026-04-01", value: 8340 },
  { date: "2026-05-01", value: 8760 },
  { date: "2026-06-01", value: 9204 },
]
