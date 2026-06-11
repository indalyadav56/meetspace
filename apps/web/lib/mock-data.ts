import type {
  ActivityItem,
  Channel,
  Chat,
  Meeting,
  Message,
  Task,
  Team,
  User,
} from "./types"

export const CURRENT_USER_ID = "u1"

export const USERS: User[] = [
  { id: "u1", name: "Indal Yadav", email: "indal@meetspace.app", initials: "IY", color: "#6366f1", role: "Product Lead", presence: "available", statusMessage: "Building meetspace ✨" },
  { id: "u2", name: "Maya Chen", email: "maya@meetspace.app", initials: "MC", color: "#8b5cf6", role: "Design Lead", presence: "busy", statusMessage: "In a meeting" },
  { id: "u3", name: "Arjun Patel", email: "arjun@meetspace.app", initials: "AP", color: "#0ea5e9", role: "Frontend Engineer", presence: "available" },
  { id: "u4", name: "Sofia Rossi", email: "sofia@meetspace.app", initials: "SR", color: "#f43f5e", role: "Product Manager", presence: "away", statusMessage: "Back at 3pm" },
  { id: "u5", name: "Leo Nakamura", email: "leo@meetspace.app", initials: "LN", color: "#10b981", role: "Backend Engineer", presence: "dnd", statusMessage: "Heads down" },
  { id: "u6", name: "Priya Sharma", email: "priya@meetspace.app", initials: "PS", color: "#f59e0b", role: "Product Designer", presence: "available" },
  { id: "u7", name: "Daniel Kim", email: "daniel@meetspace.app", initials: "DK", color: "#06b6d4", role: "QA Engineer", presence: "offline" },
  { id: "u8", name: "Hannah Weber", email: "hannah@meetspace.app", initials: "HW", color: "#d946ef", role: "Growth Marketer", presence: "available" },
]

export const TEAMS: Team[] = [
  {
    id: "t-eng",
    name: "Engineering",
    key: "ENG",
    description: "Ships the platform, APIs, and infrastructure that everything else runs on.",
    color: "#6366f1",
    icon: "💻",
    memberIds: ["u1", "u3", "u5", "u7"],
    leadId: "u3",
    createdAt: "2025-11-02",
  },
  {
    id: "t-design",
    name: "Design",
    key: "DSN",
    description: "Owns the product experience, design system, and brand.",
    color: "#8b5cf6",
    icon: "🎨",
    memberIds: ["u2", "u6"],
    leadId: "u2",
    createdAt: "2025-11-05",
  },
  {
    id: "t-product",
    name: "Product",
    key: "PRD",
    description: "Sets the roadmap, writes specs, and keeps everyone pointed the same way.",
    color: "#f43f5e",
    icon: "🧭",
    memberIds: ["u1", "u4", "u2"],
    leadId: "u4",
    createdAt: "2025-11-02",
  },
  {
    id: "t-growth",
    name: "Growth",
    key: "GRW",
    description: "Acquisition, lifecycle, and everything that moves the funnel.",
    color: "#10b981",
    icon: "📈",
    memberIds: ["u8", "u4"],
    leadId: "u8",
    createdAt: "2026-01-14",
  },
]

