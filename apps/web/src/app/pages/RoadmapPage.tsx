import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, addMonths, differenceInCalendarDays, endOfMonth, format, parseISO, startOfMonth, startOfQuarter } from 'date-fns'
import { ChevronDown, ChevronRight, Map as MapIcon, Plus } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { ID, Task } from '../../store/types'
import { useTaskResolver } from '../hooks'
import { IssueIcon, epicColor, useEpicProgress } from '../components/issue'
import { useCreateTask } from '../task/CreateTaskModal'
import { cn, toISODate } from '../../lib/utils'
import { useQueryState } from '../../lib/useQueryState'

type Zoom = 'months' | 'quarters'
const DAY_PX: Record<Zoom, number> = { months: 5, quarters: 1.8 }
const ROW = 40
const LEFT = 320

interface Span {
  start: string | null
  end: string | null
  /** dates come from the children because the epic has none of its own */
  derived: boolean
}

/** An epic's span: its own dates, or else the earliest start and latest due of its children. */
function spanOf(epic: Task, kids: Task[]): Span {
  if (epic.startDate || epic.dueDate) return { start: epic.startDate ?? epic.dueDate, end: epic.dueDate ?? epic.startDate, derived: false }
  const starts = kids.map((k) => k.startDate ?? k.dueDate).filter((d): d is string => !!d).sort()
  const ends = kids.map((k) => k.dueDate ?? k.startDate).filter((d): d is string => !!d).sort()
  return { start: starts[0] ?? null, end: ends[ends.length - 1] ?? null, derived: true }
}

