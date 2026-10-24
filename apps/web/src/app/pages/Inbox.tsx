import { useNavigate } from 'react-router-dom'
import { useQueryState } from '../../lib/useQueryState'
import { format, parseISO } from 'date-fns'
import { AlarmClock, AtSign, Bell, BellRing, CalendarClock, CheckCheck, CircleDot, MessageSquare, RotateCcw, Timer, UserPlus, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { NotificationKind } from '../../store/types'
import { Avatar, MenuItem, Popover, usePopover } from '../components/ui'
import { SNOOZE_OPTIONS, isSnoozed, useSnoozed } from '../inbox/snooze'
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

type Tab = 'important' | 'other' | 'later' | 'cleared'
const LABEL: Record<Tab, string> = { important: 'Primary', other: 'Other', later: 'Later', cleared: 'Cleared' }

export default function Inbox() {
  const nav = useNavigate()
  const s = useStore()
  const [tab, setTab] = useQueryState<Tab>('tab', 'important')
  const { until, snooze } = useSnoozed()
  const inTab = (t: Tab, n: (typeof s.notifications)[number]) =>
    t === 'cleared' ? n.cleared : n.cleared ? false : t === 'later' ? isSnoozed(until, n.id) : !isSnoozed(until, n.id) && (t === 'important' ? n.important : !n.important)
  const items = s.notifications
    .filter((n) => inTab(tab, n))
    .sort((a, b) => (tab === 'later' ? until[a.id].localeCompare(until[b.id]) : b.createdAt.localeCompare(a.createdAt)))
  const count = (t: Tab) => (t === 'cleared' ? 0 : s.notifications.filter((n) => inTab(t, n) && (t === 'later' || !n.read)).length)

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 px-4">
        <Bell size={18} className="text-brand-600" />
        <h1 className="text-base font-semibold">Inbox</h1>
        <button onClick={s.markAllRead} className="border-app hover-surface ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium">
          <CheckCheck size={14} /> Mark all read
        </button>
        {tab !== 'cleared' && items.length > 0 && (
          <button onClick={() => items.forEach((n) => s.clearNotification(n.id, true))} className="border-app hover-surface inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium">
            <X size={14} /> Clear all
          </button>
        )}
      </div>
      <div className="border-app flex gap-1 border-b px-4">
        {(['important', 'other', 'later', 'cleared'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn('relative flex h-10 items-center gap-1.5 px-2.5 text-[13px] font-medium capitalize', tab === t ? 'after:bg-brand-600 after:absolute after:inset-x-1 after:bottom-0 after:h-0.5' : 'text-muted')}
          >
            {LABEL[t]}
            {count(t) > 0 && <span className={cn('rounded-full px-1.5 text-[10px] font-bold text-white', t === 'later' ? 'bg-stone-400' : 'bg-red-500')}>{count(t)}</span>}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        {items.length === 0 && (
          <div className="text-muted flex flex-col items-center gap-2 p-16 text-sm">
            <CheckCheck size={32} className="text-emerald-500" />
            {tab === 'later' ? 'Nothing snoozed. Snooze a notification to bring it back later.' : 'Inbox zero. Nice work.'}
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
                  <span className="text-faint ml-auto shrink-0 text-xs">{tab === 'later' ? `Back ${format(parseISO(until[n.id]), 'EEE h:mm a')}` : timeAgo(n.createdAt)}</span>
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
                {!n.cleared && <SnoozeButton snoozed={tab === 'later'} onSnooze={(d) => snooze(n.id, d)} />}
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

function SnoozeButton({ snoozed, onSnooze }: { snoozed: boolean; onSnooze: (d: Date | null) => void }) {
  const pop = usePopover()
  if (snoozed)
    return (
      <button onClick={(e) => (e.stopPropagation(), onSnooze(null))} className="hover-surface text-muted rounded p-1" title="Unsnooze">
        <RotateCcw size={15} />
      </button>
    )
  return (
    <>
      <button onClick={pop.toggle} className="hover-surface text-muted rounded p-1" title="Snooze">
        <AlarmClock size={15} />
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} align="end" width={210}>
        <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">Snooze until</div>
        {SNOOZE_OPTIONS.map((o) => (
          <MenuItem key={o.label} onClick={() => (onSnooze(o.at()), pop.close())}>
            <span className="flex-1">{o.label}</span>
            <span className="text-faint text-xs">{format(o.at(), 'EEE h a')}</span>
          </MenuItem>
        ))}
      </Popover>
    </>
  )
}
