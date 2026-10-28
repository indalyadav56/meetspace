import { useNavigate } from 'react-router-dom'
import { useQueryState } from '../../lib/useQueryState'
import { format, parseISO } from 'date-fns'
import { AlarmClock, AlertTriangle, AtSign, CalendarClock, Check, CheckCheck, ExternalLink, Inbox as InboxIcon, MessageSquare, RotateCcw, Timer, UserPlus, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Avatar, MenuItem, Popover, usePopover } from '../components/ui'
import { SNOOZE_OPTIONS, useSnoozed } from '../inbox/snooze'
import { SECTIONS, completeItem, useInbox, useInboxDone, type InboxItem, type InboxKind } from '../inbox/items'
import { cn, friendlyDate, timeAgo } from '../../lib/utils'

const ICON: Record<InboxKind, typeof InboxIcon> = {
  overdue: AlertTriangle,
  today: CalendarClock,
  assigned: UserPlus,
  mention: AtSign,
  comment: MessageSquare,
  reminder: AlarmClock,
  approval: Timer,
}
const TONE: Record<InboxKind, string> = {
  overdue: 'text-red-500',
  today: 'text-amber-500',
  assigned: 'text-brand-600',
  mention: 'text-violet-500',
  comment: 'text-sky-500',
  reminder: 'text-orange-500',
  approval: 'text-emerald-600',
}
const DONE_LABEL: Partial<Record<InboxKind, string>> = { overdue: 'Complete task', today: 'Complete task', assigned: 'Complete task', comment: 'Resolve comment', reminder: 'Complete reminder' }

type Tab = 'todo' | 'later' | 'done'
const TABS: { key: Tab; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'later', label: 'Later' },
  { key: 'done', label: 'Done' },
]

