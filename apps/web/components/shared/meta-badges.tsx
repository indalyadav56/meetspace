import { CalendarClock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { PRIORITY_MAP, STATUS_MAP, tagColor } from "@/lib/config"
import { formatDueDate, isOverdue } from "@/lib/date"
import type { PriorityId, StatusId } from "@/lib/types"

export function PriorityFlag({
  priority,
  withLabel = false,
  className,
}: {
  priority: PriorityId
  withLabel?: boolean
  className?: string
}) {
  const meta = PRIORITY_MAP[priority]
  const Icon = meta.icon
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Icon className={cn("size-3.5 shrink-0", meta.color)} />
      {withLabel && <span className="text-sm">{meta.label}</span>}
    </span>
  )
}

export function StatusPill({
  status,
  className,
}: {
  status: StatusId
  className?: string
}) {
  const meta = STATUS_MAP[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        meta.soft,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  )
}

export function StatusIcon({ status, className }: { status: StatusId; className?: string }) {
  const meta = STATUS_MAP[status]
  const Icon = meta.icon
  return <Icon className={cn("size-4 shrink-0", meta.text, className)} />
}

export function TagBadge({ tag }: { tag: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium capitalize",
        tagColor(tag),
      )}
    >
      {tag}
    </span>
  )
}

export function DueDateBadge({ date }: { date: string }) {
  const overdue = isOverdue(date)
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-normal",
        overdue && "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
      )}
    >
      <CalendarClock data-icon="inline-start" />
      {formatDueDate(date)}
    </Badge>
  )
}
