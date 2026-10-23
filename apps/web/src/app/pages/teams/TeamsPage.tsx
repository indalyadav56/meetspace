import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Check, Crown, Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import type { ID, Team } from '../../../store/types'
import { Avatar, AvatarStack, Modal } from '../../components/ui'
import { cn } from '../../../lib/utils'
import { TEAM_COLORS, usePeople } from './shared'
import People from './People'
import OrgChart from './OrgChart'
import Analytics from './Analytics'

export default function TeamsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'teams'
  const teamId = params.get('team')
  const [editing, setEditing] = useState<Team | 'new' | null>(null)
  const team = useStore((s) => s.teams.find((t) => t.id === teamId))

  // ?new=1 (from the sidebar's +) opens the create dialog.
  useEffect(() => {
    if (params.get('new') === '1') {
      setEditing('new')
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      {team ? (
        <TeamDetail team={team} onEdit={() => setEditing(team)} />
      ) : tab === 'people' ? (
        <People />
      ) : tab === 'org' ? (
        <OrgChart />
      ) : tab === 'analytics' ? (
        <Analytics />
      ) : (
        <AllTeams onNew={() => setEditing('new')} onEdit={setEditing} />
      )}
      {editing && <TeamDialog team={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function Header({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <h1 className="text-xl font-bold">{title}</h1>
      <span className="text-muted text-sm">{hint}</span>
      <div className="ml-auto">{action}</div>
    </div>
  )
}

export function TeamBadge({ team, size = 36 }: { team: Pick<Team, 'name' | 'color'>; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-lg font-bold text-white" style={{ width: size, height: size, background: team.color, fontSize: size * 0.42 }}>
      {team.name[0]?.toUpperCase()}
    </span>
  )
}

function AllTeams({ onNew, onEdit }: { onNew: () => void; onEdit: (t: Team) => void }) {
  const { teams } = useStore()
  const { byId } = usePeople()
  const [, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const shown = teams.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <Header
        title="All Teams"
        hint="Groups of people who work together"
        action={
          <button onClick={onNew} className="bg-brand-600 hover:bg-brand-700 inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-semibold text-white">
            <Plus size={15} /> New team
          </button>
        }
      />
      {teams.length > 0 && (
        <div className="border-app mb-4 flex h-8 w-64 items-center gap-2 rounded-md border px-2">
          <Search size={14} className="text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teams" className="flex-1 bg-transparent text-sm outline-none" />
        </div>
      )}
      {teams.length === 0 ? (
        <div className="border-app flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <span className="surface-muted text-muted flex h-12 w-12 items-center justify-center rounded-xl">
            <Users size={22} />
          </span>
          <p className="font-semibold">No teams yet</p>
          <p className="text-muted max-w-sm text-sm">Create a team to group people, see their workload together and build your org chart.</p>
          <button onClick={onNew} className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-1.5 text-sm font-semibold text-white">
            Create a team
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => {
            // Count each task once even when several members share it.
            const open = new Set(t.members.flatMap((id) => byId.get(id)?.open.map((x) => x.id) ?? [])).size
            const overdue = new Set(t.members.flatMap((id) => byId.get(id)?.overdue.map((x) => x.id) ?? [])).size
            const online = t.members.filter((id) => byId.get(id)?.online).length
            return (
              <div key={t.id} className="group border-app hover:border-brand-500 relative rounded-xl border p-4 transition-colors">
                <button onClick={() => setParams({ team: t.id })} className="block w-full text-left">
                  <div className="flex items-center gap-3">
                    <TeamBadge team={t} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{t.name}</div>
                      <div className="text-faint text-xs">
                        {t.members.length} {t.members.length === 1 ? 'member' : 'members'} · {online} online
                      </div>
                    </div>
                  </div>
                  <p className="text-muted mt-3 line-clamp-2 min-h-[2.5em] text-sm">{t.description || 'No description yet.'}</p>
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <AvatarStack ids={t.members} size={24} max={5} />
                    <span className="text-muted ml-auto">{open} open</span>
                    {overdue > 0 && <span className="text-red-500">{overdue} overdue</span>}
                  </div>
                </button>
                <button onClick={() => onEdit(t)} className="surface text-muted absolute top-3 right-3 hidden rounded-md p-1.5 shadow group-hover:block" aria-label={`Edit ${t.name}`}>
                  <Pencil size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TeamDetail({ team, onEdit }: { team: Team; onEdit: () => void }) {
  const { deleteTeam, openTask } = useStore()
  const { byId } = usePeople()
  const [, setParams] = useSearchParams()
  const members = team.members.map((id) => byId.get(id)).filter((p) => !!p)
  const open = members.flatMap((p) => p.open)
  const unique = [...new Map(open.map((t) => [t.id, t])).values()].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
  const overdue = new Set(members.flatMap((p) => p.overdue.map((t) => t.id)))
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <button onClick={() => setParams({})} className="text-muted hover:text-app mb-3 inline-flex items-center gap-1 text-sm">
        <ArrowLeft size={14} /> All Teams
      </button>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <TeamBadge team={team} size={44} />
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{team.name}</h1>
          <p className="text-muted text-sm">{team.description || `${team.members.length} members`}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={onEdit} className="border-app hover-surface inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm">
            <Pencil size={14} /> Edit team
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete the team “${team.name}”? People stay in the workspace.`)) {
                deleteTeam(team.id)
                setParams({})
              }
            }}
            className="border-app inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Members', members.length],
          ['Online now', members.filter((p) => p.online).length],
          ['Open tasks', unique.length],
          ['Overdue', overdue.size],
        ].map(([label, n]) => (
          <div key={label} className="border-app rounded-xl border px-4 py-3">
            <div className="text-faint text-xs uppercase">{label}</div>
            <div className={cn('text-2xl font-semibold tabular-nums', label === 'Overdue' && Number(n) > 0 && 'text-red-500')}>{n}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className="border-app rounded-xl border">
          <h2 className="border-app border-b px-4 py-2.5 text-sm font-semibold">Members</h2>
          {members.map((p) => (
            <div key={p.user.id} className="border-app flex items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
              <span className="relative">
                <Avatar userId={p.user.id} size={30} />
                <span className={cn('absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg)]', p.online ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-600')} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-medium">
                  {p.user.name}
                  {team.leadId === p.user.id && (
                    <span title="Team lead">
                      <Crown size={13} className="text-amber-500" />
                    </span>
                  )}
                </span>
                <span className="text-faint block truncate text-xs">{p.member.title || p.user.email}</span>
              </span>
              <span className="text-muted text-xs">{p.open.length} open</span>
              {p.overdue.length > 0 && <span className="text-xs text-red-500">{p.overdue.length} late</span>}
            </div>
          ))}
          {members.length === 0 && <p className="text-muted px-4 py-6 text-center text-sm">No one on this team yet.</p>}
        </section>
        <section className="border-app rounded-xl border">
          <h2 className="border-app border-b px-4 py-2.5 text-sm font-semibold">Open work</h2>
          {unique.slice(0, 25).map((t) => (
            <button key={t.id} onClick={() => openTask(t.id)} className="border-app hover-surface flex w-full items-center gap-2 border-b px-4 py-2 text-left text-sm last:border-b-0">
              <span className="text-faint shrink-0 font-mono text-xs">MS-{t.key}</span>
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <AvatarStack ids={t.assignees.filter((a) => team.members.includes(a))} size={20} max={3} />
              <span className={cn('w-14 shrink-0 text-right text-xs', overdue.has(t.id) ? 'text-red-500' : 'text-muted')}>{t.dueDate ? format(parseISO(t.dueDate), 'MMM d') : '—'}</span>
            </button>
          ))}
          {unique.length === 0 && <p className="text-muted px-4 py-6 text-center text-sm">Nothing open for this team.</p>}
        </section>
      </div>
    </div>
  )
}

function TeamDialog({ team, onClose }: { team: Team | null; onClose: () => void }) {
  const { addTeam, updateTeam } = useStore()
  const { people } = usePeople()
  const [, setParams] = useSearchParams()
  const [name, setName] = useState(team?.name ?? '')
  const [description, setDescription] = useState(team?.description ?? '')
  const [color, setColor] = useState(team?.color ?? TEAM_COLORS[0])
  const [members, setMembers] = useState<ID[]>(team?.members ?? [])
  const [leadId, setLeadId] = useState<ID | null>(team?.leadId ?? null)
  const [q, setQ] = useState('')
  const toggle = (id: ID) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))
  const shown = people.filter((p) => p.user.name.toLowerCase().includes(q.toLowerCase()) || p.user.email.toLowerCase().includes(q.toLowerCase()))
  const save = () => {
    const body = { name: name.trim(), description: description.trim(), color, members, leadId: leadId && members.includes(leadId) ? leadId : null }
    if (team) updateTeam(team.id, body)
    else setParams({ team: addTeam(body) })
    onClose()
  }
  return (
    <Modal open onClose={onClose} className="mt-[8vh] max-w-lg">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) save()
        }}
        className="flex max-h-[80vh] flex-col"
      >
        <div className="border-app flex items-center gap-3 border-b p-4">
          <TeamBadge team={{ name: name || 'T', color }} />
          <h2 className="text-base font-semibold">{team ? 'Edit team' : 'New team'}</h2>
        </div>
        <div className="space-y-4 overflow-y-auto p-4 scroll-thin">
          <label className="block">
            <span className="text-muted text-xs font-medium">Name</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Design" className="border-app surface-subtle mt-1 w-full rounded-md border px-2.5 py-1.5 text-sm outline-none" />
          </label>
          <label className="block">
            <span className="text-muted text-xs font-medium">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What does this team do?" className="border-app surface-subtle mt-1 w-full resize-none rounded-md border px-2.5 py-1.5 text-sm outline-none" />
          </label>
          <div>
            <span className="text-muted text-xs font-medium">Color</span>
            <div className="mt-1 flex gap-1.5">
              {TEAM_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className={cn('h-6 w-6 rounded-full', color === c && 'ring-2 ring-offset-2 ring-offset-[var(--bg)]')} style={{ background: c, ['--tw-ring-color' as string]: c }} aria-label={`Color ${c}`} />
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center">
              <span className="text-muted text-xs font-medium">Members · {members.length}</span>
              <span className="text-faint ml-auto text-[11px]">Click the crown to pick a lead</span>
            </div>
            <div className="border-app mt-1 flex h-8 items-center gap-2 rounded-md border px-2">
              <Search size={13} className="text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find people" className="flex-1 bg-transparent text-sm outline-none" />
            </div>
            <div className="border-app mt-1 max-h-60 overflow-y-auto rounded-md border scroll-thin">
              {shown.map((p) => {
                const on = members.includes(p.user.id)
                return (
                  <div key={p.user.id} className={cn('hover-surface flex items-center gap-2 px-2 py-1.5 text-sm', on && 'bg-brand-50/60 dark:bg-brand-500/10')}>
                    <button type="button" onClick={() => toggle(p.user.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'bg-brand-600 border-brand-600 text-white' : 'border-app')}>{on && <Check size={11} />}</span>
                      <Avatar userId={p.user.id} size={22} />
                      <span className="truncate">{p.user.name}</span>
                      <span className="text-faint truncate text-xs">{p.member.title}</span>
                    </button>
                    {on && (
                      <button type="button" onClick={() => setLeadId(leadId === p.user.id ? null : p.user.id)} title={leadId === p.user.id ? 'Team lead' : 'Make team lead'} aria-label="Toggle team lead">
                        <Crown size={14} className={leadId === p.user.id ? 'text-amber-500' : 'text-faint'} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="border-app flex justify-end gap-2 border-t p-3">
          <button type="button" onClick={onClose} className="border-app hover-surface rounded-md border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button disabled={!name.trim()} className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {team ? 'Save' : 'Create team'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
