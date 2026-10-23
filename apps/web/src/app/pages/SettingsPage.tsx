import { useMemo, useState } from 'react'
import { Bell, Download, FileUp, Settings, Trash2, UserPlus, Users } from 'lucide-react'
import { useMe, useStore } from '../../store/useStore'
import type { MemberRole, Priority, Task } from '../../store/types'
import { Avatar } from '../components/ui'
import { useTaskResolver } from '../hooks'
import { SPACE_COLORS, cn } from '../../lib/utils'
import { htmlToText } from '../ai/tools'

const ROLES: { role: MemberRole; label: string; desc: string }[] = [
  { role: 'owner', label: 'Owner', desc: 'Full control, billing and deletion' },
  { role: 'admin', label: 'Admin', desc: 'Manage members, projects and settings' },
  { role: 'member', label: 'Member', desc: 'Create and edit work' },
  { role: 'guest', label: 'Guest', desc: 'Limited access to shared items' },
]

/* ---------------- CSV helpers ---------------- */

function csvEscape(v: unknown) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** RFC 4180-style parser: quoted fields, escaped quotes, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cur += '"'), i++
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',') row.push(cur), (cur = '')
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur)
      rows.push(row)
      row = []
      cur = ''
    } else cur += c
  }
  if (cur || row.length) row.push(cur), rows.push(row)
  return rows.filter((r) => r.some((x) => x.trim()))
}

export default function SettingsPage() {
  const s = useStore()
  const me = useMe()
  const ws = s.workspaces.find((w) => w.id === s.currentWorkspaceId)!
  const myRole = ws.members.find((m) => m.userId === me.id)?.role ?? 'member'
  const canManage = myRole === 'owner' || myRole === 'admin'
  const [tab, setTab] = useState<'general' | 'members' | 'data' | 'notifications'>('general')

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <Settings size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">Settings</h1>
          <span className="text-muted text-sm">{ws.name}</span>
        </div>
        <div className="border-app mb-6 flex gap-1 overflow-x-auto border-b">
          {(
            [
              ['general', 'Workspace'],
              ['members', `Members (${ws.members.length})`],
              ['data', 'Import & export'],
              ['notifications', 'Notifications'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cn('relative h-10 shrink-0 px-3 text-sm font-medium', tab === k ? 'after:bg-brand-600 after:absolute after:inset-x-1 after:bottom-0 after:h-0.5' : 'text-muted')}>
              {l}
            </button>
          ))}
        </div>
        {tab === 'general' && (
          <section className="max-w-md space-y-4">
            <label className="block text-sm">
              <span className="text-muted text-xs">Workspace name</span>
              <input value={ws.name} onChange={(e) => s.renameWorkspace(ws.id, e.target.value)} disabled={!canManage} className="border-app surface mt-1 w-full rounded-lg border px-3 py-2 outline-none disabled:opacity-60" />
            </label>
            <div>
              <span className="text-muted text-xs">Color</span>
              <div className="mt-1 flex gap-1.5">
                {SPACE_COLORS.map((c) => (
                  <button key={c} disabled={!canManage} onClick={() => s.updateWorkspace(ws.id, { color: c })} className={cn('h-7 w-7 rounded-lg', ws.color === c && 'ring-2 ring-offset-2 ring-offset-[var(--bg)]')} style={{ background: c, ['--tw-ring-color' as string]: c }} aria-label={`Color ${c}`} />
                ))}
              </div>
            </div>
            <p className="text-muted text-sm">Your role here: <b className="text-app capitalize">{myRole}</b>.</p>
          </section>
        )}
        {tab === 'members' && <Members canManage={canManage} />}
        {tab === 'data' && <ImportExport />}
        {tab === 'notifications' && <Notifications />}
      </div>
    </div>
  )
}

