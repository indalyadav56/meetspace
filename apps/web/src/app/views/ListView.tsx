import { useEffect, useMemo, useState } from 'react'
import { addDays, format, parseISO, startOfToday } from 'date-fns'
import {
  ArrowDown,
  ArrowUp,
  Ban,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Columns3,
  Copy,
  ExternalLink,
  GitBranch,
  GripVertical,
  Hash,
  Layers,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react'
import { formatMinutes, useStore, type SortKey } from '../../store/useStore'
import type { CustomField, ID, Priority, Status, Task } from '../../store/types'
import { useSubtaskCounts, useTaskResolver } from '../hooks'
import { AssigneeMenu, Avatar, DateButton, MenuItem, Popover, PriorityMenu, StatusDot, StatusMenu, StatusPill, Tag, usePopover } from '../components/ui'
import { CustomValueEditor } from '../task/TaskExtras'
import { PRIORITIES, cn } from '../../lib/utils'
import BulkBar from './BulkBar'
import { COLUMNS, GROUP_LABELS, useListPrefs, type ColKey, type GroupBy } from './listPrefs'

export interface ViewProps {
  tasks: Task[]
  statuses: Status[]
  defaultListId: ID
  showList?: boolean
  /** Tasks span several spaces; `statuses` are the virtual per-type statuses. */
  mixed?: boolean
  /** Key the List view saves its layout under (grouping, columns). */
  viewKey?: ID
  /** List whose custom fields can be shown as columns. */
  fieldListId?: ID
}

const DRAG_MIME = 'application/x-ms-task'
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

interface Group {
  id: string
  label: string
  rows: Task[]
  status?: Status
  color?: string
  userId?: ID
  /** Values a task gets when added to, or dropped into, this group. null: can't drop here. */
  patch: (t: Task | null, from?: Group) => Partial<Task> | null
}

function useGroups(tasks: Task[], statuses: Status[], groupBy: GroupBy, isDone: (t: Task) => boolean): Group[] {
  const users = useStore((s) => s.users)
  return useMemo(() => {
    switch (groupBy) {
      case 'status':
        return statuses.map((st) => ({ id: st.id, label: st.name, status: st, rows: tasks.filter((t) => t.statusId === st.id), patch: () => ({ statusId: st.id }) }))
      case 'assignee': {
        const ids = [...new Set(tasks.flatMap((t) => t.assignees))]
        const named = ids
          .map((id) => users.find((u) => u.id === id))
          .filter((u) => !!u)
          .sort((a, b) => a.name.localeCompare(b.name))
        return [
          ...named.map(
            (u): Group => ({
              id: `u:${u.id}`,
              label: u.name,
              userId: u.id,
              rows: tasks.filter((t) => t.assignees.includes(u.id)),
              patch: (t, from) => ({ assignees: [...new Set([...(t?.assignees ?? []).filter((a) => a !== from?.userId), u.id])] }),
            }),
          ),
          { id: 'u:none', label: 'Unassigned', rows: tasks.filter((t) => !t.assignees.length), patch: () => ({ assignees: [] }) },
        ]
      }
      case 'priority':
        return [
          ...PRIORITIES.map((p): Group => ({ id: `p:${p.value}`, label: p.label, color: p.color, rows: tasks.filter((t) => t.priority === p.value), patch: () => ({ priority: p.value }) })),
          { id: 'p:none', label: 'No priority', color: '#cbd5e1', rows: tasks.filter((t) => !t.priority), patch: () => ({ priority: null as Priority }) },
        ]
      case 'due': {
        const today = startOfToday()
        const t0 = iso(today)
        const t1 = iso(addDays(today, 1))
        const t7 = iso(addDays(today, 7))
        const day = (t: Task) => t.dueDate?.slice(0, 10) ?? null
        const b = (id: string, label: string, color: string, test: (d: string | null, t: Task) => boolean, due: string | null | undefined): Group => ({
          id: `d:${id}`,
          label,
          color,
          rows: tasks.filter((t) => test(day(t), t)),
          patch: () => (due === undefined ? null : { dueDate: due }),
        })
        return [
          b('overdue', 'Overdue', '#ef4444', (d, t) => !!d && d < t0 && !isDone(t), undefined),
          b('today', 'Today', '#f59e0b', (d) => d === t0, t0),
          b('tomorrow', 'Tomorrow', '#3b82f6', (d) => d === t1, t1),
          b('week', 'Next 7 days', '#8b5cf6', (d) => !!d && d > t1 && d <= t7, iso(addDays(today, 3))),
          b('later', 'Later', '#64748b', (d) => !!d && d > t7, iso(addDays(today, 14))),
          b('past', 'Done earlier', '#10b981', (d, t) => !!d && d < t0 && isDone(t), undefined),
          b('none', 'No due date', '#cbd5e1', (d) => !d, null),
        ]
      }
      case 'tag': {
        const tags = [...new Set(tasks.flatMap((t) => t.tags))].sort()
        return [
          ...tags.map((g): Group => ({ id: `t:${g}`, label: g, rows: tasks.filter((t) => t.tags.includes(g)), patch: (t) => ({ tags: [...new Set([...(t?.tags ?? []), g])] }) })),
          { id: 't:none', label: 'No tags', rows: tasks.filter((t) => !t.tags.length), patch: () => null },
        ]
      }
      default:
        return [{ id: 'all', label: 'All tasks', rows: tasks, patch: () => ({}) }]
    }
  }, [tasks, statuses, groupBy, users, isDone])
}

function GroupBadge({ g }: { g: Group }) {
  if (g.status) return <StatusPill status={g.status} />
  if (g.userId)
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
        <Avatar userId={g.userId} size={20} /> {g.label}
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white uppercase" style={{ background: g.color ?? '#64748b' }}>
      {g.label}
    </span>
  )
}

