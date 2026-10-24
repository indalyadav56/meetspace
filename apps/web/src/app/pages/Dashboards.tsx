import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addDays, differenceInCalendarDays, format, parseISO, subDays } from 'date-fns'
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Clock, Copy, LayoutDashboard, ListTodo, MoreHorizontal, Plus, Search, Star, Trash2, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { Dashboard, DashboardCard, Task } from '../../store/types'
import { useTaskResolver } from '../hooks'
import { Avatar, MenuItem, Popover, usePopover } from '../components/ui'
import { PRIORITIES, cn, tagColor, timeAgo, toISODate } from '../../lib/utils'
import { useQueryState } from '../../lib/useQueryState'

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
        <path d={line('created')} fill="none" stroke="#149c89" strokeWidth={2.5} strokeLinejoin="round" />
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
          <span className="h-0.5 w-4 bg-[#149c89]" /> Created
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[#10b981]" /> Completed
        </span>
      </div>
    </div>
  )
}


export const CARD_LABELS: Record<DashboardCard, string> = {
  stats: 'Key numbers',
  status: 'Tasks by status',
  workload: 'Workload by person',
  trend: 'Created vs completed',
  priority: 'Open tasks by priority',
  overdue: 'Overdue',
  dueSoon: 'Due in the next 7 days',
  recentlyDone: 'Recently completed',
  byList: 'Open tasks by List',
  byTag: 'Open tasks by tag',
}
const WIDE: DashboardCard[] = ['stats', 'trend']

interface Template {
  key: string
  title: string
  hint: string
  cards: DashboardCard[]
}
export const DASHBOARD_TEMPLATES: Template[] = [
  { key: 'simple', title: 'Simple Dashboard', hint: 'Manage and prioritize tasks', cards: ['stats', 'status', 'priority', 'dueSoon'] },
  { key: 'pm', title: 'Project Management', hint: 'Progress, trend and risks', cards: ['stats', 'trend', 'status', 'byList', 'overdue', 'recentlyDone'] },
  { key: 'team', title: 'Team Workload', hint: 'Who is carrying what', cards: ['stats', 'workload', 'priority', 'dueSoon', 'overdue'] },
  { key: 'triage', title: 'Bug Triage', hint: 'Open work by tag and priority', cards: ['byTag', 'priority', 'overdue', 'recentlyDone'] },
]

const viewed = {
  all: (): Record<string, string> => {
    try {
      return JSON.parse(localStorage.getItem('ms.dash.viewed') ?? '{}')
    } catch {
      return {}
    }
  },
  mark: (id: string) => {
    try {
      localStorage.setItem('ms.dash.viewed', JSON.stringify({ ...viewed.all(), [id]: new Date().toISOString() }))
    } catch {
      /* storage blocked */
    }
  },
}

export default function Dashboards() {
  const { dashboardId } = useParams()
  const d = useStore((s) => s.dashboards.find((x) => x.id === dashboardId))
  return d ? <DashboardView key={d.id} dash={d} /> : <DashboardsHub />
}