function Members({ canManage }: { canManage: boolean }) {
  const s = useStore()
  const me = useMe()
  const ws = s.workspaces.find((w) => w.id === s.currentWorkspaceId)!
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('member')
  const [q, setQ] = useState('')
  const owners = ws.members.filter((m) => m.role === 'owner').length
  const list = ws.members.filter((m) => {
    const u = s.users.find((x) => x.id === m.userId)
    return u && (u.name + u.email).toLowerCase().includes(q.toLowerCase())
  })
  return (
    <div className="space-y-6">
      {canManage && (
        <form
          className="border-app rounded-xl border p-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return
            s.inviteMember(name.trim(), email.trim(), role)
            setName('')
            setEmail('')
          }}
        >
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <UserPlus size={16} /> Invite people
          </h2>
          <div className="grid gap-2 sm:grid-cols-[1fr_1.3fr_auto_auto]">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="border-app surface rounded-lg border px-3 py-1.5 text-sm outline-none" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@company.com" className="border-app surface rounded-lg border px-3 py-1.5 text-sm outline-none" />
            <select value={role} onChange={(e) => setRole(e.target.value as MemberRole)} className="border-app surface rounded-lg border px-2 py-1.5 text-sm">
              {ROLES.filter((r) => r.role !== 'owner').map((r) => (
                <option key={r.role} value={r.role}>
                  {r.label}
                </option>
              ))}
            </select>
            <button disabled={!email} className="bg-brand-600 rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
              Invite
            </button>
          </div>
          <p className="text-faint mt-2 text-xs">Demo: invites add the person to this workspace right away; no email is sent.</p>
        </form>
      )}
      <div className="border-app overflow-hidden rounded-xl border">
        <div className="border-app flex items-center gap-2 border-b px-4 py-2">
          <Users size={15} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members" className="flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="divide-y divide-[var(--border)]">
          {list.map((m) => {
            const u = s.users.find((x) => x.id === m.userId)!
            const lastOwner = m.role === 'owner' && owners < 2
            return (
              <div key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Avatar userId={u.id} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {u.name} {u.id === me.id && <span className="text-muted">(you)</span>}
                    {m.invited && <span className="ml-2 rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">INVITED</span>}
                  </div>
                  <div className="text-muted truncate text-xs">{u.email}</div>
                </div>
                <select
                  value={m.role}
                  disabled={!canManage || lastOwner}
                  onChange={(e) => s.setMemberRole(m.userId, e.target.value as MemberRole)}
                  className="border-app surface rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                  title={lastOwner ? 'A workspace needs at least one owner' : ROLES.find((r) => r.role === m.role)?.desc}
                  aria-label={`Role for ${u.name}`}
                >
                  {ROLES.map((r) => (
                    <option key={r.role} value={r.role}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {canManage && u.id !== me.id && !lastOwner && (
                  <button onClick={() => confirm(`Remove ${u.name} from ${s.workspaces.find((w) => w.id === s.currentWorkspaceId)?.name}? They’ll be unassigned from tasks.`) && s.removeMember(u.id)} className="hover-surface rounded p-1.5 text-red-500" aria-label={`Remove ${u.name}`}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        {ROLES.map((r) => (
          <div key={r.role} className="surface-subtle rounded-lg p-3">
            <div className="text-sm font-semibold">{r.label}</div>
            <div className="text-muted text-xs">{r.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ImportExport() {
  const s = useStore()
  const r = useTaskResolver()
  const [listId, setListId] = useState(s.lists[0]?.id ?? '')
  const [rows, setRows] = useState<string[][] | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const exportCsv = () => {
    const header = ['Key', 'Title', 'Status', 'Project', 'List', 'Assignees', 'Priority', 'Start date', 'Due date', 'Story points', 'Estimate (h)', 'Tags', 'Description']
    const lines = s.tasks.map((t) => [
      `MS-${t.key}`,
      t.title,
      r.statusOf(t)?.name,
      r.spaceOf(t)?.name,
      r.listName(t.listId),
      t.assignees.map((a) => s.users.find((u) => u.id === a)?.name).join('; '),
      t.priority ?? '',
      t.startDate ?? '',
      t.dueDate ?? '',
      t.points ?? '',
      t.estimate ?? '',
      t.tags.join('; '),
      htmlToText(t.description),
    ])
    const csv = [header, ...lines].map((l) => l.map(csvEscape).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `meetspace-tasks-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const mapped = useMemo(() => {
    if (!rows?.length) return []
    const header = rows[0].map((h) => h.trim().toLowerCase())
    const col = (...names: string[]) => header.findIndex((h) => names.includes(h))
    const c = { title: col('title', 'name', 'task', 'task name'), desc: col('description', 'details', 'notes'), status: col('status'), pri: col('priority'), due: col('due date', 'due', 'deadline'), start: col('start date', 'start'), tags: col('tags', 'labels'), pts: col('story points', 'points'), who: col('assignees', 'assignee', 'owner') }
    const list = s.lists.find((l) => l.id === listId)
    const space = s.spaces.find((sp) => sp.id === list?.spaceId)
    const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}/.test(v.trim()) ? v.trim().slice(0, 10) : v && !isNaN(Date.parse(v)) ? new Date(v).toISOString().slice(0, 10) : null)
    return rows.slice(1).map((row): Partial<Task> => ({
      title: c.title >= 0 ? row[c.title] : row[0],
      description: c.desc >= 0 && row[c.desc] ? `<p>${row[c.desc].replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>` : '',
      statusId: (c.status >= 0 && space?.statuses.find((st) => st.name.toLowerCase() === row[c.status]?.trim().toLowerCase())?.id) || undefined,
      priority: c.pri >= 0 && ['urgent', 'high', 'normal', 'low'].includes(row[c.pri]?.trim().toLowerCase()) ? (row[c.pri].trim().toLowerCase() as Priority) : null,
      dueDate: c.due >= 0 ? date(row[c.due]) : null,
      startDate: c.start >= 0 ? date(row[c.start]) : null,
      tags: c.tags >= 0 && row[c.tags] ? row[c.tags].split(/[;,]/).map((x) => x.trim().toLowerCase()).filter(Boolean) : [],
      points: c.pts >= 0 && row[c.pts] && !isNaN(Number(row[c.pts])) ? Number(row[c.pts]) : null,
      assignees: c.who >= 0 && row[c.who] ? (row[c.who].split(/[;,]/).map((n) => s.users.find((u) => u.name.toLowerCase() === n.trim().toLowerCase())?.id).filter(Boolean) as string[]) : [],
    }))
  }, [rows, listId, s.lists, s.spaces, s.users])

  return (
    <div className="space-y-6">
      <section className="border-app rounded-xl border p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Download size={16} /> Export
        </h2>
        <p className="text-muted mb-3 text-sm">Download every task in this workspace as a CSV file (opens in Excel, Sheets or Numbers).</p>
        <button onClick={exportCsv} className="bg-brand-600 rounded-lg px-4 py-1.5 text-sm font-semibold text-white">
          Export {s.tasks.length} tasks
        </button>
      </section>
      <section className="border-app rounded-xl border p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <FileUp size={16} /> Import from CSV
        </h2>
        <p className="text-muted mb-3 text-sm">The first row must be headers. Recognised columns: Title/Name, Description, Status, Priority, Due date, Start date, Tags, Story points, Assignees.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              setResult(null)
              setRows(f ? parseCsv(await f.text()) : null)
            }}
            className="text-sm"
          />
          <span className="text-muted text-sm">into</span>
          <select value={listId} onChange={(e) => setListId(e.target.value)} className="border-app surface rounded-md border px-2 py-1 text-sm">
            {s.lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        {rows && (
          <div className="mt-3">
            <p className="text-sm">
              Found <b>{mapped.filter((m) => m.title?.trim()).length}</b> tasks. Preview:
            </p>
            <ul className="text-muted mt-1 list-disc pl-5 text-sm">
              {mapped.slice(0, 5).map((m, i) => (
                <li key={i}>
                  {m.title || <em>(no title — skipped)</em>}
                  {m.dueDate && ` · due ${m.dueDate}`}
                  {m.priority && ` · ${m.priority}`}
                </li>
              ))}
            </ul>
            <button
              onClick={() => {
                const n = s.importTasks(listId, mapped)
                setResult(`Imported ${n} tasks into ${s.lists.find((l) => l.id === listId)?.name}.`)
                setRows(null)
              }}
              className="bg-brand-600 mt-3 rounded-lg px-4 py-1.5 text-sm font-semibold text-white"
            >
              Import
            </button>
          </div>
        )}
        {result && <p className="mt-3 text-sm text-emerald-600">{result}</p>}
      </section>
    </div>
  )
}

function Notifications() {
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied')
  return (
    <section className="border-app max-w-lg rounded-xl border p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Bell size={16} /> Desktop notifications
      </h2>
      <p className="text-muted mb-3 text-sm">Get a system notification when a reminder is due, even if Meetspace is in a background tab.</p>
      {perm === 'granted' ? (
        <p className="text-sm text-emerald-600">Enabled for this browser.</p>
      ) : perm === 'denied' ? (
        <p className="text-muted text-sm">Blocked — allow notifications for this site in your browser settings.</p>
      ) : (
        <button onClick={async () => setPerm(await Notification.requestPermission())} className="bg-brand-600 rounded-lg px-4 py-1.5 text-sm font-semibold text-white">
          Enable notifications
        </button>
      )}
    </section>
  )
}