export const TASKS: Task[] = [
  {
    id: "k1", key: "ENG-128", title: "Build real-time task board with optimistic updates",
    description: "Drag-and-drop board where moving a card updates status instantly and syncs in the background. Should feel snappy even on slow connections.",
    status: "in_progress", priority: "high", assigneeIds: ["u3", "u1"], teamId: "t-eng",
    tags: ["feature", "infra"], dueDate: "2026-06-12",
    subtasks: [
      { id: "s1", title: "Column drag targets", done: true },
      { id: "s2", title: "Optimistic status mutation", done: true },
      { id: "s3", title: "Reconcile on server response", done: false },
      { id: "s4", title: "Keyboard reordering", done: false },
    ],
    comments: [
      { id: "c1", authorId: "u1", body: "Let's make sure the empty column drop target is generous — easy to miss otherwise.", createdAt: "2026-06-05T09:20:00Z" },
      { id: "c2", authorId: "u3", body: "Agreed. Padding bumped to 64px when a card is being dragged.", createdAt: "2026-06-05T11:02:00Z" },
    ],
    createdAt: "2026-05-28", updatedAt: "2026-06-06",
  },
  {
    id: "k2", key: "ENG-131", title: "Rate-limit the public API gateway",
    description: "Add token-bucket rate limiting per API key with sensible defaults and clear 429 responses.",
    status: "todo", priority: "urgent", assigneeIds: ["u5"], teamId: "t-eng",
    tags: ["infra", "bug"], dueDate: "2026-06-09",
    subtasks: [
      { id: "s5", title: "Token bucket middleware", done: false },
      { id: "s6", title: "Per-key config store", done: false },
    ],
    comments: [], createdAt: "2026-06-01", updatedAt: "2026-06-04",
  },
  {
    id: "k3", key: "ENG-117", title: "Migrate auth sessions to edge-cached tokens",
    description: "Move session validation to the edge to cut p95 latency on authenticated routes.",
    status: "in_review", priority: "medium", assigneeIds: ["u5", "u7"], teamId: "t-eng",
    tags: ["infra"], dueDate: "2026-06-10",
    subtasks: [{ id: "s7", title: "Edge token verifier", done: true }, { id: "s8", title: "Rollback plan", done: true }],
    comments: [{ id: "c3", authorId: "u7", body: "QA passed in staging. One flaky test around clock skew — re-running.", createdAt: "2026-06-06T14:10:00Z" }],
    createdAt: "2026-05-20", updatedAt: "2026-06-06",
  },
  {
    id: "k4", key: "ENG-140", title: "Fix avatar upload crash on Safari",
    description: "Uploading a HEIC image on Safari throws and loses the form state. Convert client-side before upload.",
    status: "backlog", priority: "high", assigneeIds: ["u3"], teamId: "t-eng",
    tags: ["bug"], dueDate: null, subtasks: [], comments: [],
    createdAt: "2026-06-03", updatedAt: "2026-06-03",
  },
  {
    id: "k5", key: "ENG-101", title: "Set up end-to-end test pipeline",
    description: "Playwright suite running on every PR with sharded parallel execution.",
    status: "done", priority: "medium", assigneeIds: ["u7", "u3"], teamId: "t-eng",
    tags: ["infra", "docs"], dueDate: "2026-05-30",
    subtasks: [{ id: "s9", title: "Playwright config", done: true }, { id: "s10", title: "CI sharding", done: true }, { id: "s11", title: "Flake retry policy", done: true }],
    comments: [], createdAt: "2026-05-10", updatedAt: "2026-05-29",
  },
  {
    id: "k6", key: "ENG-145", title: "Webhook delivery retries with backoff",
    description: "Outbound webhooks should retry with exponential backoff and surface a delivery log.",
    status: "backlog", priority: "low", assigneeIds: ["u5"], teamId: "t-eng",
    tags: ["feature", "infra"], dueDate: "2026-06-24", subtasks: [], comments: [],
    createdAt: "2026-06-04", updatedAt: "2026-06-04",
  },
  {
    id: "k7", key: "ENG-150", title: "Dark mode token audit",
    description: "Sweep for hardcoded colors that break in dark mode and replace with semantic tokens.",
    status: "todo", priority: "low", assigneeIds: ["u1"], teamId: "t-eng",
    tags: ["ux", "design"], dueDate: "2026-06-18", subtasks: [],
    comments: [], createdAt: "2026-06-05", updatedAt: "2026-06-05",
  },

  {
    id: "k8", key: "DSN-064", title: "Redesign the task detail panel",
    description: "Cleaner hierarchy: title, status, and assignees up top, activity at the bottom. Reduce visual noise.",
    status: "in_progress", priority: "high", assigneeIds: ["u2", "u6"], teamId: "t-design",
    tags: ["design", "ux"], dueDate: "2026-06-11",
    subtasks: [{ id: "s12", title: "Low-fi wireframes", done: true }, { id: "s13", title: "Hi-fi mockups", done: true }, { id: "s14", title: "Dev handoff", done: false }],
    comments: [{ id: "c4", authorId: "u2", body: "Moved activity into a collapsible section to keep the fold focused on the essentials.", createdAt: "2026-06-05T16:40:00Z" }],
    createdAt: "2026-05-26", updatedAt: "2026-06-06",
  },
  {
    id: "k9", key: "DSN-070", title: "Design system: status & priority components",
    description: "Define the canonical status pills and priority flags, plus dark-mode variants.",
    status: "in_review", priority: "medium", assigneeIds: ["u6"], teamId: "t-design",
    tags: ["design"], dueDate: "2026-06-08",
    subtasks: [{ id: "s15", title: "Status tokens", done: true }, { id: "s16", title: "Priority flags", done: true }],
    comments: [], createdAt: "2026-05-22", updatedAt: "2026-06-06",
  },
  {
    id: "k10", key: "DSN-058", title: "Empty states illustration set",
    description: "Friendly empty states for board, list, and search with no results.",
    status: "done", priority: "low", assigneeIds: ["u6"], teamId: "t-design",
    tags: ["design", "ux"], dueDate: "2026-05-28", subtasks: [], comments: [],
    createdAt: "2026-05-08", updatedAt: "2026-05-27",
  },
  {
    id: "k11", key: "DSN-075", title: "Onboarding flow exploration",
    description: "First-run experience that gets a new team to their first task in under two minutes.",
    status: "todo", priority: "medium", assigneeIds: ["u2"], teamId: "t-design",
    tags: ["ux", "research"], dueDate: "2026-06-20", subtasks: [], comments: [],
    createdAt: "2026-06-02", updatedAt: "2026-06-02",
  },
  {
    id: "k12", key: "DSN-080", title: "Icon set refresh",
    description: "Replace mismatched icons with a single consistent family across the app.",
    status: "backlog", priority: "none", assigneeIds: ["u6"], teamId: "t-design",
    tags: ["design"], dueDate: null, subtasks: [], comments: [],
    createdAt: "2026-06-04", updatedAt: "2026-06-04",
  },

  {
    id: "k13", key: "PRD-042", title: "Q3 roadmap draft",
    description: "Synthesize feedback and analytics into a prioritized Q3 roadmap for review.",
    status: "in_progress", priority: "urgent", type: "epic", assigneeIds: ["u4", "u1"], teamId: "t-product",
    tags: ["docs", "research"], dueDate: "2026-06-13",
    subtasks: [{ id: "s17", title: "Pull usage data", done: true }, { id: "s18", title: "Theme the asks", done: false }, { id: "s19", title: "Draft narrative", done: false }],
    comments: [{ id: "c5", authorId: "u4", body: "Top requests are bulk edits and saved filters. Let's slot both into the first half.", createdAt: "2026-06-06T08:15:00Z" }],
    createdAt: "2026-05-30", updatedAt: "2026-06-06",
  },
  {
    id: "k14", key: "PRD-039", title: "Write spec for saved filters",
    description: "Let users name and pin filter combinations. Define sharing and permissions.",
    status: "todo", priority: "high", assigneeIds: ["u4"], teamId: "t-product",
    tags: ["docs", "feature"], dueDate: "2026-06-16", subtasks: [], comments: [],
    createdAt: "2026-06-01", updatedAt: "2026-06-03",
  },
  {
    id: "k15", key: "PRD-031", title: "Competitive teardown: task tools",
    description: "How do the incumbents handle teams + tasks? Find the gaps we can own.",
    status: "done", priority: "medium", assigneeIds: ["u1"], teamId: "t-product",
    tags: ["research"], dueDate: "2026-05-25", subtasks: [], comments: [],
    createdAt: "2026-05-12", updatedAt: "2026-05-24",
  },
  {
    id: "k16", key: "PRD-048", title: "Define team roles & permissions model",
    description: "Owner, admin, member, guest — what each can see and do across teams.",
    status: "backlog", priority: "high", assigneeIds: ["u4", "u1"], teamId: "t-product",
    tags: ["docs"], dueDate: "2026-06-26", subtasks: [], comments: [],
    createdAt: "2026-06-05", updatedAt: "2026-06-05",
  },
  {
    id: "k17", key: "PRD-052", title: "User interviews: how teams plan their week",
    description: "Five interviews to understand weekly planning rituals and where they break.",
    status: "in_review", priority: "low", assigneeIds: ["u4"], teamId: "t-product",
    tags: ["research"], dueDate: "2026-06-10", subtasks: [], comments: [],
    createdAt: "2026-05-27", updatedAt: "2026-06-06",
  },

  {
    id: "k18", key: "GRW-021", title: "Launch announcement landing page",
    description: "A focused landing page for the public launch with a single, clear call to action.",
    status: "in_progress", priority: "high", type: "epic", assigneeIds: ["u8"], teamId: "t-growth",
    tags: ["growth", "design"], dueDate: "2026-06-14",
    subtasks: [{ id: "s20", title: "Copy draft", done: true }, { id: "s21", title: "Hero design", done: false }],
    comments: [], createdAt: "2026-05-29", updatedAt: "2026-06-05",
  },
  {
    id: "k19", key: "GRW-018", title: "Lifecycle email sequence",
    description: "Five-email onboarding sequence triggered on signup, with activation milestones.",
    status: "todo", priority: "medium", assigneeIds: ["u8", "u4"], teamId: "t-growth",
    tags: ["growth"], dueDate: "2026-06-19", subtasks: [], comments: [],
    createdAt: "2026-06-02", updatedAt: "2026-06-02",
  },
  {
    id: "k20", key: "GRW-009", title: "Set up product analytics events",
    description: "Instrument the core funnel: signup → first team → first task → invite.",
    status: "done", priority: "high", assigneeIds: ["u8", "u5"], teamId: "t-growth",
    tags: ["growth", "infra"], dueDate: "2026-05-31", subtasks: [], comments: [],
    createdAt: "2026-05-15", updatedAt: "2026-05-30",
  },
  {
    id: "k21", key: "GRW-024", title: "Referral program experiment",
    description: "Test a give-one-get-one referral loop with a holdout group.",
    status: "backlog", priority: "low", assigneeIds: ["u8"], teamId: "t-growth",
    tags: ["growth", "research"], dueDate: null, subtasks: [], comments: [],
    createdAt: "2026-06-04", updatedAt: "2026-06-04",
  },
  {
    id: "k22", key: "ENG-152", title: "Bulk edit selected tasks",
    description: "Multi-select on the list view to change status, assignee, or priority in one action.",
    status: "todo", priority: "high", assigneeIds: ["u3", "u1"], teamId: "t-eng",
    tags: ["feature"], dueDate: "2026-06-17", subtasks: [], comments: [],
    createdAt: "2026-06-06", updatedAt: "2026-06-06",
  },
  {
    id: "k23", key: "DSN-082", title: "Accessibility pass on the board",
    description: "Keyboard navigation, focus rings, and color-contrast on status pills.",
    status: "todo", priority: "medium", assigneeIds: ["u6", "u7"], teamId: "t-design",
    tags: ["ux", "design"], dueDate: "2026-06-21", subtasks: [], comments: [],
    createdAt: "2026-06-06", updatedAt: "2026-06-06",
  },
  {
    id: "k24", key: "PRD-055", title: "Pricing & packaging research",
    description: "Per-seat vs per-team pricing — model both against the funnel data.",
    status: "in_progress", priority: "medium", assigneeIds: ["u4"], teamId: "t-product",
    tags: ["research", "growth"], dueDate: "2026-06-15", subtasks: [], comments: [],
    createdAt: "2026-06-03", updatedAt: "2026-06-05",
  },
]

