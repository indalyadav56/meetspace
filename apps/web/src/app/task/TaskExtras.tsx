import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { AlertTriangle, Ban, CheckSquare, Hash, Link2, ListPlus, Pause, Play, Plus, Repeat, Settings2, Timer, Trash2, Type, X, CalendarDays, CircleDollarSign, ChevronDown } from 'lucide-react'
import { formatMinutes, useMe, useStore } from '../../store/useStore'
import type { CustomField, CustomFieldType, CustomValue, ID, Recurrence, Task } from '../../store/types'
import { useTaskResolver } from '../hooks'
import { DateButton, MenuItem, Popover, StatusDot, usePopover } from '../components/ui'
import { TAG_COLORS, cn, friendlyDate } from '../../lib/utils'

/* ---------------- Custom fields ---------------- */

export const FIELD_TYPES: { type: CustomFieldType; label: string; icon: typeof Hash }[] = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'money', label: 'Money', icon: CircleDollarSign },
  { type: 'dropdown', label: 'Dropdown', icon: ChevronDown },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { type: 'date', label: 'Date', icon: CalendarDays },
]

export function fieldIcon(type: CustomFieldType) {
  return FIELD_TYPES.find((f) => f.type === type)?.icon ?? Type
}

/** Inline editor for one custom-field value; used in the task panel and the Table view. */
export function CustomValueEditor({ field, value, onChange, compact }: { field: CustomField; value: CustomValue | undefined; onChange: (v: CustomValue) => void; compact?: boolean }) {
  const pop = usePopover()
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  useEffect(() => {
    setDraft(value == null ? '' : String(value))
  }, [value])
  const commit = () => {
    if (field.type === 'number' || field.type === 'money') onChange(draft === '' ? null : Number(draft))
    else onChange(draft === '' ? null : draft)
  }
  const input = 'hover-surface w-full rounded bg-transparent px-1 py-0.5 outline-none focus:bg-[var(--bg-muted)]'

  switch (field.type) {
    case 'checkbox':
      return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="accent-brand-600 h-4 w-4" aria-label={field.name} />
    case 'date':
      return <DateButton value={(value as string) || null} onChange={(v) => onChange(v)} placeholder={compact ? '—' : 'Empty'} />
    case 'dropdown': {
      const opt = field.options.find((o) => o.id === value)
      return (
        <>
          <button type="button" onClick={pop.toggle} className="hover-surface inline-flex min-h-6 items-center rounded px-1">
            {opt ? (
              <span className="rounded px-1.5 py-px text-[11px] font-semibold text-white" style={{ background: opt.color }}>
                {opt.name}
              </span>
            ) : (
              <span className="text-faint">{compact ? '—' : 'Empty'}</span>
            )}
          </button>
          <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={200}>
            {field.options.map((o) => (
              <MenuItem key={o.id} active={o.id === value} onClick={() => (onChange(o.id), pop.close())}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} /> {o.name}
              </MenuItem>
            ))}
            {field.options.length === 0 && <div className="text-muted px-2 py-1.5 text-xs">No options yet — add some in field settings.</div>}
            <div className="border-app my-1 border-t" />
            <MenuItem onClick={() => (onChange(null), pop.close())}>
              <X size={14} /> Clear
            </MenuItem>
          </Popover>
        </>
      )
    }
    default:
      return (
        <span className="flex items-center">
          {field.type === 'money' && <span className="text-muted pl-1">$</span>}
          <input
            type={field.type === 'text' ? 'text' : 'number'}
            value={draft}
            placeholder={compact ? '—' : 'Empty'}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className={input}
          />
        </span>
      )
  }
}

