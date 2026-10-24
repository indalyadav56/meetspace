import { Fragment, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Columns3, Download, ExternalLink, Plus } from 'lucide-react'
import { formatMinutes, useStore } from '../../store/useStore'
import type { CustomField, ID, Task } from '../../store/types'
import { CustomValueEditor, fieldIcon } from '../task/TaskExtras'
import { useTaskResolver } from '../hooks'
import { AssigneeMenu, DateButton, InlineEdit, MenuItem, Popover, PriorityMenu, StatusMenu, Tag, usePopover } from '../components/ui'
import { PRIORITY_RANK, cn } from '../../lib/utils'
import BulkBar from './BulkBar'
import type { ViewProps } from './ListView'

type Col = 'status' | 'assignees' | 'priority' | 'start' | 'due' | 'estimate' | 'points' | 'tracked' | 'tags' | 'list' | 'created' | 'updated' | `cf:${ID}`
type GroupBy = 'none' | 'status' | 'list' | 'assignee' | 'priority'
type Calc = 'none' | 'sum' | 'avg' | 'min' | 'max' | 'count'
const CALC_LABEL: Record<Calc, string> = { none: 'Calculate', sum: 'Sum', avg: 'Average', min: 'Min', max: 'Max', count: 'Count filled' }
const BUILTIN: Record<Exclude<Col, `cf:${ID}`>, string> = {
  status: 'Status',
  assignees: 'Assignees',
  priority: 'Priority',
  start: 'Start date',
  due: 'Due date',
  estimate: 'Estimate',
  points: 'Points',
  tracked: 'Time tracked',
  tags: 'Tags',
  list: 'List',
  created: 'Created',
  updated: 'Updated',
}
const DEFAULT_COLS: Col[] = ['status', 'assignees', 'priority', 'start', 'due', 'estimate', 'tracked', 'tags', 'list', 'created']

