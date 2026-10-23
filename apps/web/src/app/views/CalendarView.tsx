import { useState } from 'react'
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useTaskResolver } from '../hooks'
import { cn, toISODate } from '../../lib/utils'
import type { ViewProps } from './ListView'

export default function CalendarView({ tasks, defaultListId }: ViewProps) {
  const { updateTask, openTask, addTask } = useStore()
  const r = useTaskResolver()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [dragOver, setDragOver] = useState<string | null>(null)

  const start = startOfWeek(startOfMonth(month))
  const end = endOfWeek(endOfMonth(month))
  const days: Date[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)

  const byDay = new Map<string, typeof tasks>()
  tasks.forEach((t) => {
    if (!t.dueDate) return
    byDay.set(t.dueDate, [...(byDay.get(t.dueDate) ?? []), t])
  })
  const unscheduled = tasks.filter((t) => !t.dueDate)

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold">{format(month, 'MMMM yyyy')}</h2>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setMonth(startOfMonth(new Date()))} className="border-app hover-surface rounded-md border px-2.5 py-1 text-xs font-medium">
              Today
            </button>
            <button onClick={() => setMonth((m) => subMonths(m, 1))} className="hover-surface rounded-md p-1.5" aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setMonth((m) => addMonths(m, 1))} className="hover-surface rounded-md p-1.5" aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="text-faint grid grid-cols-7 text-center text-[11px] font-semibold uppercase">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="border-app grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-hidden rounded-lg border">
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
                  const id = e.dataTransfer.getData('text/task')
                  if (id) updateTask(id, { dueDate: iso })
                }}
                className={cn(
                  'group border-app relative min-h-[92px] overflow-hidden border-r border-b p-1 text-xs [&:nth-child(7n)]:border-r-0',
                  !isSameMonth(d, month) && 'surface-subtle',
                  dragOver === iso && 'bg-brand-50 dark:bg-brand-600/20',
                )}
              >
                <div className="mb-1 flex items-center">
                  <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full', isToday(d) ? 'bg-brand-600 font-bold text-white' : !isSameMonth(d, month) ? 'text-faint' : '')}>{format(d, 'd')}</span>
                  <button
                    onClick={() => openTask(addTask({ listId: defaultListId, title: 'New task', dueDate: iso }))}
                    className="text-faint hover-surface ml-auto hidden rounded p-0.5 group-hover:block"
                    aria-label="Add task on this day"
                  >
                    <Plus size={13} />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {items.slice(0, 3).map((t) => {
                    const st = r.statusOf(t)
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/task', t.id)}
                        onClick={() => openTask(t.id)}
                        className={cn('cursor-pointer truncate rounded px-1.5 py-0.5 font-medium', r.isDone(t) && 'line-through opacity-60')}
                        style={{ background: `${st?.color}22`, borderLeft: `3px solid ${st?.color}` }}
                        title={t.title}
                      >
                        {t.title}
                      </div>
                    )
                  })}
                  {items.length > 3 && <div className="text-muted px-1">+{items.length - 3} more</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <aside className="border-app surface-subtle max-h-64 shrink-0 overflow-y-auto border-t p-3 lg:max-h-none lg:w-64 lg:border-t-0 lg:border-l">
        <h3 className="mb-2 text-sm font-semibold">
          Unscheduled <span className="text-faint font-normal">{unscheduled.length}</span>
        </h3>
        <p className="text-muted mb-2 text-xs">Drag a task onto a day to schedule it.</p>
        <div className="space-y-1">
          {unscheduled.map((t) => (
            <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/task', t.id)} onClick={() => openTask(t.id)} className="surface border-app cursor-grab rounded-md border px-2 py-1.5 text-xs font-medium">
              {t.title}
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
