import { useMemo, useState } from 'react'
import { addDays, format, isToday, isWeekend, parseISO, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { Task } from '../../store/types'
import { useTaskResolver } from '../hooks'
import { Avatar } from '../components/ui'
import { cn, toISODate } from '../../lib/utils'
import type { ViewProps } from './ListView'

const CAPACITY = 8 // hours per working day
const DAYS = 14

/**
 * Spreads each open task's estimate (default 1h) evenly over the working days between its start and due date,
 * then sums per person per day.
 */
export default function WorkloadView({ tasks }: ViewProps) {
  const { users, openTask } = useStore()
  const r = useTaskResolver()
  const [origin, setOrigin] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const days = Array.from({ length: DAYS }, (_, i) => addDays(origin, i))

  const grid = useMemo(() => {
    const m = new Map<string, { hours: number; tasks: Task[] }>()
    for (const t of tasks) {
      if (r.isDone(t) || !t.dueDate) continue
      const start = parseISO(t.startDate ?? t.dueDate)
      const end = parseISO(t.dueDate)
      const span: Date[] = []
      for (let d = start; d <= end; d = addDays(d, 1)) if (!isWeekend(d)) span.push(d)
      if (!span.length) span.push(end)
      const perDay = (t.estimate ?? 1) / span.length / Math.max(1, t.assignees.length)
      for (const u of t.assignees)
        for (const d of span) {
          const k = `${u}|${toISODate(d)}`
          const cell = m.get(k) ?? { hours: 0, tasks: [] }
          cell.hours += perDay
          cell.tasks.push(t)
          m.set(k, cell)
        }
    }
    return m
  }, [tasks, r])

  const unassigned = tasks.filter((t) => !r.isDone(t) && t.assignees.length === 0).length

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-app flex flex-wrap items-center gap-3 border-b px-4 py-2 text-sm">
        <span className="font-semibold">
          {format(origin, 'MMM d')} – {format(addDays(origin, DAYS - 1), 'MMM d')}
        </span>
        <span className="text-muted text-xs">Capacity {CAPACITY}h/day · estimates spread across each task’s dates</span>
        {unassigned > 0 && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{unassigned} open tasks unassigned</span>}
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
        <table className="w-full min-w-[1000px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className="surface-subtle border-app sticky top-0 left-0 z-20 w-48 border-r border-b px-3 py-2 text-left text-[11px] font-semibold text-faint uppercase">Person</th>
              {days.map((d) => (
                <th key={d.toISOString()} className={cn('surface-subtle border-app sticky top-0 z-10 border-r border-b px-1 py-1.5 text-center text-[11px] font-medium', isToday(d) && 'text-brand-600', isWeekend(d) && 'text-faint')}>
                  <div>{format(d, 'EEE')}</div>
                  <div className="text-sm font-semibold">{format(d, 'd')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const total = days.reduce((a, d) => a + (grid.get(`${u.id}|${toISODate(d)}`)?.hours ?? 0), 0)
              return (
                <tr key={u.id}>
                  <td className="surface border-app sticky left-0 z-10 border-r border-b px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar userId={u.id} size={26} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{u.name}</div>
                        <div className="text-faint text-[11px]">{Math.round(total)}h scheduled</div>
                      </div>
                    </div>
                  </td>
                  {days.map((d) => {
                    const cell = grid.get(`${u.id}|${toISODate(d)}`)
                    const h = cell?.hours ?? 0
                    const weekend = isWeekend(d)
                    const pct = Math.min(1, h / CAPACITY)
                    const over = h > CAPACITY
                    return (
                      <td key={d.toISOString()} className={cn('border-app h-16 border-r border-b p-1 align-top', weekend && 'surface-subtle')}>
                        {h > 0 && (
                          <button
                            onClick={() => cell && openTask(cell.tasks[0].id)}
                            title={cell?.tasks.map((t) => t.title).join('\n')}
                            className={cn('flex h-full w-full flex-col justify-between rounded-md p-1 text-left', over ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300')}
                          >
                            <span className="text-xs font-semibold tabular-nums">{h < 10 ? h.toFixed(1) : Math.round(h)}h</span>
                            <span className="h-1 w-full overflow-hidden rounded bg-black/10">
                              <span className={cn('block h-full', over ? 'bg-red-500' : 'bg-emerald-500')} style={{ width: `${pct * 100}%` }} />
                            </span>
                            <span className="truncate text-[10px] opacity-80">{cell!.tasks.length} task{cell!.tasks.length > 1 ? 's' : ''}</span>
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="text-faint px-4 py-3 text-xs">Tip: tasks without a due date or estimate count as 1h on their due day. Done tasks are excluded.</p>
      </div>
    </div>
  )
}