/** Popover for creating/configuring a List's custom fields. */
export function FieldManager({ listId, children, className }: { listId: ID; children: React.ReactNode; className?: string }) {
  const { fields, addField, updateField, deleteField } = useStore()
  const pop = usePopover()
  const [name, setName] = useState('')
  const [type, setType] = useState<CustomFieldType>('text')
  const [editing, setEditing] = useState<ID | null>(null)
  const [opt, setOpt] = useState('')
  const listFields = fields.filter((f) => f.listId === listId)
  const editField = listFields.find((f) => f.id === editing)

  return (
    <>
      <button type="button" onClick={pop.toggle} className={className}>
        {children}
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={300} align="end">
        {editField ? (
          <div className="p-1">
            <button onClick={() => setEditing(null)} className="text-muted mb-2 text-xs hover:underline">
              ← All fields
            </button>
            <input value={editField.name} onChange={(e) => updateField(editField.id, { name: e.target.value })} className="border-app surface-subtle mb-2 w-full rounded-md border px-2 py-1.5 font-medium outline-none" />
            {editField.type === 'dropdown' && (
              <>
                <div className="text-faint px-1 py-1 text-[11px] font-semibold uppercase">Options</div>
                {editField.options.map((o) => (
                  <div key={o.id} className="flex items-center gap-2 px-1 py-1">
                    <span className="h-3 w-3 rounded-full" style={{ background: o.color }} />
                    <input
                      value={o.name}
                      onChange={(e) => updateField(editField.id, { options: editField.options.map((x) => (x.id === o.id ? { ...x, name: e.target.value } : x)) })}
                      className="flex-1 bg-transparent outline-none"
                    />
                    <button onClick={() => updateField(editField.id, { options: editField.options.filter((x) => x.id !== o.id) })} className="text-faint" aria-label="Remove option">
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <form
                  className="flex items-center gap-2 px-1 py-1"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!opt.trim()) return
                    updateField(editField.id, { options: [...editField.options, { id: `o${Date.now()}`, name: opt.trim(), color: TAG_COLORS[editField.options.length % TAG_COLORS.length] }] })
                    setOpt('')
                  }}
                >
                  <Plus size={13} className="text-faint" />
                  <input value={opt} onChange={(e) => setOpt(e.target.value)} placeholder="Add option" className="flex-1 bg-transparent outline-none" />
                </form>
              </>
            )}
            <div className="border-app my-1 border-t" />
            <MenuItem
              danger
              onClick={() => {
                if (confirm(`Delete field “${editField.name}” and its values?`)) {
                  deleteField(editField.id)
                  setEditing(null)
                }
              }}
            >
              <Trash2 size={14} /> Delete field
            </MenuItem>
          </div>
        ) : (
          <>
            <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">Custom fields</div>
            {listFields.map((f) => {
              const I = fieldIcon(f.type)
              return (
                <MenuItem key={f.id} onClick={() => setEditing(f.id)}>
                  <I size={14} className="text-muted" /> {f.name}
                  <Settings2 size={13} className="text-faint ml-auto" />
                </MenuItem>
              )
            })}
            {listFields.length === 0 && <div className="text-muted px-2 pb-2 text-xs">Add fields like story points, budget or channel to every task in this List.</div>}
            <div className="border-app my-1 border-t" />
            <form
              className="space-y-2 p-1"
              onSubmit={(e) => {
                e.preventDefault()
                if (!name.trim()) return
                const id = addField(listId, name.trim(), type)
                setName('')
                if (type === 'dropdown') setEditing(id)
              }}
            >
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New field name" className="border-app surface-subtle w-full rounded-md border px-2 py-1.5 outline-none" />
              <div className="grid grid-cols-3 gap-1">
                {FIELD_TYPES.map((ft) => (
                  <button
                    type="button"
                    key={ft.type}
                    onClick={() => setType(ft.type)}
                    className={cn('flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs', type === ft.type ? 'border-brand-500 text-brand-600' : 'border-app text-muted')}
                  >
                    <ft.icon size={12} /> {ft.label}
                  </button>
                ))}
              </div>
              <button className="bg-brand-600 w-full rounded-md py-1.5 text-xs font-semibold text-white disabled:opacity-40" disabled={!name.trim()}>
                Add field
              </button>
            </form>
          </>
        )}
      </Popover>
    </>
  )
}

