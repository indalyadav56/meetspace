import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { parseISO, differenceInCalendarDays } from 'date-fns'
import {
  Ban,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsLeftRight,
  Columns3,
  Copy,
  ExternalLink,
  Eye,
  Film,
  GitBranch,
  Hash,
  Link2,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Rows3,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { ID, Priority, StatusType, Task } from '../../store/types'
import { useTaskResolver } from '../hooks'
import { Avatar, AvatarStack, MenuItem, Popover, PriorityFlag, StatusPill, Tag, usePopover } from '../components/ui'
import { PRIORITIES, cn, friendlyDate } from '../../lib/utils'
import { useCreateTask, type CreateTaskDefaults } from '../task/CreateTaskModal'
import type { ViewProps } from './ListView'

/* ───────────────────────── preferences ───────────────────────── */

type ColBy = 'status' | 'assignee' | 'priority'
type LaneBy = 'none' | 'assignee' | 'priority' | 'list'
type Field = 'key' | 'location' | 'tags' | 'progress' | 'due' | 'priority' | 'points' | 'assignees' | 'counts'
const FIELD_LABELS: Record<Field, string> = {
  key: 'Task ID',
  location: 'Location',
  tags: 'Tags',
  progress: 'Subtask progress',
  due: 'Due date',
  priority: 'Priority',
  points: 'Story points',
  assignees: 'Assignees',
  counts: 'Subtasks, comments & clips',
}
const COL_LABELS: Record<ColBy, string> = { status: 'Status', assignee: 'Assignee', priority: 'Priority' }
const LANE_LABELS: Record<LaneBy, string> = { none: 'None', assignee: 'Assignee', priority: 'Priority', list: 'List' }

interface BoardPrefs {
  colBy: ColBy
  lanes: LaneBy
  fields: Field[]
  density: 'comfortable' | 'compact'
  hideEmpty: boolean
  collapsed: string[]
  collapsedLanes: string[]
  /** max cards per column before its header turns red (Jira's column constraint) */
  wip: Record<string, number>
}
const DEFAULTS: BoardPrefs = {
  colBy: 'status',
  lanes: 'none',
  fields: ['key', 'location', 'tags', 'progress', 'due', 'priority', 'points', 'assignees', 'counts'],
  density: 'comfortable',
  hideEmpty: false,
  collapsed: [],
  collapsedLanes: [],
  wip: {},
}

function useBoardPrefs(viewKey: string) {
  const key = `ms.board.${viewKey}`
  const [prefs, setState] = useState<BoardPrefs>(() => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(key) ?? '{}') }
    } catch {
      return DEFAULTS
    }
  })
  const set = useCallback(
    (patch: Partial<BoardPrefs>) =>
      setState((p) => {
        const next = { ...p, ...patch }
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          /* storage blocked */
        }
        return next
      }),
    [key],
  )
  return [prefs, set] as const
}

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x])

/* ───────────────────────── grouping ───────────────────────── */

interface Group {
  key: string
  name: string
  color: string
  icon?: ReactNode
}
const NONE = '__none'
const SEP = '|'
const cellId = (lane: string, col: string) => `cell${SEP}${lane}${SEP}${col}`
const cardId = (lane: string, col: string, task: ID) => `${lane}${SEP}${col}${SEP}${task}`
const parseId = (id: string) => {
  const parts = id.split(SEP)
  return parts[0] === 'cell' ? { lane: parts[1], col: parts[2], task: null } : { lane: parts[0], col: parts[1], task: parts[2] }
}

const PRIORITY_GROUPS: Group[] = [
  ...PRIORITIES.map((p) => ({ key: p.value, name: p.label, color: p.color })),
  { key: NONE, name: 'No priority', color: '#cbd5e1' },
]

/** In a cross-space board the columns are status types; find the task's own status of that type. */
function useRealStatus() {
  const r = useTaskResolver()
  const all = useStore((s) => s.tasks)
  return (virtualId: ID, taskId: ID) => {
    const type = virtualId.replace(/^v-/, '')
    const t = all.find((x) => x.id === taskId)
    return (t && r.spaceOf(t)?.statuses.find((st) => st.type === type)?.id) ?? null
  }
}

/* ───────────────────────── board ───────────────────────── */

