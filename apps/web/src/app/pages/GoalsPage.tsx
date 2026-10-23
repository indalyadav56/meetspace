import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ChevronDown, ChevronRight, Plus, Target as TargetIcon, Trash2, Trophy, X } from 'lucide-react'
import { targetProgress, useStore } from '../../store/useStore'
import type { Goal, Target, TargetKind } from '../../store/types'
import { useTaskResolver } from '../hooks'
import { Avatar, DateButton, MenuItem, Popover, usePopover } from '../components/ui'
import { SPACE_COLORS, cn } from '../../lib/utils'

function useGoalProgress() {
  const tasks = useStore((s) => s.tasks)
  const r = useTaskResolver()
  return (g: Goal) => {
    if (!g.targets.length) return 0
    return g.targets.reduce((a, t) => a + targetProgress(t, tasks, r.isDone).pct, 0) / g.targets.length
  }
}

function Ring({ pct, color, size = 44 }: { pct: number; color: string; size?: number }) {
  const r = size / 2 - 4
  const C = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="shrink-0" role="img" aria-label={`${Math.round(pct * 100)}% complete`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-muted)" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${pct * C} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" className="fill-[var(--text)] text-[11px] font-bold">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  )
}

export default function GoalsPage() {
  const { goals, addGoal } = useStore()
  const progress = useGoalProgress()
  const [open, setOpen] = useState<string | null>(null)
  const folders = [...new Set(goals.map((g) => g.folder))]

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <Trophy size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">Goals</h1>
          <button onClick={() => setOpen(addGoal())} className="bg-brand-600 hover:bg-brand-700 ml-auto inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-semibold text-white">
            <Plus size={15} /> New goal
          </button>
        </div>
        {folders.map((f) => (
          <section key={f} className="mb-8">
            <h2 className="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">{f}</h2>
            <div className="border-app divide-y divide-[var(--border)] overflow-hidden rounded-xl border">
              {goals
                .filter((g) => g.folder === f)
                .map((g) => (
                  <div key={g.id}>
                    <button onClick={() => setOpen(open === g.id ? null : g.id)} className="hover-surface flex w-full items-center gap-4 px-4 py-3 text-left">
                      {open === g.id ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
                      <Ring pct={progress(g)} color={g.color} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{g.name}</div>
                        <div className="text-muted truncate text-xs">
                          {g.targets.length} target{g.targets.length === 1 ? '' : 's'}
                          {g.dueDate && ` · due ${format(parseISO(g.dueDate), 'MMM d')}`}
                        </div>
                      </div>
                      <Avatar userId={g.ownerId} size={26} />
                    </button>
                    {open === g.id && <GoalDetail goal={g} />}
                  </div>
                ))}
            </div>
          </section>
        ))}
        {goals.length === 0 && <p className="text-muted py-16 text-center text-sm">No goals yet. Set one to keep the team pointed in the same direction.</p>}
      </div>
    </div>
  )
}

function GoalDetail({ goal: g }: { goal: Goal }) {
  const { updateGoal, deleteGoal, users, updateTarget, deleteTarget, tasks } = useStore()
  const r = useTaskResolver()
  const owner = usePopover()
  return (
    <div className="surface-subtle space-y-4 px-4 py-4 sm:px-14">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-muted text-xs">Name</span>
          <input value={g.name} onChange={(e) => updateGoal(g.id, { name: e.target.value })} className="border-app surface mt-1 w-full rounded-md border px-2 py-1.5 font-medium outline-none" />
        </label>
        <label className="text-sm">
          <span className="text-muted text-xs">Folder</span>
          <input value={g.folder} onChange={(e) => updateGoal(g.id, { folder: e.target.value || 'Goals' })} className="border-app surface mt-1 w-full rounded-md border px-2 py-1.5 outline-none" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="text-muted text-xs">Description</span>
          <textarea value={g.description} onChange={(e) => updateGoal(g.id, { description: e.target.value })} rows={2} className="border-app surface mt-1 w-full resize-none rounded-md border px-2 py-1.5 outline-none" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span className="text-muted text-xs">Owner</span>
          <button onClick={owner.toggle} className="hover-surface flex items-center gap-1.5 rounded px-1 py-0.5">
            <Avatar userId={g.ownerId} size={20} /> {users.find((u) => u.id === g.ownerId)?.name}
          </button>
          <Popover open={owner.open} anchor={owner.anchor} onClose={owner.close}>
            {users.map((u) => (
              <MenuItem key={u.id} active={u.id === g.ownerId} onClick={() => (updateGoal(g.id, { ownerId: u.id }), owner.close())}>
                <Avatar userId={u.id} size={20} /> {u.name}
              </MenuItem>
            ))}
          </Popover>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-muted text-xs">Due</span>
          <DateButton value={g.dueDate} onChange={(v) => updateGoal(g.id, { dueDate: v })} placeholder="Set date" />
        </span>
        <span className="flex items-center gap-1">
          {SPACE_COLORS.map((c) => (
            <button key={c} onClick={() => updateGoal(g.id, { color: c })} className={cn('h-4 w-4 rounded-full', g.color === c && 'ring-2 ring-offset-1 ring-offset-[var(--bg-subtle)]')} style={{ background: c, ['--tw-ring-color' as string]: c }} aria-label={`Color ${c}`} />
          ))}
        </span>
        <button onClick={() => confirm(`Delete goal “${g.name}”?`) && deleteGoal(g.id)} className="ml-auto flex items-center gap-1 text-xs text-red-500 hover:underline">
          <Trash2 size={13} /> Delete goal
        </button>
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <TargetIcon size={15} /> Targets
        </h3>
        <div className="space-y-2">
          {g.targets.map((t) => {
            const p = targetProgress(t, tasks, r.isDone)
            return (
              <div key={t.id} className="surface border-app group rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <input value={t.name} onChange={(e) => updateTarget(g.id, t.id, { name: e.target.value })} className="min-w-0 flex-1 bg-transparent font-medium outline-none" />
                  <TargetValue goalId={g.id} t={t} current={p.current} target={p.target} />
                  <button onClick={() => deleteTarget(g.id, t.id)} className="text-faint hidden group-hover:block" aria-label="Delete target">
                    <X size={14} />
                  </button>
                </div>
                <div className="surface-muted mt-2 h-2 overflow-hidden rounded-full">
                  <div className="h-full rounded-full transition-all" style={{ width: `${p.pct * 100}%`, background: g.color }} />
                </div>
              </div>
            )
          })}
        </div>
        <AddTarget goalId={g.id} />
      </div>
    </div>
  )
}