function usePrefs(key: string) {
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(`ms.table.${key}`) ?? '{}') as { cols?: Col[]; group?: GroupBy; calc?: Record<string, Calc> }
    } catch {
      return {}
    }
  }
  const [p, setP] = useState(read)
  const set = (patch: { cols?: Col[]; group?: GroupBy; calc?: Record<string, Calc> }) =>
    setP((cur) => {
      const next = { ...cur, ...patch }
      try {
        localStorage.setItem(`ms.table.${key}`, JSON.stringify(next))
      } catch {
        /* storage blocked */
      }
      return next
    })
  return [p, set] as const
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function TableView({ tasks, defaultListId, viewKey, mixed }: ViewProps) {
  const { updateTask, openTask, addTask, fields, setCustomValue, timeEntries, users, toast } = useStore()
  const r = useTaskResolver()
  const [prefs, setPrefs] = usePrefs(viewKey ?? defaultListId)
  const [sort, setSort] = useState<{ col: Col | 'title' | 'key'; desc: boolean } | null>(null)
  const [selected, setSelected] = useState<Set<ID>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [draft, setDraft] = useState('')
  const colPop = usePopover()
  const groupPop = usePopover()

  const listIds = useMemo(() => new Set([defaultListId, ...tasks.map((t) => t.listId)]), [tasks, defaultListId])
  const listFields = fields.filter((f) => listIds.has(f.listId))
  const known = new Set<string>([...Object.keys(BUILTIN), ...listFields.map((f) => `cf:${f.id}`)])
  // New custom fields show up by default; removed ones drop out.
  const cols = [...(prefs.cols ?? [...DEFAULT_COLS, ...listFields.map((f) => `cf:${f.id}` as Col)])].filter((c) => known.has(c))
  const group = prefs.group ?? 'none'
  const fieldOf = (c: Col): CustomField | undefined => (c.startsWith('cf:') ? listFields.find((f) => `cf:${f.id}` === c) : undefined)
  const label = (c: Col) => (c.startsWith('cf:') ? (fieldOf(c)?.name ?? '') : BUILTIN[c as keyof typeof BUILTIN])

  const tracked = useMemo(() => {
    const m = new Map<string, number>()
    timeEntries.forEach((e) => m.set(e.taskId, (m.get(e.taskId) ?? 0) + e.duration))
    return m
  }, [timeEntries])

  /** Plain value of a cell, for sorting and export. */
  const value = (t: Task, c: Col | 'title' | 'key'): string | number => {
    switch (c) {
      case 'key':
        return t.key
      case 'title':
        return t.title
      case 'status':
        return r.statusOf(t)?.name ?? ''
      case 'assignees':
        return t.assignees.map((a) => users.find((u) => u.id === a)?.name ?? '').join(', ')
      case 'priority':
        return t.priority ?? ''
      case 'start':
        return t.startDate ?? ''
      case 'due':
        return t.dueDate ?? ''
      case 'estimate':
        return t.estimate ?? ''
      case 'points':
        return t.points ?? ''
      case 'tracked':
        return tracked.get(t.id) ?? 0
      case 'tags':
        return t.tags.join(', ')
      case 'list':
        return r.listName(t.listId)
      case 'created':
        return t.createdAt
      case 'updated':
        return t.updatedAt
      default: {
        const f = fieldOf(c)
        const v = f ? t.custom[f.id] : null
        if (f?.type === 'dropdown') return f.options.find((o) => o.id === v)?.name ?? ''
        return v == null ? '' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v
      }
    }
  }

  const rows = useMemo(() => {
    if (!sort) return tasks
    const dir = sort.desc ? -1 : 1
    return [...tasks].sort((a, b) => {
      if (sort.col === 'priority') return dir * (PRIORITY_RANK[a.priority ?? 'none'] - PRIORITY_RANK[b.priority ?? 'none'])
      const x = value(a, sort.col)
      const y = value(b, sort.col)
      // Empty values sort last either way.
      if (x === '' || y === '') return x === y ? 0 : x === '' ? 1 : -1
      return dir * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)))
    })
  }, [tasks, sort]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    if (group === 'none') return [{ key: 'all', label: '', color: undefined as string | undefined, rows }]
    const m = new Map<string, { key: string; label: string; color?: string; rows: Task[] }>()
    const add = (key: string, lbl: string, color: string | undefined, t: Task) => {
      const g = m.get(key) ?? { key, label: lbl, color, rows: [] }
      g.rows.push(t)
      m.set(key, g)
    }
    for (const t of rows) {
      if (group === 'status') add(r.statusOf(t)?.name ?? '—', r.statusOf(t)?.name ?? 'No status', r.statusOf(t)?.color, t)
      else if (group === 'list') add(t.listId, r.listName(t.listId), undefined, t)
      else if (group === 'priority') add(t.priority ?? 'none', t.priority ? t.priority[0].toUpperCase() + t.priority.slice(1) : 'No priority', undefined, t)
      else if (!t.assignees.length) add('none', 'Unassigned', undefined, t)
      else t.assignees.forEach((a) => add(a, users.find((u) => u.id === a)?.name ?? 'Unknown', undefined, t))
    }
    return [...m.values()]
  }, [rows, group, r, users])

  const toggleSort = (c: Col | 'title' | 'key') => setSort((s) => (s?.col !== c ? { col: c, desc: false } : s.desc ? null : { col: c, desc: true }))
  const visible = new Set(tasks.map((t) => t.id))
  const sel = [...selected].filter((id) => visible.has(id))
  const allOn = tasks.length > 0 && tasks.every((t) => selected.has(t.id))
  const toggle = (id: ID) =>
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  /** Numeric columns can be summed etc.; every column can count filled cells. */
  const numeric = (c: Col) => c === 'estimate' || c === 'points' || c === 'tracked' || ['number', 'money'].includes(fieldOf(c)?.type ?? '')
  const calcOf = (c: Col): Calc => prefs.calc?.[c] ?? 'none'
  const calcValue = (c: Col) => {
    const how = calcOf(c)
    if (how === 'none') return ''
    const vals = rows.map((t) => value(t, c)).filter((v) => v !== '' && v !== 0)
    if (how === 'count') return String(vals.length)
    const nums = vals.map(Number).filter((n) => Number.isFinite(n))
    if (!nums.length) return '—'
    const n = how === 'sum' ? nums.reduce((a, b) => a + b, 0) : how === 'avg' ? nums.reduce((a, b) => a + b, 0) / nums.length : how === 'min' ? Math.min(...nums) : Math.max(...nums)
    if (c === 'tracked') return formatMinutes(Math.round(n))
    const out = Math.round(n * 100) / 100
    return c === 'estimate' ? `${out}h` : fieldOf(c)?.type === 'money' ? `$${out.toLocaleString()}` : String(out)
  }

  const exportCsv = () => {
    const head = ['ID', 'Task name', ...cols.map(label)]
    const body = rows.map((t) => [`MS-${t.key}`, t.title, ...cols.map((c) => (c === 'tracked' ? (tracked.get(t.id) ? formatMinutes(tracked.get(t.id)!) : '') : value(t, c)))])
    const csv = [head, ...body].map((row) => row.map(csvCell).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    Object.assign(document.createElement('a'), { href: url, download: 'tasks.csv' }).click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast(`Exported ${rows.length} rows`)
  }

  const th = 'border-app surface-subtle sticky top-0 z-10 border-r border-b px-3 py-2 text-left text-[11px] font-semibold uppercase text-faint whitespace-nowrap'
  const td = 'border-app border-r border-b px-3 py-1.5 whitespace-nowrap'
  const pin = 'sticky z-[11] bg-[var(--bg)]'
  const sortHead = (c: Col | 'title' | 'key', text: React.ReactNode, extra = '') => (
    <th className={cn(th, extra)}>
      <button onClick={() => toggleSort(c)} className={cn('inline-flex items-center gap-1 uppercase hover:text-[var(--text)]', sort?.col === c && 'text-brand-600')}>
        {text}
        {sort?.col === c && (sort.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
      </button>
    </th>
  )
  const moveCol = (c: Col, d: -1 | 1) => {
    const i = cols.indexOf(c)
    const j = i + d
    if (i < 0 || j < 0 || j >= cols.length) return
    const next = [...cols]
    ;[next[i], next[j]] = [next[j], next[i]]
    setPrefs({ cols: next })
  }
  const allCols: Col[] = [...(Object.keys(BUILTIN) as Col[]), ...listFields.map((f) => `cf:${f.id}` as Col)]

  const cell = (t: Task, c: Col) => {
    const space = r.spaceOf(t)
    const st = r.statusOf(t)
    const f = fieldOf(c)
    if (f) return f.listId === t.listId ? <CustomValueEditor field={f} value={t.custom[f.id]} onChange={(v) => setCustomValue(t.id, f.id, v)} compact /> : <span className="text-faint">·</span>
    switch (c) {
      case 'status':
        return (
          space && (
            <StatusMenu statuses={space.statuses} value={t.statusId} onChange={(v) => updateTask(t.id, { statusId: v })}>
              <span className="rounded px-2 py-0.5 text-[11px] font-semibold uppercase text-white" style={{ background: st?.color }}>
                {st?.name}
              </span>
            </StatusMenu>
          )
        )
      case 'assignees':
        return <AssigneeMenu value={t.assignees} onChange={(v) => updateTask(t.id, { assignees: v })} size={22} />
      case 'priority':
        return <PriorityMenu value={t.priority} onChange={(v) => updateTask(t.id, { priority: v })} showLabel />
      case 'start':
        return <DateButton value={t.startDate} onChange={(v) => updateTask(t.id, { startDate: v })} placeholder="—" />
      case 'due':
        return <DateButton value={t.dueDate} onChange={(v) => updateTask(t.id, { dueDate: v })} done={r.isDone(t)} placeholder="—" />
      case 'estimate':
      case 'points': {
        const key = c === 'estimate' ? 'estimate' : 'points'
        return (
          <span className="flex items-center gap-0.5">
            <input
              type="number"
              min={0}
              value={t[key] ?? ''}
              onChange={(e) => updateTask(t.id, { [key]: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="—"
              className="w-14 bg-transparent outline-none"
              aria-label={`${label(c)} for ${t.title}`}
            />
            {c === 'estimate' && t.estimate != null && <span className="text-faint text-xs">h</span>}
          </span>
        )
      }
      case 'tracked':
        return <span className="text-muted tabular-nums">{tracked.get(t.id) ? formatMinutes(tracked.get(t.id)!) : '—'}</span>
      case 'tags':
        return (
          <span className="flex gap-1">
            {t.tags.map((x) => (
              <Tag key={x} name={x} />
            ))}
          </span>
        )
      case 'list':
        return <span className="text-muted">{r.listName(t.listId)}</span>
      case 'created':
        return <span className="text-muted">{format(parseISO(t.createdAt), 'MMM d')}</span>
      case 'updated':
        return <span className="text-muted">{format(parseISO(t.updatedAt), 'MMM d')}</span>
    }
    return null
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-app flex flex-wrap items-center gap-2 border-b px-4 py-1.5">
        <button onClick={groupPop.toggle} className={cn('border-app hover-surface inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium', group !== 'none' && 'border-brand-500 text-brand-600')}>
          Group: {{ none: 'None', status: 'Status', list: 'List', assignee: 'Assignee', priority: 'Priority' }[group]}
        </button>
        <Popover open={groupPop.open} anchor={groupPop.anchor} onClose={groupPop.close} width={170}>
          {(['none', 'status', 'list', 'assignee', 'priority'] as const).map((g) => (
            <MenuItem key={g} active={group === g} onClick={() => (setPrefs({ group: g }), groupPop.close())}>
              {{ none: 'None', status: 'Status', list: 'List', assignee: 'Assignee', priority: 'Priority' }[g]}
            </MenuItem>
          ))}
        </Popover>
        <button onClick={colPop.toggle} className="border-app hover-surface inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium">
          <Columns3 size={13} /> Columns · {cols.length}
        </button>
        <Popover open={colPop.open} anchor={colPop.anchor} onClose={colPop.close} width={240}>
          <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">Show, hide and order columns</div>
          <div className="max-h-80 overflow-y-auto scroll-thin">
            {[...cols, ...allCols.filter((c) => !cols.includes(c))].map((c) => {
              const on = cols.includes(c)
              const f = fieldOf(c)
              const I = f ? fieldIcon(f.type) : null
              return (
                <div key={c} className="hover-surface group/c flex items-center gap-2 rounded-md px-2 py-1 text-sm">
                  <input type="checkbox" checked={on} onChange={() => setPrefs({ cols: on ? cols.filter((x) => x !== c) : [...cols, c] })} className="accent-brand-600 h-3.5 w-3.5" id={`tcol-${c}`} />
                  <label htmlFor={`tcol-${c}`} className="flex min-w-0 flex-1 items-center gap-1 truncate">
                    {I && <I size={12} className="text-faint" />} {label(c)}
                  </label>
                  {on && (
                    <span className="hidden gap-0.5 group-hover/c:flex">
                      <button onClick={() => moveCol(c, -1)} aria-label={`Move ${label(c)} left`} className="text-faint hover:text-app">
                        <ArrowUp size={12} />
                      </button>
                      <button onClick={() => moveCol(c, 1)} aria-label={`Move ${label(c)} right`} className="text-faint hover:text-app">
                        <ArrowDown size={12} />
                      </button>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="border-app my-1 border-t" />
          <MenuItem onClick={() => (setPrefs({ cols: undefined }), colPop.close())}>Reset columns</MenuItem>
        </Popover>
        {sort && (
          <button onClick={() => setSort(null)} className="text-muted text-xs hover:underline">
            Clear sort ({sort.col === 'title' ? 'Task name' : sort.col === 'key' ? 'ID' : label(sort.col)})
          </button>
        )}
        <button onClick={exportCsv} className="border-app hover-surface ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium">
          <Download size={13} /> Export CSV
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto scroll-thin">
        <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className={cn(th, pin, 'left-0 z-20 w-10 min-w-10 max-w-10 px-2')}>
                <input type="checkbox" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(tasks.map((t) => t.id)))} className="accent-brand-600 h-3.5 w-3.5" aria-label="Select all rows" />
              </th>
              {sortHead('key', '#', cn(pin, 'left-10 z-20 w-16 min-w-16 max-w-16'))}
              {sortHead('title', 'Task name', cn(pin, 'left-[104px] z-20 min-w-[280px] shadow-[1px_0_0_var(--border)]'))}
              {cols.map((c) => {
                const f = fieldOf(c)
                const I = f ? fieldIcon(f.type) : null
                return (
                  <Fragment key={c}>
                    {sortHead(
                      c,
                      <span className="inline-flex items-center gap-1">
                        {I && <I size={12} />} {label(c)}
                      </span>,
                    )}
                  </Fragment>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const closed = collapsed.has(g.key)
              return (
                <Fragment key={g.key}>
                  {group !== 'none' && (
                    <tr>
                      <td colSpan={3 + cols.length} className="border-app surface-subtle border-b px-2 py-1.5">
                        <button onClick={() => setCollapsed((c) => (c.has(g.key) ? new Set([...c].filter((x) => x !== g.key)) : new Set([...c, g.key])))} className="sticky left-2 inline-flex items-center gap-1.5 text-xs font-semibold">
                          {closed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          {g.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />}
                          {g.label} <span className="text-faint font-normal">{g.rows.length}</span>
                        </button>
                      </td>
                    </tr>
                  )}
                  {!closed &&
                    g.rows.map((t) => (
                      <tr key={`${g.key}-${t.id}`} className={cn('group hover-surface', selected.has(t.id) && 'bg-brand-50/70 dark:bg-brand-600/10')}>
                        <td className={cn(td, pin, 'left-0 px-2')}>
                          <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className={cn('accent-brand-600 h-3.5 w-3.5', !selected.has(t.id) && !sel.length && 'opacity-0 group-hover:opacity-100')} aria-label={`Select ${t.title}`} />
                        </td>
                        <td className={cn(td, pin, 'text-faint left-10')}>
                          <button onClick={() => openTask(t.id)} className="hover:underline">
                            {t.key}
                          </button>
                        </td>
                        <td className={cn(td, pin, 'left-[104px] shadow-[1px_0_0_var(--border)]')}>
                          <span className="flex items-center gap-1">
                            <InlineEdit value={t.title} onSave={(v) => updateTask(t.id, { title: v })} className="w-full font-medium" />
                            <button onClick={() => openTask(t.id)} className="text-faint hover:text-app shrink-0 opacity-0 group-hover:opacity-100" aria-label={`Open ${t.title}`}>
                              <ExternalLink size={13} />
                            </button>
                          </span>
                        </td>
                        {cols.map((c) => (
                          <td key={c} className={cn(td, c.startsWith('cf:') && 'min-w-[120px]')}>
                            {cell(t, c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                </Fragment>
              )
            })}
            <tr>
              <td className={cn(td, pin, 'left-0 surface-subtle')} />
              <td className={cn(td, pin, 'left-10 surface-subtle')} />
              <td className={cn(td, pin, 'text-faint left-[104px] surface-subtle text-xs shadow-[1px_0_0_var(--border)]')}>{rows.length} tasks</td>
              {cols.map((c) => (
                <td key={c} className={cn(td, 'surface-subtle py-1')}>
                  <select
                    value={calcOf(c)}
                    onChange={(e) => setPrefs({ calc: { ...prefs.calc, [c]: e.target.value as Calc } })}
                    className={cn('w-full bg-transparent text-xs outline-none', calcOf(c) === 'none' ? 'text-faint opacity-0 hover:opacity-100 focus:opacity-100' : 'text-app font-semibold')}
                    aria-label={`Calculate ${label(c)}`}
                    title={calcOf(c) === 'none' ? 'Calculate' : CALC_LABEL[calcOf(c)]}
                  >
                    {(numeric(c) ? (Object.keys(CALC_LABEL) as Calc[]) : (['none', 'count'] as Calc[])).map((k) => (
                      <option key={k} value={k}>
                        {k === 'none' ? 'Calculate' : calcOf(c) === k ? `${CALC_LABEL[k]}: ${calcValue(c)}` : CALC_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </td>
              ))}
            </tr>
            <tr>
              <td className={cn(td, pin, 'left-0')} />
              <td className={td} colSpan={2 + cols.length}>
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (draft.trim()) addTask({ listId: defaultListId, title: draft.trim() })
                    setDraft('')
                  }}
                >
                  <Plus size={14} className="text-faint" />
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={mixed ? `New row — added to ${r.listName(defaultListId)}` : 'New row — type a task name and press Enter'} className="flex-1 bg-transparent outline-none" />
                </form>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="text-faint px-3 py-2 text-xs">
          {tasks.length} rows{sel.length ? ` · ${sel.length} selected` : ''}
        </div>
      </div>
      {sel.length > 0 && <BulkBar ids={sel} onClear={() => setSelected(new Set())} />}
    </div>
  )
}
