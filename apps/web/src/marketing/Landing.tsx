import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  FileText,
  Flag,
  GanttChart,
  Globe,
  KanbanSquare,
  KeyRound,
  List,
  Lock,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Star,
  Workflow,
  Zap,
} from 'lucide-react'
import { MarketingFooter, MarketingNav } from './Chrome'
import { cn } from '../lib/utils'

/* ---------- Product demo (hero) ---------- */

const DEMO_TABS = [
  { key: 'list', label: 'Lists', icon: List },
  { key: 'board', label: 'Boards', icon: KanbanSquare },
  { key: 'gantt', label: 'Gantt', icon: GanttChart },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'docs', label: 'Docs', icon: FileText },
  { key: 'inbox', label: 'Inbox', icon: Bell },
  { key: 'dash', label: 'Dashboards', icon: BarChart3 },
  { key: 'auto', label: 'Automations', icon: Workflow },
] as const
type DemoKey = (typeof DEMO_TABS)[number]['key']

const people = ['#4f46e5', '#14b8a6', '#f43f5e', '#f59e0b', '#0ea5e9']
const Dot = ({ c, s = 22 }: { c: string; s?: number }) => <span className="inline-block shrink-0 rounded-full ring-2 ring-white" style={{ width: s, height: s, background: c }} />

const demoRows = [
  { t: 'Design token-based rate limiter', p: '#f59e0b', pl: 'High', a: 0, tag: ['api', '#0ea5e9'], s: 'prog' },
  { t: 'Add audit log export endpoint', p: '#3b82f6', pl: 'Normal', a: 1, tag: ['security', '#ef4444'], s: 'prog' },
  { t: 'Migrate job queue to Postgres', p: '#3b82f6', pl: 'Normal', a: 2, tag: ['infra', '#10b981'], s: 'todo' },
  { t: 'Keyboard shortcuts for board view', p: '#94a3b8', pl: 'Low', a: 3, tag: ['ux', '#8b5cf6'], s: 'todo' },
  { t: 'Rotate service credentials', p: '#ef4444', pl: 'Urgent', a: 4, tag: ['security', '#ef4444'], s: 'done' },
]

