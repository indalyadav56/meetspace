import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import { useTaskResolver } from '../../hooks'
import { Group, SidebarShell } from '../../SectionSidebar'
import { TASK_MIME, usePlanner } from './plannerStore'
import { cn, toISODate } from '../../../lib/utils'

/** Mini month, view filters and the unscheduled tasks you can drag onto a day. */
export function PlannerSidebar() {
  const p = usePlanner()
  const anchor = parseISO(p.anchor)
  const month = startOfMonth(anchor)
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) })
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 })
  const me = useStore((s) => s.currentUserId)
  const tasks = useStore((s) => s.tasks)
  const openTask = useStore((s) => s.openTask)
  const { isDone } = useTaskResolver()
  const unscheduled = tasks.filter((t) => !t.parentId && !t.dueDate && !isDone(t) && (!p.mineOnly || (me && t.assignees.includes(me))))

  return (
    <SidebarShell title="Planner">
      <div className="px-1 pt-1">
        <div className="flex items-center px-1">
          <span className="text-sm font-semibold">{format(month, 'MMMM yyyy')}</span>
          <button onClick={() => p.set({ anchor: toISODate(addMonths(month, -1)) })} className="hover-surface text-muted ml-auto rounded p-1" aria-label="Previous month">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => p.set({ anchor: toISODate(addMonths(month, 1)) })} className="hover-surface text-muted rounded p-1" aria-label="Next month">
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="mt-1 grid grid-cols-7 text-center text-[10px]">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} className="text-faint py-1 font-semibold">
              {d}
            </span>
          ))}
          {days.map((d) => {
            const inWeek = d >= weekStart && d < new Date(weekStart.getTime() + 7 * 864e5)
            return (
              <button
                key={d.toISOString()}
                onClick={() => p.set({ anchor: toISODate(d) })}
                className={cn(
                  'm-0.5 rounded-md py-1 text-xs tabular-nums',
                  !isSameMonth(d, month) && 'text-faint',
                  inWeek && 'bg-brand-50 dark:bg-brand-500/15',
                  isToday(d) && 'bg-brand-600 font-semibold text-white',
                  isSameDay(d, anchor) && !isToday(d) && 'ring-brand-500 ring-1',
                )}
              >
                {format(d, 'd')}
              </button>
            )
          })}
        </div>
      </div>

      <Group label="Show">
        {(
          [
            ['showTasks', 'Task due dates'],
            ['showMeetings', 'Meetings'],
            ['mineOnly', 'Only my work'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="hover-surface flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px]">
            <input type="checkbox" checked={p[k]} onChange={(e) => p.set({ [k]: e.target.checked })} className="accent-brand-600 h-3.5 w-3.5" />
            {label}
          </label>
        ))}
      </Group>

      <Group label={`Unscheduled · ${unscheduled.length}`}>
        {unscheduled.length === 0 && <p className="text-faint px-2 py-1 text-xs">Everything has a date.</p>}
        <p className="text-faint px-2 pb-1 text-[11px]">Drag a task onto a day to schedule it.</p>
        {unscheduled.slice(0, 40).map((t) => (
          <div
            key={t.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(TASK_MIME, t.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onClick={() => openTask(t.id)}
            className="group hover-surface flex h-8 cursor-grab items-center gap-1.5 rounded-md px-1.5 text-[13px] active:cursor-grabbing"
          >
            <GripVertical size={13} className="text-faint" />
            <span className="text-faint text-[11px]">MS-{t.key}</span>
            <span className="truncate">{t.title}</span>
          </div>
        ))}
      </Group>
    </SidebarShell>
  )
}