function TargetValue({ goalId, t, current, target }: { goalId: string; t: Target; current: number; target: number }) {
  const { updateTarget, lists } = useStore()
  if (t.kind === 'boolean')
    return (
      <label className="flex items-center gap-1.5 text-xs">
        <input type="checkbox" checked={!!t.current} onChange={(e) => updateTarget(goalId, t.id, { current: e.target.checked ? 1 : 0 })} className="accent-brand-600 h-4 w-4" />
        {t.current ? 'Done' : 'Not done'}
      </label>
    )
  if (t.kind === 'tasks')
    return (
      <span className="text-muted text-xs tabular-nums">
        {current}/{target} tasks in {lists.find((l) => l.id === t.listId)?.name ?? 'a deleted List'}
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-xs tabular-nums">
      {t.kind === 'currency' && t.unit}
      <input
        type="number"
        value={t.current}
        onChange={(e) => updateTarget(goalId, t.id, { current: Number(e.target.value) })}
        className="border-app surface w-20 rounded border px-1 py-0.5 text-right outline-none"
        aria-label="Current value"
      />
      <span className="text-muted">
        / {t.kind === 'currency' && t.unit}
        {t.target.toLocaleString()} {t.kind === 'number' && t.unit}
      </span>
    </span>
  )
}

function AddTarget({ goalId }: { goalId: string }) {
  const { addTarget, lists } = useStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<TargetKind>('number')
  const [start, setStart] = useState('0')
  const [target, setTarget] = useState('100')
  const [unit, setUnit] = useState('')
  const [listId, setListId] = useState(lists[0]?.id ?? '')

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="text-muted hover:text-app mt-2 flex items-center gap-1.5 text-sm">
        <Plus size={14} /> Add target
      </button>
    )
  return (
    <form
      className="surface border-app mt-2 space-y-2 rounded-lg border p-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        addTarget(goalId, { name: name.trim(), kind, start: Number(start) || 0, current: Number(start) || 0, target: kind === 'boolean' ? 1 : Number(target) || 0, unit: kind === 'currency' ? unit || '$' : unit, listId: kind === 'tasks' ? listId : null })
        setName('')
        setOpen(false)
      }}
    >
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Target name, e.g. Weekly active teams" className="border-app w-full rounded-md border bg-transparent px-2 py-1.5 outline-none" />
      <div className="flex flex-wrap gap-1">
        {(['number', 'currency', 'boolean', 'tasks'] as TargetKind[]).map((k) => (
          <button type="button" key={k} onClick={() => setKind(k)} className={cn('rounded-md border px-2 py-1 text-xs capitalize', kind === k ? 'border-brand-500 text-brand-600' : 'border-app text-muted')}>
            {k === 'boolean' ? 'True / false' : k === 'tasks' ? 'Task completion' : k}
          </button>
        ))}
      </div>
      {(kind === 'number' || kind === 'currency') && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          Start <input type="number" value={start} onChange={(e) => setStart(e.target.value)} className="border-app w-20 rounded border bg-transparent px-1 py-1" />
          Target <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} className="border-app w-24 rounded border bg-transparent px-1 py-1" />
          Unit <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={kind === 'currency' ? '$' : 'e.g. ms'} className="border-app w-16 rounded border bg-transparent px-1 py-1" />
        </div>
      )}
      {kind === 'tasks' && (
        <label className="flex items-center gap-2 text-xs">
          Track completion of
          <select value={listId} onChange={(e) => setListId(e.target.value)} className="border-app surface rounded border px-1 py-1">
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="hover-surface rounded-md px-2.5 py-1 text-xs">
          Cancel
        </button>
        <button className="bg-brand-600 rounded-md px-2.5 py-1 text-xs font-semibold text-white">Add target</button>
      </div>
    </form>
  )
}
