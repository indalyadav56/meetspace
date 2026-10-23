import { useNavigate } from 'react-router-dom'
import { useQueryState } from '../../lib/useQueryState'
import { AtSign, Bell, BellRing, CalendarClock, CheckCheck, CircleDot, MessageSquare, RotateCcw, Timer, UserPlus, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { NotificationKind } from '../../store/types'
import { Avatar } from '../components/ui'
import { cn, timeAgo } from '../../lib/utils'

const kindIcon: Record<NotificationKind, typeof Bell> = {
  reminder: BellRing,
  assigned: UserPlus,
  comment: MessageSquare,
  status: CircleDot,
  mention: AtSign,
  due: CalendarClock,
  timesheet: Timer,
}

type Tab = 'important' | 'other' | 'cleared'

export default function Inbox() {
  const nav = useNavigate()
  const s = useStore()
  const [tab, setTab] = useQueryState<Tab>('tab', 'important')
  const items = s.notifications
    .filter((n) => (tab === 'cleared' ? n.cleared : !n.cleared && (tab === 'important' ? n.important : !n.important)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const count = (t: Tab) => s.notifications.filter((n) => (t === 'cleared' ? false : !n.cleared && !n.read && (t === 'important' ? n.important : !n.important))).length

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 px-4">
        <Bell size={18} className="text-brand-600" />
        <h1 className="text-base font-semibold">Inbox</h1>
        <button onClick={s.markAllRead} className="border-app hover-surface ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium">
          <CheckCheck size={14} /> Mark all read
        </button>
      </div>
      <div className="border-app flex gap-1 border-b px-4">
        {(['important', 'other', 'cleared'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn('relative flex h-10 items-center gap-1.5 px-2.5 text-[13px] font-medium capitalize', tab === t ? 'after:bg-brand-600 after:absolute after:inset-x-1 after:bottom-0 after:h-0.5' : 'text-muted')}
          >
            {t}
            {count(t) > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{count(t)}</span>}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        {items.length === 0 && (
          <div className="text-muted flex flex-col items-center gap-2 p-16 text-sm">
            <CheckCheck size={32} className="text-emerald-500" />
            Inbox zero. Nice work.
          </div>
        )}
        {items.map((n) => {
          const task = s.tasks.find((t) => t.id === n.taskId)
          const actor = s.users.find((u) => u.id === n.actorId)
          const Icon = kindIcon[n.kind]
          return (
            <div
              key={n.id}
              onClick={() => {
                s.markRead(n.id)
                if (task) s.openTask(task.id)
                else if (n.kind === 'timesheet') nav(`/app/timesheets?tab=${n.text.includes('submitted their') ? 'approvals' : 'mine'}`)
              }}
              className={cn('group border-app hover-surface flex cursor-pointer items-start gap-3 border-b px-4 py-3', !n.read && 'bg-brand-50/50 dark:bg-brand-600/10')}
            >
              <span className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-brand-600')} />
              <Avatar userId={n.actorId} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="truncate font-semibold">{task?.title ?? (n.kind === 'reminder' ? 'Reminder' : 'Deleted task')}</span>
                  <span className="text-faint ml-auto shrink-0 text-xs">{timeAgo(n.createdAt)}</span>
                </div>
                <div className="text-muted mt-0.5 flex items-center gap-1.5 text-[13px]">
                  <Icon size={13} className="shrink-0" />
                  <span className="truncate">
                    <b className="text-app font-medium">{actor?.name}</b> {n.text}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                <button
                  onClick={(e) => (e.stopPropagation(), s.markRead(n.id, !n.read))}
                  className="hover-surface text-muted rounded p-1"
                  title={n.read ? 'Mark unread' : 'Mark read'}
                >
                  <CheckCheck size={15} />
                </button>
                <button
                  onClick={(e) => (e.stopPropagation(), s.clearNotification(n.id, !n.cleared))}
                  className="hover-surface text-muted rounded p-1"
                  title={n.cleared ? 'Restore' : 'Clear'}
                >
                  {n.cleared ? <RotateCcw size={15} /> : <X size={15} />}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