/* ------------------------------------------------------------------ *
 * Chat data (the Microsoft Teams surface)
 * ------------------------------------------------------------------ */

export const CHANNELS: Channel[] = [
  // Engineering
  { id: "c-eng-general", teamId: "t-eng", name: "general", description: "Team-wide announcements and chatter", private: false },
  { id: "c-eng-frontend", teamId: "t-eng", name: "frontend", description: "Web client, UI, and the design system", private: false },
  { id: "c-eng-backend", teamId: "t-eng", name: "backend", description: "APIs, services, and data", private: false },
  { id: "c-eng-releases", teamId: "t-eng", name: "releases", description: "Ship logs and changelogs", private: false },
  { id: "c-eng-incidents", teamId: "t-eng", name: "incidents", description: "On-call and incident response", private: true },
  // Design
  { id: "c-dsn-general", teamId: "t-design", name: "general", description: "Design team home base", private: false },
  { id: "c-dsn-critique", teamId: "t-design", name: "critique", description: "Share work in progress for feedback", private: false },
  { id: "c-dsn-system", teamId: "t-design", name: "design-system", description: "Tokens, components, and patterns", private: false },
  // Product
  { id: "c-prd-general", teamId: "t-product", name: "general", description: "Product team home base", private: false },
  { id: "c-prd-roadmap", teamId: "t-product", name: "roadmap", description: "Planning and prioritization", private: false },
  { id: "c-prd-research", teamId: "t-product", name: "user-research", description: "Interviews and insights", private: false },
  // Growth
  { id: "c-grw-general", teamId: "t-growth", name: "general", description: "Growth team home base", private: false },
  { id: "c-grw-campaigns", teamId: "t-growth", name: "campaigns", description: "Launches and lifecycle", private: false },
  { id: "c-grw-experiments", teamId: "t-growth", name: "experiments", description: "Tests and learnings", private: false },
]