/** Inbox: the things that need you — not a copy of the notification feed. */
export default function Inbox() {
  const nav = useNavigate()
  const s = useStore()
  const [tab, setTab] = useQueryState<Tab>('tab', 'todo')
  const [kind, setKind] = useQueryState<'all' | InboxKind>('kind', 'all')
  const inbox = useInbox()
  const { snooze } = useSnoozed()
  const { setDone } = useInboxDone()
  const list = tab === 'todo' ? inbox.todo : tab === 'later' ? inbox.later : inbox.done
  const shown = list.filter((it) => kind === 'all' || it.kind === kind)

  const open = (it: InboxItem) => {
    if (it.notificationId) s.markRead(it.notificationId)
    if (it.taskId) s.openTask(it.taskId)
    else if (it.kind === 'approval') nav('/app/timesheets?tab=approvals')
  }
  // Inbox triage is separate from the notification feed: clearing here never deletes a notification.
  const dismiss = (it: InboxItem) => {
    setDone(it.key, true)
    if (it.notificationId) s.markRead(it.notificationId)
  }
  const restore = (it: InboxItem) => setDone(it.key, false)

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 px-4">
        <InboxIcon size={18} className="text-brand-600" />
        <h1 className="text-base font-semibold">Inbox</h1>
        <span className="text-muted hidden text-sm sm:inline">— what needs you</span>
        {tab === 'todo' && shown.length > 0 && (
          <button onClick={() => shown.forEach(dismiss)} className="border-app hover-surface ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium">
            <CheckCheck size={14} /> Clear {kind === 'all' ? 'all' : 'these'}
          </button>
        )}
      </div>
      <div className="border-app flex items-center gap-1 border-b px-4">
        {TABS.map((t) => {
          const n = t.key === 'todo' ? inbox.todo.length : t.key === 'later' ? inbox.later.length : 0
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn('relative flex h-10 items-center gap-1.5 px-2.5 text-[13px] font-medium', tab === t.key ? 'after:bg-brand-600 after:absolute after:inset-x-1 after:bottom-0 after:h-0.5' : 'text-muted')}
            >
              {t.label}
              {n > 0 && <span className={cn('rounded-full px-1.5 text-[10px] font-bold text-white', t.key === 'todo' ? 'bg-red-500' : 'bg-stone-400')}>{n}</span>}
            </button>
          )
        })}
      </div>
      <div className="border-app flex flex-wrap gap-1.5 border-b px-4 py-2">
        <Chip on={kind === 'all'} onClick={() => setKind('all')} label="All" n={list.length} />
        {SECTIONS.map((sec) => {
          const n = list.filter((it) => it.kind === sec.kind).length
          return n > 0 || kind === sec.kind ? <Chip key={sec.kind} on={kind === sec.kind} onClick={() => setKind(sec.kind)} label={sec.label} n={n} /> : null
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        {shown.length === 0 && (
          <div className="text-muted flex flex-col items-center gap-2 p-16 text-center text-sm">
            <CheckCheck size={32} className="text-emerald-500" />
            {tab === 'todo' ? (
              <>
                <span className="text-app font-semibold">You’re all caught up</span>
                Tasks due today, overdue work, mentions, assigned comments and reminders land here.
              </>
            ) : tab === 'later' ? (
              'Nothing snoozed. Snooze an item to bring it back later.'
            ) : (
              'Items you complete or clear show up here.'
            )}
          </div>
        )}
        {SECTIONS.map((sec) => {
          const items = shown.filter((it) => it.kind === sec.kind).sort((a, b) => (tab === 'later' ? inbox.until[a.key].localeCompare(inbox.until[b.key]) : sec.kind === 'overdue' ? a.at.localeCompare(b.at) : b.at.localeCompare(a.at)))
          if (!items.length) return null
          const Icon = ICON[sec.kind]
          return (
            <section key={sec.kind}>
              <h2 className="surface-subtle text-muted sticky top-0 z-[1] flex items-center gap-2 px-4 py-1.5 text-[11px] font-semibold tracking-wide uppercase">
                <Icon size={13} className={TONE[sec.kind]} /> {sec.label}
                <span className="font-normal">{items.length}</span>
              </h2>
              {items.map((it) => (
                <div key={it.key} onClick={() => open(it)} className="group border-app hover-surface flex cursor-pointer items-start gap-3 border-b px-4 py-2.5">
                  {it.actorId ? (
                    <Avatar userId={it.actorId} size={30} />
                  ) : (
                    <span className="surface-muted flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full">
                      <Icon size={15} className={TONE[it.kind]} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="truncate font-semibold">{it.title}</span>
                      <span className={cn('ml-auto shrink-0 text-xs', it.kind === 'overdue' && tab === 'todo' ? 'font-medium text-red-500' : 'text-faint')}>
                        {tab === 'later' ? `Back ${format(parseISO(inbox.until[it.key]), 'EEE h:mm a')}` : it.kind === 'overdue' || it.kind === 'today' ? friendlyDate(it.at.slice(0, 10)) : it.kind === 'reminder' ? format(parseISO(it.at), 'h:mm a') : timeAgo(it.at)}
                      </span>
                    </div>
                    {it.detail && (
                      <div className="text-muted mt-0.5 truncate text-[13px]">
                        <ActorText actorName={it.kind === 'comment' ? undefined : s.users.find((u) => u.id === it.actorId)?.name} text={it.detail} />
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                    {tab === 'done' ? (
                      <IconBtn label="Move back to To do" onClick={() => restore(it)}>
                        <RotateCcw size={15} />
                      </IconBtn>
                    ) : (
                      <>
                        {DONE_LABEL[it.kind] && (
                          <IconBtn label={DONE_LABEL[it.kind]!} onClick={() => (completeItem(it), s.toast(`${DONE_LABEL[it.kind]!.split(' ')[0]}d “${it.title.slice(0, 40)}”`))} tone="hover:text-emerald-600">
                            <Check size={15} />
                          </IconBtn>
                        )}
                        {it.taskId && (
                          <IconBtn label="Open" onClick={() => open(it)}>
                            <ExternalLink size={15} />
                          </IconBtn>
                        )}
                        {tab === 'later' ? (
                          <IconBtn label="Unsnooze" onClick={() => snooze(it.key, null)}>
                            <RotateCcw size={15} />
                          </IconBtn>
                        ) : (
                          <SnoozeButton onSnooze={(d) => snooze(it.key, d)} />
                        )}
                        <IconBtn label="Clear from Inbox" onClick={() => dismiss(it)}>
                          <X size={15} />
                        </IconBtn>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}

/** Bolds the actor's name, whether or not the text already starts with it. */
export function ActorText({ actorName, text }: { actorName?: string; text: string }) {
  if (!actorName) return <>{text}</>
  const rest = text.startsWith(actorName) ? text.slice(actorName.length) : ` ${text}`
  return (
    <>
      <b className="text-app font-medium">{actorName}</b>
      {rest}
    </>
  )
}

function Chip({ on, onClick, label, n }: { on: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button onClick={onClick} className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium', on ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-100' : 'border-app text-muted hover:text-app')}>
      {label} <span className="opacity-60">{n}</span>
    </button>
  )
}

function IconBtn({ label, onClick, tone, children }: { label: string; onClick: () => void; tone?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn('hover-surface text-muted rounded p-1', tone)} title={label} aria-label={label}>
      {children}
    </button>
  )
}

function SnoozeButton({ onSnooze }: { onSnooze: (d: Date | null) => void }) {
  const pop = usePopover()
  return (
    <>
      <button onClick={pop.toggle} className="hover-surface text-muted rounded p-1" title="Snooze" aria-label="Snooze">
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
