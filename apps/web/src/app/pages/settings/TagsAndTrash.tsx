import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckSquare, ExternalLink, FileText, Merge, Pencil, PenTool, RotateCcw, Search, Trash2 } from 'lucide-react'
import { api } from '../../../api/client'
import { useStore } from '../../../store/useStore'
import { Avatar, Tag } from '../../components/ui'
import { cn, timeAgo } from '../../../lib/utils'

const ws = () => `/workspaces/${useStore.getState().currentWorkspaceId}`

/** Every tag in the workspace with how many tasks use it; rename, merge or remove them everywhere at once. */
export function TagManager() {
  const s = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const tags = useMemo(() => {
    const m = new Map<string, number>()
    s.tasks.forEach((t) => t.tags.forEach((g) => m.set(g, (m.get(g) ?? 0) + 1)))
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [s.tasks])
  const shown = tags.filter(([g]) => g.includes(q.toLowerCase()))

  /** Replace `from` with `to` (or drop it when `to` is null) on every task. */
  const retag = (from: string, to: string | null) => {
    for (const t of s.tasks) {
      if (!t.tags.includes(from)) continue
      const next = [...new Set(t.tags.map((g) => (g === from ? to : g)).filter((g): g is string => !!g))]
      s.updateTask(t.id, { tags: next })
    }
  }
  const rename = (from: string) => {
    const to = draft.trim().toLowerCase().replace(/\s+/g, '-')
    setEditing(null)
    if (!to || to === from) return
    if (tags.some(([g]) => g === to) && !confirm(`“${to}” already exists. Merge “${from}” into it?`)) return
    retag(from, to)
    s.toast(`Renamed #${from} to #${to}`)
  }
  const showTasks = (tag: string) => {
    s.setFilters({ tags: [tag] })
    nav('/app/everything')
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div>
          <h2 className="font-semibold">Tag manager</h2>
          <p className="text-muted text-sm">
            {tags.length} tags across {s.tasks.filter((t) => t.tags.length).length} tasks. Rename or delete a tag to change it on every task.
          </p>
        </div>
        <div className="border-app ml-auto flex h-8 items-center gap-2 rounded-md border px-2">
          <Search size={14} className="text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a tag" className="w-36 bg-transparent text-sm outline-none" />
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="border-app text-muted rounded-xl border border-dashed px-4 py-10 text-center text-sm">{tags.length ? 'No tags match.' : 'No tags yet. Add tags to tasks and they show up here.'}</p>
      ) : (
        <div className="border-app overflow-hidden rounded-xl border">
          {shown.map(([g, n]) => (
            <div key={g} className="border-app hover-surface group flex items-center gap-3 border-b px-4 py-2 text-sm last:border-b-0">
              {editing === g ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => rename(g)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setEditing(null)
                  }}
                  className="border-brand-500 w-48 rounded border bg-transparent px-1.5 py-0.5 text-sm outline-none"
                  aria-label={`New name for ${g}`}
                />
              ) : (
                <Tag name={g} />
              )}
              <button onClick={() => showTasks(g)} className="text-muted hover:text-app inline-flex items-center gap-1 text-xs">
                {n} task{n === 1 ? '' : 's'} <ExternalLink size={11} />
              </button>
              <span className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                <button onClick={() => (setEditing(g), setDraft(g))} className="hover-surface text-muted rounded p-1" title="Rename" aria-label={`Rename ${g}`}>
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => {
                    const into = prompt(`Merge “${g}” into which tag?`, tags.find(([x]) => x !== g)?.[0] ?? '')
                    const to = into?.trim().toLowerCase()
                    if (to && to !== g) (retag(g, to), s.toast(`Merged #${g} into #${to}`))
                  }}
                  className="hover-surface text-muted rounded p-1"
                  title="Merge into another tag"
                  aria-label={`Merge ${g}`}
                >
                  <Merge size={14} />
                </button>
                <button onClick={() => confirm(`Remove #${g} from ${n} task${n === 1 ? '' : 's'}?`) && (retag(g, null), s.toast(`Deleted #${g}`))} className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" title="Delete tag" aria-label={`Delete ${g}`}>
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

interface TrashRow {
  kind: 'task' | 'doc' | 'whiteboard'
  id: string
  title: string
  emoji?: string
  key?: number
  listId?: string
  subtasks?: number
  deletedAt: string
  deletedBy: string
}

/** Deleted tasks, docs and whiteboards; restore them or delete them for good. */
export function Trash() {
  const s = useStore()
  const [rows, setRows] = useState<TrashRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<'all' | TrashRow['kind']>('all')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [tasks, docs] = await Promise.all([
        api.raw<Omit<TrashRow, 'kind'>[]>('GET', `${ws()}/trash/tasks`),
        api.raw<TrashRow[]>('GET', `${ws()}/trash/docs`),
      ])
      setRows([...tasks.map((t) => ({ ...t, kind: 'task' as const })), ...docs].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the trash')
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const path = (r: TrashRow) => (r.kind === 'task' ? `${ws()}/tasks/${r.id}` : `${ws()}/trash/${r.kind}/${r.id}`)
  const restore = async (r: TrashRow) => {
    setBusy(r.id)
    try {
      await api.raw('POST', r.kind === 'task' ? `${path(r)}/restore` : `${path(r)}/restore`)
      setRows((xs) => (xs ?? []).filter((x) => x.id !== r.id))
      s.toast(`Restored “${r.title || 'Untitled'}”`)
    } catch (e) {
      s.toast(e instanceof Error ? e.message : 'Could not restore', 'error')
    } finally {
      setBusy(null)
    }
  }
  const purge = async (list: TrashRow[]) => {
    for (const r of list) {
      await api.raw('DELETE', r.kind === 'task' ? `${path(r)}/purge` : path(r)).catch(() => {})
    }
    setRows((xs) => (xs ?? []).filter((x) => !list.some((r) => r.id === x.id)))
  }
  const shown = (rows ?? []).filter((r) => kind === 'all' || r.kind === kind)
  const icon = (r: TrashRow) => (r.kind === 'task' ? <CheckSquare size={15} className="text-muted" /> : r.kind === 'whiteboard' ? <PenTool size={15} className="text-muted" /> : r.emoji ? <span className="w-[15px] text-center">{r.emoji}</span> : <FileText size={15} className="text-muted" />)

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div>
          <h2 className="font-semibold">Trash</h2>
          <p className="text-muted text-sm">Deleted tasks, docs and whiteboards wait here until you restore them or delete them for good.</p>
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="border-app surface ml-auto h-8 rounded-md border px-2 text-sm" aria-label="Show">
          <option value="all">Everything</option>
          <option value="task">Tasks</option>
          <option value="doc">Docs</option>
          <option value="whiteboard">Whiteboards</option>
        </select>
        {shown.length > 0 && (
          <button onClick={() => confirm(`Permanently delete ${shown.length} item${shown.length === 1 ? '' : 's'}? This can't be undone.`) && void purge(shown)} className="border-app inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
            <Trash2 size={14} /> Empty {kind === 'all' ? 'trash' : `${kind}s`}
          </button>
        )}
      </div>
      {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      {rows === null && !error ? (
        <p className="text-muted px-2 py-6 text-sm">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="border-app text-muted rounded-xl border border-dashed px-4 py-10 text-center text-sm">Trash is empty.</p>
      ) : (
        <div className="border-app overflow-hidden rounded-xl border">
          {shown.map((r) => (
            <div key={`${r.kind}-${r.id}`} className="border-app flex items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
              {icon(r)}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {r.kind === 'task' && <span className="text-faint mr-1.5 font-mono text-xs">MS-{r.key}</span>}
                  {r.title || 'Untitled'}
                </span>
                <span className="text-muted flex items-center gap-1 text-xs">
                  <span className="capitalize">{r.kind}</span>
                  {r.kind === 'task' && r.listId && <> · {s.lists.find((l) => l.id === r.listId)?.name ?? 'deleted list'}</>}
                  {!!r.subtasks && <> · {r.subtasks} subtask{r.subtasks === 1 ? '' : 's'}</>} · deleted {timeAgo(r.deletedAt)}
                  {r.deletedBy && (
                    <>
                      {' '}
                      by <Avatar userId={r.deletedBy} size={14} /> {s.users.find((u) => u.id === r.deletedBy)?.name.split(' ')[0]}
                    </>
                  )}
                </span>
              </span>
              <button disabled={busy === r.id} onClick={() => void restore(r)} className={cn('bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50')}>
                <RotateCcw size={12} /> Restore
              </button>
              <button onClick={() => confirm(`Permanently delete “${r.title || 'Untitled'}”?`) && void purge([r])} className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" title="Delete forever" aria-label="Delete forever">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
