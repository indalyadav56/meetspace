import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, addMinutes, differenceInMinutes, format, isToday, parseISO, setHours, startOfDay, startOfWeek } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Video, Phone } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import type { Meeting, Task } from '../../../store/types'
import { useTaskResolver } from '../../hooks'
import MeetingDialog from '../../calls/MeetingDialog'
import { TASK_MIME, usePlanner } from './plannerStore'
import { cn, priorityMeta, toISODate } from '../../../lib/utils'

const FIRST_HOUR = 0
const LAST_HOUR = 24
const HOUR_PX = 52

/** Week planner: task due dates on top, meetings on the hourly grid. */
export default function PlannerPage() {
  const p = usePlanner()
  const me = useStore((s) => s.currentUserId)
  const tasks = useStore((s) => s.tasks)
  const meetings = useStore((s) => s.meetings)
  const updateTask = useStore((s) => s.updateTask)
  const openTask = useStore((s) => s.openTask)
  const { isDone, statusOf } = useTaskResolver()
  const [dialog, setDialog] = useState<{ meeting?: Meeting; start?: string } | null>(null)
  const [dropDay, setDropDay] = useState<string | null>(null)
  const grid = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    // Open scrolled to the working day.
    grid.current?.scrollTo({ top: (Math.min(Math.max(now.getHours() - 2, 7), 16) - FIRST_HOUR) * HOUR_PX })
  }, [])

  const weekStart = startOfWeek(parseISO(p.anchor), { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const mine = (t: Task) => !p.mineOnly || (me && t.assignees.includes(me))
  const tasksByDay = useMemo(() => {
    const m = new Map<string, Task[]>()
    if (!p.showTasks) return m
    for (const t of tasks) {
      if (!t.dueDate || t.parentId || !mine(t)) continue
      m.set(t.dueDate, [...(m.get(t.dueDate) ?? []), t])
    }
    return m
  }, [tasks, p.showTasks, p.mineOnly, me])
  const weekMeetings = meetings.filter((m) => {
    const d = parseISO(m.start)
    return p.showMeetings && d >= weekStart && d < addDays(weekStart, 7) && (!p.mineOnly || (me && (m.attendees.includes(me) || m.createdBy === me)))
  })

  const schedule = (e: React.DragEvent, day: Date) => {
    e.preventDefault()
    setDropDay(null)
    const id = e.dataTransfer.getData(TASK_MIME)
    if (id) updateTask(id, { dueDate: toISODate(day) })
  }
  const dropProps = (day: Date) => ({
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes(TASK_MIME)) {
        e.preventDefault()
        setDropDay(toISODate(day))
      }
    },
    onDragLeave: () => setDropDay(null),
    onDrop: (e: React.DragEvent) => schedule(e, day),
  })

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 px-4">
        <CalendarDays size={18} className="text-brand-600" />
        <h1 className="text-lg font-bold">Planner</h1>
        <span className="text-muted ml-1 text-sm">{format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => p.set({ anchor: toISODate(new Date()) })} className="border-app hover-surface h-8 rounded-lg border px-3 text-sm font-medium">
            Today
          </button>
          <button onClick={() => p.set({ anchor: toISODate(addDays(weekStart, -7)) })} className="hover-surface rounded-lg p-1.5" aria-label="Previous week">
            <ChevronLeft size={17} />
          </button>
          <button onClick={() => p.set({ anchor: toISODate(addDays(weekStart, 7)) })} className="hover-surface rounded-lg p-1.5" aria-label="Next week">
            <ChevronRight size={17} />
          </button>
          <button onClick={() => setDialog({})} className="bg-brand-600 hover:bg-brand-700 ml-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-white">
            <Video size={15} /> Schedule
          </button>
        </div>
      </header>

      {/* Day headers + all-day task lane */}
      <div className="border-app grid shrink-0 grid-cols-[56px_repeat(7,minmax(0,1fr))] border-y">
        <div className="text-faint flex items-end justify-end p-1.5 text-[10px]">Due</div>
        {days.map((d) => {
          const key = toISODate(d)
          const list = tasksByDay.get(key) ?? []
          return (
            <div key={key} {...dropProps(d)} className={cn('border-app min-h-[84px] border-l p-1.5', dropDay === key && 'bg-brand-50 dark:bg-brand-500/10')}>
              <div className="mb-1 flex items-baseline gap-1.5">
                <span className="text-muted text-[11px] font-semibold uppercase">{format(d, 'EEE')}</span>
                <span className={cn('flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm font-semibold tabular-nums', isToday(d) && 'bg-brand-600 text-white')}>{format(d, 'd')}</span>
              </div>
              <div className="flex max-h-28 flex-col gap-1 overflow-y-auto scroll-thin">
                {list.map((t) => {
                  const st = statusOf(t)
                  const pr = priorityMeta(t.priority)
                  return (
                    <button
                      key={t.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData(TASK_MIME, t.id)}
                      onClick={() => openTask(t.id)}
                      title={t.title}
                      className={cn('surface border-app flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[12px] hover:shadow-sm', isDone(t) && 'text-faint line-through')}
                      style={{ borderLeft: `3px solid ${st?.color ?? '#a8a29e'}` }}
                    >
                      <span className="truncate">{t.title}</span>
                      {pr && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: pr.color }} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Hourly grid with meetings */}
      <div ref={grid} className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        <div className="relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]" style={{ height: (LAST_HOUR - FIRST_HOUR) * HOUR_PX }}>
          <div>
            {Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => (
              <div key={i} className="text-faint relative pr-2 text-right text-[10px]" style={{ height: HOUR_PX }}>
                <span className="relative -top-1.5">{format(setHours(startOfDay(new Date()), FIRST_HOUR + i), 'h a')}</span>
              </div>
            ))}
          </div>
          {days.map((d) => {
            const dayMeetings = weekMeetings.filter((m) => toISODate(parseISO(m.start)) === toISODate(d))
            return (
              <div key={d.toISOString()} className="border-app relative border-l" {...dropProps(d)}>
                {Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setDialog({ start: setHours(startOfDay(d), FIRST_HOUR + i).toISOString() })}
                    className="border-app hover:bg-brand-50/60 dark:hover:bg-brand-500/10 block w-full border-b"
                    style={{ height: HOUR_PX }}
                    aria-label={`Schedule ${format(d, 'EEE MMM d')} at ${FIRST_HOUR + i}:00`}
                  />
                ))}
                {dayMeetings.map((m) => {
                  const start = parseISO(m.start)
                  const top = (differenceInMinutes(start, setHours(startOfDay(d), FIRST_HOUR)) / 60) * HOUR_PX
                  const height = Math.max(22, (m.durationMin / 60) * HOUR_PX - 2)
                  return (
                    <button
                      key={m.id}
                      onClick={() => setDialog({ meeting: m })}
                      className="bg-accent-100 text-accent-900 dark:bg-accent-500/20 dark:text-accent-100 border-accent-500 absolute inset-x-1 overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11px] shadow-sm"
                      style={{ top: Math.min(Math.max(0, top), (LAST_HOUR - FIRST_HOUR) * HOUR_PX - height), height }}
                    >
                      <div className="flex items-center gap-1 font-semibold">
                        {m.kind === 'video' ? <Video size={11} /> : <Phone size={11} />}
                        <span className="truncate">{m.title}</span>
                      </div>
                      <div className="opacity-75">
                        {format(start, 'h:mm')}–{format(addMinutes(start, m.durationMin), 'h:mm a')}
                      </div>
                    </button>
                  )
                })}
                {isToday(d) && now.getHours() >= FIRST_HOUR && now.getHours() < LAST_HOUR && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: ((now.getHours() - FIRST_HOUR) * 60 + now.getMinutes()) * (HOUR_PX / 60) }}>
                    <span className="bg-accent-500 -ml-1 h-2 w-2 rounded-full" />
                    <span className="bg-accent-500 h-px flex-1" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      {dialog && <MeetingDialog meeting={dialog.meeting} defaults={dialog.start ? { start: dialog.start } : undefined} onClose={() => setDialog(null)} />}
    </div>
  )
}