function DashboardsHub() {
  const s = useStore()
  const nav = useNavigate()
  const [filter] = useQueryState<'all' | 'mine' | 'favorites'>('in', 'all')
  const [q, setQ] = useState('')
  const seen = useMemo(() => viewed.all(), [])
  const create = (t?: Template) => nav(`/app/dashboards/${s.addDashboard(t ? { title: t.title, cards: t.cards } : {})}`)
  const shown = s.dashboards
    .filter((d) => (filter === 'mine' ? d.createdBy === s.currentUserId : filter === 'favorites' ? s.favorites.includes(d.id) : true))
    .filter((d) => d.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (seen[b.id] ?? b.updatedAt).localeCompare(seen[a.id] ?? a.updatedAt))
  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <LayoutDashboard size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">{filter === 'mine' ? 'My dashboards' : filter === 'favorites' ? 'Favorite dashboards' : 'All dashboards'}</h1>
          <button onClick={() => create()} className="bg-brand-600 hover:bg-brand-700 ml-auto inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-semibold text-white">
            <Plus size={15} /> New dashboard
          </button>
        </div>
        <h2 className="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">Templates</h2>
        <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {DASHBOARD_TEMPLATES.map((t) => (
            <button key={t.key} onClick={() => create(t)} className="border-app surface-subtle hover:border-brand-500 flex flex-col items-start rounded-xl border p-3 text-left">
              <span className="text-sm font-semibold">{t.title}</span>
              <span className="text-faint text-xs">{t.hint}</span>
              <span className="text-muted mt-2 text-[11px]">{t.cards.map((c) => CARD_LABELS[c]).join(' · ')}</span>
            </button>
          ))}
        </div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-faint text-xs">{shown.length} dashboards</span>
          <div className="border-app ml-auto flex h-8 items-center gap-2 rounded-md border px-2">
            <Search size={14} className="text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dashboards" className="w-44 bg-transparent text-sm outline-none" />
          </div>
        </div>
        {shown.length === 0 ? (
          <div className="border-app flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-12 text-center">
            <LayoutDashboard size={22} className="text-faint" />
            <p className="font-semibold">{s.dashboards.length ? 'No dashboards match' : 'No dashboards yet'}</p>
            <p className="text-muted max-w-sm text-sm">Pick a template above or start blank. Each dashboard keeps its own cards and Space.</p>
          </div>
        ) : (
          <div className="border-app overflow-x-auto rounded-xl border">
            <div className="min-w-[800px]">
              <div className="text-faint border-app grid grid-cols-[minmax(200px,1fr)_140px_120px_100px_100px_60px] gap-2 border-b px-4 py-2 text-xs font-medium">
                <span>Name</span>
                <span>Location</span>
                <span>Owner</span>
                <span>Updated</span>
                <span>Viewed</span>
                <span />
              </div>
              {shown.map((d) => (
                <div key={d.id} className="border-app hover-surface group grid grid-cols-[minmax(200px,1fr)_140px_120px_100px_100px_60px] items-center gap-2 border-b px-4 py-2 text-sm last:border-b-0">
                  <Link to={`/app/dashboards/${d.id}`} className="flex min-w-0 items-center gap-2">
                    <LayoutDashboard size={15} className="text-brand-600 shrink-0" />
                    <span className="truncate font-medium hover:underline">{d.title}</span>
                    <span className="text-faint shrink-0 text-xs">{d.cards.length} cards</span>
                  </Link>
                  <span className="text-muted truncate text-xs">{d.spaceId ? (s.spaces.find((sp) => sp.id === d.spaceId)?.name ?? '—') : 'Everything'}</span>
                  <span className="text-muted flex min-w-0 items-center gap-1.5 text-xs">
                    <Avatar userId={d.createdBy} size={18} /> <span className="truncate">{s.users.find((u) => u.id === d.createdBy)?.name.split(' ')[0]}</span>
                  </span>
                  <span className="text-muted text-xs">{timeAgo(d.updatedAt)}</span>
                  <span className="text-muted text-xs">{seen[d.id] ? timeAgo(seen[d.id]) : '—'}</span>
                  <span className="flex justify-end gap-1">
                    <button onClick={() => s.toggleFavorite(d.id)} aria-label="Toggle favorite">
                      <Star size={14} className={s.favorites.includes(d.id) ? 'fill-amber-400 text-amber-400' : 'text-faint opacity-0 group-hover:opacity-100'} />
                    </button>
                    <DashMenu d={d} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DashMenu({ d }: { d: Dashboard }) {
  const s = useStore()
  const nav = useNavigate()
  const pop = usePopover()
  return (
    <>
      <button onClick={pop.toggle} className="text-faint hover:text-app rounded p-0.5" aria-label={`Actions for ${d.title}`}>
        <MoreHorizontal size={15} />
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} align="end" width={170}>
        <MenuItem onClick={() => (pop.close(), nav(`/app/dashboards/${s.addDashboard({ title: `${d.title} (copy)`, cards: d.cards, spaceId: d.spaceId })}`))}>
          <Copy size={14} /> Duplicate
        </MenuItem>
        <MenuItem danger onClick={() => (pop.close(), confirm(`Delete “${d.title}”?`) && s.deleteDashboard(d.id))}>
          <Trash2 size={14} /> Delete
        </MenuItem>
      </Popover>
    </>
  )
}

function DashboardView({ dash }: { dash: Dashboard }) {
  const s = useStore()
  const r = useTaskResolver()
  const nav = useNavigate()
  const addPop = usePopover()
  const [title, setTitle] = useState(dash.title)
  useEffect(() => setTitle(dash.title), [dash.title])
  useEffect(() => viewed.mark(dash.id), [dash.id])

  const tasks = useMemo(() => {
    const top = s.tasks.filter((t) => !t.parentId)
    return dash.spaceId ? top.filter((t) => r.spaceOf(t)?.id === dash.spaceId) : top
  }, [s.tasks, dash.spaceId, r])
  const done = tasks.filter((t) => r.isDone(t))
  const open = tasks.filter((t) => !r.isDone(t))
  const daysTo = (t: Task) => differenceInCalendarDays(parseISO(t.dueDate!), new Date())
  const overdue = open.filter((t) => t.dueDate && daysTo(t) < 0).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
  const dueSoon = open.filter((t) => t.dueDate && daysTo(t) >= 0 && daysTo(t) <= 7).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
  const setCards = (cards: DashboardCard[]) => s.updateDashboard(dash.id, { cards })
  const move = (c: DashboardCard, d: -1 | 1) => {
    const i = dash.cards.indexOf(c)
    const j = i + d
    if (j < 0 || j >= dash.cards.length) return
    const next = [...dash.cards]
    ;[next[i], next[j]] = [next[j], next[i]]
    setCards(next)
  }

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
  const taskList = (list: Task[], right: (t: Task) => React.ReactNode, empty: string) =>
    list.length === 0 ? (
      <p className="text-muted py-6 text-center text-sm">{empty}</p>
    ) : (
      <ul className="divide-y divide-[var(--border)]">
        {list.slice(0, 12).map((t) => (
          <li key={t.id}>
            <button onClick={() => s.openTask(t.id)} className="hover-surface flex w-full items-center gap-2 rounded px-1 py-2 text-left text-sm">
              <span className="truncate">{t.title}</span>
              <span className="ml-auto shrink-0 text-xs">{right(t)}</span>
            </button>
          </li>
        ))}
      </ul>
    )

  const render = (c: DashboardCard): React.ReactNode => {
    switch (c) {
      case 'stats':
        return (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stat('Open tasks', open.length, ListTodo, '#149c89')}
            {stat('Completed', done.length, CheckCircle2, '#10b981')}
            {stat('Overdue', overdue.length, AlertTriangle, '#ef4444')}
            {stat('Due in 7 days', dueSoon.length, Clock, '#f59e0b')}
          </div>
        )
      case 'status':
        return (
          <Donut
            data={[
              { label: 'Not started', value: tasks.filter((t) => r.statusOf(t)?.type === 'open').length, color: '#94a3b8' },
              { label: 'In progress', value: tasks.filter((t) => r.statusOf(t)?.type === 'active').length, color: '#3b82f6' },
              { label: 'Done', value: done.length, color: '#10b981' },
            ]}
          />
        )
      case 'workload':
        return (
          <Bars
            data={s.users.map((u) => ({
              key: u.id,
              label: (
                <>
                  <Avatar userId={u.id} size={20} /> <span className="truncate">{u.name.split(' ')[0]}</span>
                </>
              ),
              value: open.filter((t) => t.assignees.includes(u.id)).length,
              color: u.color,
            }))}
          />
        )
      case 'trend':
        return (
          <Trend
            points={Array.from({ length: 14 }, (_, i) => {
              const day = toISODate(subDays(new Date(), 13 - i))
              return { label: format(addDays(subDays(new Date(), 13), i), 'MMM d'), created: tasks.filter((t) => t.createdAt.slice(0, 10) === day).length, completed: done.filter((t) => t.updatedAt.slice(0, 10) === day).length }
            })}
          />
        )
      case 'priority':
        return <Bars data={[...PRIORITIES, { value: null, label: 'None', color: '#cbd5e1' }].map((p) => ({ key: String(p.value), label: p.label, value: open.filter((t) => t.priority === p.value).length, color: p.color }))} />
      case 'overdue':
        return taskList(overdue, (t) => <span className="text-red-500">{Math.abs(daysTo(t))}d late</span>, 'Nothing overdue 🎉')
      case 'dueSoon':
        return taskList(dueSoon, (t) => <span className="text-muted">{format(parseISO(t.dueDate!), 'EEE MMM d')}</span>, 'Nothing due this week.')
      case 'recentlyDone':
        return taskList(
          [...done].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
          (t) => <span className="text-faint">{timeAgo(t.updatedAt)}</span>,
          'Nothing completed yet.',
        )
      case 'byList': {
        const ids = [...new Set(open.map((t) => t.listId))]
        return <Bars data={ids.map((id) => ({ key: id, label: r.listName(id), value: open.filter((t) => t.listId === id).length })).sort((a, b) => b.value - a.value)} />
      }
      case 'byTag': {
        const tags = [...new Set(open.flatMap((t) => t.tags))]
        return tags.length ? <Bars data={tags.map((g) => ({ key: g, label: `#${g}`, value: open.filter((t) => t.tags.includes(g)).length, color: tagColor(g) })).sort((a, b) => b.value - a.value)} /> : <p className="text-muted py-6 text-center text-sm">No tagged open tasks.</p>
      }
    }
  }

  const missing = (Object.keys(CARD_LABELS) as DashboardCard[]).filter((c) => !dash.cards.includes(c))
  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button onClick={() => nav('/app/dashboards')} className="hover-surface text-muted rounded p-1.5" aria-label="All dashboards">
            <ArrowLeft size={16} />
          </button>
          <LayoutDashboard size={20} className="text-brand-600" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title.trim() !== dash.title && s.updateDashboard(dash.id, { title: title.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="min-w-0 flex-1 bg-transparent text-xl font-bold outline-none"
            aria-label="Dashboard title"
          />
          <button onClick={() => s.toggleFavorite(dash.id)} className="hover-surface rounded p-1.5" aria-label="Favorite">
            <Star size={16} className={s.favorites.includes(dash.id) ? 'fill-amber-400 text-amber-400' : 'text-muted'} />
          </button>
          <select value={dash.spaceId ?? ''} onChange={(e) => s.updateDashboard(dash.id, { spaceId: e.target.value || null })} className="border-app surface h-8 rounded-md border px-2 text-sm" aria-label="Space">
            <option value="">Everything</option>
            {s.spaces.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>
          <button onClick={addPop.toggle} disabled={!missing.length} className="bg-brand-600 hover:bg-brand-700 inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-semibold text-white disabled:opacity-50">
            <Plus size={15} /> Card
          </button>
          <Popover open={addPop.open} anchor={addPop.anchor} onClose={addPop.close} align="end" width={220}>
            {missing.map((c) => (
              <MenuItem key={c} onClick={() => (setCards([...dash.cards, c]), addPop.close())}>
                {CARD_LABELS[c]}
              </MenuItem>
            ))}
          </Popover>
        </div>
        {dash.cards.length === 0 && <p className="border-app text-muted rounded-xl border border-dashed px-4 py-12 text-center text-sm">This dashboard has no cards. Use “+ Card” to add some.</p>}
        <div className="grid gap-4 lg:grid-cols-2">
          {dash.cards.map((c, i) => (
            <section key={c} className={cn('group/card relative', (WIDE.includes(c) || c === 'stats') && 'lg:col-span-2')}>
              <div className="absolute top-2.5 right-3 z-[1] hidden items-center gap-0.5 group-hover/card:flex">
                <button onClick={() => move(c, -1)} disabled={i === 0} className="surface text-muted hover:text-app rounded p-1 shadow-sm disabled:opacity-30" aria-label={`Move ${CARD_LABELS[c]} up`}>
                  <ArrowUp size={12} />
                </button>
                <button onClick={() => move(c, 1)} disabled={i === dash.cards.length - 1} className="surface text-muted hover:text-app rounded p-1 shadow-sm disabled:opacity-30" aria-label={`Move ${CARD_LABELS[c]} down`}>
                  <ArrowDown size={12} />
                </button>
                <button onClick={() => setCards(dash.cards.filter((x) => x !== c))} className="surface text-muted rounded p-1 shadow-sm hover:text-red-500" aria-label={`Remove ${CARD_LABELS[c]}`}>
                  <X size={12} />
                </button>
              </div>
              {c === 'stats' ? render(c) : <Widget title={CARD_LABELS[c]}>{render(c)}</Widget>}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
