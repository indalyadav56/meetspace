import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Download, Search, ShieldAlert } from 'lucide-react'
import { API_BASE, api, ensureFreshToken } from '../../../api/client'
import { useStore } from '../../../store/useStore'
import { Avatar } from '../../components/ui'
import { cn } from '../../../lib/utils'
import { EVENT_LABEL, deviceName } from './Security'

interface AuditEvent {
  id: string
  workspaceId: string | null
  actorId: string | null
  action: string
  route?: string
  entityType?: string
  entityId?: string
  summary?: string
  meta?: { fields?: string[]; method?: string }
  ip?: string
  userAgent?: string
  createdAt: string
}

const VERB_TONE: Record<string, string> = {
  created: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  updated: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  deleted: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  purge: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
}

/** "task.updated" → "Updated task"; "auth.login_failed" → "Login failed". */
function label(action: string) {
  if (EVENT_LABEL[action]) return EVENT_LABEL[action]
  const [entity, ...rest] = action.split('.')
  const verb = rest.join(' ').replace(/_/g, ' ')
  if (entity === 'auth') return verb.charAt(0).toUpperCase() + verb.slice(1)
  return `${verb.charAt(0).toUpperCase()}${verb.slice(1)} ${entity.replace(/_/g, ' ')}`
}

/** Owners and admins: every change in the workspace and members' sign-ins. */
export default function AuditLog() {
  const s = useStore()
  const ws = s.currentWorkspaceId!
  const [rows, setRows] = useState<AuditEvent[]>([])
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actions, setActions] = useState<string[]>([])
  const [f, setF] = useState({ actor: '', action: '', q: '', from: '', to: '', security: true })

  const query = useCallback(
    (before?: string) => {
      const p = new URLSearchParams({ limit: '100', security: f.security ? '1' : '0' })
      for (const k of ['actor', 'action', 'q', 'from', 'to'] as const) if (f[k]) p.set(k, f[k])
      if (before) p.set('before', before)
      return p
    },
    [f],
  )
  const load = useCallback(
    async (more = false) => {
      setLoading(true)
      setError(null)
      try {
        const page = await api.get<AuditEvent[]>(`/workspaces/${ws}/audit?${query(more ? rows[rows.length - 1]?.id : undefined)}`)
        setRows((r) => (more ? [...r, ...page] : page))
        setDone(page.length < 100)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the audit log')
      } finally {
        setLoading(false)
      }
    },
    [ws, query], // rows only matters for the cursor when loading more
  )
  useEffect(() => {
    const t = setTimeout(() => void load(), f.q ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, f.q])
  useEffect(() => {
    api.get<string[]>(`/workspaces/${ws}/audit/actions`).then(setActions, () => setActions([]))
  }, [ws])

  const exportCsv = async () => {
    const token = await ensureFreshToken()
    const res = await fetch(`${API_BASE}/workspaces/${ws}/audit/export?${query()}`, { headers: { Authorization: `Bearer ${token}` } })
    const url = URL.createObjectURL(await res.blob())
    const a = Object.assign(document.createElement('a'), { href: url, download: `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv` })
    a.click()
    URL.revokeObjectURL(url)
  }

  const groups = [...new Set(actions.map((a) => a.split('.')[0]))].sort()
  const sel = 'border-app surface h-8 rounded-md border px-2 text-sm'
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="font-semibold">Audit log</h2>
          <p className="text-muted text-sm">Every change in this workspace and your members’ sign-ins. Kept for 365 days.</p>
        </div>
        <button onClick={() => void exportCsv()} className="border-app hover-surface inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium">
          <Download size={14} /> Export CSV
        </button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="border-app flex h-8 flex-1 items-center gap-2 rounded-md border px-2">
          <Search size={14} className="text-faint" />
          <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search names, actions, IPs" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </div>
        <select value={f.actor} onChange={(e) => setF({ ...f, actor: e.target.value })} className={sel} aria-label="Person">
          <option value="">Anyone</option>
          {s.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} className={sel} aria-label="Action">
          <option value="">All actions</option>
          <option value="auth.">Sign-ins & security</option>
          {groups
            .filter((g) => g !== 'auth')
            .map((g) => (
              <optgroup key={g} label={g.replace(/_/g, ' ')}>
                <option value={`${g}.`}>Any {g.replace(/_/g, ' ')} change</option>
                {actions
                  .filter((a) => a.startsWith(`${g}.`))
                  .map((a) => (
                    <option key={a} value={a}>
                      {label(a)}
                    </option>
                  ))}
              </optgroup>
            ))}
        </select>
        <input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={sel} aria-label="From" />
        <input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={sel} aria-label="To" />
        <label className="text-muted flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={f.security} onChange={(e) => setF({ ...f, security: e.target.checked })} className="accent-brand-600" /> Include sign-ins
        </label>
      </div>
      {error && (
        <p className="mb-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <ShieldAlert size={15} /> {error}
        </p>
      )}
      <div className="border-app overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-faint border-app border-b text-left text-xs">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Who</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">From</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const verb = e.action.split('.').pop() ?? ''
              const user = s.users.find((u) => u.id === e.actorId)
              return (
                <tr key={e.id} className="border-app hover-surface border-b last:border-b-0" title={e.route}>
                  <td className="text-muted px-3 py-2 text-xs whitespace-nowrap">{format(parseISO(e.createdAt), 'MMM d, HH:mm:ss')}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      {e.actorId && <Avatar userId={e.actorId} size={18} />}
                      <span className="truncate">{user?.name ?? (e.actorId ? 'Former member' : 'System')}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', VERB_TONE[verb] ?? (e.action.includes('failed') ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'surface-muted'))}>{label(e.action)}</span>
                  </td>
                  <td className="max-w-72 px-3 py-2">
                    <span className="block truncate">{e.summary || (e.meta?.method ? String(e.meta.method) : <span className="text-faint">—</span>)}</span>
                    {e.meta?.fields && e.meta.fields.length > 0 && <span className="text-faint block truncate text-[11px]">changed {e.meta.fields.join(', ')}</span>}
                  </td>
                  <td className="text-muted px-3 py-2 text-xs">
                    <span className="block">{e.ip || '—'}</span>
                    <span className="text-faint block truncate">{deviceName(e.userAgent ?? '')}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!loading && rows.length === 0 && !error && <p className="text-muted px-4 py-10 text-center text-sm">No events match these filters.</p>}
      </div>
      <div className="mt-3 flex items-center justify-center">
        {loading ? (
          <span className="text-muted text-sm">Loading…</span>
        ) : (
          !done &&
          rows.length > 0 && (
            <button onClick={() => void load(true)} className="border-app hover-surface rounded-md border px-3 py-1.5 text-sm font-medium">
              Load older events
            </button>
          )
        )}
      </div>
    </section>
  )
}
