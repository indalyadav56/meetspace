import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { addDays, format, isSameDay, isToday, parseISO, setHours, startOfDay, startOfWeek } from 'date-fns'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, LayoutGrid, List as ListIcon, Lock, Pause, Play, Plus, RotateCcw, Search, Send, Timer, Trash2, Undo2, Users, X } from 'lucide-react'
import { formatMinutes, useMe, useStore } from '../../store/useStore'
import type { ID, Task, TimeEntry, Timesheet, TimesheetStatus } from '../../store/types'
import { Avatar, Popover, usePopover } from '../components/ui'
import { clock, useElapsed } from '../task/TaskExtras'
import { useQueryState } from '../../lib/useQueryState'
import { cn, toISODate } from '../../lib/utils'

/*
 * Weekly timesheets (Monday–Sunday): fill in hours per task and day, submit the
 * week, and owners/admins approve it or send it back. Submitted and approved
 * weeks are read-only until reopened.
 */

type Tab = 'mine' | 'all' | 'approvals'
type View = 'grid' | 'entries'

const weekKey = (d: Date) => toISODate(d)
const mondayOf = (d: Date) => startOfWeek(d, { weekStartsOn: 1 })

/** "1h 30m", "1.5", "90m", "1:30" → minutes. */
function parseDuration(raw: string): number | null {
  const v = raw.trim().toLowerCase()
  if (!v) return 0
  const hm = v.match(/^(\d+):(\d{1,2})$/)
  if (hm) return Number(hm[1]) * 60 + Number(hm[2])
  const m = v.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/)
  if (m && (m[1] || m[2])) return Math.round(Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0))
  if (/^\d+(?:\.\d+)?$/.test(v)) return Math.round(Number(v) * 60)
  return null
}

const STATUS: Record<TimesheetStatus, { label: string; cls: string }> = {
  open: { label: 'Not submitted', cls: 'surface-muted text-muted' },
  submitted: { label: 'Awaiting approval', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200' },
  approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200' },
  rejected: { label: 'Returned', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200' },
}

function StatusChip({ status }: { status: TimesheetStatus }) {
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS[status].cls)}>{STATUS[status].label}</span>
}