export const CHATS: Chat[] = [
  { id: "chat-maya", memberIds: ["u1", "u2"], group: false, name: null },
  { id: "chat-arjun", memberIds: ["u1", "u3"], group: false, name: null },
  { id: "chat-sofia", memberIds: ["u1", "u4"], group: false, name: null },
  { id: "chat-launch", memberIds: ["u1", "u4", "u8"], group: true, name: "Launch crew" },
]

function rx(emoji: string, ...userIds: string[]) {
  return { emoji, userIds }
}

function m(
  id: string,
  conversationId: string,
  authorId: string,
  body: string,
  createdAt: string,
  opts: Partial<Pick<Message, "reactions" | "attachments" | "replyIds" | "parentId" | "edited" | "system">> = {},
): Message {
  return {
    id,
    conversationId,
    authorId,
    body,
    createdAt,
    reactions: opts.reactions ?? [],
    attachments: opts.attachments ?? [],
    replyIds: opts.replyIds ?? [],
    parentId: opts.parentId ?? null,
    edited: opts.edited ?? false,
    system: opts.system ?? false,
  }
}

export const MESSAGES: Message[] = [
  // ---- Engineering / #general ----
  m("eg0a", "c-eng-general", "u4", "Reminder: roadmap review moved to 2pm tomorrow 🗓️", "2026-06-07T16:20:00Z", { reactions: [rx("👍", "u1", "u3")] }),
  m("eg0b", "c-eng-general", "u5", "Edge-token migration going out to staging tonight — shout if you need the auth path stable.", "2026-06-07T18:05:00Z"),
  m("eg1", "c-eng-general", "u3", "Morning all 👋 pushed the edge-token migration to staging last night — p95 on auth routes is down ~40%.", "2026-06-08T09:02:00Z", { reactions: [rx("🎉", "u1", "u5"), rx("👍", "u7")] }),
  m("eg2", "c-eng-general", "u5", "Huge. The verifier rewrite was the big win.", "2026-06-08T09:06:00Z", { reactions: [rx("❤️", "u3")] }),
  m("eg3", "c-eng-general", "u1", "@Arjun can you drop the dashboard link? Want to show it at standup.", "2026-06-08T09:10:00Z"),
  m("eg4", "c-eng-general", "u3", "Here's the latency board 👇", "2026-06-08T09:12:00Z", {
    replyIds: ["eg4r1", "eg4r2"],
    attachments: [{ id: "att1", name: "auth-latency", kind: "link", meta: "grafana.meetspace.app" }],
  }),
  m("eg4r1", "c-eng-general", "u1", "Perfect, thank you 🙏", "2026-06-08T09:14:00Z", { parentId: "eg4" }),
  m("eg4r2", "c-eng-general", "u7", "Re-ran the clock-skew test after the merge — green now ✅", "2026-06-08T09:20:00Z", { parentId: "eg4" }),
  m("eg5", "c-eng-general", "u2", "Maya Chen added Daniel Kim to the channel.", "2026-06-08T09:25:00Z", { system: true }),
  m("eg6", "c-eng-general", "u8", "Launch landing page copy is ready for review whenever someone has a sec 🙏", "2026-06-08T11:05:00Z", { reactions: [rx("👍", "u1", "u4")] }),
  m("eg7", "c-eng-general", "u1", "Great momentum today, team ⚡", "2026-06-08T11:40:00Z"),

  // ---- Engineering / #frontend ----
  m("ef1", "c-eng-frontend", "u3", "Shipping the new task board with optimistic drag-and-drop today. Reviews welcome on the PR.", "2026-06-08T10:02:00Z", { reactions: [rx("🎉", "u1")] }),
  m("ef2", "c-eng-frontend", "u6", "The empty-column drop target feels great now. Tiny nit: focus ring is a touch tight on cards.", "2026-06-08T10:18:00Z"),
  m("ef3", "c-eng-frontend", "u1", "Good catch — bumping the ring offset. Pushing a fix shortly.", "2026-06-08T10:24:00Z", { reactions: [rx("👍", "u6") ] }),

  // ---- Engineering / #releases ----
  m("er1", "c-eng-releases", "u5", "v0.8.0 is live 🚀 — edge auth, webhook retries, and the e2e pipeline.", "2026-06-08T08:30:00Z", { reactions: [rx("🎉", "u1", "u3", "u7"), rx("🙏", "u8")] }),
  m("er2", "c-eng-releases", "u7", "Smoke tests green across all environments.", "2026-06-08T08:41:00Z", { reactions: [rx("👍", "u5")] }),

  // ---- Design / #general ----
  m("dg1", "c-dsn-general", "u2", "Morning! Posting the redesigned task detail panel for a quick gut-check.", "2026-06-08T09:35:00Z"),
  m("dg2", "c-dsn-general", "u2", "Moved activity into a collapsible section so the fold stays focused on the essentials.", "2026-06-08T09:36:00Z", {
    attachments: [{ id: "att2", name: "task-panel-v3.fig", kind: "image", meta: "Figma" }],
    reactions: [rx("❤️", "u6", "u1"), rx("😮", "u3")],
  }),
  m("dg3", "c-dsn-general", "u6", "Love it. The hierarchy reads so much faster now.", "2026-06-08T09:48:00Z"),
  m("dg4", "c-dsn-general", "u1", "Agreed — ship it. Nice work @Maya 👏", "2026-06-08T09:52:00Z", { reactions: [rx("🙏", "u2")] }),

  // ---- Product / #roadmap ----
  m("pr1", "c-prd-roadmap", "u4", "Top Q3 asks from the data: bulk edits and saved filters. Proposing both in the first half.", "2026-06-08T10:40:00Z", { reactions: [rx("👍", "u1", "u2")] }),
  m("pr2", "c-prd-roadmap", "u1", "+1. Bulk edit is already in flight on the eng side.", "2026-06-08T10:44:00Z"),
  m("pr3", "c-prd-roadmap", "u4", "Drafting the narrative doc now — will share for review by EOD.", "2026-06-08T10:51:00Z"),

  // ---- DM: Maya ----
  m("cm1", "chat-maya", "u2", "Hey! Do you have five minutes to look at the panel spacing?", "2026-06-08T10:12:00Z"),
  m("cm2", "chat-maya", "u1", "Yep, sharing my screen in a sec.", "2026-06-08T10:13:00Z"),
  m("cm3", "chat-maya", "u2", "The 16px gutter feels right. Just the header needs a touch more breathing room.", "2026-06-08T10:15:00Z", { reactions: [rx("👍", "u1")] }),
  m("cm4", "chat-maya", "u1", "On it. Updated mock coming your way 🙌", "2026-06-08T10:21:00Z"),

  // ---- DM: Launch crew (group) ----
  m("cg1", "chat-launch", "u8", "Landing page is at 90%. Need final hero copy sign-off.", "2026-06-08T11:02:00Z"),
  m("cg2", "chat-launch", "u4", "Reviewing now — two small tweaks and we're good.", "2026-06-08T11:08:00Z"),
  m("cg3", "chat-launch", "u1", "🚀 Let's aim to publish Thursday.", "2026-06-08T11:15:00Z", { reactions: [rx("🎉", "u8", "u4")] }),

  // ---- DM: Arjun ----
  m("ca1", "chat-arjun", "u3", "Pushed the focus-ring fix. Mind a quick re-review?", "2026-06-08T10:30:00Z"),
  m("ca2", "chat-arjun", "u1", "Looking now 👀", "2026-06-08T10:31:00Z"),
]

