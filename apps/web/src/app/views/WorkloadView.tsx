import { useMemo, useState } from 'react'
import { addDays, format, isToday, isWeekend, parseISO, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, UserX } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { ID, Task } from '../../store/types'
import { useTaskResolver } from '../hooks'
import { Avatar, Popover, usePopover } from '../components/ui'
import { cn, toISODate } from '../../lib/utils'
import type { ViewProps } from './ListView'

type Metric = 'hours' | 'tasks' | 'points'
const UNASSIGNED = '__none'
const METRIC_LABEL: Record<Metric, string> = { hours: 'Time estimate', tasks: 'Task count', points: 'Sprint points' }
const DEFAULT_CAPACITY: Record<Metric, number> = { hours: 8, tasks: 3, points: 3 }

const pref = (k: string, v?: string) => {
  try {
    if (v === undefined) return localStorage.getItem(`ms.workload.${k}`)
    localStorage.setItem(`ms.workload.${k}`, v)
  } catch {
    /* storage blocked */
  }
  return null
}

const fmt = (n: number, m: Metric) => (m === 'hours' ? `${n < 10 ? n.toFixed(1).replace(/\.0$/, '') : Math.round(n)}h` : m === 'tasks' ? `${Math.round(n * 10) / 10}` : `${Math.round(n * 10) / 10} pts`)

/**
 * Spreads each open task's load evenly over the working days between its start and due date,
 * split between its assignees, then sums per person per day.
 */
