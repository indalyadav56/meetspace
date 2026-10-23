import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addDays, format, parseISO } from 'date-fns'
import { ArrowDown, ArrowUp, Bookmark, CheckSquare, ExternalLink, FileText, Folder as FolderIcon, List as ListIcon, Plus, Settings2, Trash2, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { ID, Space, Task } from '../../store/types'
import { useTaskResolver } from '../hooks'
import { Avatar, Popover, StatusPill, usePopover } from '../components/ui'
import { cn, timeAgo } from '../../lib/utils'

type CardKey = 'recent' | 'docs' | 'bookmarks' | 'lists' | 'folders' | 'status' | 'workload' | 'due'
const CARDS: Record<CardKey, string> = {
  recent: 'Recent',
  docs: 'Docs',
  bookmarks: 'Bookmarks',
  lists: 'Lists',
  folders: 'Folders',
  status: 'Status',
  workload: 'Workload',
  due: 'Due soon',
}
const DEFAULT_ORDER: CardKey[] = ['recent', 'docs', 'bookmarks', 'status', 'workload', 'due', 'lists', 'folders']

interface BookmarkItem {
  id: string
  title: string
  url: string
}

function useLocal<T>(key: string, fallback: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  })
  const set = (next: T) => {
    setV(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* storage blocked */
    }
  }
  return [v, set] as const
}

function Card({ title, action, children, wide }: { title: string; action?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <section className={cn('border-app surface flex min-h-56 flex-col rounded-xl border', wide && 'lg:col-span-3')}>
      <header className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="ml-auto">{action}</div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 scroll-thin">{children}</div>
    </section>
  )
}

function Empty({ icon: Icon, text, action }: { icon: typeof FileText; text: string; action?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
      <span className="surface-muted text-muted flex h-11 w-11 items-center justify-center rounded-xl">
        <Icon size={20} />
      </span>
      <p className="text-muted max-w-56 text-xs">{text}</p>
      {action}
    </div>
  )
}

const btn = 'bg-brand-600 hover:bg-brand-700 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white'
const rowCls = 'hover-surface flex items-center gap-2 rounded-md px-2 py-1.5 text-sm'

