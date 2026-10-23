import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { BellRing, Video, X, CalendarClock, ChevronDown, ChevronRight, Clock, FileText, List as ListIcon, MessageSquare } from 'lucide-react'
import { useMe, useStore } from '../../store/useStore'
import type { Task } from '../../store/types'
import { useTaskResolver } from '../hooks'
import { Avatar, DateButton, PriorityFlag, StatusDot } from '../components/ui'
import { cn, timeAgo } from '../../lib/utils'

function Card({ title, icon: Icon, children, className }: { title: string; icon: typeof Clock; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('surface border-app flex min-h-0 flex-col rounded-xl border', className)}>
      <h2 className="flex items-center gap-2 px-4 pt-3 pb-2 text-sm font-semibold">
        <Icon size={16} className="text-muted" /> {title}
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 scroll-thin">{children}</div>
    </section>
  )
}

export default function Home() {
  const me = useMe()
  const s = useStore()
  const r = useTaskResolver()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const mine = s.tasks.filter((t) => t.assignees.includes(me.id) && !r.isDone(t))
  const buckets = useMemo(() => {
    const b: Record<string, Task[]> = { Overdue: [], Today: [], Next: [], Unscheduled: [] }
    mine.forEach((t) => {
      if (!t.dueDate) return b.Unscheduled.push(t)
      const diff = differenceInCalendarDays(parseISO(t.dueDate), new Date())
      if (diff < 0) b.Overdue.push(t)
      else if (diff === 0) b.Today.push(t)
      else b.Next.push(t)
    })
    b.Next.sort((a, c) => (a.dueDate ?? '').localeCompare(c.dueDate ?? ''))
    return b
  }, [mine])

  const recents = s.recents
    .map((id) => {
      const t = s.tasks.find((x) => x.id === id)
      if (t) return { id, label: t.title, kind: 'task' as const, onClick: () => s.openTask(id) }
      const l = s.lists.find((x) => x.id === id)
      if (l) return { id, label: l.name, kind: 'list' as const, to: `/app/list/${id}` }
      const d = s.docs.find((x) => x.id === id)
      if (d) return { id, label: d.title || 'Untitled', kind: 'doc' as const, to: `/app/docs/${id}` }
      return null
    })
    .filter(Boolean)
    .slice(0, 8) as { id: string; label: string; kind: 'task' | 'list' | 'doc'; to?: string; onClick?: () => void }[]

  const myTaskIds = new Set(s.tasks.filter((t) => t.assignees.includes(me.id)).map((t) => t.id))
  // Comments assigned to me (action items) first, then other people's comments on my tasks.
  const assigned = s.comments.filter((c) => c.assignee === me.id && !c.resolved)
  const comments = [...assigned, ...s.comments.filter((c) => myTaskIds.has(c.taskId) && c.userId !== me.id && !assigned.includes(c)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))]
  const meetingsSoon = s.meetings
    .filter((m) => differenceInCalendarDays(parseISO(m.start), new Date()) >= 0 && differenceInCalendarDays(parseISO(m.start), new Date()) < 7)
    .sort((a, b) => a.start.localeCompare(b.start))
  const reminders = s.reminders.filter((x) => !x.done).sort((a, b) => a.due.localeCompare(b.due))

  const agenda = s.tasks
    .filter((t) => t.dueDate && differenceInCalendarDays(parseISO(t.dueDate), new Date()) >= 0 && differenceInCalendarDays(parseISO(t.dueDate), new Date()) < 7 && !r.isDone(t))
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <p className="text-muted text-sm">{format(new Date(), 'EEEE, MMMM d')}</p>
        <h1 className="mb-5 text-2xl font-bold tracking-tight">
          {greeting}, {me.name.split(' ')[0]}
        </h1>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="My Work" icon={Clock} className="lg:row-span-2 lg:h-[620px]">
            {Object.entries(buckets).map(([name, list]) => (
              <Bucket key={name} name={name} tasks={list} defaultOpen={name !== 'Unscheduled'} />
            ))}
            {mine.length === 0 && <p className="text-muted px-2 py-6 text-center text-sm">You’re all caught up. 🎉</p>}
          </Card>

          <Card title="Recents" icon={Clock} className="h-[300px]">
            {recents.map((x) => {
              const Icon = x.kind === 'doc' ? FileText : x.kind === 'list' ? ListIcon : Clock
              const inner = (
                <>
                  <Icon size={14} className="text-muted" />
                  <span className="truncate">{x.label}</span>
                  <span className="text-faint ml-auto text-xs capitalize">{x.kind}</span>
                </>
              )
              return x.to ? (
                <Link key={x.id} to={x.to} className="hover-surface flex items-center gap-2 rounded-md px-2 py-2 text-sm">
                  {inner}
                </Link>
              ) : (
                <button key={x.id} onClick={x.onClick} className="hover-surface flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm">
                  {inner}
                </button>
              )
            })}
          </Card>

          <Card title="Comments for you" icon={MessageSquare} className="h-[300px]">
            {comments.length === 0 && <p className="text-muted px-2 py-6 text-center text-sm">No comments on your tasks.</p>}
            {comments.map((c) => (
              <button key={c.id} onClick={() => s.openTask(c.taskId)} className="hover-surface flex w-full gap-2 rounded-md px-2 py-2 text-left text-sm">
                <Avatar userId={c.userId} size={24} />
                <span className="min-w-0">
                  <span className="text-muted block truncate text-xs">
                    {c.assignee === me.id && <span className="mr-1 rounded bg-amber-100 px-1 font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">Assigned to you</span>}
                    {s.tasks.find((t) => t.id === c.taskId)?.title} · {timeAgo(c.createdAt)}
                  </span>
                  <span className="line-clamp-2">{c.text}</span>
                </span>
              </button>
            ))}
          </Card>

          <Card title="Reminders" icon={BellRing} className="h-[300px]">
            <ReminderForm />
            {reminders.length === 0 && <p className="text-muted px-2 py-4 text-center text-sm">No reminders.</p>}
            {reminders.map((x) => (
              <div key={x.id} className="group hover-surface flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                <input type="checkbox" checked={x.done} onChange={() => s.updateReminder(x.id, { done: true })} className="accent-brand-600 h-4 w-4" aria-label="Done" />
                <button onClick={() => x.taskId && s.openTask(x.taskId)} className="min-w-0 flex-1 truncate text-left">
                  {x.text}
                </button>
                <span className={cn('shrink-0 text-xs', new Date(x.due) < new Date() ? 'text-red-500' : 'text-faint')}>{format(parseISO(x.due), 'EEE h:mm a')}</span>
                <button onClick={() => s.deleteReminder(x.id)} className="text-faint hidden group-hover:block" aria-label="Delete reminder">
                  <X size={13} />
                </button>
              </div>
            ))}
          </Card>

          <Card title="Agenda — next 7 days" icon={CalendarClock} className="h-[300px]">
            {agenda.length === 0 && meetingsSoon.length === 0 && <p className="text-muted px-2 py-6 text-center text-sm">Nothing due this week.</p>}
            {meetingsSoon.map((m) => (
              <Link key={m.id} to="/app/chat/calls" className="hover-surface flex items-center gap-2 rounded-md px-2 py-2 text-sm">
                <span className="w-14 shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-center text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">{format(parseISO(m.start), 'EEE d')}</span>
                <Video size={13} className="text-muted shrink-0" />
                <span className="truncate">{m.title}</span>
                <span className="text-faint ml-auto shrink-0 text-xs">{format(parseISO(m.start), 'h:mm a')}</span>
              </Link>
            ))}
            <div className="grid gap-1">
              {agenda.map((t) => (
                <button key={t.id} onClick={() => s.openTask(t.id)} className="hover-surface flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm">
                  <span className="surface-muted w-14 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-semibold">{format(parseISO(t.dueDate!), 'EEE d')}</span>
                  <StatusDot status={r.statusOf(t)} size={12} />
                  <span className="truncate">{t.title}</span>
                  <span className="ml-auto flex shrink-0 -space-x-1">
                    {t.assignees.slice(0, 2).map((a) => (
                      <Avatar key={a} userId={a} size={20} ring />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Bucket({ name, tasks, defaultOpen }: { name: string; tasks: Task[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const s = useStore()
  const r = useTaskResolver()
  return (
    <div className="mb-1">
      <button onClick={() => setOpen((o) => !o)} className="hover-surface flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-semibold">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className={cn(name === 'Overdue' && tasks.length > 0 && 'text-red-500')}>{name}</span>
        <span className="text-faint font-normal">{tasks.length}</span>
      </button>
      {open &&
        tasks.map((t) => (
          <div key={t.id} onClick={() => s.openTask(t.id)} className="hover-surface flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 pl-7 text-sm">
            <StatusDot status={r.statusOf(t)} size={13} />
            <span className="truncate">{t.title}</span>
            <span className="text-faint hidden shrink-0 text-xs sm:inline">{r.listName(t.listId)}</span>
            <span className="ml-auto flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {t.priority && <PriorityFlag priority={t.priority} />}
              <DateButton value={t.dueDate} onChange={(v) => s.updateTask(t.id, { dueDate: v })} />
            </span>
          </div>
        ))}
    </div>
  )
}

function ReminderForm() {
  const add = useStore((st) => st.addReminder)
  const [text, setText] = useState('')
  const [when, setWhen] = useState('')
  return (
    <form
      className="mb-1 flex gap-1 px-1"
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim() || !when) return
        add({ text: text.trim(), due: new Date(when).toISOString(), taskId: null })
        setText('')
        setWhen('')
      }}
    >
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Remind me to…" className="border-app min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1 text-sm outline-none" />
      <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="border-app w-40 rounded-md border bg-transparent px-1 text-xs" aria-label="When" />
      <button className="bg-brand-600 rounded-md px-2 text-xs font-semibold text-white disabled:opacity-40" disabled={!text.trim() || !when}>
        Add
      </button>
    </form>
  )
}
