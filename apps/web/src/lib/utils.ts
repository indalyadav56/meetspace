import { format, isToday, isTomorrow, isYesterday, isPast, parseISO, differenceInCalendarDays } from 'date-fns'
import type { Priority } from '../store/types'

export function cn(...parts: Array<string | false | null | undefined | 0>) {
  return parts.filter(Boolean).join(' ')
}

export function uid(prefix = '') {
  return prefix + Math.random().toString(36).slice(2, 10)
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function toISODate(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

export function friendlyDate(iso: string | null) {
  if (!iso) return ''
  const d = parseISO(iso)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  if (isYesterday(d)) return 'Yesterday'
  const diff = differenceInCalendarDays(d, new Date())
  if (diff > 0 && diff < 7) return format(d, 'EEE')
  return format(d, d.getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy')
}

export function isOverdue(iso: string | null, done: boolean) {
  if (!iso || done) return false
  const d = parseISO(iso)
  return isPast(d) && !isToday(d)
}

export function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return format(new Date(iso), 'MMM d')
}

export const PRIORITIES: { value: Exclude<Priority, null>; label: string; color: string }[] = [
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
  { value: 'high', label: 'High', color: '#f59e0b' },
  { value: 'normal', label: 'Normal', color: '#3b82f6' },
  { value: 'low', label: 'Low', color: '#94a3b8' },
]

export const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3, none: 4 }

export function priorityMeta(p: Priority) {
  return PRIORITIES.find((x) => x.value === p) ?? null
}

export const TAG_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1']

export function tagColor(tag: string) {
  let h = 0
  for (const c of tag) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TAG_COLORS[h % TAG_COLORS.length]
}

export const SPACE_COLORS = ['#4f46e5', '#14b8a6', '#f43f5e', '#f59e0b', '#0ea5e9', '#8b5cf6', '#10b981', '#ec4899']
