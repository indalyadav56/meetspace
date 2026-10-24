import { useMemo, useState } from 'react'
import { subDays } from 'date-fns'
import { Check, MessageSquareDot, RotateCcw, Search } from 'lucide-react'
import { useMe, useStore } from '../../store/useStore'
import { Avatar } from '../components/ui'
import { cn, timeAgo } from '../../lib/utils'
import { useQueryState } from '../../lib/useQueryState'

type Tab = 'mine' | 'delegated'
const RANGES = { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days', 0: 'Any time' } as const

/** Comments that became action items: assigned to me, or ones I assigned to others. */
export default function AssignedComments() {
  const me = useMe()
  const s = useStore()
  const [tab, setTab] = useQueryState<Tab>('tab', 'mine')
  const [resolved, setResolved] = useState(false)
  const [range, setRange] = useState<keyof typeof RANGES>(90)
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const since = range ? subDays(new Date(), range).toISOString() : ''
    const needle = q.toLowerCase()
    return s.comments
      .filter((c) => (tab === 'mine' ? c.assignee === me.id : c.userId === me.id && !!c.assignee && c.assignee !== me.id))
      .filter((c) => !!c.resolved === resolved && c.createdAt >= since)
      .filter((c) => !needle || c.text.toLowerCase().includes(needle) || (s.tasks.find((t) => t.id === c.taskId)?.title ?? '').toLowerCase().includes(needle))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [s.comments, s.tasks, tab, me.id, resolved, range, q])

  const counts = {
    mine: s.comments.filter((c) => c.assignee === me.id && !c.resolved).length,
    delegated: s.comments.filter((c) => c.userId === me.id && c.assignee && c.assignee !== me.id && !c.resolved).length,
  }
  const chip = (on: boolean) => cn('border-app inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium', on ? 'border-brand-500 text-brand-600' : 'hover-surface')

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquareDot size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">Assigned Comments</h1>
        </div>
        <div className="border-app mb-3 flex gap-1 border-b">
          {(
            [
              ['mine', 'Assigned to me'],
              ['delegated', 'Delegated by me'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={cn('relative flex h-10 items-center gap-1.5 px-2.5 text-[13px] font-medium', tab === k ? 'after:bg-brand-600 after:absolute after:inset-x-1 after:bottom-0 after:h-0.5' : 'text-muted')}>
              {label}
              {counts[k] > 0 && <span className="bg-brand-600 rounded-full px-1.5 text-[10px] font-semibold text-white">{counts[k]}</span>}
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setResolved((v) => !v)} className={chip(resolved)} aria-pressed={resolved}>
            <Check size={13} /> {resolved ? 'Showing resolved' : 'Resolved'}
          </button>
          <select value={range} onChange={(e) => setRange(Number(e.target.value) as keyof typeof RANGES)} className="border-app surface h-7 rounded-md border px-1.5 text-xs" aria-label="Date range">
            {(Object.keys(RANGES) as unknown as (keyof typeof RANGES)[]).map((k) => (
              <option key={k} value={k}>
                {RANGES[k]}
              </option>
            ))}
          </select>
          <div className="border-app ml-auto flex h-7 items-center gap-1.5 rounded-md border px-2">
            <Search size={13} className="text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search comments" className="w-40 bg-transparent text-xs outline-none" />
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="border-app text-muted rounded-xl border border-dashed px-4 py-12 text-center text-sm">
            {resolved ? 'No resolved comments in this range.' : tab === 'mine' ? 'Nothing assigned to you. Comments people assign to you in tasks show up here.' : 'Assign a comment to someone from a task, and it shows up here until they resolve it.'}
          </div>
        ) : (
          <div className="border-app overflow-hidden rounded-xl border">
            {rows.map((c) => {
              const task = s.tasks.find((t) => t.id === c.taskId)
              return (
                <div key={c.id} className="border-app hover-surface group flex gap-3 border-b px-4 py-3 last:border-b-0">
                  <Avatar userId={c.userId} size={28} />
                  <button onClick={() => s.openTask(c.taskId)} className="min-w-0 flex-1 text-left">
                    <div className="text-muted flex flex-wrap items-center gap-x-1.5 text-xs">
                      <span className="text-app font-medium">{s.users.find((u) => u.id === c.userId)?.name}</span>
                      {tab === 'delegated' && c.assignee && (
                        <>
                          → <Avatar userId={c.assignee} size={14} /> {s.users.find((u) => u.id === c.assignee)?.name}
                        </>
                      )}
                      <span>· {timeAgo(c.createdAt)}</span>
                      <span className="truncate">· in {task ? `MS-${task.key} ${task.title}` : 'a deleted task'}</span>
                    </div>
                    <p className={cn('mt-0.5 line-clamp-3 text-sm whitespace-pre-wrap', c.resolved && 'text-faint line-through')}>{c.text}</p>
                  </button>
                  <button
                    onClick={() => s.updateComment(c.id, { resolved: !c.resolved })}
                    className={cn('shrink-0 self-start rounded-md px-2 py-1 text-xs font-medium', c.resolved ? 'hover-surface text-muted' : 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300')}
                  >
                    {c.resolved ? (
                      <span className="inline-flex items-center gap-1">
                        <RotateCcw size={12} /> Reopen
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Check size={12} /> Resolve
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
