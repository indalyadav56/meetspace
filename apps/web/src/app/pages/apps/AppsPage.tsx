import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ArrowLeft, Check, Copy, ExternalLink, Eye, EyeOff, Github, KeyRound, LayoutGrid, Lock, Mail, RefreshCw, Search, Sparkles, Video, Webhook } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import { integrations, type GitHubRepo } from '../../../api/integrations'
import { useQueryState } from '../../../lib/useQueryState'
import { errorText } from '../ai/agentsStore'
import { APPS, CATEGORIES, useIntegrations, type AppInfo } from './catalog'
import { cn } from '../../../lib/utils'

const ICON: Record<AppInfo['key'], ReactNode> = {
  github: <Github size={22} />,
  email: <Mail size={22} />,
  meetings: <Video size={22} />,
  ai: <Sparkles size={22} />,
}

function useIsAdmin() {
  return useStore((s) => {
    const role = s.workspaces.find((w) => w.id === s.currentWorkspaceId)?.members.find((m) => m.userId === s.currentUserId)?.role
    return role === 'owner' || role === 'admin'
  })
}

/** App Center: integrations that work today, with GitHub set up per workspace. */
export default function AppsPage() {
  const [category] = useQueryState<string>('category', 'all')
  const [app, setApp] = useQueryState<string>('app', '')
  const ws = useStore((s) => s.currentWorkspaceId)
  const { status, workspaceId, load } = useIntegrations()
  const [q, setQ] = useState('')
  useEffect(() => {
    if (ws && workspaceId !== ws) void load(ws).catch(() => {})
  }, [ws, workspaceId, load])

  const shown = APPS.filter((a) => {
    const on = !!status?.[a.key]?.connected
    const inCat = category === 'all' || (category === 'connected' ? on : category === 'available' ? !on : a.category === category)
    return inCat && (a.name + a.tagline).toLowerCase().includes(q.toLowerCase())
  })
  const title = category === 'connected' ? 'Connected' : category === 'available' ? 'Not connected' : (CATEGORIES.find((c) => c.key === category)?.label ?? 'All apps')

  if (app === 'github') return <GitHubDetail onBack={() => setApp('')} />
  const server = APPS.find((a) => a.key === app)
  if (server) return <ServerDetail app={server} onBack={() => setApp('')} />

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-5xl p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <LayoutGrid size={20} className="text-brand-600" />
          <h1 className="text-2xl font-bold">{title}</h1>
          <div className="border-app surface ml-auto flex h-9 w-full items-center gap-2 rounded-lg border px-3 sm:w-64">
            <Search size={15} className="text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search apps" className="flex-1 bg-transparent text-sm outline-none" aria-label="Search apps" />
          </div>
        </div>
        <p className="text-muted mt-1 text-sm">Connect the tools your team already uses. Only integrations that work today are listed.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {shown.map((a) => {
            const on = !!status?.[a.key]?.connected
            return (
              <button key={a.key} onClick={() => setApp(a.key)} className="surface border-app hover:border-brand-300 flex items-start gap-4 rounded-xl border p-4 text-left transition-colors">
                <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', a.key === 'github' ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200')}>{ICON[a.key]}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold">
                    {a.name}
                    <StatusPill on={on} />
                  </span>
                  <span className="text-muted mt-0.5 block text-sm">{a.tagline}</span>
                  <span className="text-faint mt-2 block text-xs">{a.connectable ? 'Connect per workspace' : 'Set up on the server by an admin'}</span>
                </span>
              </button>
            )
          })}
          {shown.length === 0 && <p className="text-muted col-span-full py-10 text-center text-sm">No apps match.</p>}
        </div>
      </div>
    </div>
  )
}

function StatusPill({ on }: { on: boolean }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', on ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'surface-muted text-muted')}>
      {on ? 'Connected' : 'Not connected'}
    </span>
  )
}

