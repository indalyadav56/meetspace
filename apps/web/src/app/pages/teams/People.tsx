import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import type { ID, MemberRole } from '../../../store/types'
import { Avatar } from '../../components/ui'
import { cn } from '../../../lib/utils'
import { usePeople, type Person } from './shared'

const ROLES: MemberRole[] = ['owner', 'admin', 'member', 'guest']

function TitleCell({ p, editable }: { p: Person; editable: boolean }) {
  const setMemberProfile = useStore((s) => s.setMemberProfile)
  const [v, setV] = useState(p.member.title ?? '')
  useEffect(() => setV(p.member.title ?? ''), [p.member.title])
  if (!editable) return <span className="text-muted truncate">{p.member.title || '—'}</span>
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() !== (p.member.title ?? '') && void setMemberProfile(p.user.id, { title: v.trim() })}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      placeholder="Add a title"
      maxLength={120}
      className="hover-surface w-full rounded bg-transparent px-1 py-0.5 outline-none placeholder:text-[var(--text-faint)] focus:bg-[var(--bg-muted)]"
      aria-label={`Title for ${p.user.name}`}
    />
  )
}

export function ManagerSelect({ p, people, disabled }: { p: Person; people: Person[]; disabled?: boolean }) {
  const setMemberProfile = useStore((s) => s.setMemberProfile)
  return (
    <select
      value={p.member.managerId ?? ''}
      disabled={disabled}
      onChange={(e) => void setMemberProfile(p.user.id, { managerId: e.target.value || null })}
      className="border-app surface h-7 w-full rounded-md border px-1 text-xs disabled:border-transparent disabled:bg-transparent disabled:opacity-100 disabled:appearance-none"
      aria-label={`Manager of ${p.user.name}`}
    >
      <option value="">{disabled ? '—' : 'No manager'}</option>
      {people
        .filter((x) => x.user.id !== p.user.id)
        .map((x) => (
          <option key={x.user.id} value={x.user.id}>
            {x.user.name}
          </option>
        ))}
    </select>
  )
}

export default function People() {
  const { teams } = useStore()
  const { people, canManage, me, teamsOf } = usePeople()
  const [, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [team, setTeam] = useState<ID | ''>('')
  const [role, setRole] = useState<MemberRole | ''>('')
  const [status, setStatus] = useState<'' | 'online' | 'offline'>('')
  const shown = people.filter(
    (p) =>
      (!q || `${p.user.name} ${p.user.email} ${p.member.title ?? ''}`.toLowerCase().includes(q.toLowerCase())) &&
      (!team || teamsOf(p.user.id).some((t) => t.id === team)) &&
      (!role || p.member.role === role) &&
      (!status || (status === 'online') === p.online),
  )
  const sel = 'border-app surface h-8 rounded-md border px-2 text-sm'
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">All People</h1>
        <span className="text-muted text-sm">{people.length} in this workspace</span>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="border-app flex h-8 items-center gap-2 rounded-md border px-2">
          <Search size={14} className="text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="w-44 bg-transparent text-sm outline-none" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={sel} aria-label="Status">
          <option value="">Any status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
        <select value={team} onChange={(e) => setTeam(e.target.value)} className={sel} aria-label="Team">
          <option value="">Any team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value as MemberRole | '')} className={sel} aria-label="Account type">
          <option value="">Any account type</option>
          {ROLES.map((r) => (
            <option key={r} value={r} className="capitalize">
              {r[0].toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
        <span className="text-faint ml-auto text-xs">{canManage ? 'You can edit titles and managers' : 'You can edit your own title'}</span>
      </div>
      <div className="border-app overflow-x-auto rounded-xl border">
        <div className="min-w-[900px]">
          <div className="text-faint border-app grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_90px_minmax(0,1fr)_minmax(0,1fr)_70px_70px] gap-3 border-b px-4 py-2 text-xs font-medium">
            <span>Name</span>
            <span>Title</span>
            <span>Account</span>
            <span>Reports to</span>
            <span>Teams</span>
            <span>Open</span>
            <span>Overdue</span>
          </div>
          {shown.map((p) => (
            <div key={p.user.id} className="border-app grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_90px_minmax(0,1fr)_minmax(0,1fr)_70px_70px] items-center gap-3 border-b px-4 py-2 text-sm last:border-b-0">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="relative shrink-0">
                  <Avatar userId={p.user.id} size={30} />
                  <span className={cn('absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg)]', p.online ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-600')} title={p.online ? 'Online' : 'Offline'} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {p.user.name}
                    {p.user.id === me && <span className="text-faint font-normal"> (you)</span>}
                    {p.member.invited && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Invited</span>}
                  </span>
                  <span className="text-faint block truncate text-xs">{p.user.email}</span>
                </span>
              </span>
              <TitleCell p={p} editable={canManage || p.user.id === me} />
              <span className="text-muted text-xs capitalize">{p.member.role}</span>
              <ManagerSelect p={p} people={people} disabled={!canManage} />
              <span className="flex min-w-0 flex-wrap gap-1">
                {teamsOf(p.user.id).map((t) => (
                  <button key={t.id} onClick={() => setParams({ team: t.id })} className="rounded px-1.5 py-px text-[11px] font-medium" style={{ background: `${t.color}22`, color: t.color }}>
                    {t.name}
                  </button>
                ))}
                {!teamsOf(p.user.id).length && <span className="text-faint text-xs">—</span>}
              </span>
              <span className="tabular-nums">{p.open.length}</span>
              <span className={cn('tabular-nums', p.overdue.length ? 'text-red-500' : 'text-faint')}>{p.overdue.length}</span>
            </div>
          ))}
          {shown.length === 0 && <p className="text-muted py-10 text-center text-sm">No one matches these filters.</p>}
        </div>
      </div>
    </div>
  )
}