export default function BoardView({ tasks, statuses, defaultListId, mixed, viewKey }: ViewProps) {
  const s = useStore()
  const r = useTaskResolver()
  const realStatus = useRealStatus()
  const [prefs, setPrefs] = useBoardPrefs(viewKey ?? defaultListId)
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const lanesBy: LaneBy = prefs.lanes === prefs.colBy ? 'none' : prefs.lanes

  const userGroups = useMemo(() => {
    const ids = [...new Set(tasks.flatMap((t) => t.assignees))]
    const me = s.currentUserId
    ids.sort((a, b) => (a === me ? -1 : b === me ? 1 : (s.users.find((u) => u.id === a)?.name ?? '').localeCompare(s.users.find((u) => u.id === b)?.name ?? '')))
    return [
      ...ids.map((id) => {
        const u = s.users.find((x) => x.id === id)
        return { key: id, name: u ? (id === me ? `${u.name.split(' ')[0]} (you)` : u.name) : 'Former member', color: u?.color ?? '#94a3b8', icon: <Avatar userId={id} size={18} /> }
      }),
      { key: NONE, name: 'Unassigned', color: '#94a3b8', icon: <UserRound size={14} className="text-faint" /> },
    ]
  }, [tasks, s.users, s.currentUserId])

  const groupsFor = (by: ColBy | LaneBy): Group[] => {
    if (by === 'status') return statuses.map((st) => ({ key: st.id, name: st.name, color: st.color }))
    if (by === 'assignee') return userGroups
    if (by === 'priority') return PRIORITY_GROUPS
    if (by === 'list') {
      const ids = [...new Set(tasks.map((t) => t.listId))]
      return ids.map((id) => {
        const list = s.lists.find((l) => l.id === id)
        const space = s.spaces.find((sp) => sp.id === list?.spaceId)
        return { key: id, name: mixed && space ? `${space.name} / ${list?.name ?? ''}` : (list?.name ?? 'List'), color: space?.color ?? '#94a3b8' }
      })
    }
    return [{ key: '_', name: '', color: '' }]
  }
  /** Which groups a task belongs to; a task with two assignees shows in both assignee columns. */
  const keysOf = (t: Task, by: ColBy | LaneBy, single = false): string[] => {
    if (by === 'status') return [t.statusId]
    if (by === 'assignee') return t.assignees.length ? (single ? [t.assignees[0]] : t.assignees) : [NONE]
    if (by === 'priority') return [t.priority ?? NONE]
    if (by === 'list') return [t.listId]
    return ['_']
  }

  const cols = groupsFor(prefs.colBy)
  const lanes = groupsFor(lanesBy)
  const cells = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of tasks)
      for (const lane of keysOf(t, lanesBy, true))
        for (const col of keysOf(t, prefs.colBy)) {
          const k = `${lane}${SEP}${col}`
          m.set(k, [...(m.get(k) ?? []), t])
        }
    return m
  }, [tasks, lanesBy, prefs.colBy]) // keysOf depends only on the grouping choices
  const inCol = (col: string) => lanes.flatMap((l) => cells.get(`${l.key}${SEP}${col}`) ?? [])
  const shownCols = prefs.hideEmpty ? cols.filter((c) => inCol(c.key).length > 0 || prefs.colBy === 'status') : cols
  const shownLanes = lanesBy === 'none' ? lanes : lanes.filter((l) => shownCols.some((c) => (cells.get(`${l.key}${SEP}${c.key}`) ?? []).length))

  // Subtask progress for every card in one pass.
  const progress = useMemo(() => {
    const m = new Map<ID, { done: number; total: number }>()
    for (const t of s.tasks) {
      if (!t.parentId) continue
      const p = m.get(t.parentId) ?? { done: 0, total: 0 }
      p.total++
      if (r.isDone(t)) p.done++
      m.set(t.parentId, p)
    }
    return m
  }, [s.tasks, r])

  /** Field changes implied by moving a card between columns and lanes. */
  const patchFor = (t: Task, by: ColBy | LaneBy, from: string, to: string): Partial<Task> | null => {
    if (from === to) return null
    if (by === 'assignee') {
      const rest = t.assignees.filter((a) => a !== from)
      return { assignees: to === NONE ? rest : [...new Set([...rest, to])] }
    }
    if (by === 'priority') return { priority: to === NONE ? null : (to as Priority) }
    if (by === 'list') {
      const sameSpace = s.lists.find((l) => l.id === to)?.spaceId === s.lists.find((l) => l.id === t.listId)?.spaceId
      if (!sameSpace) {
        s.toast('Move a task to another Space from the task itself', 'error')
        return null
      }
      return { listId: to }
    }
    return null
  }

  const onEnd = (e: DragEndEvent) => {
    setActiveId(null)
    if (!e.over) return
    const from = parseId(String(e.active.id))
    const to = parseId(String(e.over.id))
    const task = s.tasks.find((t) => t.id === from.task)
    if (!task) return
    const overTask = to.task && to.task !== task.id ? to.task : null
    const patch: Partial<Task> = { ...patchFor(task, lanesBy, from.lane, to.lane) }
    if (prefs.colBy === 'status') {
      if (mixed) {
        if (from.col !== to.col) {
          const real = realStatus(to.col, task.id)
          if (real) patch.statusId = real
        }
      } else if (from.col !== to.col || overTask) {
        // Real statuses keep manual order, so drop position matters.
        s.moveTask(task.id, to.col, overTask)
      }
    } else Object.assign(patch, patchFor(task, prefs.colBy, from.col, to.col))
    if (Object.keys(patch).length) s.updateTask(task.id, patch)
  }

  const addDefaults = (lane: string, col: string): CreateTaskDefaults => {
    const d: CreateTaskDefaults = mixed ? {} : { listId: defaultListId }
    const apply = (by: ColBy | LaneBy, key: string) => {
      if (by === 'status') Object.assign(d, mixed ? { statusType: key.replace(/^v-/, '') as StatusType } : { statusId: key })
      if (by === 'assignee' && key !== NONE) d.assignees = [key]
      if (by === 'priority' && key !== NONE) d.priority = key as Priority
      if (by === 'list') d.listId = key
    }
    apply(prefs.colBy, col)
    apply(lanesBy, lane)
    return d
  }
  const add = (lane: string, col: string) => useCreateTask.getState().open(addDefaults(lane, col))

  const active = activeId ? s.tasks.find((t) => t.id === parseId(activeId).task) : undefined
  const pointsOf = (ts: Task[]) => ts.reduce((n, t) => n + (t.points ?? 0), 0)
  const colW = (key: string) => (prefs.collapsed.includes(key) ? 44 : prefs.density === 'compact' ? 248 : 280)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <BoardBar prefs={prefs} setPrefs={setPrefs} cols={cols} />
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onEnd} onDragCancel={() => setActiveId(null)}>
        <div className="scroll-thin min-h-0 flex-1 overflow-auto">
          <div className="inline-flex min-w-full flex-col px-4 pb-4">
            {/* Column headers stay on top while the board scrolls. */}
            <div className="sticky top-0 z-10 flex gap-3 bg-[var(--bg)] pt-3 pb-2">
              {shownCols.map((c) => (
                <ColumnHeader
                  key={c.key}
                  group={c}
                  width={colW(c.key)}
                  tasks={inCol(c.key)}
                  points={pointsOf(inCol(c.key))}
                  collapsed={prefs.collapsed.includes(c.key)}
                  wip={prefs.wip[c.key]}
                  onCollapse={() => setPrefs({ collapsed: toggle(prefs.collapsed, c.key) })}
                  onWip={(n) => setPrefs({ wip: { ...prefs.wip, [c.key]: n } })}
                  onAdd={() => add(lanes[0]?.key ?? '_', c.key)}
                />
              ))}
            </div>

            {shownLanes.map((lane) => {
              const laneTasks = shownCols.flatMap((c) => cells.get(`${lane.key}${SEP}${c.key}`) ?? [])
              const closed = prefs.collapsedLanes.includes(lane.key)
              return (
                <div key={lane.key} className={cn(lanesBy !== 'none' && 'mb-2')}>
                  {lanesBy !== 'none' && (
                    <button
                      onClick={() => setPrefs({ collapsedLanes: toggle(prefs.collapsedLanes, lane.key) })}
                      className="hover-surface sticky left-0 my-1 flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] font-semibold"
                      aria-expanded={!closed}
                    >
                      {closed ? <ChevronRight size={14} className="text-faint" /> : <ChevronDown size={14} className="text-faint" />}
                      {lane.icon ?? <span className="h-2.5 w-2.5 rounded-full" style={{ background: lane.color }} />}
                      {lane.name}
                      <span className="text-faint font-normal">{laneTasks.length}</span>
                      {pointsOf(laneTasks) > 0 && <span className="surface-muted text-muted rounded-full px-1.5 text-[11px] font-medium">{pointsOf(laneTasks)} pts</span>}
                    </button>
                  )}
                  {!closed && (
                    <div className="flex gap-3">
                      {shownCols.map((c) => (
                        <Cell
                          key={c.key}
                          id={cellId(lane.key, c.key)}
                          width={colW(c.key)}
                          color={c.color}
                          collapsed={prefs.collapsed.includes(c.key)}
                          tall={lanesBy === 'none'}
                          onAdd={() => add(lane.key, c.key)}
                        >
                          <SortableContext items={(cells.get(`${lane.key}${SEP}${c.key}`) ?? []).map((t) => cardId(lane.key, c.key, t.id))} strategy={verticalListSortingStrategy}>
                            {(cells.get(`${lane.key}${SEP}${c.key}`) ?? []).map((t) => (
                              <SortableCard key={t.id} id={cardId(lane.key, c.key, t.id)}>
                                <Card task={t} prefs={prefs} progress={progress.get(t.id)} showStatus={prefs.colBy !== 'status'} />
                              </SortableCard>
                            ))}
                          </SortableContext>
                        </Cell>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {shownLanes.length === 0 && <p className="text-muted py-16 text-center text-sm">No tasks match these filters.</p>}
          </div>
        </div>
        <DragOverlay>{active ? <Card task={active} prefs={prefs} progress={progress.get(active.id)} showStatus={prefs.colBy !== 'status'} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  )
}

/* ───────────────────────── toolbar ───────────────────────── */

const barBtn = 'border-app hover-surface inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium'

function BoardBar({ prefs, setPrefs, cols }: { prefs: BoardPrefs; setPrefs: (p: Partial<BoardPrefs>) => void; cols: Group[] }) {
  const colPop = usePopover()
  const lanePop = usePopover()
  const fieldPop = usePopover()
  const anyCollapsed = prefs.collapsed.length > 0 || prefs.collapsedLanes.length > 0
  return (
    <div className="border-app flex flex-wrap items-center gap-1.5 border-b px-4 py-1.5">
      <button onClick={colPop.toggle} className={barBtn} aria-label="Group columns by">
        <Columns3 size={13} /> Columns: <span className="text-brand-600">{COL_LABELS[prefs.colBy]}</span>
      </button>
      <Popover open={colPop.open} anchor={colPop.anchor} onClose={colPop.close} width={190}>
        <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">Columns by</div>
        {(Object.keys(COL_LABELS) as ColBy[]).map((k) => (
          <MenuItem key={k} active={prefs.colBy === k} onClick={() => (setPrefs({ colBy: k, collapsed: [], lanes: prefs.lanes === k ? 'none' : prefs.lanes }), colPop.close())}>
            {COL_LABELS[k]}
          </MenuItem>
        ))}
      </Popover>
      <button onClick={lanePop.toggle} className={cn(barBtn, prefs.lanes !== 'none' && 'border-brand-500 text-brand-700 dark:text-brand-200')} aria-label="Swimlanes">
        <Rows3 size={13} /> Swimlanes{prefs.lanes !== 'none' && `: ${LANE_LABELS[prefs.lanes]}`}
      </button>
      <Popover open={lanePop.open} anchor={lanePop.anchor} onClose={lanePop.close} width={190}>
        <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">Swimlanes by</div>
        {(Object.keys(LANE_LABELS) as LaneBy[])
          .filter((k) => k !== prefs.colBy)
          .map((k) => (
            <MenuItem key={k} active={prefs.lanes === k} onClick={() => (setPrefs({ lanes: k, collapsedLanes: [] }), lanePop.close())}>
              {LANE_LABELS[k]}
            </MenuItem>
          ))}
      </Popover>
      <button onClick={fieldPop.toggle} className={barBtn} aria-label="Card fields">
        <SlidersHorizontal size={13} /> Card
      </button>
      <Popover open={fieldPop.open} anchor={fieldPop.anchor} onClose={fieldPop.close} width={230}>
        <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">Density</div>
        <div className="mx-2 mb-1 grid grid-cols-2 gap-1 rounded-md bg-[var(--bg-subtle)] p-0.5">
          {(['comfortable', 'compact'] as const).map((d) => (
            <button key={d} onClick={() => setPrefs({ density: d })} className={cn('rounded px-2 py-1 text-xs capitalize', prefs.density === d ? 'surface font-semibold shadow-sm' : 'text-muted')}>
              {d}
            </button>
          ))}
        </div>
        <div className="text-faint px-2 pt-1 pb-0.5 text-[11px] font-semibold uppercase">Show on cards</div>
        {(Object.keys(FIELD_LABELS) as Field[]).map((f) => (
          <label key={f} className="hover-surface flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5">
            <input type="checkbox" checked={prefs.fields.includes(f)} onChange={() => setPrefs({ fields: toggle(prefs.fields, f) })} className="accent-brand-600" />
            {FIELD_LABELS[f]}
          </label>
        ))}
      </Popover>
      <label className={cn(barBtn, 'cursor-pointer')}>
        <input type="checkbox" checked={prefs.hideEmpty} onChange={(e) => setPrefs({ hideEmpty: e.target.checked })} className="accent-brand-600" /> Hide empty
      </label>
      {anyCollapsed && (
        <button onClick={() => setPrefs({ collapsed: [], collapsedLanes: [] })} className={barBtn}>
          <ChevronsLeftRight size={13} /> Expand all
        </button>
      )}
      {prefs.collapsed.length > 0 && <span className="text-faint text-[11px]">{prefs.collapsed.filter((k) => cols.some((c) => c.key === k)).length} collapsed</span>}
    </div>
  )
}

/* ───────────────────────── columns ───────────────────────── */

function ColumnHeader({
  group,
  width,
  tasks,
  points,
  collapsed,
  wip,
  onCollapse,
  onWip,
  onAdd,
}: {
  group: Group
  width: number
  tasks: Task[]
  points: number
  collapsed: boolean
  wip?: number
  onCollapse: () => void
  onWip: (n: number) => void
  onAdd: () => void
}) {
  const menu = usePopover()
  const over = !!wip && tasks.length > wip
  if (collapsed)
    return (
      <button onClick={onCollapse} style={{ width }} className="hover-surface flex shrink-0 flex-col items-center gap-2 rounded-lg bg-[var(--bg-subtle)] py-2" title={`Expand ${group.name}`} aria-label={`Expand ${group.name}`}>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: group.color }} />
        <span className="text-muted text-xs font-semibold">{tasks.length}</span>
      </button>
    )
  return (
    <div style={{ width, borderTopColor: group.color }} className={cn('group/col shrink-0 rounded-lg border-t-[3px] bg-[var(--bg-subtle)] px-2.5 py-2', over && 'bg-red-50 dark:bg-red-500/10')}>
      <div className="flex items-center gap-2">
        {group.icon}
        <span className="truncate text-xs font-semibold tracking-wide uppercase">{group.name}</span>
        <span className={cn('rounded-full px-1.5 text-[11px] font-semibold tabular-nums', over ? 'bg-red-500 text-white' : 'text-muted')} title={wip ? `WIP limit ${wip}` : undefined}>
          {tasks.length}
          {wip ? `/${wip}` : ''}
        </span>
        {points > 0 && <span className="text-faint text-[11px]">{points} pts</span>}
        <span className="ml-auto flex items-center opacity-60 group-hover/col:opacity-100">
          <button onClick={menu.toggle} className="hover-surface text-muted rounded p-1" aria-label={`${group.name} column options`}>
            <MoreHorizontal size={14} />
          </button>
          <button onClick={onAdd} className="hover-surface text-muted rounded p-1" aria-label={`Add task to ${group.name}`}>
            <Plus size={14} />
          </button>
        </span>
      </div>
      <Popover open={menu.open} anchor={menu.anchor} onClose={menu.close} align="end" width={210}>
        <MenuItem onClick={() => (onAdd(), menu.close())}>
          <Plus size={14} /> Add task
        </MenuItem>
        <MenuItem onClick={() => (onCollapse(), menu.close())}>
          <ChevronsLeftRight size={14} /> Collapse column
        </MenuItem>
        <MenuItem
          onClick={() => {
            menu.close()
            const v = prompt(`Most tasks allowed in “${group.name}” (0 for no limit)`, String(wip ?? 0))
            if (v !== null && Number.isFinite(Number(v)) && Number(v) >= 0) onWip(Math.floor(Number(v)))
          }}
        >
          <Hash size={14} /> {wip ? `WIP limit: ${wip}` : 'Set WIP limit'}
        </MenuItem>
      </Popover>
    </div>
  )
}

function Cell({ id, width, color, collapsed, tall, onAdd, children }: { id: string; width: number; color: string; collapsed: boolean; tall: boolean; onAdd: () => void; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  if (collapsed) return <div ref={setNodeRef} style={{ width }} className={cn('shrink-0 rounded-lg bg-[var(--bg-subtle)]', isOver && 'ring-brand-500 ring-2')} />
  return (
    <div
      ref={setNodeRef}
      style={{ width, background: isOver ? `${color}1f` : undefined }}
      className={cn('group/cell flex shrink-0 flex-col gap-2 rounded-lg bg-[var(--bg-subtle)] p-1.5 transition-colors', tall ? 'min-h-[calc(100vh-260px)]' : 'min-h-20', isOver && 'ring-brand-500 ring-2')}
    >
      {children}
      <button onClick={onAdd} className={cn('text-muted hover:text-app flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-[var(--bg-hover)]', !tall && 'opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100')}>
        <Plus size={14} /> Add task
      </button>
    </div>
  )
}

function SortableCard({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners} className={cn('outline-none', isDragging && 'opacity-30')}>
      {children}
    </div>
  )
}

/* ───────────────────────── card ───────────────────────── */

function dueTone(iso: string, done: boolean) {
  if (done) return 'text-faint'
  const d = differenceInCalendarDays(parseISO(iso), new Date())
  if (d < 0) return 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300'
  if (d === 0) return 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'
  if (d <= 2) return 'text-amber-600 dark:text-amber-300'
  return 'text-muted'
}

function Card({ task: shown, prefs, progress, showStatus, overlay }: { task: Task; prefs: BoardPrefs; progress?: { done: number; total: number }; showStatus: boolean; overlay?: boolean }) {
  const s = useStore()
  const r = useTaskResolver()
  // Cross-space boards pass tasks re-keyed onto virtual statuses; show the real one.
  const task = s.tasks.find((t) => t.id === shown.id) ?? shown
  const comments = useStore((st) => st.comments.reduce((n, c) => n + (c.taskId === task.id ? 1 : 0), 0))
  const done = r.isDone(task)
  const space = r.spaceOf(task)
  const f = (k: Field) => prefs.fields.includes(k)
  const compact = prefs.density === 'compact'
  const checks = task.checklist.length
  const checksDone = task.checklist.filter((c) => c.done).length
  const sub = progress ?? { done: 0, total: 0 }
  const totalParts = sub.total + checks
  const doneParts = sub.done + checksDone
  const blocked = task.blockedBy.some((id) => {
    const b = s.tasks.find((t) => t.id === id)
    return b && !r.isDone(b)
  })

  const toggleDone = () => {
    const want: StatusType[] = done ? ['open', 'active'] : ['done', 'closed']
    const target = space?.statuses.find((st) => st.type === want[0]) ?? space?.statuses.find((st) => st.type === want[1])
    if (target) s.updateTask(task.id, { statusId: target.id })
  }

  const meta = (
    <>
      {f('priority') && task.priority && <PriorityFlag priority={task.priority} />}
      {f('due') && task.dueDate && <span className={cn('rounded px-1 py-px text-[11px] font-medium', dueTone(task.dueDate, done))}>{friendlyDate(task.dueDate)}</span>}
      {f('points') && task.points != null && (
        <span className="surface-muted text-muted rounded-full px-1.5 text-[11px] font-semibold tabular-nums" title="Story points">
          {task.points}
        </span>
      )}
      {blocked && (
        <span className="inline-flex items-center gap-0.5 rounded bg-red-50 px-1 text-[11px] font-medium text-red-600 dark:bg-red-500/15 dark:text-red-300" title="Waiting on another task">
          <Ban size={11} /> Blocked
        </span>
      )}
      {f('counts') && (
        <span className="text-faint flex items-center gap-2 text-[11px]">
          {sub.total > 0 && (
            <span className="flex items-center gap-0.5" title="Subtasks">
              <GitBranch size={12} /> {sub.total}
            </span>
          )}
          {checks > 0 && (
            <span className="flex items-center gap-0.5" title="Checklist">
              <ListChecks size={12} /> {checksDone}/{checks}
            </span>
          )}
          {comments > 0 && (
            <span className="flex items-center gap-0.5" title="Comments">
              <MessageSquare size={12} /> {comments}
            </span>
          )}
          {task.clipIds.length > 0 && (
            <span className="flex items-center gap-0.5" title="Clips">
              <Film size={12} /> {task.clipIds.length}
            </span>
          )}
          {task.watchers.length > 0 && !compact && (
            <span className="flex items-center gap-0.5" title="Watchers">
              <Eye size={12} /> {task.watchers.length}
            </span>
          )}
        </span>
      )}
    </>
  )

  return (
    <div
      onClick={() => s.openTask(task.id)}
      onKeyDown={(e) => e.key === 'Enter' && s.openTask(task.id)}
      className={cn(
        'surface border-app group/card relative cursor-pointer rounded-lg border text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition hover:border-[var(--text-faint)] hover:shadow-md',
        compact ? 'px-2.5 py-2' : 'p-3',
        overlay && 'shadow-pop rotate-[2deg] cursor-grabbing',
        done && 'opacity-75',
      )}
    >
      {(f('key') || f('location')) && (
        <div className="text-faint mb-1 flex min-w-0 items-center gap-1.5 pr-12 text-[11px]">
          {f('key') && <span className="shrink-0 font-mono font-medium">MS-{task.key}</span>}
          {f('key') && f('location') && <span>·</span>}
          {f('location') && (
            <span className="flex min-w-0 items-center gap-1 truncate">
              {space && <span className="h-1.5 w-1.5 shrink-0 rounded-sm" style={{ background: space.color }} />}
              <span className="truncate">{r.listName(task.listId)}</span>
            </span>
          )}
        </div>
      )}
      <div className="flex items-start gap-2">
        <span className={cn('line-clamp-3 font-medium leading-snug', done && 'text-faint line-through')}>{task.title}</span>
      </div>
      {showStatus && (
        <div className="mt-1.5">
          <StatusPill status={r.statusOf(task)} size="xs" />
        </div>
      )}
      {f('tags') && !compact && task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((t) => (
            <Tag key={t} name={t} />
          ))}
          {task.tags.length > 3 && <span className="text-faint text-[11px]">+{task.tags.length - 3}</span>}
        </div>
      )}
      {f('progress') && !compact && totalParts > 0 && (
        <div className="mt-2.5 flex items-center gap-2" title={`${doneParts} of ${totalParts} done`}>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--bg-hover)]">
            <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${(doneParts / totalParts) * 100}%` }} />
          </div>
          <span className="text-faint text-[10px] tabular-nums">{Math.round((doneParts / totalParts) * 100)}%</span>
        </div>
      )}
      <div className={cn('flex items-center gap-2', compact ? 'mt-1.5' : 'mt-2.5')}>
        {meta}
        {f('assignees') && task.assignees.length > 0 && (
          <span className="ml-auto">
            <AvatarStack ids={task.assignees} size={compact ? 18 : 22} max={3} />
          </span>
        )}
      </div>

      {!overlay && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={toggleDone} className={cn('surface border-app rounded border p-0.5', done ? 'text-emerald-600' : 'text-faint hover:text-emerald-600')} title={done ? 'Reopen' : 'Mark complete'} aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}>
            <Check size={13} />
          </button>
          <CardMenu task={task} />
        </div>
      )}
    </div>
  )
}

function CardMenu({ task }: { task: Task }) {
  const { openTask, duplicateTask, deleteTask, toast } = useStore()
  const pop = usePopover()
  const copy = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text)
    toast(`Copied ${what}`)
    pop.close()
  }
  return (
    <>
      <button onClick={pop.toggle} className="surface border-app text-faint hover:text-app rounded border p-0.5" aria-label={`Actions for ${task.title}`}>
        <MoreHorizontal size={13} />
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} align="end" width={200}>
        <MenuItem onClick={() => (openTask(task.id), pop.close())}>
          <ExternalLink size={14} /> Open
        </MenuItem>
        <MenuItem onClick={() => (duplicateTask(task.id), pop.close())}>
          <Copy size={14} /> Duplicate
        </MenuItem>
        <MenuItem onClick={() => copy(`${location.origin}/app/t/${task.id}`, 'link')}>
          <Link2 size={14} /> Copy link
        </MenuItem>
        <MenuItem onClick={() => copy(`MS-${task.key}`, `MS-${task.key}`)}>
          <Hash size={14} /> Copy ID
        </MenuItem>
        <div className="border-app my-1 border-t" />
        <MenuItem danger onClick={() => (confirm(`Delete “${task.title}”?`) && deleteTask(task.id), pop.close())}>
          <Trash2 size={14} /> Delete
        </MenuItem>
      </Popover>
    </>
  )
}

