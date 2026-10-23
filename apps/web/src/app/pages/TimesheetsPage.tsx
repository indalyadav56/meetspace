import { useMemo, useState } from 'react'
import { addDays, format, isSameDay, isToday, parseISO, setHours, startOfDay, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Clock, Pause, Plus, Timer, Trash2 } from 'lucide-react'
import { formatMinutes, useMe, useStore } from '../../store/useStore'
import { Avatar } from '../components/ui'
import { clock, useElapsed } from '../task/TaskExtras'
import { cn, toISODate } from '../../lib/utils'

export default function TimesheetsPage() {
  const { timeEntries, tasks, users, timer, stopTimer, openTask, addTimeEntry, deleteTimeEntry, lists } = useStore()
  const me = useMe()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [who, setWho] = useState<string>(me.id)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const runningTask = timer ? tasks.find((t) => t.id === timer.taskId) : null
  const sec = useElapsed(timer?.start)

  const week = useMemo(
    () => timeEntries.filter((e) => (who === 'all' || e.userId === who) && parseISO(e.start) >= weekStart && parseISO(e.start) < addDays(weekStart, 7)),
    [timeEntries, who, weekStart],
  )
  const rows = useMemo(() => {
    const byTask = new Map<string, number[]>()
    week.forEach((e) => {
      const arr = byTask.get(e.taskId) ?? Array(7).fill(0)
      const idx = days.findIndex((d) => isSameDay(d, parseISO(e.start)))
      if (idx >= 0) arr[idx] += e.duration
      byTask.set(e.taskId, arr)
    })
    return [...byTask.entries()].map(([taskId, mins]) => ({ task: tasks.find((t) => t.id === taskId), taskId, mins }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, tasks, weekStart])
  const dayTotals = days.map((_, i) => rows.reduce((a, r) => a + r.mins[i], 0))
  const total = dayTotals.reduce((a, b) => a + b, 0)

  // manual entry form
  const [taskId, setTaskId] = useState(tasks.find((t) => t.assignees.includes(me.id))?.id ?? tasks[0]?.id ?? '')
  const [date, setDate] = useState(toISODate(new Date()))
  const [dur, setDur] = useState('')
  const [note, setNote] = useState('')

  const th = 'surface-subtle border-app sticky top-0 border-b px-3 py-2 text-[11px] font-semibold uppercase text-faint'

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Timer size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">Timesheets</h1>
          <select value={who} onChange={(e) => setWho(e.target.value)} className="border-app surface ml-auto h-8 rounded-md border px-2 text-sm" aria-label="Person">
            <option value={me.id}>My time</option>
            <option value="all">Everyone</option>
            {users
              .filter((u) => u.id !== me.id)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekStart((w) => addDays(w, -7))} className="hover-surface rounded-md p-1.5" aria-label="Previous week">
              <ChevronLeft size={16} />
            </button>
            <span className="w-40 text-center text-sm font-medium">
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d')}
            </span>
            <button onClick={() => setWeekStart((w) => addDays(w, 7))} className="hover-surface rounded-md p-1.5" aria-label="Next week">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {runningTask && (
          <div className="mb-4 flex items-center gap-3 rounded-xl bg-emerald-500 px-4 py-3 text-white">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
            <button onClick={() => openTask(runningTask.id)} className="min-w-0 truncate font-semibold hover:underline">
              {runningTask.title}
            </button>
            <span className="ml-auto font-mono text-lg tabular-nums">{clock(sec)}</span>
            <button onClick={stopTimer} className="flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold hover:bg-white/30">
              <Pause size={14} /> Stop
            </button>
          </div>
        )}

        <div className="border-app overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[820px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th className={cn(th, 'text-left')}>Task</th>
                {days.map((d) => (
                  <th key={d.toISOString()} className={cn(th, 'w-20 text-center', isToday(d) && 'text-brand-600')}>
                    {format(d, 'EEE d')}
                  </th>
                ))}
                <th className={cn(th, 'w-24 text-right')}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-muted p-10 text-center">
                    No time tracked this week. Start a timer from any task, or add time below.
                  </td>
                </tr>
              )}
              {rows.map(({ task, taskId, mins }) => (
                <tr key={taskId} className="hover-surface">
                  <td className="border-app border-b px-3 py-2">
                    <button onClick={() => task && openTask(task.id)} className="block max-w-[320px] truncate text-left font-medium hover:underline">
                      {task?.title ?? 'Deleted task'}
                    </button>
                    <span className="text-faint text-xs">{lists.find((l) => l.id === task?.listId)?.name}</span>
                  </td>
                  {mins.map((m, i) => (
                    <td key={i} className={cn('border-app border-b px-2 py-2 text-center tabular-nums', m ? '' : 'text-faint')}>
                      {m ? formatMinutes(m) : '—'}
                    </td>
                  ))}
                  <td className="border-app border-b px-3 py-2 text-right font-semibold tabular-nums">{formatMinutes(mins.reduce((a, b) => a + b, 0))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="surface-subtle font-semibold">
                <td className="px-3 py-2">Total</td>
                {dayTotals.map((m, i) => (
                  <td key={i} className={cn('px-2 py-2 text-center tabular-nums', m > 8 * 60 && 'text-red-500')}>
                    {m ? formatMinutes(m) : '—'}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">{formatMinutes(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
          <form
            className="border-app space-y-3 rounded-xl border p-4"
            onSubmit={(e) => {
              e.preventDefault()
              const m = dur.match(/^\s*(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m?)?\s*$/i)
              const minutes = m ? Math.round(Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) : 0
              if (!minutes || !taskId) return
              addTimeEntry({ taskId, start: setHours(startOfDay(parseISO(date)), 9).toISOString(), duration: minutes, note })
              setDur('')
              setNote('')
            }}
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Plus size={15} /> Add time
            </h2>
            <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="border-app surface w-full rounded-md border px-2 py-1.5 text-sm" aria-label="Task">
              {tasks
                .filter((t) => !t.parentId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
            <div className="flex gap-2">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-app surface flex-1 rounded-md border px-2 py-1.5 text-sm" aria-label="Date" />
              <input value={dur} onChange={(e) => setDur(e.target.value)} placeholder="1h 30m" className="border-app surface w-24 rounded-md border px-2 py-1.5 text-sm" aria-label="Duration" />
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="border-app surface w-full rounded-md border px-2 py-1.5 text-sm" />
            <button className="bg-brand-600 w-full rounded-md py-1.5 text-sm font-semibold text-white">Log time</button>
          </form>

          <div className="border-app rounded-xl border">
            <h2 className="border-app flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold">
              <Clock size={15} /> Entries this week
            </h2>
            <div className="max-h-80 divide-y divide-[var(--border)] overflow-y-auto scroll-thin">
              {[...week]
                .sort((a, b) => b.start.localeCompare(a.start))
                .map((e) => (
                  <div key={e.id} className="group flex items-center gap-3 px-4 py-2 text-[13px]">
                    <Avatar userId={e.userId} size={22} />
                    <span className="w-16 font-semibold tabular-nums">{formatMinutes(e.duration)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {tasks.find((t) => t.id === e.taskId)?.title}
                      {e.note && <span className="text-faint"> · {e.note}</span>}
                    </span>
                    <span className="text-faint shrink-0 text-xs">{format(parseISO(e.start), 'EEE, MMM d')}</span>
                    <button onClick={() => deleteTimeEntry(e.id)} className="text-faint hidden hover:text-red-500 group-hover:block" aria-label="Delete entry">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              {week.length === 0 && <p className="text-muted p-6 text-center text-sm">Nothing yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
