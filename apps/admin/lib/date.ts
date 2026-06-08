const MS_PER_DAY = 1000 * 60 * 60 * 24

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Whole days between today and the given ISO date (negative = overdue). */
export function daysUntil(iso: string): number {
  const due = startOfDay(new Date(iso + "T00:00:00"))
  const now = startOfDay(new Date())
  return Math.round((due.getTime() - now.getTime()) / MS_PER_DAY)
}

/** Compact, human label for a due date relative to today. */
export function formatDueDate(iso: string): string {
  const diff = daysUntil(iso)
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  if (diff === -1) return "Yesterday"
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff <= 7) return `${diff}d left`
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export function isOverdue(iso: string): boolean {
  return daysUntil(iso) < 0
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/** Relative "time ago" for timestamps (comments, activity). */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