export default function TimesheetsPage() {
  const s = useStore()
  const me = useMe()
  const [tab, setTab] = useQueryState<Tab>('tab', 'mine')
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [viewing, setViewing] = useState<ID | null>(null) // someone else's sheet, opened from All/Approvals
  const ws = s.workspaces.find((w) => w.id === s.currentWorkspaceId)
  const myRole = ws?.members.find((m) => m.userId === me.id)?.role
  const isManager = myRole === 'owner' || myRole === 'admin'
  const sheetOf = (userId: ID, week: Date): Timesheet | undefined => s.timesheets.find((t) => t.userId === userId && t.weekStart === weekKey(week))
  const pending = s.timesheets.filter((t) => t.status === 'submitted')

  const tabs: { key: Tab; label: string; icon: typeof Timer; badge?: number }[] = [
    { key: 'mine', label: 'My timesheet', icon: Timer },
    { key: 'all', label: 'All timesheets', icon: Users },
    { key: 'approvals', label: 'Approvals', icon: Check, badge: isManager ? pending.length : undefined },
  ]

  return (
    <div className="flex h-full flex-col">
      <header className="border-app flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 pt-3 sm:px-6">
        <h1 className="flex items-center gap-2 pb-3 text-lg font-bold">
          <Timer size={19} className="text-brand-600" /> Timesheets
        </h1>
        <nav className="flex gap-1" role="tablist">
          {tabs.map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => (setTab(key), setViewing(null))}
              className={cn('-mb-px flex items-center gap-1.5 border-b-2 px-2.5 pb-3 text-sm font-medium', tab === key ? 'border-brand-600 text-app' : 'text-muted border-transparent hover:text-[var(--text)]')}
            >
              <Icon size={15} /> {label}
              {!!badge && <span className="bg-brand-600 rounded-full px-1.5 text-[10px] font-bold text-white">{badge}</span>}
            </button>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        <div className="mx-auto max-w-6xl p-4 sm:p-6">
          {tab === 'approvals' ? (
            <Approvals isManager={isManager} onView={(userId, week) => (setWeekStart(parseISO(week)), setViewing(userId), setTab('all'))} />
          ) : (
            <>
              <WeekBar weekStart={weekStart} onChange={setWeekStart} />
              {tab === 'mine' && <MySheet weekStart={weekStart} sheet={sheetOf(me.id, weekStart)} />}
              {tab === 'all' &&
                (viewing ? (
                  <PersonSheet userId={viewing} weekStart={weekStart} sheet={sheetOf(viewing, weekStart)} isManager={isManager} onBack={() => setViewing(null)} />
                ) : (
                  <Everyone weekStart={weekStart} sheetOf={sheetOf} onOpen={setViewing} />
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------- week navigation ---------------- */

function WeekBar({ weekStart, onChange }: { weekStart: Date; onChange: (d: Date) => void }) {
  const pick = usePopover()
  const thisWeek = mondayOf(new Date())
  return (
    <div className="mb-5 flex items-center gap-1">
      <button onClick={() => onChange(addDays(weekStart, -7))} className="hover-surface rounded-md p-1.5" aria-label="Previous week">
        <ChevronLeft size={17} />
      </button>
      <button onClick={() => onChange(addDays(weekStart, 7))} className="hover-surface rounded-md p-1.5" aria-label="Next week">
        <ChevronRight size={17} />
      </button>
      <button onClick={pick.toggle} className="hover-surface ml-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-xl font-semibold tracking-tight">
        {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), weekStart.getMonth() === addDays(weekStart, 6).getMonth() ? 'd' : 'MMM d')}
        <ChevronDown size={16} className="text-muted" />
      </button>
      {weekKey(weekStart) !== weekKey(thisWeek) && (
        <button onClick={() => onChange(thisWeek)} className="text-brand-600 ml-2 text-sm font-medium hover:underline">
          This week
        </button>
      )}
      <Popover open={pick.open} anchor={pick.anchor} onClose={pick.close} width={220}>
        {[
          ['This week', thisWeek],
          ['Last week', addDays(thisWeek, -7)],
          ['Two weeks ago', addDays(thisWeek, -14)],
        ].map(([label, d]) => (
          <button key={label as string} onClick={() => (onChange(d as Date), pick.close())} className="hover-surface flex w-full rounded-md px-2 py-1.5 text-left text-sm">
            {label as string}
          </button>
        ))}
        <label className="border-app mt-1 block border-t px-2 pt-2 pb-1 text-xs">
          <span className="text-faint">Jump to a date</span>
          <input type="date" onChange={(e) => e.target.value && (onChange(mondayOf(parseISO(e.target.value))), pick.close())} className="border-app surface mt-1 w-full rounded-md border px-2 py-1 text-sm" />
        </label>
      </Popover>
    </div>
  )
}

/* ---------------- my timesheet ---------------- */

function useWeekEntries(userId: ID, weekStart: Date) {
  const timeEntries = useStore((s) => s.timeEntries)
  return useMemo(() => timeEntries.filter((e) => e.userId === userId && parseISO(e.start) >= weekStart && parseISO(e.start) < addDays(weekStart, 7)), [timeEntries, userId, weekStart])
}

/** Task rows added to a week before any time is logged (kept in this browser). */
function usePinnedRows(weekStart: Date) {
  const key = `meetspace.timesheet.rows.${weekKey(weekStart)}`
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '[]') as ID[]
    } catch {
      return []
    }
  }
  const [rows, setRows] = useState<ID[]>(read)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setRows(read()), [key])
  const save = (next: ID[]) => {
    setRows(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* storage unavailable: rows last until reload */
    }
  }
  return [rows, (ids: ID[]) => save([...new Set([...rows, ...ids])]), (id: ID) => save(rows.filter((r) => r !== id))] as const
}

function MySheet({ weekStart, sheet }: { weekStart: Date; sheet?: Timesheet }) {
  const s = useStore()
  const me = useMe()
  const [view, setView] = useQueryState<View>('view', 'grid')
  const entries = useWeekEntries(me.id, weekStart)
  const [pinned, pin, unpin] = usePinnedRows(weekStart)
  const status = sheet?.status ?? 'open'
  const locked = status === 'submitted' || status === 'approved'
  const total = entries.reduce((a, e) => a + e.duration, 0)
  const lastWeek = useWeekEntries(me.id, addDays(weekStart, -7))
  const picker = usePopover()
  const [pickerMode, setPickerMode] = useState<'add' | 'timer'>('add')
  const running = s.timer ? s.tasks.find((t) => t.id === s.timer!.taskId) : undefined
  const sec = useElapsed(s.timer?.start)

  const rowIds = useMemo(() => [...new Set([...entries.map((e) => e.taskId), ...pinned])], [entries, pinned])
  const myOpen = s.tasks.filter((t) => !t.parentId && t.assignees.includes(me.id))

  const quick: { label: string; hint: string; icon: typeof Users; disabled?: boolean; run: (e: React.MouseEvent<HTMLElement>) => void }[] = [
    { label: 'All assigned tasks', hint: `${myOpen.length} task${myOpen.length === 1 ? '' : 's'}`, icon: Users, disabled: !myOpen.length, run: () => pin(myOpen.map((t) => t.id)) },
    { label: 'Last week’s tasks', hint: `${new Set(lastWeek.map((e) => e.taskId)).size} with time`, icon: Copy, disabled: !lastWeek.length, run: () => pin([...new Set(lastWeek.map((e) => e.taskId))]) },
    { label: 'Pick tasks', hint: 'Search any task', icon: Plus, run: (e) => (setPickerMode('add'), picker.toggle(e)) },
    { label: 'Track time', hint: 'Start a timer', icon: Play, run: (e) => (setPickerMode('timer'), picker.toggle(e)) },
  ]

  return (
    <>
      {running && (
        <div className="bg-brand-600 mb-4 flex items-center gap-3 rounded-xl px-4 py-3 text-white">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
          <button onClick={() => s.openTask(running.id)} className="min-w-0 truncate font-semibold hover:underline">
            {running.title}
          </button>
          <span className="ml-auto font-mono text-lg tabular-nums">{clock(sec)}</span>
          <button onClick={s.stopTimer} className="flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold hover:bg-white/30">
            <Pause size={14} /> Stop
          </button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusChip status={status} />
        <span className="text-muted text-sm">
          {formatMinutes(total)} this week{locked && ' · read-only'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="surface-muted flex rounded-lg p-0.5 text-sm">
            {(
              [
                ['grid', 'Timesheet', LayoutGrid],
                ['entries', 'Time entries', ListIcon],
              ] as const
            ).map(([key, label, Icon]) => (
              <button key={key} onClick={() => setView(key)} className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1', view === key ? 'surface shadow-sm font-medium' : 'text-muted')}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          {status === 'open' || status === 'rejected' ? (
            <button disabled={!entries.length} onClick={() => s.submitTimesheet(weekKey(weekStart))} className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40" title={entries.length ? 'Send this week for approval' : 'Log some time first'}>
              <Send size={14} /> Submit week
            </button>
          ) : status === 'submitted' ? (
            <button onClick={() => s.reopenTimesheet(me.id, weekKey(weekStart))} className="border-app hover-surface flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium">
              <Undo2 size={14} /> Withdraw
            </button>
          ) : null}
        </div>
      </div>

      {status === 'rejected' && sheet?.note && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">
          Returned by {s.users.find((u) => u.id === sheet.decidedBy)?.name ?? 'an admin'}: “{sheet.note}”. Fix it and submit again.
        </p>
      )}
      {status === 'approved' && (
        <p className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
          <Lock size={14} /> Approved by {s.users.find((u) => u.id === sheet?.decidedBy)?.name ?? 'an admin'}{sheet?.decidedAt && ` on ${format(parseISO(sheet.decidedAt), 'MMM d')}`}. Ask an admin to reopen it if something changed.
        </p>
      )}

      {view === 'grid' ? (
        rowIds.length === 0 && !locked ? (
          <div className="border-app flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center">
            <span className="bg-brand-50 text-brand-600 dark:bg-brand-500/15 flex h-14 w-14 items-center justify-center rounded-2xl">
              <CalendarDays size={26} />
            </span>
            <h2 className="mt-4 text-lg font-semibold">Start this week’s timesheet</h2>
            <p className="text-muted mt-1 text-sm">Add the tasks you worked on, then type hours into each day.</p>
            <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-4">
              {quick.map(({ label, hint, icon: Icon, disabled, run }) => (
                <button key={label} disabled={disabled} onClick={run} className="border-app hover-surface flex flex-col items-start gap-2 rounded-xl border p-3 text-left disabled:opacity-40">
                  <span className="surface-muted text-brand-600 flex h-8 w-8 items-center justify-center rounded-lg">
                    <Icon size={16} />
                  </span>
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-faint text-xs">{hint}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Grid userId={me.id} weekStart={weekStart} entries={entries} rowIds={rowIds} locked={locked} onRemoveRow={unpin} onAddRow={(e) => (setPickerMode('add'), picker.toggle(e))} />
        )
      ) : (
        <EntryList entries={entries} weekStart={weekStart} locked={locked} />
      )}

      <Popover open={picker.open} anchor={picker.anchor} onClose={picker.close} width={320}>
        <TaskPicker
          title={pickerMode === 'timer' ? 'Start a timer on…' : 'Add tasks to this week'}
          exclude={pickerMode === 'add' ? rowIds : []}
          onPick={(t) => {
            if (pickerMode === 'timer') {
              s.startTimer(t.id)
              pin([t.id])
              picker.close()
            } else pin([t.id])
          }}
        />
      </Popover>
    </>
  )
}

function TaskPicker({ title, exclude, onPick }: { title: string; exclude: ID[]; onPick: (t: Task) => void }) {
  const s = useStore()
  const me = useMe()
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const needle = q.toLowerCase()
    return s.tasks
      .filter((t) => !t.parentId && !exclude.includes(t.id) && (needle ? t.title.toLowerCase().includes(needle) || `ms-${t.key}`.includes(needle) : t.assignees.includes(me.id)))
      .slice(0, 8)
  }, [q, s.tasks, exclude, me.id])
  return (
    <div className="p-1">
      <div className="px-1 pb-1.5 text-xs font-semibold">{title}</div>
      <div className="border-app flex items-center gap-2 rounded-md border px-2">
        <Search size={14} className="text-faint" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks or MS-12" className="h-8 flex-1 bg-transparent text-sm outline-none" />
      </div>
      <div className="mt-1 max-h-64 overflow-y-auto">
        {!q && <div className="text-faint px-2 py-1 text-[11px]">Assigned to you</div>}
        {list.map((t) => (
          <button key={t.id} onClick={() => onPick(t)} className="hover-surface flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm">
            <span className="text-faint shrink-0 text-xs">MS-{t.key}</span>
            <span className="truncate">{t.title}</span>
          </button>
        ))}
        {list.length === 0 && <div className="text-muted px-2 py-4 text-center text-xs">No tasks found.</div>}
      </div>
    </div>
  )
}

/* ---------------- the grid ---------------- */

function Grid({ userId, weekStart, entries, rowIds, locked, onRemoveRow, onAddRow }: { userId: ID; weekStart: Date; entries: TimeEntry[]; rowIds: ID[]; locked: boolean; onRemoveRow?: (id: ID) => void; onAddRow?: (e: React.MouseEvent<HTMLElement>) => void }) {
  const s = useStore()
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const cell = (taskId: ID, i: number) => entries.filter((e) => e.taskId === taskId && isSameDay(parseISO(e.start), days[i]))
  const dayTotals = days.map((_, i) => entries.filter((e) => isSameDay(parseISO(e.start), days[i])).reduce((a, e) => a + e.duration, 0))
  const total = dayTotals.reduce((a, b) => a + b, 0)
  const editable = !locked && userId === s.currentUserId

  // Make a day's total for a task equal `minutes`, reusing existing entries where possible.
  const setDay = (taskId: ID, i: number, minutes: number) => {
    const existing = cell(taskId, i)
    const current = existing.reduce((a, e) => a + e.duration, 0)
    if (minutes === current) return
    if (minutes === 0) return existing.forEach((e) => s.deleteTimeEntry(e.id))
    if (!existing.length) return s.addTimeEntry({ taskId, start: setHours(startOfDay(days[i]), 9).toISOString(), duration: minutes, note: '' })
    const [first, ...rest] = existing
    rest.forEach((e) => s.deleteTimeEntry(e.id))
    s.updateTimeEntry(first.id, { duration: minutes })
  }

  const th = 'surface-subtle border-app border-b px-2 py-2 text-[11px] font-semibold uppercase text-faint'
  return (
    <div className="border-app overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[860px] border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className={cn(th, 'pl-4 text-left')}>Task</th>
            {days.map((d) => (
              <th key={d.toISOString()} className={cn(th, 'w-[84px] text-center', isToday(d) && 'text-brand-600')}>
                {format(d, 'EEE')}
                <span className="block text-[13px] font-semibold normal-case">{format(d, 'd')}</span>
              </th>
            ))}
            <th className={cn(th, 'w-24 pr-4 text-right')}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rowIds.map((taskId) => {
            const task = s.tasks.find((t) => t.id === taskId)
            const mins = days.map((_, i) => cell(taskId, i).reduce((a, e) => a + e.duration, 0))
            const rowTotal = mins.reduce((a, b) => a + b, 0)
            return (
              <tr key={taskId} className="group">
                <td className="border-app border-b py-1.5 pr-2 pl-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => task && s.openTask(task.id)} className="min-w-0 truncate text-left font-medium hover:underline">
                      {task?.title ?? 'Deleted task'}
                    </button>
                    {editable && onRemoveRow && rowTotal === 0 && (
                      <button onClick={() => onRemoveRow(taskId)} className="text-faint hidden hover:text-red-500 group-hover:block" aria-label="Remove row">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  <span className="text-faint text-xs">
                    {task && `MS-${task.key} · `}
                    {s.lists.find((l) => l.id === task?.listId)?.name}
                  </span>
                </td>
                {mins.map((m, i) => (
                  <td key={i} className={cn('border-app border-b px-1 py-1 text-center', isToday(days[i]) && 'bg-brand-50/40 dark:bg-brand-500/5')}>
                    {editable ? <HoursCell minutes={m} onCommit={(v) => setDay(taskId, i, v)} /> : <span className={cn('tabular-nums', !m && 'text-faint')}>{m ? formatMinutes(m) : '–'}</span>}
                  </td>
                ))}
                <td className="border-app border-b pr-4 text-right font-semibold tabular-nums">{rowTotal ? formatMinutes(rowTotal) : '–'}</td>
              </tr>
            )
          })}
          {editable && onAddRow && (
            <tr>
              <td colSpan={9} className="border-app border-b px-4 py-2">
                <button onClick={onAddRow} className="text-muted hover:text-brand-600 flex items-center gap-1.5 text-sm">
                  <Plus size={14} /> Add task
                </button>
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="surface-subtle font-semibold">
            <td className="py-2 pl-4">Total</td>
            {dayTotals.map((m, i) => (
              <td key={i} className={cn('py-2 text-center tabular-nums', m > 8 * 60 && 'text-accent-600')} title={m > 8 * 60 ? 'More than 8 hours' : undefined}>
                {m ? formatMinutes(m) : '–'}
              </td>
            ))}
            <td className="py-2 pr-4 text-right tabular-nums">{formatMinutes(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function HoursCell({ minutes, onCommit }: { minutes: number; onCommit: (m: number) => void }) {
  const shown = minutes ? formatMinutes(minutes) : ''
  const [draft, setDraft] = useState(shown)
  const [bad, setBad] = useState(false)
  useEffect(() => setDraft(shown), [shown])
  const commit = () => {
    const m = parseDuration(draft)
    if (m === null || m > 24 * 60) {
      setBad(true)
      return
    }
    setBad(false)
    if (m !== minutes) onCommit(m)
  }
  return (
    <input
      value={draft}
      onChange={(e) => (setDraft(e.target.value), setBad(false))}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      placeholder="–"
      aria-label="Hours"
      title={bad ? 'Use a format like 1h 30m, 1.5 or 1:30' : 'Type hours, e.g. 1h 30m'}
      className={cn('hover:border-app focus:border-brand-500 h-8 w-full rounded-md border border-transparent bg-transparent text-center tabular-nums outline-none placeholder:text-[var(--text-faint)]', bad && 'border-red-400')}
    />
  )
}

/* ---------------- time entries ---------------- */

function EntryList({ entries, weekStart, locked }: { entries: TimeEntry[]; weekStart: Date; locked: boolean }) {
  const s = useStore()
  const me = useMe()
  const [taskId, setTaskId] = useState(s.tasks.find((t) => t.assignees.includes(me.id))?.id ?? s.tasks[0]?.id ?? '')
  const [date, setDate] = useState(toISODate(isSameDay(mondayOf(new Date()), weekStart) ? new Date() : weekStart))
  const [dur, setDur] = useState('')
  const [note, setNote] = useState('')
  const sorted = [...entries].sort((a, b) => b.start.localeCompare(a.start))
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="border-app rounded-xl border">
        <h2 className="border-app flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold">
          <Clock size={15} /> {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
        </h2>
        <div className="divide-y divide-[var(--border)]">
          {sorted.map((e) => (
            <div key={e.id} className="group flex items-center gap-3 px-4 py-2 text-[13px]">
              <span className="w-20 shrink-0 font-semibold tabular-nums">{formatMinutes(e.duration)}</span>
              <span className="min-w-0 flex-1 truncate">
                {s.tasks.find((t) => t.id === e.taskId)?.title ?? 'Deleted task'}
                {e.note && <span className="text-faint"> · {e.note}</span>}
              </span>
              <span className="text-faint shrink-0 text-xs">{format(parseISO(e.start), 'EEE, MMM d')}</span>
              {!locked && (
                <button onClick={() => s.deleteTimeEntry(e.id)} className="text-faint hidden hover:text-red-500 group-hover:block" aria-label="Delete entry">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {!entries.length && <p className="text-muted p-8 text-center text-sm">No time logged this week.</p>}
        </div>
      </div>
      {!locked && (
        <form
          className="border-app h-fit space-y-3 rounded-xl border p-4"
          onSubmit={(e) => {
            e.preventDefault()
            const minutes = parseDuration(dur)
            if (!minutes || !taskId) return
            s.addTimeEntry({ taskId, start: setHours(startOfDay(parseISO(date)), 9).toISOString(), duration: minutes, note })
            setDur('')
            setNote('')
          }}
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Plus size={15} /> Log time
          </h2>
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="border-app surface w-full rounded-md border px-2 py-1.5 text-sm" aria-label="Task">
            {s.tasks
              .filter((t) => !t.parentId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  MS-{t.key} {t.title}
                </option>
              ))}
          </select>
          <div className="flex gap-2">
            <input type="date" value={date} min={toISODate(weekStart)} max={toISODate(addDays(weekStart, 6))} onChange={(e) => setDate(e.target.value)} className="border-app surface flex-1 rounded-md border px-2 py-1.5 text-sm" aria-label="Date" />
            <input value={dur} onChange={(e) => setDur(e.target.value)} placeholder="1h 30m" className="border-app surface w-24 rounded-md border px-2 py-1.5 text-sm" aria-label="Duration" />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you work on? (optional)" className="border-app surface w-full rounded-md border px-2 py-1.5 text-sm" />
          <button disabled={!parseDuration(dur)} className="bg-brand-600 hover:bg-brand-700 w-full rounded-md py-1.5 text-sm font-semibold text-white disabled:opacity-40">
            Log time
          </button>
        </form>
      )}
    </div>
  )
}

/* ---------------- everyone ---------------- */

function Everyone({ weekStart, sheetOf, onOpen }: { weekStart: Date; sheetOf: (u: ID, w: Date) => Timesheet | undefined; onOpen: (u: ID) => void }) {
  const s = useStore()
  const ws = s.workspaces.find((w) => w.id === s.currentWorkspaceId)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const rows = (ws?.members ?? []).map((m) => {
    const mine = s.timeEntries.filter((e) => e.userId === m.userId && parseISO(e.start) >= weekStart && parseISO(e.start) < addDays(weekStart, 7))
    const perDay = days.map((d) => mine.filter((e) => isSameDay(parseISO(e.start), d)).reduce((a, e) => a + e.duration, 0))
    return { userId: m.userId, perDay, total: perDay.reduce((a, b) => a + b, 0), status: sheetOf(m.userId, weekStart)?.status ?? 'open' }
  })
  const th = 'surface-subtle border-app border-b px-2 py-2 text-[11px] font-semibold uppercase text-faint'
  return (
    <div className="border-app overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[860px] border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className={cn(th, 'pl-4 text-left')}>Person</th>
            {days.map((d) => (
              <th key={d.toISOString()} className={cn(th, 'w-20 text-center')}>
                {format(d, 'EEE d')}
              </th>
            ))}
            <th className={cn(th, 'w-24 text-right')}>Total</th>
            <th className={cn(th, 'w-40 pr-4 text-right')}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const user = s.users.find((u) => u.id === r.userId)
            return (
              <tr key={r.userId} onClick={() => onOpen(r.userId)} className="hover-surface cursor-pointer">
                <td className="border-app border-b py-2 pl-4">
                  <span className="flex items-center gap-2 font-medium">
                    <Avatar userId={r.userId} size={24} /> {user?.name ?? 'Member'}
                  </span>
                </td>
                {r.perDay.map((m, i) => (
                  <td key={i} className={cn('border-app border-b text-center tabular-nums', !m && 'text-faint')}>
                    {m ? formatMinutes(m) : '–'}
                  </td>
                ))}
                <td className="border-app border-b text-right font-semibold tabular-nums">{formatMinutes(r.total)}</td>
                <td className="border-app border-b pr-4 text-right">
                  <StatusChip status={r.status} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PersonSheet({ userId, weekStart, sheet, isManager, onBack }: { userId: ID; weekStart: Date; sheet?: Timesheet; isManager: boolean; onBack: () => void }) {
  const s = useStore()
  const entries = useWeekEntries(userId, weekStart)
  const rowIds = [...new Set(entries.map((e) => e.taskId))]
  const user = s.users.find((u) => u.id === userId)
  const status = sheet?.status ?? 'open'
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={onBack} className="hover-surface text-muted flex items-center gap-1 rounded-md px-2 py-1 text-sm">
          <ChevronLeft size={15} /> Everyone
        </button>
        <span className="flex items-center gap-2 font-semibold">
          <Avatar userId={userId} size={24} /> {user?.name}
        </span>
        <StatusChip status={status} />
        {isManager && <DecisionButtons userId={userId} weekStart={weekKey(weekStart)} status={status} />}
      </div>
      {rowIds.length ? <Grid userId={userId} weekStart={weekStart} entries={entries} rowIds={rowIds} locked /> : <p className="border-app text-muted rounded-xl border border-dashed p-10 text-center text-sm">No time logged this week.</p>}
    </>
  )
}

function DecisionButtons({ userId, weekStart, status }: { userId: ID; weekStart: string; status: TimesheetStatus }) {
  const s = useStore()
  const [returning, setReturning] = useState(false)
  const [note, setNote] = useState('')
  if (status === 'approved' || status === 'rejected')
    return (
      <button onClick={() => s.reopenTimesheet(userId, weekStart)} className="border-app hover-surface ml-auto flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium">
        <RotateCcw size={13} /> Reopen
      </button>
    )
  if (status !== 'submitted') return null
  if (returning)
    return (
      <form className="ml-auto flex items-center gap-1.5" onSubmit={(e) => (e.preventDefault(), s.decideTimesheet(userId, weekStart, false, note.trim()), setReturning(false))}>
        <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="What needs fixing?" className="border-app surface h-7 w-56 rounded-md border px-2 text-xs" />
        <button className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">Return</button>
        <button type="button" onClick={() => setReturning(false)} className="hover-surface rounded-md p-1" aria-label="Cancel">
          <X size={13} />
        </button>
      </form>
    )
  return (
    <span className="ml-auto flex gap-1.5">
      <button onClick={() => setReturning(true)} className="border-app hover-surface rounded-lg border px-2.5 py-1 text-xs font-medium">
        Return
      </button>
      <button onClick={() => s.decideTimesheet(userId, weekStart, true)} className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white">
        <Check size={13} /> Approve
      </button>
    </span>
  )
}

/* ---------------- approvals ---------------- */

function Approvals({ isManager, onView }: { isManager: boolean; onView: (userId: ID, week: string) => void }) {
  const s = useStore()
  const me = useMe()
  const minutesFor = (t: Timesheet) => {
    const start = parseISO(t.weekStart)
    return s.timeEntries.filter((e) => e.userId === t.userId && parseISO(e.start) >= start && parseISO(e.start) < addDays(start, 7)).reduce((a, e) => a + e.duration, 0)
  }
  const visible = isManager ? s.timesheets : s.timesheets.filter((t) => t.userId === me.id)
  const groups: [string, Timesheet[]][] = [
    [isManager ? 'Waiting for you' : 'Waiting for approval', visible.filter((t) => t.status === 'submitted')],
    ['Recently decided', visible.filter((t) => t.status === 'approved' || t.status === 'rejected').slice(0, 20)],
  ]
  return (
    <div className="space-y-8">
      {!isManager && <p className="text-muted text-sm">Owners and admins approve timesheets. Here’s where yours stand.</p>}
      {groups.map(([title, list]) => (
        <section key={title}>
          <h2 className="mb-2 text-sm font-semibold">
            {title} <span className="text-faint font-normal">{list.length}</span>
          </h2>
          <div className="border-app divide-y divide-[var(--border)] rounded-xl border">
            {list.map((t) => (
              <Row key={t.id}>
                <Avatar userId={t.userId} size={28} />
                <button onClick={() => onView(t.userId, t.weekStart)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium">{s.users.find((u) => u.id === t.userId)?.name ?? 'Member'}</span>
                  <span className="text-faint text-xs">
                    Week of {format(parseISO(t.weekStart), 'MMM d')} · {formatMinutes(minutesFor(t))}
                    {t.submittedAt && ` · submitted ${format(parseISO(t.submittedAt), 'MMM d')}`}
                    {t.status === 'rejected' && t.note && ` · “${t.note}”`}
                  </span>
                </button>
                <StatusChip status={t.status} />
                {isManager && <DecisionButtons userId={t.userId} weekStart={t.weekStart} status={t.status} />}
              </Row>
            ))}
            {!list.length && <p className="text-muted p-6 text-center text-sm">{title === groups[0][0] ? 'All caught up.' : 'Nothing yet.'}</p>}
          </div>
        </section>
      ))}
    </div>
  )
}

const Row = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">{children}</div>
