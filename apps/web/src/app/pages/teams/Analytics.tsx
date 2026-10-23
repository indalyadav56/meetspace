import { useMemo, useState } from 'react'
import { addDays, format, isSameDay, isToday, parseISO, startOfDay } from 'date-fns'
import { BarChart3, CheckSquare, ChevronLeft, ChevronRight, Timer } from 'lucide-react'
import { formatMinutes, useStore } from '../../../store/useStore'
import type { ID, MemberRole } from '../../../store/types'
import { Avatar } from '../../components/ui'
import { cn } from '../../../lib/utils'
import { usePeople } from './shared'

/** Each logged action counts as this many minutes of attention when splitting "focused on". */
const ACTION_MINUTES = 5

interface Focus {
  taskId: ID
  minutes: number
  tracked: number
  actions: number
}

/**
 * Who was around on a day and what they worked on: tracked time plus task activity,
 * split per task. Built from the workspace's time entries, running timer and task history.
 */
export default function Analytics() {
  const { activity, timeEntries, timer, tasks, teams, openTask, currentUserId } = useStore()
  const { people, teamsOf } = usePeople()
  const [day, setDay] = useState(() => startOfDay(new Date()))
  const [show, setShow] = useState<'online' | 'offline'>('online')
  const [team, setTeam] = useState<ID | ''>('')
  const [role, setRole] = useState<MemberRole | ''>('')
  const [manager, setManager] = useState<ID | ''>('')
  const [sort, setSort] = useState<'active' | 'name'>('active')

  const stats = useMemo(() => {
    const per = new Map<ID, Map<ID, Focus>>()
    const hours = new Map<number, Set<ID>>()
    const bump = (userId: ID, taskId: ID, minutes: number, kind: 'tracked' | 'action', at: Date) => {
      const m = per.get(userId) ?? new Map<ID, Focus>()
      const f = m.get(taskId) ?? { taskId, minutes: 0, tracked: 0, actions: 0 }
      f.minutes += minutes
      if (kind === 'tracked') f.tracked += minutes
      else f.actions += 1
      m.set(taskId, f)
      per.set(userId, m)
      const h = at.getHours()
      hours.set(h, new Set([...(hours.get(h) ?? []), userId]))
    }
    for (const a of activity) {
      const at = parseISO(a.createdAt)
      if (a.userId && isSameDay(at, day)) bump(a.userId, a.taskId, ACTION_MINUTES, 'action', at)
    }
    for (const e of timeEntries) {
      const at = parseISO(e.start)
      if (isSameDay(at, day)) bump(e.userId, e.taskId, e.duration, 'tracked', at)
    }
    if (timer && currentUserId && isToday(day)) {
      const start = parseISO(timer.start)
      bump(currentUserId, timer.taskId, Math.max(1, (Date.now() - start.getTime()) / 60000), 'tracked', start)
    }
    return { per, hours }
  }, [activity, timeEntries, timer, currentUserId, day])

  const filtered = people.filter(
    (p) => (!team || teamsOf(p.user.id).some((t) => t.id === team)) && (!role || p.member.role === role) && (!manager || p.member.managerId === manager),
  )
  // Past days have no presence history, so "online" means "was active that day".
  const isOn = (id: ID, online: boolean) => (isToday(day) ? online || stats.per.has(id) : stats.per.has(id))
  const on = filtered.filter((p) => isOn(p.user.id, p.online))
  const off = filtered.filter((p) => !isOn(p.user.id, p.online))
  const list = (show === 'online' ? on : off).sort((a, b) => {
    if (sort === 'name') return a.user.name.localeCompare(b.user.name)
    const total = (id: ID) => [...(stats.per.get(id)?.values() ?? [])].reduce((s, f) => s + f.minutes, 0)
    return total(b.user.id) - total(a.user.id)
  })
  const maxHour = Math.max(1, ...[...stats.hours.values()].map((s) => s.size))
  const managers = people.filter((p) => people.some((x) => x.member.managerId === p.user.id))
  const sel = 'border-app surface h-8 rounded-md border px-2 text-sm'

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Analytics</h1>
        <span className="text-muted text-sm">See who’s online and what they’re working on</span>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={team} onChange={(e) => setTeam(e.target.value)} className={sel} aria-label="Team">
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value as MemberRole | '')} className={sel} aria-label="Account type">
          <option value="">Any account type</option>
          {(['owner', 'admin', 'member', 'guest'] as const).map((r) => (
            <option key={r} value={r}>
              {r[0].toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
        <select value={manager} onChange={(e) => setManager(e.target.value)} className={sel} aria-label="Manager">
          <option value="">Any manager</option>
          {managers.map((p) => (
            <option key={p.user.id} value={p.user.id}>
              Reports to {p.user.name}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as 'active' | 'name')} className={sel} aria-label="Sort">
          <option value="active">Most active first</option>
          <option value="name">Name</option>
        </select>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setDay((d) => addDays(d, -1))} className="border-app hover-surface rounded-md border p-1.5" aria-label="Previous day">
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => setDay((d) => (isToday(d) ? d : addDays(d, 1)))} disabled={isToday(day)} className="border-app hover-surface rounded-md border p-1.5 disabled:opacity-40" aria-label="Next day">
            <ChevronRight size={15} />
          </button>
          <input
            type="date"
            value={format(day, 'yyyy-MM-dd')}
            max={format(new Date(), 'yyyy-MM-dd')}
            onChange={(e) => e.target.value && setDay(startOfDay(parseISO(e.target.value)))}
            className="border-app surface h-8 rounded-md border px-2 text-sm"
            aria-label="Day"
          />
        </div>
      </div>

      <section className="border-app mb-5 rounded-xl border p-4">
        <div className="text-muted mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
          <span className="bg-brand-500 h-2 w-2 rounded-full" /> People active by hour · {isToday(day) ? 'today' : format(day, 'EEE, MMM d')}
        </div>
        {stats.hours.size === 0 ? (
          <div className="text-muted flex h-28 flex-col items-center justify-center gap-2 text-sm">
            <BarChart3 size={24} className="text-faint" /> Not enough data for this day.
          </div>
        ) : (
          <div className="flex h-32 gap-1">
            {Array.from({ length: 24 }, (_, h) => {
              const n = stats.hours.get(h)?.size ?? 0
              return (
                <div key={h} className="group flex flex-1 flex-col items-center gap-1" title={`${h}:00 — ${n} ${n === 1 ? 'person' : 'people'}`}>
                  <div className="flex w-full flex-1 items-end">
                    <div className={cn('w-full rounded-t', n ? 'bg-brand-500 group-hover:bg-brand-600' : 'surface-muted')} style={{ height: n ? `${(n / maxHour) * 100}%` : 3 }} />
                  </div>
                  <span className="text-faint text-[9px] tabular-nums">{h % 3 === 0 ? h : ''}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="mb-3 flex items-center gap-2">
        <div className="surface-muted flex rounded-lg p-0.5 text-sm">
          {(
            [
              ['online', `${on.length} ${isToday(day) ? 'Online' : 'Active'}`],
              ['offline', `${off.length} ${isToday(day) ? 'Offline' : 'Inactive'}`],
            ] as const
          ).map(([k, label]) => (
            <button key={k} onClick={() => setShow(k)} className={cn('rounded-md px-3 py-1', show === k ? 'surface font-medium shadow-sm' : 'text-muted')}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-faint ml-auto text-xs">Focus = tracked time + {ACTION_MINUTES} min per task update</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => {
          const focus = [...(stats.per.get(p.user.id)?.values() ?? [])].sort((a, b) => b.minutes - a.minutes)
          const total = focus.reduce((s, f) => s + f.minutes, 0)
          const tracked = focus.reduce((s, f) => s + f.tracked, 0)
          return (
            <section key={p.user.id} className="border-app rounded-xl border p-4">
              <div className="border-app mb-3 flex items-center gap-2.5 border-b pb-3">
                <span className="relative">
                  <Avatar userId={p.user.id} size={34} />
                  <span className={cn('absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg)]', p.online ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-600')} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.user.id === currentUserId ? 'You' : p.user.name}</span>
                  <span className="text-faint block truncate text-xs">{p.member.title || teamsOf(p.user.id)[0]?.name || p.user.email}</span>
                </span>
                {tracked > 0 && (
                  <span className="text-muted inline-flex items-center gap-1 text-xs" title="Time tracked">
                    <Timer size={12} /> {formatMinutes(tracked)}
                  </span>
                )}
              </div>
              <div className="text-faint mb-2 text-xs font-medium">Focused on</div>
              {focus.length === 0 ? (
                <p className="text-faint py-3 text-sm">No tracked work {isToday(day) ? 'yet today' : 'that day'}.</p>
              ) : (
                <div className="space-y-1.5">
                  {focus.slice(0, 5).map((f) => {
                    const t = tasks.find((x) => x.id === f.taskId)
                    const pct = Math.round((f.minutes / total) * 100)
                    return (
                      <button key={f.taskId} onClick={() => t && openTask(t.id)} className="relative flex w-full items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left text-sm" title={`${f.tracked ? `${formatMinutes(f.tracked)} tracked · ` : ''}${f.actions} updates`}>
                        <span className="absolute inset-y-0 left-0 rounded-md bg-emerald-500/15" style={{ width: `${pct}%` }} />
                        <CheckSquare size={14} className="text-muted relative shrink-0" />
                        <span className="relative min-w-0 flex-1 truncate">{t?.title ?? 'Deleted task'}</span>
                        <span className="relative shrink-0 text-xs font-semibold tabular-nums">{pct}%</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
        {list.length === 0 && <p className="text-muted col-span-full py-10 text-center text-sm">{show === 'online' ? 'No one matches.' : 'Everyone was around.'}</p>}
      </div>
    </div>
  )
}