export const ACTIVITY: ActivityItem[] = [
  { id: "act1", kind: "mention", actorId: "u1", teamId: "t-eng", channelId: "c-eng-general", chatId: null, preview: "@Arjun can you drop the dashboard link?", createdAt: "2026-06-08T09:10:00Z", read: false },
  { id: "act2", kind: "reaction", actorId: "u5", teamId: "t-eng", channelId: "c-eng-general", chatId: null, preview: "Great momentum today, team ⚡", emoji: "❤️", createdAt: "2026-06-08T09:06:00Z", read: false },
  { id: "act3", kind: "reply", actorId: "u7", teamId: "t-eng", channelId: "c-eng-general", chatId: null, preview: "Re-ran the clock-skew test — green now ✅", createdAt: "2026-06-08T09:20:00Z", read: false },
  { id: "act4", kind: "message", actorId: "u2", teamId: null, channelId: null, chatId: "chat-maya", preview: "The header needs a touch more breathing room.", createdAt: "2026-06-08T10:15:00Z", read: false },
  { id: "act5", kind: "mention", actorId: "u4", teamId: "t-product", channelId: "c-prd-roadmap", chatId: null, preview: "Bulk edit is already in flight on the eng side.", createdAt: "2026-06-08T10:44:00Z", read: true },
  { id: "act6", kind: "added", actorId: "u4", teamId: "t-growth", channelId: "c-grw-campaigns", chatId: null, preview: "added you to #campaigns", createdAt: "2026-06-07T16:40:00Z", read: true },
  { id: "act7", kind: "reaction", actorId: "u8", teamId: "t-eng", channelId: "c-eng-general", chatId: null, preview: "Can you drop the dashboard link?", emoji: "👍", createdAt: "2026-06-07T15:00:00Z", read: true },
]