export default function ListView({ tasks, statuses, defaultListId, showList, viewKey, fieldListId }: ViewProps) {
  const { moveTask, updateTask, filters, setFilters, fields, timeEntries } = useStore()
  const r = useTaskResolver()
  const [prefs, setPrefs] = useListPrefs(viewKey ?? defaultListId)
  const [selected, setSelected] = useState<Set<ID>>(new Set())
  const [drop, setDrop] = useState<{ group: string; before: ID | null } | null>(null)
  const listFields = useMemo(() => (fieldListId ? fields.filter((f) => f.listId === fieldListId) : []), [fields, fieldListId])
  const cols = prefs.cols.filter((c) => !c.startsWith('cf:') || listFields.some((f) => `cf:${f.id}` === c))
  const groups = useGroups(tasks, statuses, prefs.groupBy, r.isDone)
  const shown = groups.filter((g) => prefs.showEmpty || g.rows.length || prefs.groupBy === 'none')
  const minutes = useMemo(() => {
    const m = new Map<ID, number>()
    timeEntries.forEach((e) => m.set(e.taskId, (m.get(e.taskId) ?? 0) + e.duration))
    return m
  }, [timeEntries])

  const width = (c: ColKey) => (c.startsWith('cf:') ? 130 : COLUMNS[c as keyof typeof COLUMNS].w)
  const grid = { gridTemplateColumns: `minmax(260px, 1fr) ${cols.map((c) => `${width(c)}px`).join(' ')} 32px` }
  const toggle = (id: ID) =>
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const visible = new Set(tasks.map((t) => t.id))
  const sel = [...selected].filter((id) => visible.has(id))
  // Moving between status groups in a cross-Space view would need real status ids.
  const canDrag = !(showList && prefs.groupBy === 'status')
  const manual = filters.sort === 'manual'

  const onDrop = (e: React.DragEvent, to: Group, before: ID | null) => {
    e.preventDefault()
    setDrop(null)
    const raw = e.dataTransfer.getData(DRAG_MIME)
    if (!raw) return
    const { id, group } = JSON.parse(raw) as { id: ID; group: string }
    const t = tasks.find((x) => x.id === id)
    if (!t || before === id) return
    const from = groups.find((g) => g.id === group)
    const patch = to.id === group ? {} : to.patch(t, from)
    if (patch === null) return
    if (prefs.groupBy === 'status' && to.status) return moveTask(id, to.status.id, manual ? before : null)
    if (Object.keys(patch).length) updateTask(id, patch)
    if (manual && !showList && before) moveTask(id, patch.statusId ?? t.statusId, before)
  }
  const dragOver = (e: React.DragEvent, g: Group, before: ID | null) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return
    e.preventDefault()
    if (drop?.group !== g.id || drop.before !== before) setDrop({ group: g.id, before })
  }

  const sortBy = (k?: SortKey) => {
    if (!k) return
    if (filters.sort !== k) setFilters({ sort: k, sortDir: 'asc' })
    else if (filters.sortDir === 'asc') setFilters({ sortDir: 'desc' })
    else setFilters({ sort: 'manual', sortDir: 'asc' })
  }
  const head = (label: string, k?: SortKey) => (
    <button onClick={() => sortBy(k)} disabled={!k} className={cn('inline-flex items-center gap-0.5 truncate text-left uppercase', k && 'hover:text-app', filters.sort === k && k && 'text-brand-600')}>
      {label}
      {filters.sort === k && k && (filters.sortDir === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
    </button>
  )
  const totals = (rows: Task[]) => {
    const out: string[] = []
    if (cols.includes('points')) {
      const p = rows.reduce((a, t) => a + (t.points ?? 0), 0)
      if (p) out.push(`${p} pts`)
    }
    if (cols.includes('estimate')) {
      const h = rows.reduce((a, t) => a + (t.estimate ?? 0), 0)
      if (h) out.push(`${formatMinutes(h * 60)} est.`)
    }
    if (cols.includes('time')) {
      const m = rows.reduce((a, t) => a + (minutes.get(t.id) ?? 0), 0)
      if (m) out.push(`${formatMinutes(m)} tracked`)
    }
    return out.join(' · ')
  }
  const allCollapsed = shown.length > 0 && shown.every((g) => prefs.collapsed.includes(g.id))

  return (
    <div className="relative flex h-full flex-col">
      <ListToolbar prefs={prefs} setPrefs={setPrefs} listFields={listFields} allCollapsed={allCollapsed} groupIds={shown.map((g) => g.id)} />
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-24 scroll-thin sm:px-4">
        <div style={{ minWidth: 300 + cols.reduce((a, c) => a + width(c), 0) }}>
          {shown.map((g) => {
            const closed = prefs.collapsed.includes(g.id)
            const sum = totals(g.rows)
            const defaults = { ...(g.patch(null) ?? {}), statusId: g.status?.id ?? statuses[0]?.id }
            return (
              <section key={g.id} className="mt-4" onDragOver={(e) => dragOver(e, g, null)} onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDrop(null)} onDrop={(e) => onDrop(e, g, null)}>
                <div className="group/h sticky top-0 z-10 flex items-center gap-2 bg-[var(--bg)] py-1.5">
                  <button onClick={() => setPrefs({ collapsed: closed ? prefs.collapsed.filter((x) => x !== g.id) : [...prefs.collapsed, g.id] })} className="text-muted" aria-label={closed ? `Expand ${g.label}` : `Collapse ${g.label}`}>
                    {closed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                  </button>
                  <GroupBadge g={g} />
                  <span className="text-faint text-xs">{g.rows.length}</span>
                  {sum && <span className="text-faint text-xs">· {sum}</span>}
                  {defaults && g.patch(null) !== null && <AddTaskButton listId={defaultListId} defaults={defaults} compact />}
                </div>
                {!closed && (
                  <>
                    <div className="text-faint border-app grid items-center border-b px-2 py-1 text-[11px] font-medium" style={grid}>
                      <span className="flex items-center gap-2 pl-4">
                        <input
                          type="checkbox"
                          aria-label="Select all in group"
                          checked={g.rows.length > 0 && g.rows.every((x) => selected.has(x.id))}
                          onChange={(e) =>
                            setSelected((cur) => {
                              const next = new Set(cur)
                              g.rows.forEach((x) => (e.target.checked ? next.add(x.id) : next.delete(x.id)))
                              return next
                            })
                          }
                          className="accent-brand-600 h-3.5 w-3.5"
                        />
                        {head('Name', 'title')}
                      </span>
                      {cols.map((c) => {
                        if (c.startsWith('cf:')) return <span key={c}>{head(listFields.find((f) => `cf:${f.id}` === c)?.name ?? '')}</span>
                        const m = COLUMNS[c as keyof typeof COLUMNS]
                        return <span key={c}>{head(m.label, m.sort)}</span>
                      })}
                      <span />
                    </div>
                    {g.rows.map((t) => (
                      <div key={t.id} className="relative" onDragOver={(e) => (e.stopPropagation(), dragOver(e, g, t.id))} onDrop={(e) => (e.stopPropagation(), onDrop(e, g, t.id))}>
                        {drop?.group === g.id && drop.before === t.id && <div className="bg-brand-500 absolute inset-x-0 top-0 z-[5] h-0.5" />}
                        <TaskRow
                          task={t}
                          statuses={statuses}
                          showList={showList}
                          cols={cols}
                          grid={grid}
                          fields={listFields}
                          minutes={minutes}
                          expandAll={prefs.expandSubtasks}
                          selected={selected.has(t.id)}
                          onSelect={() => toggle(t.id)}
                          anySelected={sel.length > 0}
                          dragGroup={canDrag ? g.id : undefined}
                        />
                      </div>
                    ))}
                    {drop?.group === g.id && drop.before === null && <div className="bg-brand-500 h-0.5" />}
                    {g.patch(null) !== null && <AddRow listId={defaultListId} defaults={defaults} />}
                  </>
                )}
              </section>
            )
          })}
          {shown.length === 0 && <p className="text-muted py-16 text-center text-sm">No tasks match these filters.</p>}
        </div>
      </div>
      {sel.length > 0 && <BulkBar ids={sel} onClear={() => setSelected(new Set())} />}
    </div>
  )
}

function ListToolbar({
  prefs,
  setPrefs,
  listFields,
  allCollapsed,
  groupIds,
}: {
  prefs: ReturnType<typeof useListPrefs>[0]
  setPrefs: ReturnType<typeof useListPrefs>[1]
  listFields: CustomField[]
  allCollapsed: boolean
  groupIds: string[]
}) {
  const groupPop = usePopover()
  const colPop = usePopover()
  const chip = 'border-app hover-surface inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium'
  const toggleCol = (c: ColKey) => setPrefs({ cols: prefs.cols.includes(c) ? prefs.cols.filter((x) => x !== c) : [...prefs.cols, c] })
  const moveCol = (c: ColKey, d: -1 | 1) => {
    const i = prefs.cols.indexOf(c)
    const j = i + d
    if (i < 0 || j < 0 || j >= prefs.cols.length) return
    const next = [...prefs.cols]
    ;[next[i], next[j]] = [next[j], next[i]]
    setPrefs({ cols: next })
  }
  const all: [ColKey, string][] = [...(Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]).map((k): [ColKey, string] => [k, COLUMNS[k].label]), ...listFields.map((f): [ColKey, string] => [`cf:${f.id}`, f.name])]
  const ordered = [...all].sort((a, b) => {
    const ia = prefs.cols.indexOf(a[0])
    const ib = prefs.cols.indexOf(b[0])
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pt-2">
      <button onClick={groupPop.toggle} className={cn(chip, prefs.groupBy !== 'status' && 'border-brand-500 text-brand-600')}>
        <Layers size={13} /> Group: {GROUP_LABELS[prefs.groupBy]}
      </button>
      <Popover open={groupPop.open} anchor={groupPop.anchor} onClose={groupPop.close} width={180}>
        <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">Group by</div>
        {(Object.keys(GROUP_LABELS) as GroupBy[]).map((k) => (
          <MenuItem key={k} active={prefs.groupBy === k} onClick={() => (setPrefs({ groupBy: k, collapsed: [] }), groupPop.close())}>
            {GROUP_LABELS[k]}
          </MenuItem>
        ))}
      </Popover>
      <button onClick={() => setPrefs({ expandSubtasks: !prefs.expandSubtasks })} className={cn(chip, prefs.expandSubtasks && 'border-brand-500 text-brand-600')} title="Show subtasks under their parent">
        <GitBranch size={13} /> Subtasks: {prefs.expandSubtasks ? 'Expanded' : 'Collapsed'}
      </button>
      <button onClick={colPop.toggle} className={chip}>
        <Columns3 size={13} /> Columns
      </button>
      <Popover open={colPop.open} anchor={colPop.anchor} onClose={colPop.close} width={240}>
        <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">Shown columns</div>
        <div className="max-h-80 overflow-y-auto scroll-thin">
          {ordered.map(([k, label]) => {
            const on = prefs.cols.includes(k)
            return (
              <div key={k} className="hover-surface group/c flex items-center gap-2 rounded-md px-2 py-1 text-sm">
                <input type="checkbox" checked={on} onChange={() => toggleCol(k)} className="accent-brand-600 h-3.5 w-3.5" id={`col-${k}`} />
                <label htmlFor={`col-${k}`} className="flex min-w-0 flex-1 items-center gap-1 truncate">
                  {k.startsWith('cf:') && <Hash size={12} className="text-faint" />} {label}
                </label>
                {on && (
                  <span className="hidden gap-0.5 group-hover/c:flex">
                    <button onClick={() => moveCol(k, -1)} aria-label={`Move ${label} left`} className="text-faint hover:text-app">
                      <ArrowUp size={12} />
                    </button>
                    <button onClick={() => moveCol(k, 1)} aria-label={`Move ${label} right`} className="text-faint hover:text-app">
                      <ArrowDown size={12} />
                    </button>
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </Popover>
      <label className={cn(chip, 'cursor-pointer')}>
        <input type="checkbox" checked={prefs.showEmpty} onChange={(e) => setPrefs({ showEmpty: e.target.checked })} className="accent-brand-600 h-3.5 w-3.5" /> Empty groups
      </label>
      <button onClick={() => setPrefs({ collapsed: allCollapsed ? [] : groupIds })} className={chip}>
        {allCollapsed ? <ChevronsUpDown size={13} /> : <ChevronsDownUp size={13} />} {allCollapsed ? 'Expand all' : 'Collapse all'}
      </button>
      <span className="text-faint ml-auto hidden text-[11px] lg:inline">Drag rows to reorder or move between groups · click a column to sort</span>
    </div>
  )
}

function TagCell({ task }: { task: Task }) {
  const { updateTask, tasks } = useStore()
  const pop = usePopover()
  const [q, setQ] = useState('')
  const all = useMemo(() => [...new Set(tasks.flatMap((t) => t.tags))].sort(), [tasks])
  const set = (tags: string[]) => updateTask(task.id, { tags })
  const options = all.filter((g) => g.includes(q.toLowerCase()))
  return (
    <>
      <button onClick={pop.toggle} className="hover-surface flex min-h-7 w-full min-w-0 items-center gap-1 overflow-hidden rounded px-1 text-left">
        {task.tags.slice(0, 2).map((t) => (
          <Tag key={t} name={t} />
        ))}
        {task.tags.length > 2 && <span className="text-faint text-[11px]">+{task.tags.length - 2}</span>}
        {!task.tags.length && <span className="text-faint opacity-0 group-hover:opacity-100">+ tag</span>}
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={220}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const v = q.trim().toLowerCase()
            if (v && !task.tags.includes(v)) set([...task.tags, v])
            setQ('')
          }}
        >
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or create a tag" className="border-app surface-subtle mb-1 w-full rounded-md border px-2 py-1 text-sm outline-none" />
        </form>
        <div className="max-h-56 overflow-y-auto scroll-thin">
          {options.map((g) => (
            <MenuItem key={g} active={task.tags.includes(g)} onClick={() => set(task.tags.includes(g) ? task.tags.filter((x) => x !== g) : [...task.tags, g])}>
              <Tag name={g} />
            </MenuItem>
          ))}
          {q.trim() && !all.includes(q.trim().toLowerCase()) && <div className="text-muted px-2 py-1.5 text-xs">Press Enter to create “{q.trim().toLowerCase()}”</div>}
        </div>
      </Popover>
    </>
  )
}

function NumberCell({ value, onChange, suffix }: { value: number | null; onChange: (v: number | null) => void; suffix?: string }) {
  const [v, setV] = useState(value == null ? '' : String(value))
  useEffect(() => setV(value == null ? '' : String(value)), [value])
  return (
    <span className="flex items-center">
      <input
        value={v}
        inputMode="decimal"
        placeholder="—"
        onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))}
        onBlur={() => {
          const n = v === '' ? null : Number(v)
          if (n !== value && (n === null || Number.isFinite(n))) onChange(n)
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="hover-surface w-full rounded bg-transparent px-1 py-0.5 outline-none placeholder:text-[var(--text-faint)] focus:bg-[var(--bg-muted)]"
      />
      {suffix && v !== '' && <span className="text-faint pr-1 text-xs">{suffix}</span>}
    </span>
  )
}

function Cell({ col, task, statuses, done, fields, minutes }: { col: ColKey; task: Task; statuses: Status[]; done: boolean; fields: CustomField[]; minutes: Map<ID, number> }) {
  const { updateTask, setCustomValue, tasks } = useStore()
  const r = useTaskResolver()
  const up = (p: Partial<Task>) => updateTask(task.id, p)
  if (col.startsWith('cf:')) {
    const f = fields.find((x) => `cf:${x.id}` === col)
    return f ? <CustomValueEditor field={f} value={task.custom[f.id]} onChange={(v) => setCustomValue(task.id, f.id, v)} compact /> : null
  }
  switch (col) {
    case 'assignee':
      return <AssigneeMenu value={task.assignees} onChange={(v) => up({ assignees: v })} />
    case 'due':
      return <DateButton value={task.dueDate} onChange={(v) => up({ dueDate: v })} done={done} />
    case 'start':
      return <DateButton value={task.startDate} onChange={(v) => up({ startDate: v })} />
    case 'priority':
      return <PriorityMenu value={task.priority} onChange={(v) => up({ priority: v })} />
    case 'tags':
      return <TagCell task={task} />
    case 'status': {
      const st = r.statusOf(task)
      return (
        <StatusMenu statuses={r.spaceOf(task)?.statuses ?? statuses} value={task.statusId} onChange={(v) => up({ statusId: v })} className="hover-surface rounded px-1 py-0.5">
          {st ? <StatusPill status={st} size="xs" /> : <span className="text-faint">—</span>}
        </StatusMenu>
      )
    }
    case 'estimate':
      return <NumberCell value={task.estimate} onChange={(v) => up({ estimate: v })} suffix="h" />
    case 'points':
      return <NumberCell value={task.points} onChange={(v) => up({ points: v })} />
    case 'progress': {
      const subs = tasks.filter((t) => t.parentId === task.id)
      const total = task.checklist.length + subs.length
      const doneN = task.checklist.filter((c) => c.done).length + subs.filter((s) => r.isDone(s)).length
      if (!total) return <span className="text-faint px-1">—</span>
      return (
        <span className="flex items-center gap-1.5 px-1" title={`${doneN} of ${total} checklist items and subtasks done`}>
          <span className="surface-muted h-1.5 flex-1 overflow-hidden rounded-full">
            <span className="bg-brand-600 block h-full rounded-full" style={{ width: `${(doneN / total) * 100}%` }} />
          </span>
          <span className="text-faint text-[11px] tabular-nums">
            {doneN}/{total}
          </span>
        </span>
      )
    }
    case 'time': {
      const m = minutes.get(task.id)
      return <span className={cn('px-1 tabular-nums', !m && 'text-faint')}>{m ? formatMinutes(m) : '—'}</span>
    }
    case 'created':
      return <span className="text-muted px-1 text-xs">{format(parseISO(task.createdAt), 'MMM d')}</span>
    case 'updated':
      return <span className="text-muted px-1 text-xs">{format(parseISO(task.updatedAt), 'MMM d')}</span>
  }
  return null
}

function RowMenu({ task, onRename, onSubtask }: { task: Task; onRename: () => void; onSubtask: () => void }) {
  const { openTask, duplicateTask, deleteTask } = useStore()
  const pop = usePopover()
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (text: string, what: string) => {
    void navigator.clipboard.writeText(text)
    setCopied(what)
    setTimeout(() => (setCopied(null), pop.close()), 700)
  }
  return (
    <>
      <button onClick={pop.toggle} className="text-faint hover:text-app rounded p-1 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Actions for ${task.title}`}>
        <MoreHorizontal size={15} />
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} align="end" width={200}>
        <MenuItem onClick={() => (openTask(task.id), pop.close())}>
          <ExternalLink size={14} /> Open
        </MenuItem>
        <MenuItem onClick={() => (onRename(), pop.close())}>
          <Pencil size={14} /> Rename
        </MenuItem>
        <MenuItem onClick={() => (onSubtask(), pop.close())}>
          <GitBranch size={14} /> Add subtask
        </MenuItem>
        <MenuItem onClick={() => (duplicateTask(task.id), pop.close())}>
          <Copy size={14} /> Duplicate
        </MenuItem>
        <MenuItem onClick={() => copy(`${location.origin}/app/t/${task.id}`, 'link')}>
          <Link2 size={14} /> {copied === 'link' ? 'Copied!' : 'Copy link'}
        </MenuItem>
        <MenuItem onClick={() => copy(`MS-${task.key}`, 'id')}>
          <Hash size={14} /> {copied === 'id' ? 'Copied!' : `Copy ID (MS-${task.key})`}
        </MenuItem>
        <div className="border-app my-1 border-t" />
        <MenuItem danger onClick={() => (confirm(`Delete “${task.title}”?`) && deleteTask(task.id), pop.close())}>
          <Trash2 size={14} /> Delete
        </MenuItem>
      </Popover>
    </>
  )
}

function TaskRow({
  task,
  statuses,
  showList,
  cols,
  grid,
  fields,
  minutes,
  expandAll,
  depth = 0,
  selected,
  onSelect,
  anySelected,
  dragGroup,
}: {
  task: Task
  statuses: Status[]
  showList?: boolean
  cols: ColKey[]
  grid: React.CSSProperties
  fields: CustomField[]
  minutes: Map<ID, number>
  expandAll: boolean
  depth?: number
  selected?: boolean
  onSelect?: () => void
  anySelected?: boolean
  dragGroup?: string
}) {
  const { updateTask, openTask, tasks } = useStore()
  const r = useTaskResolver()
  const subCounts = useSubtaskCounts()
  const [open, setOpen] = useState(expandAll)
  const [renaming, setRenaming] = useState(false)
  const [addingSub, setAddingSub] = useState(false)
  useEffect(() => setOpen(expandAll), [expandAll])
  const subs = open || addingSub ? tasks.filter((t) => t.parentId === task.id).sort((a, b) => a.order - b.order) : []
  const count = subCounts.get(task.id) ?? 0
  const done = r.isDone(task)
  const space = r.spaceOf(task)
  const st = space ? space.statuses : statuses
  const blocked = task.blockedBy.some((b) => {
    const bt = tasks.find((x) => x.id === b)
    return bt && !r.isDone(bt)
  })

  return (
    <>
      <div
        onClick={() => (renaming ? undefined : anySelected && onSelect ? onSelect() : openTask(task.id))}
        draggable={!!dragGroup && !renaming}
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ id: task.id, group: dragGroup }))
          e.dataTransfer.effectAllowed = 'move'
        }}
        className={cn('group border-app hover-surface grid cursor-pointer items-center border-b px-2 text-[13px]', selected && 'bg-brand-50 dark:bg-brand-600/15')}
        style={{ ...grid, minHeight: 40 }}
      >
        <div className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: depth * 24 }}>
          <span className={cn('text-faint w-3 shrink-0 cursor-grab opacity-0', dragGroup && 'group-hover:opacity-100')} aria-hidden>
            {dragGroup && depth === 0 && <GripVertical size={13} />}
          </span>
          {onSelect && (
            <input
              type="checkbox"
              checked={!!selected}
              onClick={(e) => e.stopPropagation()}
              onChange={onSelect}
              aria-label={`Select ${task.title}`}
              className={cn('accent-brand-600 h-3.5 w-3.5 shrink-0', !selected && !anySelected && 'opacity-0 group-hover:opacity-100')}
            />
          )}
          <span className="w-4 shrink-0">
            {count > 0 && (
              <button onClick={(e) => (e.stopPropagation(), setOpen((o) => !o))} className="text-faint" aria-label="Toggle subtasks">
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
          </span>
          <span onClick={(e) => e.stopPropagation()}>
            <StatusMenu statuses={st} value={task.statusId} onChange={(v) => updateTask(task.id, { statusId: v })}>
              <StatusDot status={r.statusOf(task)} />
            </StatusMenu>
          </span>
          {renaming ? (
            <input
              autoFocus
              defaultValue={task.title}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== task.title) updateTask(task.id, { title: v })
                setRenaming(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') setRenaming(false)
              }}
              className="border-brand-500 min-w-0 flex-1 rounded border bg-transparent px-1.5 py-0.5 font-medium outline-none"
              aria-label="Task name"
            />
          ) : (
            <span onDoubleClick={(e) => (e.stopPropagation(), setRenaming(true))} className={cn('truncate font-medium', done && 'text-faint line-through')}>
              {task.title}
            </span>
          )}
          {!renaming && (
            <button onClick={(e) => (e.stopPropagation(), setRenaming(true))} className="text-faint hover:text-app shrink-0 opacity-0 group-hover:opacity-100" aria-label="Rename task" title="Rename">
              <Pencil size={12} />
            </button>
          )}
          {blocked && (
            <span title="Waiting on another task" className="shrink-0 text-red-500">
              <Ban size={13} />
            </span>
          )}
          {task.recurrence && (
            <span title={`Repeats ${task.recurrence}`} className="text-faint shrink-0">
              <Repeat size={12} />
            </span>
          )}
          {count > 0 && (
            <span className="text-faint inline-flex shrink-0 items-center gap-0.5 text-[11px]">
              <GitBranch size={11} /> {count}
            </span>
          )}
          {showList && <span className="surface-muted text-muted shrink-0 rounded px-1.5 text-[10px]">{r.listName(task.listId)}</span>}
        </div>
        {cols.map((c) => (
          <div key={c} onClick={(e) => e.stopPropagation()} className="min-w-0">
            <Cell col={c} task={task} statuses={statuses} done={done} fields={fields} minutes={minutes} />
          </div>
        ))}
        <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
          <RowMenu task={task} onRename={() => setRenaming(true)} onSubtask={() => (setAddingSub(true), setOpen(true))} />
        </div>
      </div>
      {subs.map((s) => (
        <TaskRow key={s.id} task={s} statuses={statuses} cols={cols} grid={grid} fields={fields} minutes={minutes} expandAll={expandAll} depth={depth + 1} />
      ))}
      {addingSub && <AddRow listId={task.listId} defaults={{ parentId: task.id, statusId: task.statusId }} depth={depth + 1} autoOpen onDone={() => setAddingSub(false)} />}
    </>
  )
}

