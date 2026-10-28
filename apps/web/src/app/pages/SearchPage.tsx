import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, subDays } from 'date-fns'
import { Bookmark, BookmarkPlus, Loader2, Search, Trash2, X } from 'lucide-react'
import { api } from '../../api/client'
import { useStore } from '../../store/useStore'
import { Avatar } from '../components/ui'
import { cn, timeAgo, toISODate } from '../../lib/utils'
import { useQueryState } from '../../lib/useQueryState'
import { TYPE_META, routeForHit, type DocType, type Hit, type Results } from '../CommandPalette'

interface Saved {
  id: string
  name: string
  query: Record<string, string>
}

const TABS: (DocType | 'all')[] = ['all', 'task', 'doc', 'message', 'comment', 'clip', 'meeting', 'goal', 'whiteboard', 'form', 'list', 'project', 'channel']
const WHEN = [
  { key: '', label: 'Any time' },
  { key: '1', label: 'Today' },
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 3 months' },
]
const FILTER_KEYS = ['q', 'type', 'author', 'space', 'when', 'sort'] as const

/** Search everything in the workspace with filters, and keep searches to run again. */
export default function SearchPage() {
  const s = useStore()
  const nav = useNavigate()
  const ws = s.currentWorkspaceId!
  const [q, setQ] = useQueryState<string>('q', '')
  const [type, setType] = useQueryState<string>('type', 'all')
  const [author, setAuthor] = useQueryState<string>('author', '')
  const [space, setSpace] = useQueryState<string>('space', '')
  const [when, setWhen] = useQueryState<string>('when', '')
  const [sort, setSort] = useQueryState<string>('sort', 'relevance')
  const [draft, setDraft] = useState(q)
  const [res, setRes] = useState<Results | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Saved[]>([])

  useEffect(() => setDraft(q), [q])
  useEffect(() => {
    api.get<Saved[]>(`/workspaces/${ws}/search/saved`).then(setSaved, () => setSaved([]))
  }, [ws])

  // A Space filter covers the Space itself, its Lists and folders.
  const parents = useMemo(() => (space ? [space, ...s.lists.filter((l) => l.spaceId === space).map((l) => l.id), ...s.folders.filter((f) => f.spaceId === space).map((f) => f.id)] : []), [space, s.lists, s.folders])

  useEffect(() => {
    if (q.trim().length < 2) {
      setRes(null)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    const p = new URLSearchParams({ q: q.trim(), sort: sort === 'recent' ? 'recent' : 'relevance', limit: '50' })
    if (type !== 'all') p.set('type', type)
    if (author) p.set('author', author)
    if (parents.length) p.set('in', parents.join(','))
    if (when) p.set('from', toISODate(subDays(new Date(), Number(when) - 1)))
    api
      .get<Results>(`/workspaces/${ws}/search?${p}`, { signal: ctrl.signal })
      .then((r) => (setRes(r), setError(null)))
      .catch((e) => e.name !== 'AbortError' && setError(e instanceof Error ? e.message : 'Search is unavailable'))
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [ws, q, type, author, parents, when, sort])

  const current = { q, type, author, space, when, sort }
  const apply = (query: Record<string, string>) => {
    const p = new URLSearchParams()
    for (const k of FILTER_KEYS) if (query[k] && !(k === 'type' && query[k] === 'all') && !(k === 'sort' && query[k] === 'relevance')) p.set(k, query[k])
    nav(`/app/search?${p}`)
  }
  const save = async () => {
    const name = prompt('Name this search', q.trim())
    if (!name?.trim()) return
    try {
      const r = await api.raw<Saved>('POST', `/workspaces/${ws}/search/saved`, { body: { name: name.trim(), query: current } })
      setSaved((xs) => [...xs, r])
      s.toast('Search saved')
    } catch (e) {
      s.toast(e instanceof Error ? e.message : 'Could not save', 'error')
    }
  }
  const remove = async (id: string) => {
    await api.raw('DELETE', `/workspaces/${ws}/search/saved/${id}`).catch(() => {})
    setSaved((xs) => xs.filter((x) => x.id !== id))
  }

  const context = (h: Hit) => {
    const list = s.lists.find((l) => l.id === h.parent)
    if (list) return `${s.spaces.find((x) => x.id === list.spaceId)?.name ?? ''} / ${list.name}`
    const ch = s.channels.find((c) => c.id === h.parent)
    if (ch) return ch.kind === 'dm' ? 'Direct message' : `#${ch.name}`
    const task = s.tasks.find((t) => t.id === h.parent)
    if (task) return `on ${task.title}`
    return s.spaces.find((x) => x.id === h.parent)?.name ?? ''
  }
  const sel = 'border-app surface h-8 rounded-md border px-2 text-sm'
  const filtered = !!(author || space || when || type !== 'all')

  return (
    <div className="flex h-full min-h-0">
      <aside className="border-app surface-subtle hidden w-56 shrink-0 flex-col border-r p-3 md:flex">
        <div className="text-faint mb-2 text-[11px] font-semibold tracking-wide uppercase">Saved searches</div>
        {saved.length === 0 && <p className="text-faint text-xs">Run a search and save it to come back to it.</p>}
        {saved.map((x) => (
          <div key={x.id} className="group hover-surface flex items-center rounded-md">
            <button onClick={() => apply(x.query)} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm">
              <Bookmark size={13} className="text-brand-600 shrink-0" />
              <span className="truncate">{x.name}</span>
            </button>
            <button onClick={() => void remove(x.id)} className="text-faint mr-1 rounded p-1 opacity-0 group-hover:opacity-100 hover:text-red-500" aria-label={`Delete ${x.name}`}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="border-app space-y-3 border-b px-4 py-3">
          <form onSubmit={(e) => (e.preventDefault(), setQ(draft.trim()))} className="border-app focus-within:border-brand-500 flex h-10 items-center gap-2 rounded-lg border px-3">
            <Search size={16} className="text-faint" />
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search tasks, docs, messages, comments…" className="min-w-0 flex-1 bg-transparent outline-none" aria-label="Search" />
            {loading && <Loader2 size={15} className="text-faint animate-spin" />}
            {q && (
              <button type="button" onClick={() => (setDraft(''), setQ(''))} className="text-faint hover:text-app" aria-label="Clear">
                <X size={15} />
              </button>
            )}
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <select value={author} onChange={(e) => setAuthor(e.target.value)} className={sel} aria-label="Created by">
              <option value="">Anyone</option>
              {s.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <select value={space} onChange={(e) => setSpace(e.target.value)} className={sel} aria-label="In">
              <option value="">Everywhere</option>
              {s.spaces.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <select value={when} onChange={(e) => setWhen(e.target.value)} className={sel} aria-label="Updated">
              {WHEN.map((w) => (
                <option key={w.key} value={w.key}>
                  {w.label}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={sel} aria-label="Sort">
              <option value="relevance">Best match</option>
              <option value="recent">Most recent</option>
            </select>
            {filtered && (
              <button onClick={() => apply({ q })} className="text-muted hover:text-app text-xs font-medium">
                Clear filters
              </button>
            )}
            {q.trim().length >= 2 && (
              <button onClick={() => void save()} className="border-app hover-surface ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium">
                <BookmarkPlus size={14} /> Save search
              </button>
            )}
          </div>
          {res && (
            <div className="flex gap-1 overflow-x-auto">
              {TABS.filter((t) => t === 'all' || res.counts[t] || t === type).map((t) => {
                const n = t === 'all' ? Object.values(res.counts).reduce((a, b) => a + b, 0) : (res.counts[t] ?? 0)
                return (
                  <button key={t} onClick={() => setType(t)} className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-medium', type === t ? 'bg-brand-600 text-white' : 'text-muted hover-surface')}>
                    {t === 'all' ? 'All' : TYPE_META[t].label + 's'} <span className="opacity-70">{n}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          {error && <p className="m-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
          {!q && (
            <div className="text-muted flex flex-col items-center gap-2 p-16 text-center text-sm">
              <Search size={28} className="text-faint" />
              Search every task, doc, message, comment, clip and more. Narrow by person, Space or date, and save searches you run often.
            </div>
          )}
          {res && res.hits.length === 0 && !loading && <p className="text-muted p-10 text-center text-sm">Nothing matches “{q}”{filtered && ' with these filters'}.</p>}
          {res?.hits.map((h) => {
            const meta = TYPE_META[h.type]
            const authorId = (h as Hit & { author?: string }).author
            return (
              <button key={`${h.type}:${h.entity_id}`} onClick={() => nav(routeForHit(h))} className="border-app hover-surface flex w-full items-start gap-3 border-b px-4 py-3 text-left">
                <span className="surface-muted text-muted mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                  <meta.icon size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    {h.key && <span className="text-faint shrink-0 font-mono text-xs">{h.key}</span>}
                    <span className="truncate text-sm font-medium">{h.title || 'Untitled'}</span>
                  </span>
                  {h.snippet && <span className="text-muted mt-0.5 line-clamp-2 block text-[13px] [&_mark]:rounded-sm [&_mark]:bg-amber-200/70 [&_mark]:px-px dark:[&_mark]:bg-amber-500/40" dangerouslySetInnerHTML={{ __html: h.snippet }} />}
                  <span className="text-faint mt-1 flex items-center gap-1.5 text-[11px]">
                    {meta.label}
                    {context(h) && <> · {context(h)}</>}
                    {authorId && (
                      <>
                        {' '}
                        · <Avatar userId={authorId} size={14} /> {s.users.find((u) => u.id === authorId)?.name.split(' ')[0]}
                      </>
                    )}
                    {h.updated_at && <> · {timeAgo(h.updated_at)}</>}
                  </span>
                </span>
                <span className="text-faint hidden shrink-0 text-[11px] sm:block">{h.updated_at && format(parseISO(h.updated_at), 'MMM d')}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