function DemoBody({ k }: { k: DemoKey }) {
  if (k === 'list')
    return (
      <div className="p-4 text-[13px]">
        {[
          ['IN PROGRESS', '#3b82f6', 'prog'],
          ['TO DO', '#94a3b8', 'todo'],
        ].map(([name, color, s]) => (
          <div key={s} className="mb-3">
            <span className="rounded px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: color }}>
              {name}
            </span>
            <div className="mt-2 grid grid-cols-[1fr_70px_90px_80px] border-b border-slate-100 pb-1 text-[11px] text-slate-400">
              <span className="pl-6">Name</span>
              <span>Assignee</span>
              <span>Priority</span>
              <span>Tags</span>
            </div>
            {demoRows
              .filter((r) => r.s === s)
              .map((r) => (
                <div key={r.t} className="grid grid-cols-[1fr_70px_90px_80px] items-center border-b border-slate-100 py-2">
                  <span className="flex items-center gap-2 truncate">
                    <span className="h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: color }} />
                    {r.t}
                  </span>
                  <Dot c={people[r.a]} />
                  <span className="flex items-center gap-1 text-slate-600">
                    <Flag size={12} fill={r.p} color={r.p} /> {r.pl}
                  </span>
                  <span className="w-fit rounded px-1.5 text-[11px]" style={{ background: `${r.tag[1]}22`, color: r.tag[1] }}>
                    {r.tag[0]}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
    )
  if (k === 'board')
    return (
      <div className="flex gap-3 p-4">
        {[
          ['To do', '#94a3b8', 'todo'],
          ['In progress', '#3b82f6', 'prog'],
          ['Complete', '#10b981', 'done'],
        ].map(([n, c, s]) => (
          <div key={s} className="w-1/3 rounded-xl p-2" style={{ background: `${c}14` }}>
            <span className="rounded px-2 py-0.5 text-[11px] font-semibold text-white uppercase" style={{ background: c }}>
              {n}
            </span>
            <div className="mt-2 space-y-2">
              {demoRows
                .filter((r) => r.s === s)
                .map((r) => (
                  <div key={r.t} className="rounded-lg border border-slate-200 bg-white p-2.5 text-[12px] shadow-sm">
                    <div className="font-medium">{r.t}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <Dot c={people[r.a]} s={18} />
                      <Flag size={11} fill={r.p} color={r.p} />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    )
  if (k === 'gantt')
    return (
      <div className="p-4 text-[12px]">
        <div className="mb-2 grid grid-cols-[160px_1fr] text-[10px] text-slate-400">
          <span />
          <div className="grid grid-cols-14">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} className="text-center">
                {i + 1}
              </span>
            ))}
          </div>
        </div>
        {demoRows.map((r, i) => (
          <div key={r.t} className="grid grid-cols-[160px_1fr] items-center border-b border-slate-100 py-1.5">
            <span className="truncate pr-2">{r.t}</span>
            <div className="relative h-6">
              <div className="absolute inset-y-0 rounded-md" style={{ left: `${(i * 13) % 55}%`, width: `${25 + ((i * 7) % 25)}%`, background: ['#6366f1', '#14b8a6', '#f59e0b', '#f43f5e', '#0ea5e9'][i] }} />
            </div>
          </div>
        ))}
      </div>
    )
  if (k === 'calendar')
    return (
      <div className="grid grid-cols-7 gap-px bg-slate-100 p-px text-[11px]">
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="min-h-[58px] bg-white p-1">
            <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full', i === 17 && 'bg-indigo-600 text-white')}>{((i + 27) % 31) + 1}</span>
            {[3, 9, 17, 22, 26].includes(i) && <div className="mt-0.5 truncate rounded bg-indigo-50 px-1 text-indigo-700">{demoRows[i % 5].t}</div>}
            {[10, 17].includes(i) && <div className="mt-0.5 truncate rounded bg-teal-50 px-1 text-teal-700">Launch review</div>}
          </div>
        ))}
      </div>
    )
  if (k === 'docs')
    return (
      <div className="mx-auto max-w-md p-6 text-[13px] leading-relaxed">
        <div className="text-3xl">📘</div>
        <h3 className="mt-2 text-xl font-bold">Engineering handbook</h3>
        <p className="mt-2 text-slate-600">How we plan, review and ship. Edit freely — this is a living document.</p>
        <h4 className="mt-4 font-semibold">Code review</h4>
        {['Keep pull requests small', 'Add screenshots for UI changes', 'Link the task in every PR'].map((t, i) => (
          <div key={t} className="mt-1.5 flex items-center gap-2">
            <span className={cn('flex h-4 w-4 items-center justify-center rounded border', i === 0 ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300')}>{i === 0 && <Check size={11} />}</span>
            <span className={cn(i === 0 && 'text-slate-400 line-through')}>{t}</span>
          </div>
        ))}
      </div>
    )
  if (k === 'inbox')
    return (
      <div className="divide-y divide-slate-100 text-[13px]">
        {[
          ['Priya', 'commented on', 'Add audit log export endpoint', 1],
          ['Marcus', 'assigned you', 'Board cards flicker on drag', 2],
          ['Sofia', 'moved to In review', 'Optimistic updates for edits', 3],
          ['Jonas', 'mentioned you in', 'Launch brief', 4],
        ].map(([n, v, t, c]) => (
          <div key={t as string} className="flex items-center gap-3 px-4 py-3">
            <span className="h-2 w-2 rounded-full bg-indigo-600" />
            <Dot c={people[c as number]} s={28} />
            <div className="min-w-0">
              <div className="truncate font-semibold">{t}</div>
              <div className="text-slate-500">
                <b className="font-medium text-slate-800">{n}</b> {v}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  if (k === 'dash')
    return (
      <div className="grid grid-cols-2 gap-3 p-4">
        {[
          ['Open', '18', '#6366f1'],
          ['Overdue', '3', '#ef4444'],
        ].map(([l, v, c]) => (
          <div key={l} className="rounded-xl border border-slate-200 p-3">
            <div className="text-2xl font-bold" style={{ color: c }}>
              {v}
            </div>
            <div className="text-xs text-slate-500">{l} tasks</div>
          </div>
        ))}
        <div className="col-span-2 rounded-xl border border-slate-200 p-3">
          <div className="mb-2 text-xs font-semibold">Workload</div>
          {[70, 45, 90, 30].map((w, i) => (
            <div key={i} className="mb-1.5 flex items-center gap-2">
              <Dot c={people[i]} s={16} />
              <div className="h-3 flex-1 rounded bg-slate-100">
                <div className="h-full rounded" style={{ width: `${w}%`, background: people[i] }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  return (
    <div className="space-y-2 p-6 text-[13px]">
      {[
        ['When', 'status changes to In review', '#6366f1'],
        ['Then', 'assign the reviewer on rotation', '#14b8a6'],
        ['And', 'post an update to the team inbox', '#f59e0b'],
      ].map(([a, b, c]) => (
        <div key={a} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <span className="rounded-md px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: c }}>
            {a}
          </span>
          {b}
        </div>
      ))}
    </div>
  )
}

function ProductDemo() {
  const [k, setK] = useState<DemoKey>('list')
  const [auto, setAuto] = useState(true)
  useEffect(() => {
    if (!auto) return
    const id = setInterval(() => setK((cur) => DEMO_TABS[(DEMO_TABS.findIndex((t) => t.key === cur) + 1) % DEMO_TABS.length].key), 3800)
    return () => clearInterval(id)
  }, [auto])
  const active = DEMO_TABS.find((t) => t.key === k)!
  return (
    <div className="border-y border-slate-200">
      <div className="mx-auto grid max-w-[1280px] lg:grid-cols-[200px_1fr] lg:border-x lg:border-slate-200">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 p-3 lg:flex-col lg:border-r lg:border-b-0 lg:p-4">
          {DEMO_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => (setK(t.key), setAuto(false))}
              className={cn('flex shrink-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-[15px] font-medium transition-colors', k === t.key ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-950')}
            >
              <t.icon size={17} />
              {t.label}
            </button>
          ))}
        </div>
        <div className="bg-slate-50 p-3 sm:p-5">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex h-11 items-center gap-3 border-b border-slate-100 px-3">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                <span className="h-4 w-4 rounded bg-indigo-600" /> Acme Studio
              </span>
              <span className="mx-auto hidden h-7 w-72 items-center gap-2 rounded-md border border-slate-200 px-2 text-[12px] text-slate-400 sm:flex">
                <Search size={13} /> Search
              </span>
              <Dot c={people[0]} s={24} />
            </div>
            <div className="flex">
              <div className="hidden w-14 shrink-0 flex-col items-center gap-3 bg-slate-900 py-3 sm:flex">
                {DEMO_TABS.slice(0, 5).map((t) => (
                  <t.icon key={t.key} size={17} className={t.key === k ? 'text-white' : 'text-slate-500'} />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex h-10 items-center gap-2 border-b border-slate-100 px-4 text-[13px] font-semibold">
                  <active.icon size={15} className="text-indigo-600" /> Engineering · {active.label}
                </div>
                <div key={k} className="animate-fade-up h-[360px] overflow-hidden [animation-duration:.35s]">
                  <DemoBody k={k} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Sections ---------- */

const PROBLEM_TABS = [
  { key: 'Tasks', title: 'Every task has an owner and a date', body: 'Break big goals into tasks and subtasks, set priorities, and see exactly who is doing what by when — in any view your team prefers.', icon: List },
  { key: 'Docs', title: 'Specs that live next to the work', body: 'Write briefs, notes and handbooks with a fast editor. Link them to the tasks they describe so context is never more than a click away.', icon: FileText },
  { key: 'Inbox', title: 'Updates that find you', body: 'Assignments, comments and status changes land in one Inbox. Triage them into Important, Other or Cleared and get back to work.', icon: Bell },
  { key: 'Reporting', title: 'Progress you can see', body: 'Dashboards roll up status, workload and deadlines across Spaces, so stand-ups take minutes instead of meetings.', icon: BarChart3 },
]

function ProblemSection() {
  const [i, setI] = useState(0)
  const t = PROBLEM_TABS[i]
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-24 sm:px-6 lg:px-10">
      <h2 className="max-w-3xl text-4xl leading-[1.05] font-bold tracking-[-0.03em] sm:text-5xl">
        Your work is scattered across a dozen tools. <span className="text-slate-400">It doesn’t have to be.</span>
      </h2>
      <p className="mt-5 max-w-2xl text-lg text-slate-600">Meetspace brings tasks, docs, updates and reporting into one workspace, so the whole team works from the same source of truth.</p>
      <div className="mt-12 grid gap-8 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {PROBLEM_TABS.map((p, idx) => (
            <button
              key={p.key}
              onClick={() => setI(idx)}
              className={cn('flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition', idx === i ? 'border-indigo-200 bg-indigo-50/60' : 'border-transparent hover:bg-slate-50')}
            >
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', idx === i ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600')}>
                <p.icon size={18} />
              </span>
              <span>
                <span className="block font-semibold">{p.key}</span>
                {idx === i && <span className="mt-1 block text-sm text-slate-600">{p.body}</span>}
              </span>
            </button>
          ))}
        </div>
        <div key={i} className="animate-fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-teal-500 p-8 text-white sm:p-12">
          <t.icon size={40} className="opacity-80" />
          <h3 className="mt-6 max-w-md text-3xl font-bold tracking-tight">{t.title}</h3>
          <p className="mt-3 max-w-md text-white/80">{t.body}</p>
          <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-white/10" />
          <div className="absolute right-24 -bottom-20 h-40 w-40 rounded-full bg-white/10" />
          <Link to="/signup" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-semibold text-indigo-700">
            Try it free <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  )
}

function AssistSection() {
  const cards = [
    { icon: Sparkles, title: 'Summaries on demand', body: 'Catch up on a long task thread or doc in seconds with an auto-generated recap.' },
    { icon: Workflow, title: 'Automations that stick', body: 'When a status changes, assign reviewers, set dates or notify the right people — automatically.' },
    { icon: Zap, title: 'Quick actions everywhere', body: 'Press ⌘K to jump to any task, doc or list and act on it without leaving the keyboard.' },
  ]
  return (
    <section className="bg-slate-950 py-24 text-white">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-sm text-white/80">
          <Sparkles size={14} className="text-teal-300" /> Meetspace Assist
        </span>
        <h2 className="mt-6 max-w-3xl text-4xl leading-[1.05] font-bold tracking-[-0.03em] sm:text-6xl">
          Less busywork. <span className="bg-gradient-to-r from-teal-300 to-indigo-300 bg-clip-text text-transparent">More real work.</span>
        </h2>
        <p className="mt-5 max-w-2xl text-lg text-white/70">Built-in helpers handle the repetitive parts of coordination, so your team spends time on decisions instead of updates.</p>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <div key={c.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 transition hover:bg-white/[0.07]">
              <c.icon size={26} className="text-teal-300" />
              <h3 className="mt-5 text-xl font-semibold">{c.title}</h3>
              <p className="mt-2 text-white/65">{c.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/20 to-transparent p-7">
            <div className="text-sm text-white/60">Weekly recap · Engineering</div>
            <ul className="mt-4 space-y-3 text-[15px]">
              {['12 tasks completed, 3 more than last week', 'Rate limiter is on track for Friday', '2 bugs overdue — both assigned to the web team'].map((x) => (
                <li key={x} className="flex gap-3">
                  <Check size={18} className="mt-0.5 shrink-0 text-teal-300" /> {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col justify-between rounded-3xl border border-white/10 p-7">
            <div className="text-5xl font-bold tracking-tight">
              4.5<span className="text-white/40">h</span>
            </div>
            <p className="mt-3 text-white/65">Average time per person saved each week on status updates, in our internal pilot.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

const TEAMS = [
  { key: 'Product', title: 'Turn roadmaps into releases', points: ['Roadmaps in Gantt', 'Specs in Docs', 'Feedback triage boards'], color: '#6366f1' },
  { key: 'Engineering', title: 'Ship faster with fewer surprises', points: ['Sprint boards', 'Bug intake lists', 'Release checklists'], color: '#0ea5e9' },
  { key: 'Marketing', title: 'Run every campaign from one calendar', points: ['Content calendar', 'Launch plans', 'Asset reviews'], color: '#f43f5e' },
  { key: 'Operations', title: 'Make processes repeatable', points: ['Templates for recurring work', 'Automated hand-offs', 'SLA tracking'], color: '#14b8a6' },
  { key: 'People', title: 'Hire and onboard with care', points: ['Candidate pipelines', 'Onboarding checklists', 'Team handbooks'], color: '#f59e0b' },
  { key: 'Leadership', title: 'See the whole picture', points: ['Portfolio dashboards', 'Goal tracking', 'Weekly recaps'], color: '#8b5cf6' },
]

function TeamsSection() {
  const [i, setI] = useState(0)
  const t = TEAMS[i]
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-24 sm:px-6 lg:px-10">
      <h2 className="text-center text-4xl font-bold tracking-[-0.03em] sm:text-5xl">Built for every team</h2>
      <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2">
        {TEAMS.map((x, idx) => (
          <button
            key={x.key}
            onClick={() => setI(idx)}
            className={cn('rounded-full border px-4 py-2 text-sm font-semibold transition', idx === i ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 text-slate-700 hover:border-slate-400')}
          >
            {x.key}
          </button>
        ))}
      </div>
      <div key={i} className="animate-fade-up mt-10 grid items-center gap-8 rounded-3xl border border-slate-200 p-6 sm:p-10 md:grid-cols-2">
        <div>
          <h3 className="text-3xl font-bold tracking-tight">{t.title}</h3>
          <ul className="mt-6 space-y-3">
            {t.points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-lg text-slate-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: t.color }}>
                  <Check size={14} />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <Link to="/signup" className="mt-8 inline-flex items-center gap-1.5 font-semibold" style={{ color: t.color }}>
            Explore {t.key.toLowerCase()} templates <ChevronRight size={16} />
          </Link>
        </div>
        <div className="aspect-[4/3] rounded-2xl p-5" style={{ background: `linear-gradient(135deg, ${t.color}26, ${t.color}08)` }}>
          <div className="h-full space-y-2 rounded-xl bg-white p-4 shadow-lg">
            {t.points.concat(t.points).slice(0, 5).map((p, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2 text-sm">
                <span className="h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: t.color }} />
                {p}
                <Dot c={people[idx]} s={18} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Stats() {
  return (
    <section className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-px px-4 sm:px-6 md:grid-cols-4 lg:px-10">
        {[
          ['3×', 'faster weekly planning'],
          ['40%', 'fewer status meetings'],
          ['1', 'place for tasks and docs'],
          ['∞', 'tasks on the free plan'],
        ].map(([n, l]) => (
          <div key={l} className="px-4 py-12 text-center">
            <div className="text-5xl font-bold tracking-tight text-slate-950">{n}</div>
            <div className="mt-2 text-slate-600">{l}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

const QUOTES = [
  { q: 'We replaced three tools and a shared spreadsheet in a week. Planning meetings got shorter immediately.', n: 'Dana K.', r: 'Head of Product, Northwind', c: 0 },
  { q: 'The board and Gantt views on the same data finally got design and engineering on the same page.', n: 'Ravi S.', r: 'Engineering Manager, Bluepeak', c: 1 },
  { q: 'Our content calendar lives here now. Everyone knows what’s shipping and who owns it.', n: 'Lena M.', r: 'Marketing Lead, Fernway', c: 2 },
]

function Testimonials() {
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-24 sm:px-6 lg:px-10">
      <h2 className="max-w-2xl text-4xl font-bold tracking-[-0.03em] sm:text-5xl">Teams love working in one lane</h2>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {QUOTES.map((x) => (
          <figure key={x.n} className="flex flex-col rounded-3xl border border-slate-200 p-7">
            <div className="flex gap-0.5 text-amber-400">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={16} fill="currentColor" />
              ))}
            </div>
            <blockquote className="mt-4 flex-1 text-lg leading-relaxed text-slate-800">“{x.q}”</blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <Dot c={people[x.c]} s={36} />
              <span>
                <span className="block font-semibold">{x.n}</span>
                <span className="block text-sm text-slate-500">{x.r}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

function Enterprise() {
  const items = [
    { icon: ShieldCheck, t: 'Granular permissions', d: 'Control who can see and edit every Space, List and Doc.' },
    { icon: KeyRound, t: 'Single sign-on', d: 'SAML SSO and SCIM provisioning on Enterprise.' },
    { icon: Lock, t: 'Encryption', d: 'Data encrypted in transit and at rest.' },
    { icon: ServerCog, t: 'Audit logs', d: 'Track changes across the workspace.' },
    { icon: Globe, t: 'Data residency', d: 'Choose where your workspace is hosted.' },
    { icon: Clock, t: '99.9% uptime', d: 'Backed by a service-level agreement.' },
  ]
  return (
    <section className="bg-slate-50 py-24">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-4xl font-bold tracking-[-0.03em] sm:text-5xl">Ready for the enterprise</h2>
            <p className="mt-5 text-lg text-slate-600">Security, control and support for organisations that need them — without making the product harder to use.</p>
            <Link to="/pricing#enterprise" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white">
              Talk to sales <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((i) => (
              <div key={i.t} className="rounded-2xl border border-slate-200 bg-white p-5">
                <i.icon size={22} className="text-indigo-600" />
                <h3 className="mt-3 font-semibold">{i.t}</h3>
                <p className="mt-1 text-sm text-slate-600">{i.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="px-4 py-24 sm:px-6 lg:px-10">
      <div className="relative mx-auto max-w-[1280px] overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-600 to-teal-500 px-6 py-20 text-center text-white">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -right-16 -bottom-24 h-80 w-80 rounded-full bg-white/10" />
        <h2 className="relative mx-auto max-w-3xl text-4xl leading-[1.05] font-bold tracking-[-0.03em] sm:text-6xl">All your team’s work, in one lane.</h2>
        <p className="relative mt-5 text-lg text-white/80">Free forever for small teams. Upgrade when you’re ready.</p>
        <Link to="/signup" className="relative mt-10 inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 text-lg font-semibold text-indigo-700 shadow-xl transition hover:scale-[1.02]">
          Get started — it’s free <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  )
}

export default function Landing() {
  return (
    <div className="bg-white text-slate-950">
      <MarketingNav />
      <main>
        <section className="mx-auto max-w-[1280px] px-4 pt-16 pb-14 sm:px-6 sm:pt-24 lg:px-10">
          <Link to="/signup" className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300">
            <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">NEW</span>
            Meetspace Assist is here <ChevronRight size={15} />
          </Link>
          <h1 className="animate-fade-up mt-7 max-w-5xl text-[44px] leading-[0.98] font-bold tracking-[-0.045em] [animation-delay:.05s] sm:text-7xl lg:text-[88px]">
            Plan it. Track it. Ship it&nbsp;— together.
          </h1>
          <p className="animate-fade-up mt-6 max-w-2xl text-xl leading-relaxed text-slate-600 [animation-delay:.1s]">
            Meetspace gives your team one workspace for tasks, docs and updates — with the views you need to see what matters and move it forward.
          </p>
          <div className="animate-fade-up mt-9 flex flex-wrap items-center gap-4 [animation-delay:.15s]">
            <Link to="/signup" className="rounded-2xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white transition hover:bg-slate-800">
              Get started. It’s free!
            </Link>
            <span className="text-sm leading-snug text-slate-500">
              Free forever plan.
              <br />
              No credit card needed.
            </span>
          </div>
        </section>
        <ProductDemo />
        <ProblemSection />
        <AssistSection />
        <TeamsSection />
        <Stats />
        <Testimonials />
        <Enterprise />
        <FinalCta />
      </main>
      <MarketingFooter />
    </div>
  )
}