export const MEETINGS: Meeting[] = [
  { id: "mtg1", title: "Daily standup", start: "2026-06-08T09:30:00", end: "2026-06-08T09:45:00", organizerId: "u4", attendeeIds: ["u1", "u3", "u5", "u7"], online: true, channelId: "c-eng-general", color: "#6366f1" },
  { id: "mtg2", title: "Design critique", start: "2026-06-08T13:00:00", end: "2026-06-08T14:00:00", organizerId: "u2", attendeeIds: ["u1", "u2", "u6"], online: true, channelId: "c-dsn-critique", color: "#8b5cf6" },
  { id: "mtg3", title: "Launch sync", start: "2026-06-08T15:30:00", end: "2026-06-08T16:00:00", organizerId: "u8", attendeeIds: ["u1", "u4", "u8"], online: true, channelId: null, color: "#10b981" },
  { id: "mtg4", title: "Roadmap review", start: "2026-06-09T14:00:00", end: "2026-06-09T15:00:00", organizerId: "u4", attendeeIds: ["u1", "u2", "u4"], online: true, channelId: "c-prd-roadmap", color: "#f43f5e" },
  { id: "mtg5", title: "1:1 with Maya", start: "2026-06-10T11:00:00", end: "2026-06-10T11:30:00", organizerId: "u1", attendeeIds: ["u1", "u2"], online: true, channelId: null, color: "#6366f1" },
]