/** ClickUp-style Space overview: cards you can show, hide and reorder. */
export default function SpaceOverview({ space }: { space: Space }) {
  const s = useStore()
  const nav = useNavigate()
  const r = useTaskResolver()
  const [order, setOrder] = useLocal<CardKey[]>(`ms.space.cards.${space.id}`, DEFAULT_ORDER)
  const [bookmarks, setBookmarks] = useLocal<BookmarkItem[]>(`ms.space.bookmarks.${space.id}`, [])
  const [draft, setDraft] = useState<{ title: string; url: string } | null>(null)
  const settings = usePopover()

  const lists = s.lists.filter((l) => l.spaceId === space.id)
  const listIds = new Set(lists.map((l) => l.id))
  const tasks = useMemo(() => s.tasks.filter((t) => listIds.has(t.listId) && !t.parentId), [s.tasks, lists]) // eslint-disable-line react-hooks/exhaustive-deps
  const open = tasks.filter((t) => !r.isDone(t))
  const docs = s.docs.filter((d) => d.spaceId === space.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const folders = s.folders.filter((f) => f.spaceId === space.id)
  const today = format(new Date(), 'yyyy-MM-dd')
  const overdue = open.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < today)
  const week = format(addDays(new Date(), 7), 'yyyy-MM-dd')
  const dueSoon = open.filter((t) => t.dueDate && t.dueDate.slice(0, 10) >= today && t.dueDate.slice(0, 10) <= week).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))

  const recent = s.recents
    .map((id): { id: ID; label: string; to: string; icon: typeof ListIcon } | null => {
      const l = lists.find((x) => x.id === id)
      if (l) return { id, label: l.name, to: `/app/list/${l.id}`, icon: ListIcon }
      const d = docs.find((x) => x.id === id)
      if (d) return { id, label: d.title || 'Untitled', to: `/app/docs/${d.id}`, icon: FileText }
      const t = tasks.find((x) => x.id === id)
      if (t) return { id, label: t.title, to: `/app/t/${t.id}`, icon: CheckSquare }
      return null
    })
    .filter((x) => !!x)
  // Fall back to the latest-edited things in the space when nothing was opened yet.
  const recentRows = recent.length ? recent : [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6).map((t) => ({ id: t.id, label: t.title, to: `/app/t/${t.id}`, icon: CheckSquare }))

  const byStatus = space.statuses.map((st) => ({ st, n: tasks.filter((t) => t.statusId === st.id).length }))
  const workload = useMemo(() => {
    const m = new Map<ID, Task[]>()
    open.forEach((t) => (t.assignees.length ? t.assignees : ['']).forEach((a) => m.set(a, [...(m.get(a) ?? []), t])))
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [open])
  const maxLoad = Math.max(1, ...workload.map(([, ts]) => ts.length))

  const addBookmark = () => {
    if (!draft) return
    let url = draft.url.trim()
    if (!url) return
    if (!/^(https?:)?\/\//.test(url) && !url.startsWith('/')) url = `https://${url}`
    setBookmarks([...bookmarks, { id: crypto.randomUUID(), title: draft.title.trim() || url.replace(/^https?:\/\//, ''), url }])
    setDraft(null)
  }

  const cards: Record<CardKey, ReactNode> = {
    recent: (
      <Card title="Recent">
        {recentRows.length ? (
          recentRows.map((x) => (
            <Link key={x.id} to={x.to} className={rowCls}>
              <x.icon size={15} className="text-muted shrink-0" />
              <span className="truncate">{x.label}</span>
              <span className="text-faint shrink-0 text-xs">· in {space.name}</span>
            </Link>
          ))
        ) : (
          <Empty icon={ListIcon} text="Things you open in this space show up here." />
        )}
      </Card>
    ),
    docs: (
      <Card title="Docs" action={docs.length > 0 && <button onClick={() => nav(`/app/docs/${s.addDoc(space.id)}`)} className="text-muted hover:text-app" aria-label="Add a doc"><Plus size={15} /></button>}>
        {docs.length ? (
          docs.slice(0, 8).map((d) => (
            <Link key={d.id} to={`/app/docs/${d.id}`} className={rowCls}>
              <span className="w-5 text-center">{d.emoji}</span>
              <span className="truncate">{d.title || 'Untitled'}</span>
              <span className="text-faint ml-auto shrink-0 text-xs">{timeAgo(d.updatedAt)}</span>
            </Link>
          ))
        ) : (
          <Empty
            icon={FileText}
            text="There are no Docs in this space yet."
            action={
              <button onClick={() => nav(`/app/docs/${s.addDoc(space.id)}`)} className={btn}>
                Add a Doc
              </button>
            }
          />
        )}
      </Card>
    ),
    bookmarks: (
      <Card title="Bookmarks" action={bookmarks.length > 0 && !draft && <button onClick={() => setDraft({ title: '', url: '' })} className="text-muted hover:text-app" aria-label="Add a bookmark"><Plus size={15} /></button>}>
        {draft && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              addBookmark()
            }}
            className="mx-2 mb-2 space-y-1.5"
          >
            <input autoFocus value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="Paste a link (https://… or /app/…)" className="border-app surface-subtle w-full rounded-md border px-2 py-1 text-sm outline-none" />
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Name (optional)" className="border-app surface-subtle w-full rounded-md border px-2 py-1 text-sm outline-none" />
            <div className="flex gap-2">
              <button className={btn} disabled={!draft.url.trim()}>
                Save
              </button>
              <button type="button" onClick={() => setDraft(null)} className="text-muted text-xs hover:underline">
                Cancel
              </button>
            </div>
          </form>
        )}
        {bookmarks.map((b) => {
          const internal = b.url.startsWith('/')
          return (
            <div key={b.id} className={cn(rowCls, 'group')}>
              <Bookmark size={14} className="text-muted shrink-0" />
              {internal ? (
                <Link to={b.url} className="min-w-0 flex-1 truncate">
                  {b.title}
                </Link>
              ) : (
                <a href={b.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate">
                  {b.title}
                </a>
              )}
              {!internal && <ExternalLink size={12} className="text-faint shrink-0" />}
              <button onClick={() => setBookmarks(bookmarks.filter((x) => x.id !== b.id))} className="text-faint hidden shrink-0 group-hover:block" aria-label={`Remove ${b.title}`}>
                <X size={13} />
              </button>
            </div>
          )
        })}
        {!bookmarks.length && !draft && (
          <Empty
            icon={Bookmark}
            text="Bookmarks keep links to items or any page on the web one click away."
            action={
              <button onClick={() => setDraft({ title: '', url: '' })} className={btn}>
                Add Bookmark
              </button>
            }
          />
        )}
      </Card>
    ),
    lists: (
      <Card
        title="Lists"
        wide
        action={
          <button
            onClick={() => {
              const n = prompt('New List name')
              if (n?.trim()) nav(`/app/list/${s.addList(space.id, null, n.trim())}`)
            }}
            className="text-muted hover:text-app"
            aria-label="Add a list"
          >
            <Plus size={15} />
          </button>
        }
      >
        {lists.length ? (
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((l) => {
              const ts = tasks.filter((t) => t.listId === l.id)
              const done = ts.filter((t) => r.isDone(t)).length
              const folder = folders.find((f) => f.id === l.folderId)
              return (
                <Link key={l.id} to={`/app/list/${l.id}`} className={cn(rowCls, 'flex-col items-stretch')}>
                  <span className="flex items-center gap-2">
                    <ListIcon size={14} className="text-muted" />
                    <span className="truncate font-medium">{l.name}</span>
                    {folder && <span className="text-faint truncate text-xs">in {folder.name}</span>}
                    <span className="text-faint ml-auto text-xs">
                      {done}/{ts.length}
                    </span>
                  </span>
                  <span className="surface-muted mt-1 block h-1.5 overflow-hidden rounded-full">
                    <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${ts.length ? (done / ts.length) * 100 : 0}%` }} />
                  </span>
                </Link>
              )
            })}
          </div>
        ) : (
          <Empty icon={ListIcon} text="This space has no Lists yet." />
        )}
      </Card>
    ),
    folders: (
      <Card title="Folders" wide action={folders.length > 0 && <button onClick={() => { const n = prompt('New folder name'); if (n?.trim()) s.addFolder(space.id, n.trim()) }} className="text-muted hover:text-app" aria-label="Add a folder"><Plus size={15} /></button>}>
        {folders.length ? (
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
            {folders.map((f) => {
              const inside = lists.filter((l) => l.folderId === f.id)
              return (
                <div key={f.id} className={cn(rowCls, 'items-start')}>
                  <FolderIcon size={15} className="text-muted mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{f.name}</span>
                    <span className="text-faint block truncate text-xs">{inside.length ? inside.map((l) => l.name).join(', ') : 'No lists'}</span>
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <Empty
            icon={FolderIcon}
            text="Add a Folder to group related Lists."
            action={
              <button
                onClick={() => {
                  const n = prompt('New folder name')
                  if (n?.trim()) s.addFolder(space.id, n.trim())
                }}
                className={btn}
              >
                Add Folder
              </button>
            }
          />
        )}
      </Card>
    ),
    status: (
      <Card title="Status">
        {tasks.length ? (
          <div className="px-2">
            <div className="mb-3 flex h-3 overflow-hidden rounded-full">
              {byStatus.map(({ st, n }) => n > 0 && <span key={st.id} title={`${st.name}: ${n}`} style={{ width: `${(n / tasks.length) * 100}%`, background: st.color }} />)}
            </div>
            {byStatus.map(({ st, n }) => (
              <div key={st.id} className="flex items-center gap-2 py-1 text-sm">
                <StatusPill status={st} size="xs" />
                <span className="text-muted ml-auto tabular-nums">{n}</span>
              </div>
            ))}
          </div>
        ) : (
          <Empty icon={CheckSquare} text="No tasks in this space yet." />
        )}
      </Card>
    ),
    workload: (
      <Card title="Workload">
        {workload.length ? (
          workload.map(([uid, ts]) => (
            <div key={uid || 'none'} className="flex items-center gap-2 px-2 py-1.5 text-sm">
              {uid ? <Avatar userId={uid} size={22} /> : <span className="surface-muted h-[22px] w-[22px] rounded-full" />}
              <span className="w-28 truncate">{uid ? s.users.find((u) => u.id === uid)?.name : 'Unassigned'}</span>
              <span className="surface-muted h-2 flex-1 overflow-hidden rounded-full">
                <span className="bg-brand-600 block h-full rounded-full" style={{ width: `${(ts.length / maxLoad) * 100}%` }} />
              </span>
              <span className="text-muted w-6 text-right text-xs tabular-nums">{ts.length}</span>
            </div>
          ))
        ) : (
          <Empty icon={CheckSquare} text="Nothing open — everyone’s clear." />
        )}
      </Card>
    ),
    due: (
      <Card title={`Due soon${overdue.length ? ` · ${overdue.length} overdue` : ''}`}>
        {[...overdue, ...dueSoon].length ? (
          [...overdue, ...dueSoon].slice(0, 10).map((t) => (
            <button key={t.id} onClick={() => s.openTask(t.id)} className={cn(rowCls, 'w-full text-left')}>
              <span className="truncate">{t.title}</span>
              <span className={cn('ml-auto shrink-0 text-xs', t.dueDate!.slice(0, 10) < today ? 'text-red-500' : 'text-muted')}>{format(parseISO(t.dueDate!), 'MMM d')}</span>
            </button>
          ))
        ) : (
          <Empty icon={CheckSquare} text="Nothing due in the next 7 days." />
        )}
      </Card>
    ),
  }

  const hidden = DEFAULT_ORDER.filter((k) => !order.includes(k))
  const move = (k: CardKey, d: -1 | 1) => {
    const i = order.indexOf(k)
    const j = i + d
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
  }

  return (
    <div className="h-full overflow-y-auto px-4 pb-10 scroll-thin">
      <div className="flex flex-wrap items-center gap-3 py-3">
        {[
          ['Tasks', tasks.length],
          ['Open', open.length],
          ['Done', tasks.length - open.length],
          ['Overdue', overdue.length],
          ['Docs', docs.length],
        ].map(([label, n]) => (
          <div key={label} className="border-app surface rounded-lg border px-3 py-1.5">
            <div className="text-faint text-[11px] uppercase">{label}</div>
            <div className={cn('text-lg font-semibold tabular-nums', label === 'Overdue' && Number(n) > 0 && 'text-red-500')}>{n}</div>
          </div>
        ))}
        <button onClick={settings.toggle} className="border-app hover-surface ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium">
          <Settings2 size={14} /> Customize
        </button>
        <Popover open={settings.open} anchor={settings.anchor} onClose={settings.close} align="end" width={230}>
          <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">Cards</div>
          {order.map((k, i) => (
            <div key={k} className="hover-surface flex items-center gap-1 rounded-md px-2 py-1 text-sm">
              <span className="flex-1">{CARDS[k]}</span>
              <button onClick={() => move(k, -1)} disabled={i === 0} className="text-faint hover:text-app disabled:opacity-30" aria-label={`Move ${CARDS[k]} up`}>
                <ArrowUp size={13} />
              </button>
              <button onClick={() => move(k, 1)} disabled={i === order.length - 1} className="text-faint hover:text-app disabled:opacity-30" aria-label={`Move ${CARDS[k]} down`}>
                <ArrowDown size={13} />
              </button>
              <button onClick={() => setOrder(order.filter((x) => x !== k))} className="text-faint hover:text-red-500" aria-label={`Hide ${CARDS[k]}`}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {hidden.length > 0 && (
            <>
              <div className="text-faint mt-1 px-2 py-1 text-[11px] font-semibold uppercase">Add a card</div>
              {hidden.map((k) => (
                <button key={k} onClick={() => setOrder([...order, k])} className="hover-surface flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm">
                  <Plus size={13} /> {CARDS[k]}
                </button>
              ))}
            </>
          )}
          <div className="border-app my-1 border-t" />
          <button onClick={() => setOrder(DEFAULT_ORDER)} className="text-muted hover-surface w-full rounded-md px-2 py-1 text-left text-xs">
            Reset layout
          </button>
        </Popover>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {order.map((k) => (
          <div key={k} className={cn('contents')}>
            {cards[k]}
          </div>
        ))}
      </div>
    </div>
  )
}
