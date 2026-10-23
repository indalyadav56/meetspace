import { useMemo, useState } from 'react'
import { addDays, differenceInCalendarDays, format, parseISO, subDays } from 'date-fns'
import { AlertTriangle, CheckCircle2, Clock, LayoutDashboard, ListTodo } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useTaskResolver } from '../hooks'
import { Avatar } from '../components/ui'
import { PRIORITIES, cn, toISODate } from '../../lib/utils'

function Widget({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('surface border-app rounded-xl border p-4', className)}>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Donut({ data, size = 150 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1
  const r = size / 2 - 14
  const C = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Tasks by status">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-muted)" strokeWidth={20} />
        {data.map((d) => {
          const len = (d.value / total) * C
          const el = (
            <circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={20}
              strokeDasharray={`${Math.max(len - 2, 0)} ${C}`}
              strokeDashoffset={-acc}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>
                {d.label}: {d.value}
              </title>
            </circle>
          )
          acc += len
          return el
        })}
        <text x="50%" y="48%" textAnchor="middle" className="fill-[var(--text)] text-2xl font-bold">
          {data.reduce((a, b) => a + b.value, 0)}
        </text>
        <text x="50%" y="62%" textAnchor="middle" className="fill-[var(--text-muted)] text-[11px]">
          tasks
        </text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
            {d.label}
            <span className="text-muted ml-3 tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Bars({ data }: { data: { label: React.ReactNode; key: string; value: number; color?: string }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.key} className="flex items-center gap-3 text-sm">
          <div className="flex w-36 shrink-0 items-center gap-2 truncate">{d.label}</div>
          <div className="surface-muted h-5 flex-1 overflow-hidden rounded">
            <div className="h-full rounded transition-all" style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? 'var(--color-brand-500)' }} />
          </div>
          <span className="text-muted w-6 text-right tabular-nums">{d.value}</span>
        </div>
      ))}
    </div>
  )
}

function Trend({ points }: { points: { label: string; created: number; completed: number }[] }) {
  const W = 560
  const H = 170
  const pad = 24
  const max = Math.max(1, ...points.flatMap((p) => [p.created, p.completed]))
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, points.length - 1)
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2)
  const line = (k: 'created' | 'completed') => points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[k])}`).join(' ')
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Created vs completed over 14 days">
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={pad} x2={W - pad} y1={y(max * f)} y2={y(max * f)} stroke="var(--border)" strokeDasharray="3 4" />
        ))}
        <path d={line('created')} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinejoin="round" />
        <path d={line('completed')} fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinejoin="round" />
        {points.map((p, i) =>
          i % 2 === 0 ? (
            <text key={p.label} x={x(i)} y={H - 4} textAnchor="middle" className="fill-[var(--text-faint)] text-[10px]">
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
      <div className="text-muted flex gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[#6366f1]" /> Created
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[#10b981]" /> Completed
        </span>
      </div>
    </div>
  )
}

export default function Dashboards() {
  const s = useStore()
  const r = useTaskResolver()
  const [spaceId, setSpaceId] = useState<string>('all')

  const tasks = useMemo(() => {
    const top = s.tasks.filter((t) => !t.parentId)
    return spaceId === 'all' ? top : top.filter((t) => r.spaceOf(t)?.id === spaceId)
  }, [s.tasks, spaceId, r])

  const done = tasks.filter((t) => r.isDone(t))
  const open = tasks.filter((t) => !r.isDone(t))
  const overdue = open.filter((t) => t.dueDate && differenceInCalendarDays(parseISO(t.dueDate), new Date()) < 0)
  const dueSoon = open.filter((t) => t.dueDate && (() => { const d = differenceInCalendarDays(parseISO(t.dueDate), new Date()); return d >= 0 && d <= 7 })())

  const byType = [
    { label: 'Not started', value: tasks.filter((t) => r.statusOf(t)?.type === 'open').length, color: '#94a3b8' },
    { label: 'In progress', value: tasks.filter((t) => r.statusOf(t)?.type === 'active').length, color: '#3b82f6' },
    { label: 'Done', value: done.length, color: '#10b981' },
  ]

  const workload = s.users.map((u) => ({
    key: u.id,
    label: (
      <>
        <Avatar userId={u.id} size={20} /> <span className="truncate">{u.name.split(' ')[0]}</span>
      </>
    ),
    value: open.filter((t) => t.assignees.includes(u.id)).length,
    color: u.color,
  }))

  const byPriority = [...PRIORITIES, { value: null, label: 'None', color: '#cbd5e1' }].map((p) => ({
    key: String(p.value),
    label: p.label,
    value: open.filter((t) => t.priority === p.value).length,
    color: p.color,
  }))

  const trend = Array.from({ length: 14 }, (_, i) => {
    const day = toISODate(subDays(new Date(), 13 - i))
    return {
      label: format(addDays(subDays(new Date(), 13), i), 'MMM d'),
      created: tasks.filter((t) => t.createdAt.slice(0, 10) === day).length,
      completed: done.filter((t) => t.updatedAt.slice(0, 10) === day).length,
    }
  })

  const stat = (label: string, value: number, Icon: typeof Clock, color: string) => (
    <div className="surface border-app flex items-center gap-3 rounded-xl border p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${color}1f`, color }}>
        <Icon size={20} />
      </span>
      <div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-muted text-xs">{label}</div>
      </div>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <LayoutDashboard size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">Team overview</h1>
          <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className="border-app surface ml-auto h-8 rounded-md border px-2 text-sm" aria-label="Project">
            <option value="all">All projects</option>
            {s.spaces.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stat('Open tasks', open.length, ListTodo, '#6366f1')}
          {stat('Completed', done.length, CheckCircle2, '#10b981')}
          {stat('Overdue', overdue.length, AlertTriangle, '#ef4444')}
          {stat('Due in 7 days', dueSoon.length, Clock, '#f59e0b')}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Widget title="Tasks by status">
            <Donut data={byType} />
          </Widget>
          <Widget title="Workload — open tasks per person">
            <Bars data={workload} />
          </Widget>
          <Widget title="Created vs completed — last 14 days" className="lg:col-span-2">
            <Trend points={trend} />
          </Widget>
          <Widget title="Open tasks by priority">
            <Bars data={byPriority} />
          </Widget>
          <Widget title="Overdue">
            {overdue.length === 0 ? (
              <p className="text-muted py-6 text-center text-sm">Nothing overdue 🎉</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {overdue.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => s.openTask(t.id)} className="hover-surface flex w-full items-center gap-2 rounded px-1 py-2 text-left text-sm">
                      <span className="truncate">{t.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-red-500">{Math.abs(differenceInCalendarDays(parseISO(t.dueDate!), new Date()))}d late</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Widget>
        </div>
      </div>
    </div>
  )
}
