import { useMemo, useState } from 'react'
import { addDays, differenceInCalendarDays, format, isToday, isWeekend, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Link2 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { ID, Task } from '../../store/types'
import { useTaskResolver } from '../hooks'
import { StatusDot } from '../components/ui'
import { cn, toISODate } from '../../lib/utils'
import type { ViewProps } from './ListView'

type Zoom = 'day' | 'week' | 'month'
const SCALE: Record<Zoom, { dayW: number; days: number; step: number }> = {
  day: { dayW: 36, days: 42, step: 7 },
  week: { dayW: 14, days: 120, step: 28 },
  month: { dayW: 4, days: 365, step: 91 },
}
const ROW_H = 36

type Drag = { id: string; mode: 'move' | 'end' | 'start'; x0: number; start: string; due: string; delta: number }
type Link = { from: ID; x: number; y: number; x2: number; y2: number }

const pref = (k: string, v?: string) => {
  try {
    if (v === undefined) return localStorage.getItem(`ms.gantt.${k}`)
    localStorage.setItem(`ms.gantt.${k}`, v)
  } catch {
    /* storage blocked */
  }
  return null
}

const spanOf = (t: Task) => {
  const s = t.startDate ?? t.dueDate
  const e = t.dueDate ?? t.startDate
  return s && e ? { s: s.slice(0, 10), e: e.slice(0, 10) } : null
}

/** The longest chain of dependent tasks by total days: those decide the end date. */
function criticalPath(tasks: Task[]): Set<ID> {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const memo = new Map<ID, { len: number; prev: ID | null }>()
  const walk = (t: Task, stack: Set<ID>): { len: number; prev: ID | null } => {
    const hit = memo.get(t.id)
    if (hit) return hit
    const sp = spanOf(t)
    const dur = sp ? differenceInCalendarDays(parseISO(sp.e), parseISO(sp.s)) + 1 : 0
    let best = { len: dur, prev: null as ID | null }
    stack.add(t.id)
    for (const b of t.blockedBy) {
      const bt = byId.get(b)
      if (!bt || stack.has(b)) continue // ignore cycles
      const r = walk(bt, stack)
      if (r.len + dur > best.len) best = { len: r.len + dur, prev: b }
    }
    stack.delete(t.id)
    memo.set(t.id, best)
    return best
  }
  let end: Task | null = null
  let bestLen = 0
  for (const t of tasks) {
    const r = walk(t, new Set())
    if (r.len > bestLen && (t.blockedBy.length || tasks.some((x) => x.blockedBy.includes(t.id)))) {
      bestLen = r.len
      end = t
    }
  }
  const out = new Set<ID>()
  for (let cur: ID | null = end?.id ?? null; cur && !out.has(cur); cur = memo.get(cur)?.prev ?? null) out.add(cur)
  return out.size > 1 ? out : new Set()
}

export default function GanttView({ tasks }: ViewProps) {
  const { updateTask, openTask, addDependency, removeDependency, tasks: all } = useStore()
  const r = useTaskResolver()
  const [zoom, setZoomState] = useState<Zoom>(() => (pref('zoom') as Zoom) || 'day')
  const [cascade, setCascadeState] = useState(() => pref('cascade') !== '0')
  const [critical, setCriticalState] = useState(() => pref('critical') === '1')
  const [order, setOrderState] = useState<'start' | 'manual'>(() => (pref('order') === 'manual' ? 'manual' : 'start'))
  const { dayW, days: DAYS, step } = SCALE[zoom]
  const anchor = (z: Zoom) => (z === 'day' ? addDays(startOfWeek(new Date()), -7) : z === 'week' ? addDays(startOfWeek(new Date()), -28) : startOfMonth(addDays(new Date(), -60)))
  const [origin, setOrigin] = useState(() => anchor(zoom))
  const [drag, setDrag] = useState<Drag | null>(null)
  const [link, setLink] = useState<Link | null>(null)
  const setZoom = (z: Zoom) => (setZoomState(z), setOrigin(anchor(z)), pref('zoom', z))
  const setCascade = (v: boolean) => (setCascadeState(v), pref('cascade', v ? '1' : '0'))
  const setCritical = (v: boolean) => (setCriticalState(v), pref('critical', v ? '1' : '0'))
  const setOrder = (v: 'start' | 'manual') => (setOrderState(v), pref('order', v))

  const rows = useMemo(() => (order === 'manual' ? tasks : [...tasks].sort((a, b) => (spanOf(a)?.s ?? '9999').localeCompare(spanOf(b)?.s ?? '9999'))), [tasks, order])
  const path = useMemo(() => (critical ? criticalPath(rows) : new Set<ID>()), [critical, rows])
  const days = Array.from({ length: DAYS }, (_, i) => addDays(origin, i))
  const width = DAYS * dayW

  /** Push tasks that depend on `id` so each starts after its blocker ends. */
  const shiftDependents = (id: ID, newEnd: string, seen = new Set<ID>([id])) => {
    for (const d of all.filter((t) => t.blockedBy.includes(id))) {
      if (seen.has(d.id)) continue
      seen.add(d.id)
      const sp = spanOf(d)
      if (!sp) continue
      const gap = differenceInCalendarDays(parseISO(newEnd), parseISO(sp.s)) + 1
      if (gap <= 0) continue
      const s = toISODate(addDays(parseISO(sp.s), gap))
      const e = toISODate(addDays(parseISO(sp.e), gap))
      updateTask(d.id, { startDate: s, dueDate: e })
      shiftDependents(d.id, e, seen)
    }
  }

  const onPointerDown = (e: React.PointerEvent, t: Task, mode: Drag['mode']) => {
    const sp = spanOf(t)
    if (!sp) return
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ id: t.id, mode, x0: e.clientX, start: sp.s, due: sp.e, delta: 0 })
  }
  const timelineXY = (e: React.PointerEvent) => {
    const el = (e.currentTarget as HTMLElement).querySelector('[data-timeline]') as HTMLElement | null
    const b = el?.getBoundingClientRect()
    return b ? { x: e.clientX - b.left, y: e.clientY - b.top } : { x: 0, y: 0 }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (link) {
      const p = timelineXY(e)
      setLink({ ...link, x2: p.x, y2: p.y })
      return
    }
    if (!drag) return
    setDrag({ ...drag, delta: Math.round((e.clientX - drag.x0) / dayW) })
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (link) {
      const row = Math.floor(link.y2 / ROW_H)
      const target = rows[row]
      setLink(null)
      if (target && target.id !== link.from) addDependency(target.id, link.from)
      return
    }
    if (!drag) return
    const { id, mode, start, due, delta } = drag
    setDrag(null)
    if (delta === 0) return void (e.button === 0 && openTask(id))
    const s = parseISO(start)
    const d = parseISO(due)
    let patch: Partial<Task>
    if (mode === 'move') patch = { startDate: toISODate(addDays(s, delta)), dueDate: toISODate(addDays(d, delta)) }
    else if (mode === 'end') patch = { startDate: start, dueDate: toISODate(addDays(d, Math.max(delta, -differenceInCalendarDays(d, s)))) }
    else patch = { dueDate: due, startDate: toISODate(addDays(s, Math.min(delta, differenceInCalendarDays(d, s)))) }
    updateTask(id, patch)
    if (cascade && patch.dueDate && patch.dueDate > due) shiftDependents(id, patch.dueDate)
  }

  const geometry = (t: Task) => {
    const sp = spanOf(t)
    if (!sp) return null
    let s = parseISO(sp.s)
    let e = parseISO(sp.e)
    if (drag?.id === t.id) {
      if (drag.mode !== 'end') s = addDays(s, drag.delta)
      if (drag.mode !== 'start') e = addDays(e, drag.delta)
      if (e < s) [s, e] = drag.mode === 'end' ? [s, s] : [e, e]
    }
    return { left: differenceInCalendarDays(s, origin) * dayW, width: Math.max(dayW, (differenceInCalendarDays(e, s) + 1) * dayW), s, e }
  }
  const progress = (t: Task) => {
    const subs = all.filter((x) => x.parentId === t.id)
    const total = t.checklist.length + subs.length
    if (r.isDone(t)) return 1
    return total ? (t.checklist.filter((c) => c.done).length + subs.filter((x) => r.isDone(x)).length) / total : 0
  }

  const todayX = differenceInCalendarDays(new Date(), origin) * dayW + dayW / 2
  // Header ticks: every day when zoomed in; weeks or months when zoomed out.
  const ticks = days.filter((d) => (zoom === 'day' ? true : zoom === 'week' ? d.getDay() === 1 : d.getDate() === 1))
  const scheduled = rows.filter((t) => spanOf(t))
  const btn = 'border-app hover-surface rounded-md border px-2.5 py-1 text-xs font-medium'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-app flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm">
        <span className="font-semibold">
          {format(origin, 'MMM d')} – {format(addDays(origin, DAYS - 1), 'MMM d, yyyy')}
        </span>
        <span className="text-faint hidden text-xs xl:inline">
          {scheduled.length}/{rows.length} scheduled · drag bars to move · edges to resize · <Link2 size={11} className="inline" /> dot to link
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <label className="text-muted flex items-center gap-1 text-xs" title="Moving a task later pushes the tasks waiting on it">
            <input type="checkbox" checked={cascade} onChange={(e) => setCascade(e.target.checked)} className="accent-brand-600 h-3.5 w-3.5" /> Shift dependents
          </label>
          <label className="text-muted flex items-center gap-1 text-xs" title="Highlight the chain of tasks that decides the end date">
            <input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)} className="accent-brand-600 h-3.5 w-3.5" /> Critical path
          </label>
          <select value={order} onChange={(e) => setOrder(e.target.value as 'start' | 'manual')} className="border-app surface h-7 rounded-md border px-1.5 text-xs" aria-label="Row order">
            <option value="start">Order: start date</option>
            <option value="manual">Order: as listed</option>
          </select>
          <div className="border-app flex rounded-md border p-0.5 text-xs">
            {(['day', 'week', 'month'] as const).map((z) => (
              <button key={z} onClick={() => setZoom(z)} className={cn('rounded px-2 py-0.5 capitalize', zoom === z ? 'surface-muted text-app font-medium' : 'text-muted')}>
                {z}
              </button>
            ))}
          </div>
          <button onClick={() => setOrigin(anchor(zoom))} className={btn}>
            Today
          </button>
          <button onClick={() => setOrigin((o) => addDays(o, -step))} className="hover-surface rounded-md p-1.5" aria-label="Earlier">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setOrigin((o) => addDays(o, step))} className="hover-surface rounded-md p-1.5" aria-label="Later">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 overflow-auto scroll-thin" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        {/* Left task column */}
        <div className="surface border-app sticky left-0 z-20 w-56 shrink-0 border-r sm:w-72">
          <div className="border-app surface-subtle text-faint sticky top-0 z-10 flex h-12 items-end border-b px-3 pb-1.5 text-[11px] font-semibold uppercase">Task</div>
          {rows.map((t) => {
            const g = spanOf(t)
            return (
              <button key={t.id} onClick={() => openTask(t.id)} className={cn('border-app hover-surface flex w-full items-center gap-2 border-b px-3 text-left text-[13px]', path.has(t.id) && 'bg-red-50 dark:bg-red-500/10')} style={{ height: ROW_H }}>
                <StatusDot status={r.statusOf(t)} size={12} />
                <span className={cn('min-w-0 flex-1 truncate', r.isDone(t) && 'text-faint line-through')}>{t.title}</span>
                {g && <span className="text-faint shrink-0 text-[10px] tabular-nums">{differenceInCalendarDays(parseISO(g.e), parseISO(g.s)) + 1}d</span>}
              </button>
            )
          })}
        </div>
        {/* Timeline */}
        <div className="relative" style={{ width }}>
          <div className="surface-subtle border-app sticky top-0 z-10 h-12 border-b">
            {ticks.map((d) => {
              const x = differenceInCalendarDays(d, origin) * dayW
              return (
                <div key={d.toISOString()} className={cn('border-app absolute bottom-0 flex flex-col justify-end border-l pb-1 pl-1 text-[10px]', isToday(d) && zoom === 'day' && 'text-brand-600 font-bold')} style={{ left: x, width: zoom === 'day' ? dayW : undefined, height: '100%' }}>
                  {zoom === 'day' ? (
                    <span className="flex flex-col items-center pr-1">
                      {d.getDate() === 1 || d.getDay() === 0 ? <span className="text-muted font-semibold">{format(d, 'MMM')}</span> : <span>&nbsp;</span>}
                      <span className="text-faint">{format(d, 'EEEEE')}</span>
                      <span>{format(d, 'd')}</span>
                    </span>
                  ) : zoom === 'week' ? (
                    <span className="whitespace-nowrap">
                      {d.getDate() <= 7 && <span className="text-muted block font-semibold">{format(d, 'MMM')}</span>}
                      {format(d, 'd')}
                    </span>
                  ) : (
                    <span className="text-muted font-semibold whitespace-nowrap">{format(d, d.getMonth() === 0 ? 'MMM yyyy' : 'MMM')}</span>
                  )}
                </div>
              )
            })}
          </div>
          {zoom === 'day' && (
            <div className="pointer-events-none absolute top-12 bottom-0 left-0 flex">
              {days.map((d) => (
                <div key={d.toISOString()} className={cn('border-app h-full shrink-0 border-r', isWeekend(d) && 'surface-subtle')} style={{ width: dayW }} />
              ))}
            </div>
          )}
          {zoom !== 'day' &&
            ticks.map((d) => <div key={d.toISOString()} className="border-app pointer-events-none absolute top-12 bottom-0 border-l" style={{ left: differenceInCalendarDays(d, origin) * dayW }} />)}
          {todayX > 0 && todayX < width && (
            <div className="bg-brand-500 pointer-events-none absolute top-12 bottom-0 z-[5] w-px" style={{ left: todayX }}>
              <span className="bg-brand-500 absolute -top-1 -left-1 h-2 w-2 rounded-full" />
            </div>
          )}
          <div data-timeline className="relative">
            {/* Dependency arrows: blocker's end → dependent's start. Click one to remove it. */}
            <svg className="absolute top-0 left-0 z-[6] overflow-visible" width={width} height={rows.length * ROW_H} style={{ pointerEvents: 'none' }}>
              <defs>
                <marker id="gantt-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill="#64748b" />
                </marker>
                <marker id="gantt-arrow-red" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill="#ef4444" />
                </marker>
              </defs>
              {rows.flatMap((t, row) =>
                t.blockedBy.map((bId) => {
                  const bRow = rows.findIndex((x) => x.id === bId)
                  const from = bRow >= 0 ? geometry(rows[bRow]) : null
                  const to = geometry(t)
                  if (!from || !to) return null
                  const x1 = from.left + from.width
                  const y1 = bRow * ROW_H + ROW_H / 2
                  const x2 = to.left - 2
                  const y2 = row * ROW_H + ROW_H / 2
                  const mid = Math.max(x1 + 8, Math.min(x2 - 8, (x1 + x2) / 2))
                  const late = x2 < x1
                  const hot = late || (path.has(t.id) && path.has(bId))
                  const d = `M${x1},${y1} H${mid} V${y2} H${x2}`
                  return (
                    <g key={`${bId}-${t.id}`}>
                      <path d={d} fill="none" stroke={hot ? '#ef4444' : '#64748b'} strokeWidth={hot ? 2 : 1.5} strokeDasharray={late ? '4 3' : undefined} markerEnd={hot ? 'url(#gantt-arrow-red)' : 'url(#gantt-arrow)'} />
                      <path d={d} fill="none" stroke="transparent" strokeWidth={10} style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onClick={() => confirm(`Remove the link “${rows[bRow].title}” → “${t.title}”?`) && removeDependency(t.id, bId)}>
                        <title>{late ? 'Starts before its blocker ends' : 'Click to remove this link'}</title>
                      </path>
                    </g>
                  )
                }),
              )}
              {link && <path d={`M${link.x},${link.y} L${link.x2},${link.y2}`} stroke="#0b7f71" strokeWidth={2} strokeDasharray="4 3" fill="none" />}
            </svg>
            {rows.map((t, row) => {
              const g = geometry(t)
              const st = r.statusOf(t)
              const p = progress(t)
              const onPath = path.has(t.id)
              return (
                <div key={t.id} className={cn('border-app relative border-b', onPath && 'bg-red-50/50 dark:bg-red-500/5')} style={{ height: ROW_H }}>
                  {g && (
                    <div
                      onPointerDown={(e) => onPointerDown(e, t, 'move')}
                      className={cn('group absolute top-1.5 flex cursor-grab touch-none items-center overflow-visible rounded-md text-[11px] font-semibold text-white shadow-sm select-none', drag?.id === t.id && 'cursor-grabbing ring-2 ring-black/10', onPath && 'ring-2 ring-red-500')}
                      style={{ left: g.left, width: g.width, height: ROW_H - 12, background: st?.color }}
                      title={`${t.title}\n${format(g.s, 'MMM d')} – ${format(g.e, 'MMM d')}${p ? ` · ${Math.round(p * 100)}% done` : ''}`}
                    >
                      {p > 0 && p < 1 && <span className="absolute inset-y-0 left-0 rounded-l-md bg-black/15" style={{ width: `${p * 100}%` }} />}
                      <span onPointerDown={(e) => onPointerDown(e, t, 'start')} className="absolute inset-y-0 left-0 z-[1] w-2 cursor-ew-resize rounded-l-md group-hover:bg-black/15" />
                      <span className="relative truncate px-2">{g.width > 60 ? t.title : ''}</span>
                      {g.width <= 60 && <span className="text-app pointer-events-none absolute top-1/2 left-full ml-4 -translate-y-1/2 truncate font-medium whitespace-nowrap">{t.title}</span>}
                      <span onPointerDown={(e) => onPointerDown(e, t, 'end')} className="absolute inset-y-0 right-0 z-[1] w-2 cursor-ew-resize rounded-r-md group-hover:bg-black/15" />
                      <span
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                          const x = g.left + g.width
                          const y = row * ROW_H + ROW_H / 2
                          setLink({ from: t.id, x, y, x2: x, y2: y })
                        }}
                        className="border-brand-600 absolute top-1/2 -right-3 z-[2] hidden h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 bg-white group-hover:block"
                        title="Drag to another task to make it wait on this one"
                      />
                    </div>
                  )}
                  {!g && (
                    <button
                      onClick={() => updateTask(t.id, { startDate: toISODate(new Date()), dueDate: toISODate(addDays(new Date(), 2)) })}
                      className="text-faint hover:text-app absolute top-2 text-[11px]"
                      style={{ left: Math.max(4, Math.min(width - 80, todayX - 30)) }}
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
    </div>
  )
}
