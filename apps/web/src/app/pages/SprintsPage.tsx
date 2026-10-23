import { useMemo, useState } from 'react'
import { addDays, differenceInCalendarDays, format, isAfter, parseISO } from 'date-fns'
import { ArrowRight, CalendarRange, CheckCircle2, Flag, Play, Plus, Target, Trash2, Zap } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { Sprint, Task } from '../../store/types'
import { useTaskResolver } from '../hooks'
import { AvatarStack, Modal, PriorityFlag, StatusDot, StatusMenu } from '../components/ui'
import { cn, toISODate } from '../../lib/utils'

/** Remaining points per day: total minus points of tasks that were done by the end of that day (done time ≈ last update). */
function burndown(sprint: Sprint, tasks: Task[], isDone: (t: Task) => boolean) {
  const start = parseISO(sprint.startDate)
  const end = parseISO(sprint.endDate)
  const days = Math.max(1, differenceInCalendarDays(end, start))
  const total = tasks.reduce((a, t) => a + (t.points ?? 0), 0)
  const today = new Date()
  const points: { day: string; ideal: number; actual: number | null }[] = []
  for (let i = 0; i <= days; i++) {
    const d = addDays(start, i)
    const dayEnd = toISODate(d)
    const burned = tasks.filter((t) => isDone(t) && t.updatedAt.slice(0, 10) <= dayEnd).reduce((a, t) => a + (t.points ?? 0), 0)
    points.push({ day: format(d, 'MMM d'), ideal: total - (total * i) / days, actual: isAfter(d, today) ? null : total - burned })
  }
  return { total, points }
}

function Burndown({ data, total }: { data: ReturnType<typeof burndown>['points']; total: number }) {
  const W = 600
  const H = 200
  const pad = 28
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, data.length - 1)
  const y = (v: number) => H - pad - (v / Math.max(1, total)) * (H - pad * 2)
  const ideal = data.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.ideal)}`).join(' ')
  const actualPts = data.map((p, i) => (p.actual == null ? null : [x(i), y(p.actual)] as const)).filter(Boolean) as (readonly [number, number])[]
  const actual = actualPts.map(([px, py], i) => `${i ? 'L' : 'M'}${px},${py}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Sprint burndown: remaining points versus ideal">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad} x2={W - pad} y1={y(total * f)} y2={y(total * f)} stroke="var(--border)" strokeDasharray="3 4" />
          <text x={pad - 6} y={y(total * f) + 3} textAnchor="end" className="fill-[var(--text-faint)] text-[10px]">
            {Math.round(total * f)}
          </text>
        </g>
      ))}
      <path d={ideal} fill="none" stroke="var(--text-faint)" strokeWidth={1.5} strokeDasharray="5 4" />
      {actual && <path d={actual} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinejoin="round" />}
      {actualPts.length > 0 && <circle cx={actualPts[actualPts.length - 1][0]} cy={actualPts[actualPts.length - 1][1]} r={4} fill="#6366f1" />}
      {data.map((p, i) =>
        i % Math.ceil(data.length / 6) === 0 || i === data.length - 1 ? (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-[var(--text-faint)] text-[10px]">
            {p.day}
          </text>
        ) : null,
      )}
    </svg>
  )
}

