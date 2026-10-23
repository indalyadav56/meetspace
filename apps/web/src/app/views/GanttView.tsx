import { useRef, useState } from 'react'
import { addDays, differenceInCalendarDays, format, isToday, isWeekend, parseISO, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { Task } from '../../store/types'
import { useTaskResolver } from '../hooks'
import { StatusDot } from '../components/ui'
import { cn, toISODate } from '../../lib/utils'
import type { ViewProps } from './ListView'

const DAY_W = 36
const ROW_H = 36
const DAYS = 42

type Drag = { id: string; mode: 'move' | 'end' | 'start'; x0: number; start: string; due: string; delta: number }

export default function GanttView({ tasks }: ViewProps) {
  const { updateTask, openTask } = useStore()
  const r = useTaskResolver()
  const [origin, setOrigin] = useState(() => addDays(startOfWeek(new Date()), -7))
  const [drag, setDrag] = useState<Drag | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  const days = Array.from({ length: DAYS }, (_, i) => addDays(origin, i))
  const span = (t: Task) => {
    const s = t.startDate ?? t.dueDate
    const e = t.dueDate ?? t.startDate
    return s && e ? { s, e } : null
  }

  const onPointerDown = (e: React.PointerEvent, t: Task, mode: Drag['mode']) => {
    const sp = span(t)
    if (!sp) return
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ id: t.id, mode, x0: e.clientX, start: sp.s, due: sp.e, delta: 0 })
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return
    setDrag({ ...drag, delta: Math.round((e.clientX - drag.x0) / DAY_W) })
  }
  const onPointerUp = () => {
    if (!drag) return
    const { id, mode, start, due, delta } = drag
    setDrag(null)
    if (delta === 0) return openTask(id)
    const s = parseISO(start)
    const d = parseISO(due)
    if (mode === 'move') updateTask(id, { startDate: toISODate(addDays(s, delta)), dueDate: toISODate(addDays(d, delta)) })
    if (mode === 'end') updateTask(id, { startDate: start, dueDate: toISODate(addDays(d, Math.max(delta, -differenceInCalendarDays(d, s)))) })
    if (mode === 'start') updateTask(id, { dueDate: due, startDate: toISODate(addDays(s, Math.min(delta, differenceInCalendarDays(d, s)))) })
  }

  const geometry = (t: Task) => {
    const sp = span(t)
    if (!sp) return null
    let s = parseISO(sp.s)
    let e = parseISO(sp.e)
    if (drag?.id === t.id) {
      if (drag.mode !== 'end') s = addDays(s, drag.delta)
      if (drag.mode !== 'start') e = addDays(e, drag.delta)
      if (e < s) [s, e] = drag.mode === 'end' ? [s, s] : [e, e]
    }
    const left = differenceInCalendarDays(s, origin) * DAY_W
    const width = (differenceInCalendarDays(e, s) + 1) * DAY_W
    return { left, width }
  }

  const todayX = differenceInCalendarDays(new Date(), origin) * DAY_W + DAY_W / 2

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-app flex items-center gap-2 border-b px-4 py-2 text-sm">
        <span className="font-semibold">{format(origin, 'MMM d')} – {format(addDays(origin, DAYS - 1), 'MMM d, yyyy')}</span>
        <span className="text-muted hidden text-xs sm:inline">Drag bars to reschedule · drag edges to resize</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setOrigin(addDays(startOfWeek(new Date()), -7))} className="border-app hover-surface rounded-md border px-2.5 py-1 text-xs font-medium">
            Today
          </button>
          <button onClick={() => setOrigin((o) => addDays(o, -7))} className="hover-surface rounded-md p-1.5" aria-label="Earlier">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setOrigin((o) => addDays(o, 7))} className="hover-surface rounded-md p-1.5" aria-label="Later">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div ref={scroller} className="flex min-h-0 flex-1 overflow-auto scroll-thin" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        {/* Left task column */}
        <div className="surface border-app sticky left-0 z-20 w-56 shrink-0 border-r sm:w-72">
          <div className="border-app surface-subtle text-faint sticky top-0 z-10 flex h-12 items-end border-b px-3 pb-1.5 text-[11px] font-semibold uppercase">Task</div>
          {tasks.map((t) => (
            <button key={t.id} onClick={() => openTask(t.id)} className="border-app hover-surface flex w-full items-center gap-2 border-b px-3 text-left text-[13px]" style={{ height: ROW_H }}>
              <StatusDot status={r.statusOf(t)} size={12} />
              <span className={cn('truncate', r.isDone(t) && 'text-faint line-through')}>{t.title}</span>
            </button>
          ))}
        </div>
        {/* Timeline */}
        <div className="relative" style={{ width: DAYS * DAY_W }}>
          <div className="surface-subtle border-app sticky top-0 z-10 flex h-12 border-b">
            {days.map((d) => (
              <div key={d.toISOString()} className={cn('border-app flex shrink-0 flex-col items-center justify-end border-r pb-1 text-[10px]', isToday(d) && 'text-brand-600 font-bold')} style={{ width: DAY_W }}>
                {d.getDate() === 1 || d.getDay() === 0 ? <span className="text-muted font-semibold">{format(d, 'MMM')}</span> : <span>&nbsp;</span>}
                <span className="text-faint">{format(d, 'EEEEE')}</span>
                <span>{format(d, 'd')}</span>
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute top-12 bottom-0 left-0 flex">
            {days.map((d) => (
              <div key={d.toISOString()} className={cn('border-app h-full shrink-0 border-r', isWeekend(d) && 'surface-subtle')} style={{ width: DAY_W }} />
            ))}
          </div>
          {todayX > 0 && todayX < DAYS * DAY_W && <div className="bg-brand-500 pointer-events-none absolute top-12 bottom-0 z-[5] w-px" style={{ left: todayX }} />}
          {/* Dependency arrows: blocker's end → dependent's start */}
          <svg className="pointer-events-none absolute top-12 left-0 z-[6] overflow-visible" width={DAYS * DAY_W} height={tasks.length * ROW_H}>
            <defs>
              <marker id="gantt-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="#64748b" />
              </marker>
            </defs>
            {tasks.flatMap((t, row) =>
              t.blockedBy.map((bId) => {
                const bRow = tasks.findIndex((x) => x.id === bId)
                const from = bRow >= 0 ? geometry(tasks[bRow]) : null
                const to = geometry(t)
                if (!from || !to) return null
                const x1 = from.left + from.width
                const y1 = bRow * ROW_H + ROW_H / 2
                const x2 = to.left - 2
                const y2 = row * ROW_H + ROW_H / 2
                const mid = Math.max(x1 + 10, Math.min(x2 - 10, (x1 + x2) / 2))
                const late = x2 < x1
                return (
                  <path
                    key={`${bId}-${t.id}`}
                    d={`M${x1},${y1} H${mid} V${y2} H${x2}`}
                    fill="none"
                    stroke={late ? '#ef4444' : '#64748b'}
                    strokeWidth={1.5}
                    strokeDasharray={late ? '4 3' : undefined}
                    markerEnd="url(#gantt-arrow)"
                  />
                )
              }),
            )}
          </svg>
          {tasks.map((t) => {
            const g = geometry(t)
            const st = r.statusOf(t)
            return (
              <div key={t.id} className="border-app relative border-b" style={{ height: ROW_H }}>
                {g && (
                  <div
                    onPointerDown={(e) => onPointerDown(e, t, 'move')}
                    className={cn('group absolute top-1.5 flex cursor-grab touch-none items-center overflow-hidden rounded-md px-2 text-[11px] font-semibold text-white shadow-sm select-none', drag?.id === t.id && 'cursor-grabbing ring-2 ring-black/10')}
                    style={{ left: g.left, width: g.width, height: ROW_H - 12, background: st?.color }}
                    title={t.title}
                  >
                    <span onPointerDown={(e) => onPointerDown(e, t, 'start')} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize group-hover:bg-black/15" />
                    <span className="truncate">{t.title}</span>
                    <span onPointerDown={(e) => onPointerDown(e, t, 'end')} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize group-hover:bg-black/15" />
                  </div>
                )}
                {!g && (
                  <button
                    onClick={() => updateTask(t.id, { startDate: toISODate(new Date()), dueDate: toISODate(addDays(new Date(), 2)) })}
                    className="text-faint hover:text-app absolute top-2 text-[11px]"
                    style={{ left: Math.max(4, todayX - 30) }}
                  >
                    + schedule
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
