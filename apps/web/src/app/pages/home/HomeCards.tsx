import { useMemo, useState } from 'react'
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns'
import { ChevronDown, ChevronRight, Sparkles, Star } from 'lucide-react'
import { useMe, useStore } from '../../../store/useStore'
import type { Task } from '../../../store/types'
import { useTaskResolver } from '../../hooks'
import { AvatarStack, DateButton, PriorityFlag, StatusDot } from '../../components/ui'
import { useAssistant } from '../../ai/useAssistant'
import { cn } from '../../../lib/utils'

function Row({ t, extra }: { t: Task; extra?: React.ReactNode }) {
  const s = useStore()
  const r = useTaskResolver()
  return (
    <div onClick={() => s.openTask(t.id)} className="hover-surface flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 pl-7 text-sm">
      <StatusDot status={r.statusOf(t)} size={13} />
      <span className={cn('truncate', r.isDone(t) && 'text-faint line-through')}>{t.title}</span>
      <span className="text-faint hidden shrink-0 text-xs sm:inline">{r.listName(t.listId)}</span>
      <span className="ml-auto flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {extra}
        {t.priority && <PriorityFlag priority={t.priority} />}
        <DateButton value={t.dueDate} onChange={(v) => s.updateTask(t.id, { dueDate: v })} done={r.isDone(t)} />
      </span>
    </div>
  )
}

function Bucket({ name, tasks, defaultOpen, extra }: { name: string; tasks: Task[]; defaultOpen: boolean; extra?: (t: Task) => React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-1">
      <button onClick={() => setOpen((o) => !o)} className="hover-surface flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-semibold">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className={cn(name === 'Overdue' && tasks.length > 0 && 'text-red-500')}>{name}</span>
        <span className="text-faint font-normal">{tasks.length}</span>
      </button>
      {open && tasks.map((t) => <Row key={t.id} t={t} extra={extra?.(t)} />)}
    </div>
  )
}

type Tab = 'todo' | 'done' | 'delegated'

/** My Work with ClickUp's To Do / Done / Delegated split. */
export function MyWork() {
  const me = useMe()
  const s = useStore()
  const r = useTaskResolver()
  const [tab, setTab] = useState<Tab>('todo')

  const buckets = useMemo(() => {
    const b: Record<string, Task[]> = { Overdue: [], Today: [], Next: [], Unscheduled: [] }
    for (const t of s.tasks) {
      if (!t.assignees.includes(me.id) || r.isDone(t)) continue
      if (!t.dueDate) b.Unscheduled.push(t)
      else {
        const diff = differenceInCalendarDays(parseISO(t.dueDate), new Date())
        if (diff < 0) b.Overdue.push(t)
        else if (diff === 0) b.Today.push(t)
        else b.Next.push(t)
      }
    }
    b.Next.sort((a, c) => (a.dueDate ?? '').localeCompare(c.dueDate ?? ''))
    return b
  }, [s.tasks, me.id, r])

  const done = useMemo(() => {
    const since = subDays(new Date(), 14).toISOString()
    return s.tasks.filter((t) => t.assignees.includes(me.id) && r.isDone(t) && t.updatedAt >= since).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [s.tasks, me.id, r])

  // Tasks I created or assigned that now belong to someone else.
  const delegated = useMemo(() => {
    const mine = new Set(s.activity.filter((a) => a.userId === me.id && (a.text === 'created this task' || a.text.startsWith('assigned '))).map((a) => a.taskId))
    return s.tasks.filter((t) => mine.has(t.id) && !r.isDone(t) && t.assignees.length > 0 && !t.assignees.includes(me.id))
  }, [s.activity, s.tasks, me.id, r])

  const count = { todo: Object.values(buckets).reduce((a, b) => a + b.length, 0), done: done.length, delegated: delegated.length }
  return (
    <>
      <div className="mb-2 flex gap-1 px-2">
        {(
          [
            ['todo', 'To Do'],
            ['done', 'Done'],
            ['delegated', 'Delegated'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium', tab === k ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'text-muted hover-surface')}>
            {label} <span className="text-faint">{count[k]}</span>
          </button>
        ))}
      </div>
      {tab === 'todo' && (
        <>
          {Object.entries(buckets).map(([name, list]) => (
            <Bucket key={name} name={name} tasks={list} defaultOpen={name !== 'Unscheduled'} />
          ))}
          {count.todo === 0 && <p className="text-muted px-2 py-6 text-center text-sm">You’re all caught up. 🎉</p>}
        </>
      )}
      {tab === 'done' && (done.length ? done.map((t) => <Row key={t.id} t={t} />) : <p className="text-muted px-2 py-6 text-center text-sm">Nothing finished in the last two weeks.</p>)}
      {tab === 'delegated' &&
        (delegated.length ? (
          delegated.map((t) => <Row key={t.id} t={t} extra={<AvatarStack ids={t.assignees} size={18} max={2} />} />)
        ) : (
          <p className="text-muted px-2 py-6 text-center text-sm">Tasks you create or assign to others show here.</p>
        ))}
    </>
  )
}

/** Starred tasks: a short list of what matters most. */
export function Priorities() {
  const s = useStore()
  const r = useTaskResolver()
  const starred = s.tasks.filter((t) => s.favorites.includes(t.id)).sort((a, b) => Number(r.isDone(a)) - Number(r.isDone(b)))
  if (!starred.length)
    return (
      <div className="text-muted flex flex-col items-center gap-1 px-3 py-6 text-center text-sm">
        <Star size={18} className="text-amber-400" />
        Star a task (in its header) to pin it here. Priorities keep your most important work in one list.
      </div>
    )
  return (
    <>
      {starred.map((t) => (
        <Row
          key={t.id}
          t={t}
          extra={
            <button onClick={() => s.toggleFavorite(t.id)} title="Remove from priorities" aria-label="Remove from priorities">
              <Star size={13} className="fill-amber-400 text-amber-400" />
            </button>
          }
        />
      ))}
    </>
  )
}

/** One click to have the assistant write a stand-up from recent activity. */
export function Standup() {
  const me = useMe()
  const s = useStore()
  const since = subDays(new Date(), 1).toISOString()
  const recent = s.activity.filter((a) => a.userId === me.id && a.createdAt >= since)
  const write = () => {
    const lines = recent
      .slice(-40)
      .map((a) => `- ${format(parseISO(a.createdAt), 'MMM d HH:mm')} ${a.text} — ${s.tasks.find((t) => t.id === a.taskId)?.title ?? 'a task'}`)
      .join('\n')
    useAssistant
      .getState()
      .ask(`Write my daily stand-up (Yesterday / Today / Blockers) in a short, friendly tone. Use my activity from the last 24 hours and my open tasks due soon.${lines ? `\n\nMy recent activity:\n${lines}` : ''}`)
  }
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-4 text-center">
      <p className="text-muted text-sm">Let the assistant summarise your last 24 hours into Yesterday · Today · Blockers.</p>
      <p className="text-faint text-xs">{recent.length} updates in the last day</p>
      <button onClick={write} className="bg-brand-600 hover:bg-brand-700 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white">
        <Sparkles size={14} /> Write StandUp
      </button>
    </div>
  )
}