/** Epics across every Space on one timeline, Jira-style. */
export default function RoadmapPage() {
  const s = useStore()
  const r = useTaskResolver()
  const progress = useEpicProgress()
  const [zoom, setZoom] = useQueryState<Zoom>('zoom', 'months')
  const [spaceFilter, setSpaceFilter] = useQueryState<string>('space', '')
  const [open, setOpen] = useState<Set<ID>>(new Set())
  const scroller = useRef<HTMLDivElement>(null)

  const epics = useMemo(
    () => s.tasks.filter((t) => t.issueType === 'epic' && (!spaceFilter || r.spaceOf(t)?.id === spaceFilter)).sort((a, b) => (a.startDate ?? a.dueDate ?? '9').localeCompare(b.startDate ?? b.dueDate ?? '9') || a.key - b.key),
    [s.tasks, spaceFilter, r],
  )
  const kidsOf = useMemo(() => {
    const m = new Map<ID, Task[]>()
    for (const t of s.tasks) if (t.epicId) m.set(t.epicId, [...(m.get(t.epicId) ?? []), t])
    return m
  }, [s.tasks])

  // The visible range covers every dated epic plus a little context around today.
  const { from, to } = useMemo(() => {
    const dates = epics.flatMap((e) => {
      const sp = spanOf(e, kidsOf.get(e.id) ?? [])
      return [sp.start, sp.end].filter((d): d is string => !!d).map((d) => parseISO(d))
    })
    const today = new Date()
    const min = new Date(Math.min(addMonths(today, -1).getTime(), ...dates.map((d) => d.getTime())))
    const max = new Date(Math.max(addMonths(today, zoom === 'months' ? 6 : 12).getTime(), ...dates.map((d) => d.getTime())))
    return { from: zoom === 'months' ? startOfMonth(min) : startOfQuarter(min), to: endOfMonth(addMonths(max, 1)) }
  }, [epics, kidsOf, zoom])

  const px = DAY_PX[zoom]
  const days = differenceInCalendarDays(to, from) + 1
  const width = days * px
  const x = (d: string) => differenceInCalendarDays(parseISO(d), from) * px
  const months: Date[] = []
  for (let m = startOfMonth(from); m <= to; m = addMonths(m, 1)) months.push(m)
  const todayX = differenceInCalendarDays(new Date(), from) * px

  const groups = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const e of epics) {
      const sp = r.spaceOf(e)?.id ?? ''
      m.set(sp, [...(m.get(sp) ?? []), e])
    }
    return [...m]
  }, [epics, r])

  const toggle = (id: ID) => setOpen((o) => {
    const n = new Set(o)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })
  const newEpic = () => useCreateTask.getState().open({ issueType: 'epic', listId: spaceFilter ? s.lists.find((l) => l.spaceId === spaceFilter)?.id : undefined })
  const scrollToToday = (behavior: ScrollBehavior = 'smooth') => scroller.current?.scrollTo({ left: Math.max(0, todayX - 200), behavior })
  // Open on today rather than the start of the range.
  const hasEpics = epics.length > 0
  useEffect(() => {
    if (hasEpics) scrollToToday('auto')
  }, [hasEpics, zoom]) // only when the timeline appears or its scale changes

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-app flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <MapIcon size={18} className="text-brand-600" />
        <h1 className="text-base font-semibold">Roadmap</h1>
        <span className="text-muted hidden text-sm sm:inline">— epics across every Space</span>
        <div className="ml-auto flex items-center gap-2">
          <select value={spaceFilter} onChange={(e) => setSpaceFilter(e.target.value)} className="border-app surface h-8 rounded-md border px-2 text-sm" aria-label="Space">
            <option value="">All Spaces</option>
            {s.spaces.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>
          <div className="border-app flex rounded-md border p-0.5 text-xs">
            {(['months', 'quarters'] as const).map((z) => (
              <button key={z} onClick={() => setZoom(z)} className={cn('rounded px-2 py-1 capitalize', zoom === z ? 'surface-muted font-semibold' : 'text-muted')}>
                {z}
              </button>
            ))}
          </div>
          <button onClick={() => scrollToToday()} className="border-app hover-surface h-8 rounded-md border px-2.5 text-sm">
            Today
          </button>
          <button onClick={newEpic} className="bg-brand-600 hover:bg-brand-700 inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-semibold text-white">
            <Plus size={15} /> Epic
          </button>
        </div>
      </div>

      {epics.length === 0 ? (
        <div className="text-muted m-auto flex max-w-sm flex-col items-center gap-2 p-10 text-center text-sm">
          <IssueIcon type="epic" size={28} />
          <span className="text-app font-semibold">No epics yet</span>
          Epics group related tasks across Lists and Spaces. Create one, then link tasks to it from their Epic field.
          <button onClick={newEpic} className="bg-brand-600 mt-2 rounded-lg px-4 py-1.5 text-sm font-semibold text-white">
            Create an epic
          </button>
        </div>
      ) : (
        <div ref={scroller} className="scroll-thin min-h-0 flex-1 overflow-auto">
          <div className="relative" style={{ width: LEFT + width }}>
            {/* month header */}
            <div className="border-app sticky top-0 z-20 flex border-b bg-[var(--bg)]" style={{ height: 36 }}>
              <div className="border-app sticky left-0 z-10 flex shrink-0 items-center border-r bg-[var(--bg)] px-3 text-xs font-semibold" style={{ width: LEFT }}>
                Epic
              </div>
              <div className="relative" style={{ width }}>
                {months.map((m) => (
                  <div key={m.toISOString()} className="border-app text-muted absolute top-0 flex h-full items-center border-l px-2 text-[11px] font-medium whitespace-nowrap" style={{ left: Math.max(0, x(toISODate(m))), width: (differenceInCalendarDays(endOfMonth(m), m) + 1) * px }}>
                    {zoom === 'quarters' && m.getMonth() % 3 !== 0 ? '' : format(m, zoom === 'months' ? 'MMM yyyy' : "'Q'Q yyyy")}
                  </div>
                ))}
              </div>
            </div>

            {/* today line */}
            <div className="pointer-events-none absolute top-9 bottom-0 z-[5] w-px bg-red-500/70" style={{ left: LEFT + todayX }} />

            {groups.map(([spaceId, list]) => {
              const space = s.spaces.find((sp) => sp.id === spaceId)
              return (
                <div key={spaceId}>
                  <div className="surface-subtle border-app sticky left-0 flex items-center gap-2 border-b px-3 py-1.5 text-xs font-semibold" style={{ width: LEFT + width }}>
                    <span className="h-2.5 w-2.5 rounded" style={{ background: space?.color }} /> {space?.name ?? 'Space'}
                    <span className="text-faint font-normal">{list.length}</span>
                  </div>
                  {list.map((e) => {
                    const kids = kidsOf.get(e.id) ?? []
                    const p = progress.get(e.id)
                    const pct = p?.total ? Math.round((p.done / p.total) * 100) : 0
                    const span = spanOf(e, kids)
                    const expanded = open.has(e.id)
                    return (
                      <div key={e.id}>
                        <Row>
                          <div className="border-app sticky left-0 z-10 flex shrink-0 items-center gap-1.5 border-r bg-[var(--bg)] px-2" style={{ width: LEFT, height: ROW }}>
                            <button onClick={() => toggle(e.id)} disabled={!kids.length} className="text-faint hover:text-app rounded p-0.5 disabled:opacity-0" aria-label={expanded ? 'Collapse' : 'Expand'}>
                              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <IssueIcon type="epic" size={15} />
                            <button onClick={() => s.openTask(e.id)} className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline">
                              {e.title}
                            </button>
                            <span className="text-faint shrink-0 text-[11px] tabular-nums">{p ? `${p.done}/${p.total}` : '0'}</span>
                          </div>
                          <div className="relative" style={{ width, height: ROW }}>
                            {span.start && span.end ? (
                              <EpicBar epic={e} span={{ start: span.start, end: span.end }} left={x(span.start)} width={Math.max(px * 2, x(span.end) - x(span.start) + px)} px={px} pct={pct} derived={span.derived} />
                            ) : (
                              <button
                                onClick={() => s.updateTask(e.id, { startDate: toISODate(new Date()), dueDate: toISODate(addDays(new Date(), 30)) })}
                                className="text-faint hover:text-app absolute top-2.5 rounded border border-dashed border-[var(--border)] px-2 py-0.5 text-[11px]"
                                style={{ left: Math.max(4, todayX + 4) }}
                              >
                                No dates — schedule from today
                              </button>
                            )}
                          </div>
                        </Row>
                        {expanded &&
                          kids.map((k) => (
                            <Row key={k.id}>
                              <div className="border-app sticky left-0 z-10 flex shrink-0 items-center gap-1.5 border-r bg-[var(--bg)] pr-2 pl-9" style={{ width: LEFT, height: 32 }}>
                                <IssueIcon type={k.issueType} size={13} />
                                <button onClick={() => s.openTask(k.id)} className={cn('min-w-0 flex-1 truncate text-left text-[13px] hover:underline', r.isDone(k) && 'text-faint line-through')}>
                                  {k.title}
                                </button>
                                <span className="shrink-0 rounded px-1 text-[9px] font-semibold uppercase text-white" style={{ background: r.statusOf(k)?.color }}>
                                  {r.statusOf(k)?.name}
                                </span>
                              </div>
                              <div className="relative" style={{ width, height: 32 }}>
                                {(k.startDate || k.dueDate) && (
                                  <div
                                    onClick={() => s.openTask(k.id)}
                                    className="absolute top-2.5 h-3 cursor-pointer rounded-full opacity-80 hover:opacity-100"
                                    style={{ left: x(k.startDate ?? k.dueDate!), width: Math.max(8, x(k.dueDate ?? k.startDate!) - x(k.startDate ?? k.dueDate!) + px), background: r.isDone(k) ? '#10b981' : epicColor(e.id) }}
                                    title={`${k.title} · ${k.startDate ?? ''} → ${k.dueDate ?? ''}`}
                                  />
                                )}
                              </div>
                            </Row>
                          ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="border-app hover-surface flex border-b">{children}</div>
}

/** A draggable epic bar: drag to move, drag either end to resize. */
function EpicBar({ epic, span, left, width, px, pct, derived }: { epic: Task; span: { start: string; end: string }; left: number; width: number; px: number; pct: number; derived: boolean }) {
  const updateTask = useStore((s) => s.updateTask)
  const openTask = useStore((s) => s.openTask)
  const [drag, setDrag] = useState<{ mode: 'move' | 'start' | 'end'; x0: number; dx: number } | null>(null)
  const color = epicColor(epic.id)
  const dDays = drag ? Math.round(drag.dx / px) : 0
  const l = left + (drag && drag.mode !== 'end' ? dDays * px : 0)
  const w = width + (drag?.mode === 'end' ? dDays * px : drag?.mode === 'start' ? -dDays * px : 0)

  const start = (mode: 'move' | 'start' | 'end') => (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ mode, x0: e.clientX, dx: 0 })
  }
  const end = () => {
    if (!drag) return
    const n = Math.round(drag.dx / px)
    setDrag(null)
    if (n === 0) {
      if (drag.mode === 'move') openTask(epic.id)
      return
    }
    // A span derived from child issues becomes the epic's own dates once it's moved.
    const s0 = parseISO(span.start)
    const e0 = parseISO(span.end)
    const nextStart = drag.mode === 'end' ? s0 : addDays(s0, n)
    const nextEnd = drag.mode === 'start' ? e0 : addDays(e0, n)
    if (nextEnd < nextStart) return
    updateTask(epic.id, { startDate: toISODate(nextStart), dueDate: toISODate(nextEnd) })
  }

  return (
    <div
      className={cn('group absolute top-2 flex h-6 cursor-grab items-center overflow-hidden rounded-md text-[11px] font-medium text-white shadow-sm select-none active:cursor-grabbing', derived && 'opacity-80')}
      style={{ left: l, width: Math.max(w, px * 2), background: `${color}66`, outline: derived ? `1px dashed ${color}` : undefined }}
      onPointerDown={start('move')}
      onPointerMove={(e) => drag && setDrag({ ...drag, dx: e.clientX - drag.x0 })}
      onPointerUp={end}
      title={`${epic.title}${derived ? ' (dates from child issues)' : ''} · ${pct}% done`}
    >
      <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: color }} />
      <span className="relative truncate px-2">
        {pct}% · {epic.title}
      </span>
      <span onPointerDown={start('start')} className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100" style={{ background: 'rgba(255,255,255,.5)' }} />
      <span onPointerDown={start('end')} className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100" style={{ background: 'rgba(255,255,255,.5)' }} />
    </div>
  )
}
