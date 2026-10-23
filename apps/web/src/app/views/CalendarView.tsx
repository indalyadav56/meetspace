import { useMemo, useState } from 'react'
import { addDays, differenceInCalendarDays, endOfMonth, endOfWeek, format, isSameMonth, isToday, isWeekend, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { Task } from '../../store/types'
import { useTaskResolver } from '../hooks'
import { AvatarStack, Popover, PriorityFlag, usePopover } from '../components/ui'
import { PRIORITIES, cn, toISODate } from '../../lib/utils'
import type { ViewProps } from './ListView'

type Mode = 'month' | 'week' | 'day'
type ColorBy = 'status' | 'priority'
const MIME = 'text/task'
/** Spans longer than this are drawn on their due day only, to keep months readable. */
const MAX_SPAN = 31

const pref = (k: string, v?: string) => {
  try {
    if (v === undefined) return localStorage.getItem(`ms.cal.${k}`)
    localStorage.setItem(`ms.cal.${k}`, v)
  } catch {
    /* storage blocked */
  }
  return null
}

/** The days a task occupies: start → due (or just the due day). */
function span(t: Task): [string, string] | null {
  if (!t.dueDate && !t.startDate) return null
  const due = (t.dueDate ?? t.startDate)!.slice(0, 10)
  const start = (t.startDate ?? t.dueDate)!.slice(0, 10)
  if (start > due || differenceInCalendarDays(parseISO(due), parseISO(start)) > MAX_SPAN) return [due, due]
  return [start, due]
}

export default function CalendarView({ tasks, defaultListId }: ViewProps) {
  const { updateTask, openTask, addTask } = useStore()
  const r = useTaskResolver()
  const [mode, setModeState] = useState<Mode>(() => (pref('mode') as Mode) || 'month')
  const [cursor, setCursor] = useState(() => new Date())
  const [weekends, setWeekendsState] = useState(() => pref('weekends') !== '0')
  const [colorBy, setColorByState] = useState<ColorBy>(() => (pref('color') as ColorBy) || 'status')
  const [dragOver, setDragOver] = useState<string | null>(null)
  const setMode = (m: Mode) => (setModeState(m), pref('mode', m))
  const setWeekends = (v: boolean) => (setWeekendsState(v), pref('weekends', v ? '1' : '0'))
  const setColorBy = (v: ColorBy) => (setColorByState(v), pref('color', v))

  const days = useMemo(() => {
    const out: Date[] = []
    const [a, b] = mode === 'month' ? [startOfWeek(startOfMonth(cursor)), endOfWeek(endOfMonth(cursor))] : mode === 'week' ? [startOfWeek(cursor), endOfWeek(cursor)] : [cursor, cursor]
    for (let d = a; d <= b; d = addDays(d, 1)) if (weekends || mode === 'day' || !isWeekend(d)) out.push(d)
    return out
  }, [mode, cursor, weekends])

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of tasks) {
      const sp = span(t)
      if (!sp) continue
      for (let d = parseISO(sp[0]); toISODate(d) <= sp[1]; d = addDays(d, 1)) m.set(toISODate(d), [...(m.get(toISODate(d)) ?? []), t])
    }
    // Longer spans first so bars line up across days.
    for (const list of m.values()) list.sort((a, b) => (span(a)![0] === span(b)![0] ? 0 : span(a)![0] < span(b)![0] ? -1 : 1))
    return m
  }, [tasks])
  const unscheduled = tasks.filter((t) => !span(t))
  const today = toISODate(new Date())
  const overdue = tasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < today && !r.isDone(t))

  const color = (t: Task) => (colorBy === 'priority' ? (PRIORITIES.find((p) => p.value === t.priority)?.color ?? '#cbd5e1') : (r.statusOf(t)?.color ?? '#94a3b8'))
  const drop = (iso: string, id: string) => {
    const t = tasks.find((x) => x.id === id)
    if (!t) return
    const sp = span(t)
    // Keep the task's length: shift its start along with the due date.
    if (sp && t.startDate && sp[0] !== sp[1]) {
      const shift = differenceInCalendarDays(parseISO(iso), parseISO(sp[0]))
      updateTask(id, { startDate: toISODate(addDays(parseISO(sp[0]), shift)), dueDate: toISODate(addDays(parseISO(sp[1]), shift)) })
    } else updateTask(id, { dueDate: iso, ...(t.startDate && t.startDate.slice(0, 10) > iso ? { startDate: iso } : {}) })
  }
  const move = (dir: -1 | 1) => setCursor((c) => (mode === 'month' ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : addDays(c, dir * (mode === 'week' ? 7 : 1))))
  const title = mode === 'month' ? format(cursor, 'MMMM yyyy') : mode === 'week' ? `${format(days[0] ?? cursor, 'MMM d')} – ${format(days[days.length - 1] ?? cursor, 'MMM d, yyyy')}` : format(cursor, 'EEEE, MMMM d, yyyy')
  const cols = mode === 'day' ? 1 : weekends ? 7 : 5
  const limit = mode === 'month' ? 3 : 999

  const chip = (t: Task, iso: string) => {
    const sp = span(t)!
    // Label the bar where it starts and again at the start of each week row it wraps onto.
    const first = iso === sp[0] || days.findIndex((d) => toISODate(d) === iso) % cols === 0
    const last = iso === sp[1]
    const c = color(t)
    return (
      <div
        key={t.id}
        draggable
        onDragStart={(e) => e.dataTransfer.setData(MIME, t.id)}
        onClick={(e) => (e.stopPropagation(), openTask(t.id))}
        className={cn('flex cursor-pointer items-center gap-1 truncate px-1.5 py-0.5 font-medium', first ? 'rounded-l' : '-ml-1 pl-2.5', last ? 'rounded-r' : '-mr-1', r.isDone(t) && 'line-through opacity-60')}
        style={{ background: `${c}26`, borderLeft: first ? `3px solid ${c}` : undefined }}
        title={`${t.title}${sp[0] !== sp[1] ? ` · ${format(parseISO(sp[0]), 'MMM d')} – ${format(parseISO(sp[1]), 'MMM d')}` : ''}`}
      >
        <span className={cn('truncate', !first && 'opacity-0')}>{t.title}</span>
        {mode !== 'month' && first && (
          <span className="ml-auto flex shrink-0 items-center gap-1">
            {t.priority && <PriorityFlag priority={t.priority} />}
            {t.assignees.length > 0 && <AvatarStack ids={t.assignees} size={16} max={2} />}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <label className="text-muted mr-1 flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={weekends} onChange={(e) => setWeekends(e.target.checked)} className="accent-brand-600 h-3.5 w-3.5" /> Weekends
            </label>
            <select value={colorBy} onChange={(e) => setColorBy(e.target.value as ColorBy)} className="border-app surface h-7 rounded-md border px-1.5 text-xs" aria-label="Color tasks by">
              <option value="status">Color: status</option>
              <option value="priority">Color: priority</option>
            </select>
            <div className="border-app flex rounded-md border p-0.5 text-xs">
              {(['day', 'week', 'month'] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={cn('rounded px-2 py-0.5 capitalize', mode === m ? 'surface-muted text-app font-medium' : 'text-muted')}>
                  {m}
                </button>
              ))}
            </div>
            <button onClick={() => setCursor(new Date())} className="border-app hover-surface rounded-md border px-2.5 py-1 text-xs font-medium">
              Today
            </button>
            <button onClick={() => move(-1)} className="hover-surface rounded-md p-1.5" aria-label="Previous">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => move(1)} className="hover-surface rounded-md p-1.5" aria-label="Next">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        {mode !== 'day' && (
          <div className="text-faint grid text-center text-[11px] font-semibold uppercase" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {days.slice(0, cols).map((d) => (
              <div key={d.toISOString()} className="py-1">
                {format(d, 'EEE')}
                {mode === 'week' && <span className={cn('ml-1', isToday(d) && 'text-brand-600')}>{format(d, 'd')}</span>}
              </div>
            ))}
          </div>
        )}
        <div className={cn('border-app grid min-h-0 flex-1 overflow-y-auto rounded-lg border scroll-thin', mode === 'month' && 'auto-rows-fr')} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {days.map((d) => {
            const iso = toISODate(d)
            const items = byDay.get(iso) ?? []
            return (
              <div
                key={iso}
                onDragOver={(e) => (e.preventDefault(), setDragOver(iso))}
                onDragLeave={() => setDragOver((x) => (x === iso ? null : x))}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(null)
                  const id = e.dataTransfer.getData(MIME)
                  if (id) drop(iso, id)
                }}
                onDoubleClick={() => openTask(addTask({ listId: defaultListId, title: 'New task', dueDate: iso }))}
                className={cn(
                  'group border-app relative overflow-hidden border-r border-b p-1 text-xs',
                  mode === 'month' ? 'min-h-[96px]' : 'min-h-[420px]',
                  mode === 'month' && !isSameMonth(d, cursor) && 'surface-subtle',
                  isWeekend(d) && mode !== 'month' && 'surface-subtle',
                  dragOver === iso && 'bg-brand-50 dark:bg-brand-600/20',
                )}
                style={{ borderRightWidth: days.indexOf(d) % cols === cols - 1 ? 0 : undefined }}
              >
                <div className="mb-1 flex items-center">
                  {mode === 'month' && (
                    <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full', isToday(d) ? 'bg-brand-600 font-bold text-white' : !isSameMonth(d, cursor) ? 'text-faint' : '')}>{format(d, 'd')}</span>
                  )}
                  {mode === 'day' && <span className="text-muted px-1 text-[11px] font-semibold uppercase">{items.length} tasks</span>}
                  <button onClick={() => openTask(addTask({ listId: defaultListId, title: 'New task', dueDate: iso }))} className="text-faint hover-surface ml-auto hidden rounded p-0.5 group-hover:block" aria-label="Add task on this day">
                    <Plus size={13} />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {items.slice(0, limit).map((t) => chip(t, iso))}
                  {items.length > limit && <MoreTasks tasks={items} date={d} onOpen={openTask} />}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-faint mt-1.5 text-[11px]">Drag tasks between days to reschedule (multi-day tasks keep their length) · double-click a day to add a task</p>
      </div>
      <aside className="border-app surface-subtle max-h-64 shrink-0 overflow-y-auto border-t p-3 lg:max-h-none lg:w-64 lg:border-t-0 lg:border-l">
        {overdue.length > 0 && (
          <>
            <h3 className="mb-2 text-sm font-semibold text-red-600">
              Overdue <span className="font-normal">{overdue.length}</span>
            </h3>
            <div className="mb-4 space-y-1">
              {overdue.slice(0, 8).map((t) => (
                <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData(MIME, t.id)} onClick={() => openTask(t.id)} className="surface flex cursor-grab items-center gap-2 rounded-md border border-red-200 px-2 py-1.5 text-xs font-medium dark:border-red-500/30">
                  <span className="truncate">{t.title}</span>
                  <span className="ml-auto shrink-0 text-red-500">{format(parseISO(t.dueDate!), 'MMM d')}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <h3 className="mb-2 text-sm font-semibold">
          Unscheduled <span className="text-faint font-normal">{unscheduled.length}</span>
        </h3>
        <p className="text-muted mb-2 text-xs">Drag a task onto a day to schedule it.</p>
        <div className="space-y-1">
          {unscheduled.map((t) => (
            <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData(MIME, t.id)} onClick={() => openTask(t.id)} className="surface border-app cursor-grab rounded-md border px-2 py-1.5 text-xs font-medium">
              {t.title}
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}

function MoreTasks({ tasks, date, onOpen }: { tasks: Task[]; date: Date; onOpen: (id: string) => void }) {
  const pop = usePopover()
  return (
    <>
      <button onClick={(e) => (e.stopPropagation(), pop.toggle(e))} className="text-muted hover:text-app px-1 font-medium">
        +{tasks.length - 3} more
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={240}>
        <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">{format(date, 'EEE, MMM d')}</div>
        {tasks.map((t) => (
          <button key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData(MIME, t.id)} onClick={() => (onOpen(t.id), pop.close())} className="hover-surface block w-full truncate rounded-md px-2 py-1.5 text-left text-sm">
            {t.title}
          </button>
        ))}
      </Popover>
    </>
  )
}
