import {
  CircleDashed,
  Circle,
  CircleDotDashed,
  Eye,
  CheckCircle2,
  SignalHigh,
  SignalMedium,
  SignalLow,
  AlertTriangle,
  Minus,
  type LucideIcon,
} from "lucide-react"
import type { PriorityId, StatusId } from "./types"

export interface StatusMeta {
  id: StatusId
  label: string
  icon: LucideIcon
  /** Solid dot color. */
  dot: string
  /** Icon / accent text color. */
  text: string
  /** Soft pill background + text, used for badges. */
  soft: string
}

export const STATUSES: StatusMeta[] = [
  {
    id: "backlog",
    label: "Backlog",
    icon: CircleDashed,
    dot: "bg-zinc-400",
    text: "text-zinc-500",
    soft: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
  },
  {
    id: "todo",
    label: "To Do",
    icon: Circle,
    dot: "bg-sky-500",
    text: "text-sky-500",
    soft: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    id: "in_progress",
    label: "In Progress",
    icon: CircleDotDashed,
    dot: "bg-amber-500",
    text: "text-amber-500",
    soft: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    id: "in_review",
    label: "In Review",
    icon: Eye,
    dot: "bg-violet-500",
    text: "text-violet-500",
    soft: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    id: "done",
    label: "Done",
    icon: CheckCircle2,
    dot: "bg-emerald-500",
    text: "text-emerald-500",
    soft: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
]

export const STATUS_MAP = Object.fromEntries(
  STATUSES.map((s) => [s.id, s]),
) as Record<StatusId, StatusMeta>

export interface PriorityMeta {
  id: PriorityId
  label: string
  icon: LucideIcon
  color: string
  rank: number
}

export const PRIORITIES: PriorityMeta[] = [
  { id: "urgent", label: "Urgent", icon: AlertTriangle, color: "text-red-500", rank: 4 },
  { id: "high", label: "High", icon: SignalHigh, color: "text-orange-500", rank: 3 },
  { id: "medium", label: "Medium", icon: SignalMedium, color: "text-amber-500", rank: 2 },
  { id: "low", label: "Low", icon: SignalLow, color: "text-sky-500", rank: 1 },
  { id: "none", label: "No priority", icon: Minus, color: "text-muted-foreground", rank: 0 },
]

export const PRIORITY_MAP = Object.fromEntries(
  PRIORITIES.map((p) => [p.id, p]),
) as Record<PriorityId, PriorityMeta>

/** Tag → soft color class. Falls back to neutral when unmapped. */
export const TAG_COLORS: Record<string, string> = {
  design: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  bug: "bg-red-500/10 text-red-600 dark:text-red-400",
  feature: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  research: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  docs: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  infra: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  growth: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  ux: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
}

export function tagColor(tag: string) {
  return TAG_COLORS[tag.toLowerCase()] ?? "bg-muted text-muted-foreground"
}