export default function WorkloadView({ tasks }: ViewProps) {
  const { users, workspaces, currentWorkspaceId } = useStore()
  const r = useTaskResolver()
  const [metric, setMetricState] = useState<Metric>(() => (pref('metric') as Metric) || 'hours')
  const [capacity, setCapacityState] = useState<number>(() => Number(pref(`cap.${metric}`)) || DEFAULT_CAPACITY[metric])
  const [weeks, setWeeksState] = useState(() => Number(pref('weeks')) || 2)
  const [weekends, setWeekendsState] = useState(() => pref('weekends') === '1')
  const [origin, setOrigin] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const setMetric = (m: Metric) => {
    setMetricState(m)
    setCapacityState(Number(pref(`cap.${m}`)) || DEFAULT_CAPACITY[m])
    pref('metric', m)
  }
  const setCapacity = (n: number) => (setCapacityState(n), pref(`cap.${metric}`, String(n)))
  const setWeeks = (n: number) => (setWeeksState(n), pref('weeks', String(n)))
  const setWeekends = (v: boolean) => (setWeekendsState(v), pref('weekends', v ? '1' : '0'))

  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(origin, i)).filter((d) => weekends || !isWeekend(d))
  const members = workspaces.find((w) => w.id === currentWorkspaceId)?.members.map((m) => m.userId) ?? users.map((u) => u.id)
  const people = users.filter((u) => members.includes(u.id))

  const grid = useMemo(() => {
    const m = new Map<string, { load: number; tasks: Task[] }>()
    for (const t of tasks) {
      if (r.isDone(t) || !t.dueDate) continue
      const start = parseISO((t.startDate ?? t.dueDate).slice(0, 10))
      const end = parseISO(t.dueDate.slice(0, 10))
      const span: Date[] = []
      for (let d = start; d <= end; d = addDays(d, 1)) if (!isWeekend(d)) span.push(d)
      if (!span.length) span.push(end)
      const weight = metric === 'hours' ? (t.estimate ?? 1) : metric === 'points' ? (t.points ?? 0) : 1
      if (!weight) continue
      const who = t.assignees.length ? t.assignees : [UNASSIGNED]
      const perDay = weight / span.length / who.length
      for (const u of who)
        for (const d of span) {
          const k = `${u}|${toISODate(d)}`
          const cell = m.get(k) ?? { load: 0, tasks: [] }
          cell.load += perDay
          cell.tasks.push(t)
          m.set(k, cell)
        }
    }
    return m
  }, [tasks, r, metric])

  const hasUnassigned = days.some((d) => grid.has(`${UNASSIGNED}|${toISODate(d)}`))
  const rows: { id: string; name: string }[] = [...people.map((u) => ({ id: u.id, name: u.name })), ...(hasUnassigned ? [{ id: UNASSIGNED, name: 'Unassigned' }] : [])]
  const workDays = days.filter((d) => !isWeekend(d)).length
  const sel = 'border-app surface h-7 rounded-md border px-1.5 text-xs'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-app flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm">
        <span className="font-semibold">
          {format(origin, 'MMM d')} – {format(addDays(origin, weeks * 7 - 1), 'MMM d')}
        </span>
        <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className={sel} aria-label="Measure workload by">
          {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
            <option key={m} value={m}>
              {METRIC_LABEL[m]}
            </option>
          ))}
        </select>
        <label className="text-muted flex items-center gap-1 text-xs">
          Capacity
          <input type="number" min={1} max={99} value={capacity} onChange={(e) => Number(e.target.value) > 0 && setCapacity(Number(e.target.value))} className="border-app surface h-7 w-14 rounded-md border px-1.5 text-xs" aria-label="Capacity per day" />
          {metric === 'hours' ? 'h' : metric === 'tasks' ? 'tasks' : 'pts'}/day
        </label>
        <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className={sel} aria-label="Range">
          <option value={1}>1 week</option>
          <option value={2}>2 weeks</option>
          <option value={4}>4 weeks</option>
        </select>
        <label className="text-muted flex items-center gap-1 text-xs">
          <input type="checkbox" checked={weekends} onChange={(e) => setWeekends(e.target.checked)} className="accent-brand-600 h-3.5 w-3.5" /> Weekends
        </label>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setOrigin(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="border-app hover-surface rounded-md border px-2.5 py-1 text-xs font-medium">
            This week
          </button>
          <button onClick={() => setOrigin((o) => addDays(o, -7))} className="hover-surface rounded-md p-1.5" aria-label="Previous week">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setOrigin((o) => addDays(o, 7))} className="hover-surface rounded-md p-1.5" aria-label="Next week">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto scroll-thin">
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className="surface-subtle border-app sticky top-0 left-0 z-20 w-56 border-r border-b px-3 py-2 text-left text-[11px] font-semibold text-faint uppercase">Person</th>
              {days.map((d) => (
                <th key={d.toISOString()} className={cn('surface-subtle border-app sticky top-0 z-10 border-r border-b px-1 py-1.5 text-center text-[11px] font-medium', isToday(d) && 'text-brand-600', isWeekend(d) && 'text-faint')}>
                  <div>{format(d, 'EEE')}</div>
                  <div className="text-sm font-semibold">{format(d, 'd')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const total = days.reduce((a, d) => a + (grid.get(`${p.id}|${toISODate(d)}`)?.load ?? 0), 0)
              const cap = capacity * workDays
              const pct = cap ? Math.min(1, total / cap) : 0
              return (
                <tr key={p.id}>
                  <td className="surface border-app sticky left-0 z-10 border-r border-b px-3 py-2">
                    <div className="flex items-center gap-2">
                      {p.id === UNASSIGNED ? (
                        <span className="surface-muted text-muted flex h-[26px] w-[26px] items-center justify-center rounded-full">
                          <UserX size={14} />
                        </span>
                      ) : (
                        <Avatar userId={p.id} size={26} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{p.name}</div>
                        {p.id !== UNASSIGNED ? (
                          <div className="flex items-center gap-1.5">
                            <span className="surface-muted h-1 w-16 overflow-hidden rounded-full">
                              <span className={cn('block h-full', total > cap ? 'bg-red-500' : 'bg-emerald-500')} style={{ width: `${pct * 100}%` }} />
                            </span>
                            <span className={cn('text-[11px] tabular-nums', total > cap ? 'text-red-500' : 'text-faint')}>
                              {fmt(total, metric)} / {fmt(cap, metric)}
                            </span>
                          </div>
                        ) : (
                          <div className="text-faint text-[11px]">{fmt(total, metric)} with no owner</div>
                        )}
                      </div>
                    </div>
                  </td>
                  {days.map((d) => (
                    <Cell key={d.toISOString()} cell={grid.get(`${p.id}|${toISODate(d)}`)} weekend={isWeekend(d)} capacity={p.id === UNASSIGNED ? Infinity : capacity} metric={metric} date={d} />
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="text-faint px-4 py-3 text-xs">
          {metric === 'hours' ? 'Tasks without an estimate count as 1h. ' : metric === 'points' ? 'Tasks without points are left out. ' : ''}Load is spread over each task’s working days and split between its assignees. Done tasks and tasks without a due date are excluded.
        </p>
      </div>
    </div>
  )
}

function Cell({ cell, weekend, capacity, metric, date }: { cell?: { load: number; tasks: Task[] }; weekend: boolean; capacity: number; metric: Metric; date: Date }) {
  const openTask = useStore((s) => s.openTask)
  const pop = usePopover()
  const h = cell?.load ?? 0
  const over = h > capacity
  const pct = capacity === Infinity ? 0.5 : Math.min(1, h / capacity)
  const unique = cell ? [...new Map(cell.tasks.map((t) => [t.id as ID, t])).values()] : []
  return (
    <td className={cn('border-app h-16 border-r border-b p-1 align-top', weekend && 'surface-subtle')}>
      {h > 0 && (
        <>
          <button
            onClick={pop.toggle}
            className={cn(
              'flex h-full w-full flex-col justify-between rounded-md p-1 text-left',
              capacity === Infinity ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : over ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
            )}
          >
            <span className="text-xs font-semibold tabular-nums">{fmt(h, metric)}</span>
            <span className="h-1 w-full overflow-hidden rounded bg-black/10">
              <span className={cn('block h-full', over ? 'bg-red-500' : capacity === Infinity ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${pct * 100}%` }} />
            </span>
            <span className="truncate text-[10px] opacity-80">
              {unique.length} task{unique.length > 1 ? 's' : ''}
            </span>
          </button>
          <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={260}>
            <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">{format(date, 'EEE, MMM d')}</div>
            {unique.map((t) => (
              <button key={t.id} onClick={() => (openTask(t.id), pop.close())} className="hover-surface flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm">
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="text-faint shrink-0 text-xs">{metric === 'points' ? `${t.points ?? 0} pts` : `${t.estimate ?? 1}h`}</span>
              </button>
            ))}
          </Popover>
        </>
      )}
    </td>
  )
}
