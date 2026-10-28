import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isToday, isYesterday, parseISO } from 'date-fns'
import { AtSign, Bell, BellRing, CalendarClock, Check, CheckCheck, CircleDot, Maximize2, MessageSquare, Settings, Timer, UserPlus, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { Notification, NotificationKind } from '../../store/types'
import { Avatar } from '../components/ui'
import { cn, timeAgo } from '../../lib/utils'

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  reminder: BellRing,
  assigned: UserPlus,
  comment: MessageSquare,
  status: CircleDot,
  mention: AtSign,
  due: CalendarClock,
  timesheet: Timer,
}
const KIND_TONE: Record<NotificationKind, string> = {
  reminder: 'bg-orange-500',
  assigned: 'bg-brand-600',
  comment: 'bg-sky-500',
  status: 'bg-emerald-500',
  mention: 'bg-violet-500',
  due: 'bg-amber-500',
  timesheet: 'bg-teal-600',
}

type Filter = 'all' | 'unread' | 'mention' | 'assigned' | 'comment'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'mention', label: 'Mentions' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'comment', label: 'Comments' },
]

const groupOf = (iso: string) => {
  const d = parseISO(iso)
  return isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : 'Earlier'
}

/**
 * The activity feed behind the bell: everything that happened on work you're
 * involved in. Inbox, by contrast, only holds what you still need to act on.
 */
export default function NotificationFeed({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const s = useStore()
  const nav = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const all = s.notifications.filter((n) => !n.cleared).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const shown = all.filter((n) => (filter === 'all' ? true : filter === 'unread' ? !n.read : n.kind === filter)).slice(0, compact ? 50 : 300)
  const unread = all.filter((n) => !n.read).length
  const go = (to: string) => (nav(to), onNavigate?.())

  const open = (n: Notification) => {
    s.markRead(n.id)
    const task = s.tasks.find((t) => t.id === n.taskId)
    if (task) (s.openTask(task.id), onNavigate?.())
    else if (n.kind === 'timesheet') go(`/app/timesheets?tab=${n.text.includes('submitted their') ? 'approvals' : 'mine'}`)
  }

  let lastGroup = ''
  return (
    <div className={cn('flex min-h-0 flex-col', compact ? 'max-h-[min(640px,calc(100vh-80px))]' : 'h-full')}>
      <div className={cn('flex shrink-0 items-center gap-2', compact ? 'px-3 pt-2.5 pb-1' : 'h-12 px-4')}>
        <Bell size={compact ? 16 : 18} className="text-brand-600" />
        <h2 className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>Notifications</h2>
        {unread > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
        <span className="ml-auto flex items-center gap-0.5">
          <button disabled={!unread} onClick={s.markAllRead} className="hover-surface text-muted rounded p-1.5 disabled:opacity-30" title="Mark all as read" aria-label="Mark all as read">
            <CheckCheck size={15} />
          </button>
          <button onClick={() => go('/app/settings?tab=notifications')} className="hover-surface text-muted rounded p-1.5" title="Notification settings" aria-label="Notification settings">
            <Settings size={15} />
          </button>
          {compact && (
            <button onClick={() => go('/app/notifications')} className="hover-surface text-muted rounded p-1.5" title="Open full page" aria-label="Open all notifications">
              <Maximize2 size={14} />
            </button>
          )}
        </span>
      </div>
      <div className={cn('border-app flex shrink-0 gap-1 overflow-x-auto border-b', compact ? 'px-2 pb-2' : 'px-4 pb-2')}>
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', filter === f.key ? 'bg-brand-600 text-white' : 'text-muted hover-surface')}>
            {f.label}
            {f.key === 'unread' && unread > 0 && ` ${unread}`}
          </button>
        ))}
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 && (
          <div className="text-muted flex flex-col items-center gap-2 px-6 py-12 text-center text-sm">
            <Bell size={26} className="text-faint" />
            {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet. Updates on tasks you follow show up here.'}
          </div>
        )}
        {shown.map((n) => {
          const task = s.tasks.find((t) => t.id === n.taskId)
          const actor = s.users.find((u) => u.id === n.actorId)
          const Icon = KIND_ICON[n.kind]
          const g = groupOf(n.createdAt)
          const header = g !== lastGroup
          lastGroup = g
          return (
            <div key={n.id}>
              {header && <div className="text-faint surface sticky top-0 z-[1] px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wide uppercase">{g}</div>}
              <div onClick={() => open(n)} className={cn('group hover-surface relative flex cursor-pointer items-start gap-3 px-4 py-2.5', !n.read && 'bg-brand-50/60 dark:bg-brand-600/10')}>
                <span className="relative shrink-0">
                  {actor ? (
                    <Avatar userId={actor.id} size={30} />
                  ) : (
                    <span className="surface-muted flex h-[30px] w-[30px] items-center justify-center rounded-full">
                      <Bell size={14} className="text-faint" />
                    </span>
                  )}
                  <span className={cn('absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full text-white ring-2 ring-[var(--bg)]', KIND_TONE[n.kind])}>
                    <Icon size={9} />
                  </span>
                </span>
                <div className="min-w-0 flex-1 text-[13px]">
                  <div className="leading-snug">
                    {actor && n.text.startsWith(actor.name) ? (
                      <>
                        <b className="font-semibold">{actor.name}</b>
                        <span className="text-muted">{n.text.slice(actor.name.length)}</span>
                      </>
                    ) : (
                      <>
                        {actor && <b className="font-semibold">{actor.name} </b>}
                        <span className="text-muted">{n.text}</span>
                      </>
                    )}
                  </div>
                  {task && (
                    <div className="text-faint mt-0.5 truncate text-xs">
                      <span className="font-mono">MS-{task.key}</span> · <span className="text-app">{task.title}</span>
                    </div>
                  )}
                  <div className="text-faint mt-0.5 text-[11px]">{timeAgo(n.createdAt)}</div>
                </div>
                {!n.read && <span className="bg-brand-600 mt-1.5 h-2 w-2 shrink-0 rounded-full group-hover:hidden" aria-label="Unread" />}
                <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => s.markRead(n.id, !n.read)} className="text-muted hover:text-app rounded p-1" title={n.read ? 'Mark unread' : 'Mark read'} aria-label={n.read ? 'Mark unread' : 'Mark read'}>
                    <Check size={14} />
                  </button>
                  <button onClick={() => s.clearNotification(n.id, true)} className="text-muted hover:text-app rounded p-1" title="Remove" aria-label="Remove notification">
                    <X size={14} />
                  </button>
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