export default function SprintsPage() {
  const s = useStore()
  const r = useTaskResolver()
  const withSprints = s.spaces.filter((sp) => s.sprints.some((x) => x.spaceId === sp.id))
  const [spaceId, setSpaceId] = useState(withSprints[0]?.id ?? s.spaces[0]?.id ?? '')
  const space = s.spaces.find((sp) => sp.id === spaceId)
  const sprints = s.sprints.filter((x) => x.spaceId === spaceId).sort((a, b) => a.startDate.localeCompare(b.startDate))
  const active = sprints.find((x) => x.status === 'active')
  const planned = sprints.filter((x) => x.status === 'planned')
  const done = sprints.filter((x) => x.status === 'done')
  const listIds = new Set(s.lists.filter((l) => l.spaceId === spaceId).map((l) => l.id))
  const projectTasks = s.tasks.filter((t) => listIds.has(t.listId) && !t.parentId)
  const [completing, setCompleting] = useState<Sprint | null>(null)
  const [viewId, setViewId] = useState<string | null>(null)
  const current = sprints.find((x) => x.id === viewId) ?? active ?? planned[0] ?? done[done.length - 1]

  const sprintTasks = current ? projectTasks.filter((t) => t.sprintId === current.id) : []
  const backlog = projectTasks.filter((t) => !t.sprintId && !r.isDone(t))
  const bd = useMemo(() => (current ? burndown(current, sprintTasks, r.isDone) : null), [current, sprintTasks, r])
  const pointsDone = sprintTasks.filter(r.isDone).reduce((a, t) => a + (t.points ?? 0), 0)
  const daysLeft = current ? differenceInCalendarDays(parseISO(current.endDate), new Date()) : 0

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Zap size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">Sprints</h1>
          <select value={spaceId} onChange={(e) => (setSpaceId(e.target.value), setViewId(null))} className="border-app surface h-8 rounded-md border px-2 text-sm" aria-label="Project">
            {s.spaces.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>
          <button onClick={() => setViewId(s.addSprint(spaceId))} className="bg-brand-600 hover:bg-brand-700 ml-auto inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-semibold text-white">
            <Plus size={15} /> New sprint
          </button>
        </div>

        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
          {sprints.map((sp) => (
            <button
              key={sp.id}
              onClick={() => setViewId(sp.id)}
              className={cn('shrink-0 rounded-lg border px-3 py-1.5 text-left text-xs', current?.id === sp.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/15' : 'border-app hover-surface')}
            >
              <span className="flex items-center gap-1.5 font-semibold">
                {sp.status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                {sp.status === 'done' && <CheckCircle2 size={12} className="text-muted" />}
                {sp.name}
              </span>
              <span className="text-muted">
                {format(parseISO(sp.startDate), 'MMM d')} – {format(parseISO(sp.endDate), 'MMM d')}
              </span>
            </button>
          ))}
          {sprints.length === 0 && <p className="text-muted text-sm">No sprints in {space?.name} yet — create one to start planning.</p>}
        </div>

        {current && bd && (
          <>
            <div className="border-app mb-4 rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input value={current.name} onChange={(e) => s.updateSprint(current.id, { name: e.target.value })} className="min-w-0 bg-transparent text-lg font-bold outline-none" aria-label="Sprint name" />
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase', current.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : current.status === 'planned' ? 'surface-muted text-muted' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300')}>
                  {current.status}
                </span>
                <span className="text-muted flex items-center gap-1 text-xs">
                  <CalendarRange size={13} />
                  <input type="date" value={current.startDate} onChange={(e) => s.updateSprint(current.id, { startDate: e.target.value })} className="bg-transparent" aria-label="Start date" /> –
                  <input type="date" value={current.endDate} onChange={(e) => s.updateSprint(current.id, { endDate: e.target.value })} className="bg-transparent" aria-label="End date" />
                </span>
                <div className="ml-auto flex gap-2">
                  {current.status === 'planned' && (
                    <button onClick={() => s.startSprint(current.id)} className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white">
                      <Play size={13} /> Start sprint
                    </button>
                  )}
                  {current.status === 'active' && (
                    <button onClick={() => setCompleting(current)} className="bg-brand-600 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white">
                      <CheckCircle2 size={13} /> Complete sprint
                    </button>
                  )}
                  {current.status !== 'active' && (
                    <button onClick={() => confirm(`Delete ${current.name}? Its tasks go back to the backlog.`) && (s.deleteSprint(current.id), setViewId(null))} className="hover-surface rounded-md p-1.5 text-red-500" aria-label="Delete sprint">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <label className="text-muted mt-2 flex items-center gap-2 text-sm">
                <Target size={14} />
                <input value={current.goal} onChange={(e) => s.updateSprint(current.id, { goal: e.target.value })} placeholder="Sprint goal" className="text-app min-w-0 flex-1 bg-transparent outline-none" />
              </label>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {[
                  ['Points done', `${pointsDone} / ${bd.total}`],
                  ['Tasks done', `${sprintTasks.filter(r.isDone).length} / ${sprintTasks.length}`],
                  [current.status === 'done' ? 'Velocity' : 'Days left', current.status === 'done' ? `${current.completedPoints ?? pointsDone} pts` : current.status === 'planned' ? '—' : `${Math.max(0, daysLeft)}`],
                  ['Unestimated', `${sprintTasks.filter((t) => t.points == null).length}`],
                ].map(([l, v]) => (
                  <div key={l} className="surface-subtle rounded-lg p-3">
                    <div className="text-xl font-bold tabular-nums">{v}</div>
                    <div className="text-muted text-xs">{l}</div>
                  </div>
                ))}
              </div>
              <div className="surface-muted mt-3 h-2 overflow-hidden rounded-full">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${bd.total ? (pointsDone / bd.total) * 100 : 0}%` }} />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
              <section className="border-app rounded-xl border p-4">
                <h2 className="mb-2 text-sm font-semibold">Sprint tasks</h2>
                {sprintTasks.length === 0 && <p className="text-muted py-6 text-center text-sm">Add tasks from the backlog →</p>}
                <div className="divide-y divide-[var(--border)]">
                  {sprintTasks.map((t) => (
                    <SprintRow key={t.id} task={t} statuses={space?.statuses ?? []} action={current.status !== 'done' ? { label: 'Remove', onClick: () => s.updateTask(t.id, { sprintId: null }) } : undefined} />
                  ))}
                </div>
              </section>
              <div className="space-y-4">
                <section className="border-app rounded-xl border p-4">
                  <h2 className="mb-1 flex items-center gap-3 text-sm font-semibold">
                    Burndown
                    <span className="text-muted flex items-center gap-1 text-xs font-normal">
                      <span className="h-0.5 w-4 bg-[#6366f1]" /> Remaining
                    </span>
                    <span className="text-muted flex items-center gap-1 text-xs font-normal">
                      <span className="h-0 w-4 border-t border-dashed border-[var(--text-faint)]" /> Ideal
                    </span>
                  </h2>
                  {bd.total ? <Burndown data={bd.points} total={bd.total} /> : <p className="text-muted py-6 text-center text-sm">Estimate tasks with story points to see the burndown.</p>}
                </section>
                {current.status !== 'done' && (
                  <section className="border-app rounded-xl border p-4">
                    <h2 className="mb-2 text-sm font-semibold">
                      Backlog <span className="text-faint font-normal">{backlog.length}</span>
                    </h2>
                    <div className="max-h-72 divide-y divide-[var(--border)] overflow-y-auto scroll-thin">
                      {backlog.map((t) => (
                        <SprintRow key={t.id} task={t} statuses={space?.statuses ?? []} action={{ label: 'Add', onClick: () => s.updateTask(t.id, { sprintId: current.id }) }} />
                      ))}
                      {backlog.length === 0 && <p className="text-muted py-4 text-center text-sm">Backlog is empty.</p>}
                    </div>
                  </section>
                )}
              </div>
            </div>

            {done.length > 0 && (
              <section className="border-app mt-4 rounded-xl border p-4">
                <h2 className="mb-3 text-sm font-semibold">Velocity</h2>
                <div className="flex h-32 items-end gap-3">
                  {done.map((sp) => {
                    const max = Math.max(1, ...done.map((d) => d.completedPoints ?? 0))
                    return (
                      <div key={sp.id} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-xs font-semibold tabular-nums">{sp.completedPoints ?? 0}</span>
                        <div className="bg-brand-500 w-full max-w-12 rounded-t" style={{ height: `${((sp.completedPoints ?? 0) / max) * 80}px` }} />
                        <span className="text-muted text-[11px]">{sp.name}</span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      {completing && <CompleteDialog sprint={completing} planned={planned} onClose={() => setCompleting(null)} unfinished={projectTasks.filter((t) => t.sprintId === completing.id && !r.isDone(t)).length} />}
    </div>
  )
}

function SprintRow({ task, statuses, action }: { task: Task; statuses: import('../../store/types').Status[]; action?: { label: string; onClick: () => void } }) {
  const { updateTask, openTask } = useStore()
  const r = useTaskResolver()
  return (
    <div className="flex items-center gap-2 py-2 text-[13px]">
      <StatusMenu statuses={statuses} value={task.statusId} onChange={(v) => updateTask(task.id, { statusId: v })}>
        <StatusDot status={r.statusOf(task)} />
      </StatusMenu>
      <button onClick={() => openTask(task.id)} className={cn('min-w-0 flex-1 truncate text-left', r.isDone(task) && 'text-faint line-through')}>
        {task.title}
      </button>
      {task.priority && <PriorityFlag priority={task.priority} />}
      <AvatarStack ids={task.assignees} size={20} max={2} />
      <input
        type="number"
        min={0}
        value={task.points ?? ''}
        onChange={(e) => updateTask(task.id, { points: e.target.value === '' ? null : Number(e.target.value) })}
        placeholder="pts"
        className="border-app w-12 rounded border bg-transparent px-1 py-0.5 text-center text-xs"
        aria-label="Story points"
        title="Story points"
      />
      {action && (
        <button onClick={action.onClick} className="hover-surface text-muted rounded px-1.5 py-0.5 text-xs">
          {action.label}
        </button>
      )}
    </div>
  )
}

function CompleteDialog({ sprint, planned, unfinished, onClose }: { sprint: Sprint; planned: Sprint[]; unfinished: number; onClose: () => void }) {
  const { completeSprint, addSprint } = useStore()
  const [target, setTarget] = useState<string>(planned[0]?.id ?? 'new')
  return (
    <Modal open onClose={onClose} className="mt-[15vh] max-w-md">
      <div className="p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Flag size={18} /> Complete {sprint.name}
        </h2>
        <p className="text-muted mt-2 text-sm">{unfinished ? `${unfinished} unfinished task${unfinished > 1 ? 's' : ''} will move to:` : 'All tasks are done. Nice work!'}</p>
        {unfinished > 0 && (
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="border-app surface mt-3 w-full rounded-lg border px-2 py-1.5 text-sm">
            {planned.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (and start it)
              </option>
            ))}
            <option value="new">A new sprint (and start it)</option>
            <option value="backlog">The backlog</option>
          </select>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="hover-surface rounded-lg px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            onClick={() => {
              const dest = target === 'backlog' || !unfinished ? null : target === 'new' ? addSprint(sprint.spaceId) : target
              completeSprint(sprint.id, dest)
              onClose()
            }}
            className="bg-brand-600 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
          >
            Complete <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </Modal>
  )
}