function AddTaskButton({ listId, defaults, compact }: { listId: ID; defaults: Partial<Task>; compact?: boolean }) {
  const { addTask, openTask } = useStore()
  return (
    <button
      onClick={() => openTask(addTask({ ...defaults, listId, title: 'New task' }))}
      className={cn('text-faint hover:text-app rounded p-0.5', compact && 'opacity-0 group-hover/h:opacity-100')}
      aria-label="Add a task to this group"
      title="Add task"
    >
      <Plus size={14} />
    </button>
  )
}

/** Inline quick-add. Set assignee, due date and priority before saving; Enter keeps it open for the next one. */
function AddRow({ listId, defaults, depth = 0, autoOpen, onDone }: { listId: ID; defaults: Partial<Task>; depth?: number; autoOpen?: boolean; onDone?: () => void }) {
  const addTask = useStore((s) => s.addTask)
  const [editing, setEditing] = useState(!!autoOpen)
  const [v, setV] = useState('')
  const [assignees, setAssignees] = useState<ID[]>(defaults.assignees ?? [])
  const [due, setDue] = useState<string | null>(defaults.dueDate ?? null)
  const [priority, setPriority] = useState<Priority>(defaults.priority ?? null)
  const close = () => {
    setEditing(false)
    onDone?.()
  }
  const pad = { paddingLeft: 36 + depth * 24 }
  if (!editing)
    return (
      <button onClick={() => setEditing(true)} className="text-faint hover:text-app flex h-9 items-center gap-2 text-[13px]" style={pad}>
        <Plus size={14} /> {defaults.parentId ? 'Add subtask' : 'Add task'}
      </button>
    )
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (v.trim()) addTask({ ...defaults, listId, title: v.trim(), assignees, dueDate: due, priority })
        setV('')
      }}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && !v && !document.querySelector('.shadow-pop') && close()}
      className="border-brand-500 my-0.5 flex h-10 items-center gap-2 rounded border pr-2"
      style={pad}
    >
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && close()}
        placeholder={defaults.parentId ? 'Subtask name — press Enter to save' : 'Task name — press Enter to save'}
        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
      />
      <AssigneeMenu value={assignees} onChange={setAssignees} size={22} />
      <DateButton value={due} onChange={setDue} placeholder={<span className="text-faint text-xs">Due</span>} />
      <PriorityMenu value={priority} onChange={setPriority} />
      <button className="bg-brand-600 rounded px-2 py-1 text-xs font-semibold text-white">Save</button>
      <button type="button" onClick={close} className="text-muted text-xs hover:underline">
        Cancel
      </button>
    </form>
  )
}