export function CustomFieldsSection({ task }: { task: Task }) {
  const { fields, setCustomValue } = useStore()
  const listFields = fields.filter((f) => f.listId === task.listId)
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold">Custom fields</h3>
        <FieldManager listId={task.listId} className="text-muted hover-surface ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs">
          <Settings2 size={13} /> Manage
        </FieldManager>
      </div>
      {listFields.length === 0 ? (
        <p className="text-faint text-xs">No custom fields on this List yet.</p>
      ) : (
        <div className="border-app divide-y divide-[var(--border)] rounded-lg border">
          {listFields.map((f) => {
            const I = fieldIcon(f.type)
            return (
              <div key={f.id} className="flex min-h-9 items-center gap-2 px-3 text-[13px]">
                <span className="text-muted flex w-40 shrink-0 items-center gap-2">
                  <I size={14} /> <span className="truncate">{f.name}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <CustomValueEditor field={f} value={task.custom[f.id]} onChange={(v) => setCustomValue(task.id, f.id, v)} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ---------------- Dependencies ---------------- */

export function DependenciesSection({ task }: { task: Task }) {
  const { tasks, addDependency, removeDependency, openTask } = useStore()
  const r = useTaskResolver()
  const pop = usePopover()
  const [q, setQ] = useState('')
  const [mode, setMode] = useState<'waiting' | 'blocking'>('waiting')
  const waitingOn = task.blockedBy.map((id) => tasks.find((t) => t.id === id)).filter(Boolean) as Task[]
  const blocking = tasks.filter((t) => t.blockedBy.includes(task.id))
  const candidates = tasks.filter((t) => t.id !== task.id && !t.parentId && t.title.toLowerCase().includes(q.toLowerCase()) && !task.blockedBy.includes(t.id) && !t.blockedBy.includes(task.id)).slice(0, 8)
  const openBlockers = waitingOn.filter((t) => !r.isDone(t))

  const Row = ({ t, onRemove }: { t: Task; onRemove: () => void }) => (
    <div className="group hover-surface flex items-center gap-2 px-3 py-1.5 text-sm">
      <StatusDot status={r.statusOf(t)} size={13} />
      <button onClick={() => openTask(t.id)} className={cn('min-w-0 flex-1 truncate text-left', r.isDone(t) && 'text-faint line-through')}>
        {t.title}
      </button>
      {t.dueDate && <span className="text-faint text-xs">{friendlyDate(t.dueDate)}</span>}
      <button onClick={onRemove} className="text-faint hidden group-hover:block" aria-label="Remove dependency">
        <X size={14} />
      </button>
    </div>
  )

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Link2 size={16} /> Dependencies
        </h3>
        <button onClick={pop.toggle} className="text-muted hover-surface ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs">
          <Plus size={13} /> Add
        </button>
        <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={300} align="end">
          <div className="mb-1 grid grid-cols-2 gap-1 p-1">
            {(['waiting', 'blocking'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={cn('rounded-md py-1 text-xs font-medium', mode === m ? 'bg-brand-600 text-white' : 'surface-muted')}>
                {m === 'waiting' ? 'Waiting on' : 'Blocking'}
              </button>
            ))}
          </div>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="border-app surface-subtle mb-1 w-full rounded-md border px-2 py-1.5 outline-none" />
          {candidates.map((c) => (
            <MenuItem
              key={c.id}
              onClick={() => {
                if (mode === 'waiting') addDependency(task.id, c.id)
                else addDependency(c.id, task.id)
                pop.close()
                setQ('')
              }}
            >
              <StatusDot status={r.statusOf(c)} size={12} /> <span className="truncate">{c.title}</span>
            </MenuItem>
          ))}
        </Popover>
      </div>
      {openBlockers.length > 0 && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={14} /> Waiting on {openBlockers.length} unfinished task{openBlockers.length > 1 ? 's' : ''}.
        </div>
      )}
      {waitingOn.length === 0 && blocking.length === 0 ? (
        <p className="text-faint text-xs">No dependencies. Link tasks that must happen in order.</p>
      ) : (
        <div className="border-app overflow-hidden rounded-lg border">
          {waitingOn.length > 0 && (
            <>
              <div className="surface-subtle text-faint flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold uppercase">
                <Ban size={12} /> Waiting on
              </div>
              {waitingOn.map((t) => (
                <Row key={t.id} t={t} onRemove={() => removeDependency(task.id, t.id)} />
              ))}
            </>
          )}
          {blocking.length > 0 && (
            <>
              <div className="surface-subtle text-faint flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold uppercase">
                <ListPlus size={12} /> Blocking
              </div>
              {blocking.map((t) => (
                <Row key={t.id} t={t} onRemove={() => removeDependency(t.id, task.id)} />
              ))}
            </>
          )}
        </div>
      )}
    </section>
  )
}

/* ---------------- Recurrence ---------------- */

export function RecurrenceSelect({ task }: { task: Task }) {
  const updateTask = useStore((s) => s.updateTask)
  const pop = usePopover()
  const opts: { v: Recurrence; label: string }[] = [
    { v: null, label: 'Never' },
    { v: 'daily', label: 'Daily' },
    { v: 'weekly', label: 'Weekly' },
    { v: 'monthly', label: 'Monthly' },
  ]
  return (
    <>
      <button onClick={pop.toggle} className={cn('hover-surface inline-flex items-center gap-1.5 rounded px-1 py-0.5', !task.recurrence && 'text-faint')}>
        <Repeat size={13} /> {task.recurrence ? `Repeats ${task.recurrence}` : 'Doesn’t repeat'}
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={220}>
        {opts.map((o) => (
          <MenuItem key={String(o.v)} active={task.recurrence === o.v} onClick={() => (updateTask(task.id, { recurrence: o.v }), pop.close())}>
            {o.label}
          </MenuItem>
        ))}
        <div className="text-muted px-2 pt-1 pb-1.5 text-[11px]">When completed, a new copy is created with dates moved forward.</div>
      </Popover>
    </>
  )
}

/* ---------------- Time tracking ---------------- */

export function useElapsed(start: string | undefined) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!start) return
    const id = setInterval(() => tick((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [start])
  if (!start) return 0
  return Math.floor((Date.now() - new Date(start).getTime()) / 1000)
}

export function clock(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function TimerButton({ taskId, size = 'md' }: { taskId: ID; size?: 'sm' | 'md' }) {
  const { timer, startTimer, stopTimer } = useStore()
  const running = timer?.taskId === taskId
  const sec = useElapsed(running ? timer!.start : undefined)
  return (
    <button
      onClick={(e) => (e.stopPropagation(), running ? stopTimer() : startTimer(taskId))}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-medium tabular-nums',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-[13px]',
        running ? 'bg-emerald-500 text-white' : 'hover-surface border-app border',
      )}
      title={running ? 'Stop timer' : 'Start timer'}
    >
      {running ? <Pause size={13} /> : <Play size={13} />}
      {running ? clock(sec) : 'Start'}
    </button>
  )
}

export function TimeSection({ task }: { task: Task }) {
  const { timeEntries, addTimeEntry, deleteTimeEntry, users } = useStore()
  const me = useMe()
  const entries = useMemo(() => timeEntries.filter((e) => e.taskId === task.id).sort((a, b) => b.start.localeCompare(a.start)), [timeEntries, task.id])
  const total = entries.reduce((a, e) => a + e.duration, 0)
  const [manual, setManual] = useState('')
  const est = task.estimate ? task.estimate * 60 : 0

  return (
    <section className="mt-8">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Timer size={16} /> Time tracked
        </h3>
        <span className="text-muted text-xs">
          {formatMinutes(total)}
          {est ? ` of ${formatMinutes(est)} estimated` : ''}
        </span>
        <span className="ml-auto">
          <TimerButton taskId={task.id} />
        </span>
      </div>
      {est > 0 && (
        <div className="surface-muted mb-2 h-1.5 overflow-hidden rounded-full">
          <div className={cn('h-full', total > est ? 'bg-red-500' : 'bg-brand-500')} style={{ width: `${Math.min(100, (total / est) * 100)}%` }} />
        </div>
      )}
      <form
        className="mb-2 flex items-center gap-2 text-sm"
        onSubmit={(e) => {
          e.preventDefault()
          const m = manual.match(/^\s*(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m?)?\s*$/i)
          const minutes = m ? Math.round(Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) : 0
          if (!minutes) return
          addTimeEntry({ taskId: task.id, start: new Date().toISOString(), duration: minutes, note: 'Manual entry' })
          setManual('')
        }}
      >
        <Plus size={15} className="text-faint" />
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Add time manually, e.g. 1h 30m" className="flex-1 bg-transparent outline-none" />
      </form>
      {entries.length > 0 && (
        <div className="border-app divide-y divide-[var(--border)] rounded-lg border text-[13px]">
          {entries.slice(0, 6).map((e) => (
            <div key={e.id} className="group flex items-center gap-2 px-3 py-1.5">
              <span className="font-medium tabular-nums">{formatMinutes(e.duration)}</span>
              <span className="text-muted truncate">{e.userId === me.id ? 'You' : users.find((u) => u.id === e.userId)?.name}</span>
              {e.note && <span className="text-faint truncate">· {e.note}</span>}
              <span className="text-faint ml-auto shrink-0 text-xs">{format(parseISO(e.start), 'MMM d, h:mm a')}</span>
              <button onClick={() => deleteTimeEntry(e.id)} className="text-faint hidden group-hover:block" aria-label="Delete entry">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