function DetailShell({ icon, name, on, onBack, children }: { icon: ReactNode; name: string; on: boolean; onBack: () => void; children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-3xl p-5 sm:p-8">
        <button onClick={onBack} className="text-muted hover:text-app mb-4 inline-flex items-center gap-1 text-sm">
          <ArrowLeft size={15} /> All apps
        </button>
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 text-white dark:bg-white dark:text-stone-900">{icon}</span>
          <div>
            <h1 className="text-2xl font-bold">{name}</h1>
            <StatusPill on={on} />
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function ServerDetail({ app, onBack }: { app: AppInfo; onBack: () => void }) {
  const st = useIntegrations((s) => s.status?.[app.key])
  const how: Record<string, string> = {
    email: 'Set APP_RESEND_API_KEY (and optionally APP_RESEND_FROM) in apps/backend/.env, then restart the backend.',
    meetings: 'Run the bundled livekit-server and set APP_LIVEKIT_API_KEY / APP_LIVEKIT_API_SECRET for the backend.',
    ai: 'Set APP_AI_GEMINI_API_KEY for the backend. Without it the assistant runs in offline mode.',
  }
  return (
    <DetailShell icon={ICON[app.key]} name={app.name} on={!!st?.connected} onBack={onBack}>
      <p className="text-muted mt-4">{app.tagline}</p>
      <div className="border-app surface-subtle mt-6 rounded-xl border p-4 text-sm">
        <div className="font-semibold">{st?.connected ? 'Configured on this server' : 'Not configured yet'}</div>
        {st?.connected && 'provider' in st && <p className="text-muted mt-1">Provider: {st.provider}{'model' in st && st.model ? ` · ${st.model}` : ''}</p>}
        <p className="text-muted mt-2">{how[app.key]}</p>
      </div>
    </DetailShell>
  )
}

function Copyable({ value, secret }: { value: string; secret?: boolean }) {
  const [shown, setShown] = useState(!secret)
  const [copied, setCopied] = useState(false)
  return (
    <div className="border-app surface flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-xs">
      <span className="min-w-0 flex-1 truncate">{shown ? value : '•'.repeat(Math.min(32, value.length))}</span>
      {secret && (
        <button onClick={() => setShown((x) => !x)} className="text-muted hover:text-app" aria-label={shown ? 'Hide' : 'Reveal'}>
          {shown ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      )}
      <button
        onClick={() => {
          void navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="text-muted hover:text-app"
        aria-label="Copy"
      >
        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
      </button>
    </div>
  )
}

function GitHubDetail({ onBack }: { onBack: () => void }) {
  const { status, setStatus } = useIntegrations()
  const gh = status?.github
  const isAdmin = useIsAdmin()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [hook, setHook] = useState<{ path: string; secret: string; events: string[] } | null>(null)

  useEffect(() => {
    if (!gh?.connected) return
    setPicked(gh.repos ?? [])
    integrations.repos().then(setRepos, (e) => setError(errorText(e)))
    if (isAdmin) integrations.webhook().then(setHook, () => {})
  }, [gh?.connected, gh?.account])

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    setError(null)
    setNote(null)
    try {
      await fn()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const visible = useMemo(() => (repos ?? []).filter((r) => r.fullName.toLowerCase().includes(filter.toLowerCase())), [repos, filter])
  const dirty = JSON.stringify([...picked].sort()) !== JSON.stringify([...(gh?.repos ?? [])].sort())

  return (
    <DetailShell icon={<Github size={28} />} name="GitHub" on={!!gh?.connected} onBack={onBack}>
      <p className="text-muted mt-4">Link pull requests, issues and commits to tasks. Anything that mentions a task key like <code className="surface-muted rounded px-1">MS-123</code> in its title, description, branch name or commit message is linked automatically, and the task’s activity shows when a pull request is opened, merged or closed.</p>
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-200">{error}</p>}
      {note && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">{note}</p>}

      {!gh?.connected ? (
        <section className="border-app mt-6 rounded-xl border p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <KeyRound size={16} /> Connect with a personal access token
          </h2>
          <ol className="text-muted mt-3 list-decimal space-y-1 pl-5 text-sm">
            <li>
              On GitHub, open{' '}
              <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer" className="text-brand-700 dark:text-brand-300 inline-flex items-center gap-0.5 font-medium hover:underline">
                Fine-grained tokens <ExternalLink size={12} />
              </a>{' '}
              and create a token.
            </li>
            <li>Choose the repositories Meetspace may read.</li>
            <li>Grant read-only access to Contents, Issues, Pull requests and Metadata.</li>
            <li>Paste the token below. It’s encrypted before it’s stored.</li>
          </ol>
          {isAdmin ? (
            <form
              className="mt-4 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault()
                void run('connect', async () => {
                  setStatus(await integrations.connectGitHub(token))
                  setToken('')
                })
              }}
            >
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" autoComplete="off" className="border-app surface focus:border-brand-500 h-10 flex-1 rounded-lg border px-3 font-mono text-sm outline-none" aria-label="GitHub token" />
              <button disabled={!token.trim() || !!busy} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-stone-900">
                <Github size={16} /> {busy === 'connect' ? 'Connecting…' : 'Connect GitHub'}
              </button>
            </form>
          ) : (
            <p className="text-muted mt-4 flex items-center gap-2 text-sm">
              <Lock size={14} /> Ask a workspace owner or admin to connect GitHub.
            </p>
          )}
        </section>
      ) : (
        <>
          <section className="border-app mt-6 flex items-center gap-3 rounded-xl border p-4">
            {gh.avatar && <img src={gh.avatar} alt="" className="h-10 w-10 rounded-full" />}
            <div className="min-w-0">
              <div className="font-semibold">@{gh.account}</div>
              <div className="text-muted text-xs">{gh.lastSyncedAt ? `Last synced ${formatDistanceToNow(parseISO(gh.lastSyncedAt))} ago` : 'Not synced yet'} · syncs every 10 minutes</div>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                disabled={!!busy || !(gh.repos ?? []).length}
                onClick={() =>
                  void run('sync', async () => {
                    const r = await integrations.sync()
                    setNote(r.linked ? `Linked ${r.linked} item${r.linked === 1 ? '' : 's'} to tasks.` : 'Up to date — nothing new mentions a task key.')
                    setStatus(await integrations.status())
                  })
                }
                className="border-app hover-surface inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium disabled:opacity-50"
                title={(gh.repos ?? []).length ? 'Scan watched repositories now' : 'Choose repositories first'}
              >
                <RefreshCw size={14} className={busy === 'sync' ? 'animate-spin' : ''} /> Sync now
              </button>
              {isAdmin && (
                <button
                  disabled={!!busy}
                  onClick={() =>
                    confirm('Disconnect GitHub? Existing links stay on tasks.') &&
                    void run('disconnect', async () => {
                      await integrations.disconnectGitHub()
                      setStatus(await integrations.status())
                    })
                  }
                  className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  Disconnect
                </button>
              )}
            </div>
          </section>

          <section className="border-app mt-4 rounded-xl border p-4">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Watched repositories</h2>
              <span className="text-muted text-sm">{picked.length} selected</span>
              {isAdmin && dirty && (
                <button
                  disabled={!!busy}
                  onClick={() => void run('repos', async () => setStatus(await integrations.setRepos(picked)))}
                  className="bg-brand-600 hover:bg-brand-700 ml-auto h-8 rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy === 'repos' ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
            <p className="text-muted mt-1 text-sm">Pull requests and commits in these repositories are scanned for task keys.</p>
            <div className="border-app surface mt-3 flex h-9 items-center gap-2 rounded-lg border px-3">
              <Search size={14} className="text-faint" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter repositories" className="flex-1 bg-transparent text-sm outline-none" aria-label="Filter repositories" />
            </div>
            <div className="mt-2 max-h-72 overflow-y-auto scroll-thin">
              {repos === null && !error && <p className="text-muted py-3 text-sm">Loading repositories…</p>}
              {visible.map((r) => {
                const on = picked.includes(r.fullName)
                return (
                  <label key={r.fullName} className="hover-surface flex h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm">
                    <input type="checkbox" disabled={!isAdmin} checked={on} onChange={() => setPicked((p) => (on ? p.filter((x) => x !== r.fullName) : [...p, r.fullName]))} className="accent-brand-600 h-3.5 w-3.5" />
                    <span className="truncate">{r.fullName}</span>
                    {r.private && <Lock size={12} className="text-faint" />}
                  </label>
                )
              })}
              {repos && visible.length === 0 && <p className="text-muted py-3 text-sm">No repositories match.</p>}
            </div>
          </section>

          {isAdmin && hook && (
            <section className="border-app mt-4 rounded-xl border p-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <Webhook size={16} /> Instant updates (optional)
              </h2>
              <p className="text-muted mt-1 text-sm">Add a webhook to each repository (Settings → Webhooks) so links appear the moment a pull request or push happens. Without it, Meetspace catches up on its regular sync.</p>
              <div className="mt-3 grid gap-2 text-sm">
                <label className="text-muted text-xs font-medium">Payload URL</label>
                <Copyable value={window.location.origin + hook.path} />
                <label className="text-muted text-xs font-medium">Secret</label>
                <Copyable value={hook.secret} secret />
                <p className="text-faint text-xs">Content type: application/json · Events: {hook.events.join(', ')}. GitHub must be able to reach this server’s URL.</p>
              </div>
            </section>
          )}
        </>
      )}
    </DetailShell>
  )
}
