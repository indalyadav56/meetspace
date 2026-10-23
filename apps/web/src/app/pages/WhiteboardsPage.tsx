import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Copy, ExternalLink, LayoutGrid, Link2, List as ListIcon, MoreHorizontal, Pencil, PenTool, Plus, Search, Star, Trash2 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { BoardItem, Whiteboard } from '../../store/types'
import { Avatar, MenuItem, Popover, usePopover } from '../components/ui'
import { cn, timeAgo } from '../../lib/utils'
import { ItemShape, bounds } from '../whiteboard/shapes'
import { BOARD_TEMPLATES, cloneItems, type BoardTemplate } from '../whiteboard/templates'
import { BoardEditor } from '../whiteboard/BoardEditor'
import { viewedTimes } from '../whiteboard/viewed'

export default function WhiteboardsPage() {
  const { boardId } = useParams()
  const board = useStore((s) => s.whiteboards.find((w) => w.id === boardId))
  return board ? <BoardEditor key={board.id} board={board} /> : <BoardIndex />
}

function Thumb({ items }: { items: BoardItem[] }) {
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  if (!items.length) return <div className="text-faint flex h-full items-center justify-center text-xs">Empty board</div>
  const find = (id: string) => byId.get(id)
  const bs = items.map((i) => bounds(i, find))
  const minX = Math.min(...bs.map((b) => b.x)) - 20
  const minY = Math.min(...bs.map((b) => b.y)) - 20
  const w = Math.max(...bs.map((b) => b.x + b.w)) - minX + 20
  const h = Math.max(...bs.map((b) => b.y + b.h)) - minY + 20
  const ordered = [...items.filter((i) => i.kind === 'frame'), ...items.filter((i) => i.kind !== 'frame')]
  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      {ordered.map((i) => (
        <ItemShape key={i.id} item={i} find={find} static />
      ))}
    </svg>
  )
}

type SortKey = 'title' | 'updated' | 'created' | 'viewed'
const SORTS: Record<SortKey, string> = { title: 'Name', updated: 'Date updated', created: 'Date created', viewed: 'Date viewed' }

const pref = (k: string, v?: string) => {
  try {
    if (v === undefined) return localStorage.getItem(`ms.boards.${k}`)
    localStorage.setItem(`ms.boards.${k}`, v)
  } catch {
    /* storage blocked */
  }
  return null
}

function useBoardActions() {
  const { addWhiteboard, updateWhiteboard, deleteWhiteboard } = useStore()
  const nav = useNavigate()
  return {
    create: (t?: BoardTemplate) => {
      const id = addWhiteboard()
      if (t) updateWhiteboard(id, { title: t.title, items: cloneItems(t.items(), 0, 0) })
      nav(`/app/whiteboards/${id}`)
    },
    duplicate: (w: Whiteboard) => {
      const copy = addWhiteboard()
      updateWhiteboard(copy, { title: `${w.title} (copy)`, items: cloneItems(w.items, 0, 0, (i) => w.items.find((x) => x.id === i)) })
    },
    rename: (w: Whiteboard) => {
      const t = prompt('Rename whiteboard', w.title)
      if (t?.trim()) updateWhiteboard(w.id, { title: t.trim() })
    },
    remove: (w: Whiteboard) => confirm(`Delete “${w.title}”?`) && deleteWhiteboard(w.id),
    copyLink: (w: Whiteboard) => void navigator.clipboard.writeText(`${location.origin}/app/whiteboards/${w.id}`),
  }
}

function RowMenu({ w }: { w: Whiteboard }) {
  const pop = usePopover()
  const nav = useNavigate()
  const a = useBoardActions()
  const act = (fn: () => void) => () => (fn(), pop.close())
  return (
    <>
      <button onClick={pop.toggle} className="text-faint hover:text-app rounded p-1" aria-label={`Actions for ${w.title}`}>
        <MoreHorizontal size={16} />
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} align="end" width={190}>
        <MenuItem onClick={act(() => nav(`/app/whiteboards/${w.id}`))}>
          <ExternalLink size={14} /> Open
        </MenuItem>
        <MenuItem onClick={act(() => a.rename(w))}>
          <Pencil size={14} /> Rename
        </MenuItem>
        <MenuItem onClick={act(() => a.duplicate(w))}>
          <Copy size={14} /> Duplicate
        </MenuItem>
        <MenuItem onClick={act(() => a.copyLink(w))}>
          <Link2 size={14} /> Copy link
        </MenuItem>
        <div className="border-app my-1 border-t" />
        <MenuItem danger onClick={act(() => a.remove(w))}>
          <Trash2 size={14} /> Delete
        </MenuItem>
      </Popover>
    </>
  )
}

function BoardIndex() {
  const { whiteboards, favorites, toggleFavorite, currentUserId } = useStore()
  const [params] = useSearchParams()
  const mine = params.get('mine') === '1'
  const a = useBoardActions()
  const [q, setQ] = useState('')
  const [sort, setSortState] = useState<SortKey>(() => (pref('sort') as SortKey) || 'updated')
  const [desc, setDesc] = useState(() => pref('desc') !== '0')
  const [view, setViewState] = useState<'table' | 'grid'>(() => (pref('view') === 'grid' ? 'grid' : 'table'))
  const [copied, setCopied] = useState<string | null>(null)
  const sortPop = usePopover()
  const newPop = usePopover()
  const viewed = useMemo(() => viewedTimes(), [])

  const setSort = (k: SortKey) => {
    const d = sort === k ? !desc : k !== 'title'
    setSortState(k)
    setDesc(d)
    pref('sort', k)
    pref('desc', d ? '1' : '0')
  }
  const setView = (v: 'table' | 'grid') => (setViewState(v), pref('view', v))

  const shown = useMemo(() => {
    const needle = q.toLowerCase()
    const value = (w: Whiteboard) => (sort === 'title' ? w.title.toLowerCase() : sort === 'updated' ? w.updatedAt : sort === 'created' ? (w.createdAt ?? '') : (viewed[w.id] ?? ''))
    return whiteboards
      .filter((w) => !mine || w.createdBy === currentUserId)
      .filter((w) => !needle || w.title.toLowerCase().includes(needle) || w.items.some((i) => i.text.toLowerCase().includes(needle)))
      .sort((x, y) => (desc ? -1 : 1) * value(x).localeCompare(value(y)))
  }, [whiteboards, mine, currentUserId, q, sort, desc, viewed])

  const head = (k: SortKey, className?: string) => (
    <button onClick={() => setSort(k)} className={cn('inline-flex items-center gap-1 text-left hover:text-[var(--text)]', sort === k && 'text-brand-600', className)}>
      {SORTS[k]}
      {sort === k && (desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
    </button>
  )
  const when = (iso?: string) => (iso ? timeAgo(iso) : '—')

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <PenTool size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">{mine ? 'My whiteboards' : 'All whiteboards'}</h1>
          <div className="ml-auto flex">
            <button onClick={() => a.create()} className="bg-brand-600 hover:bg-brand-700 inline-flex h-8 items-center gap-1 rounded-l-md px-3 text-sm font-semibold text-white">
              <Plus size={15} /> New whiteboard
            </button>
            <button onClick={newPop.toggle} className="bg-brand-600 hover:bg-brand-700 border-brand-700 inline-flex h-8 items-center rounded-r-md border-l px-1.5 text-white" aria-label="New whiteboard from a template">
              <ChevronDown size={15} />
            </button>
            <Popover open={newPop.open} anchor={newPop.anchor} onClose={newPop.close} align="end" width={250}>
              <MenuItem onClick={() => (a.create(), newPop.close())}>
                <Plus size={14} /> Blank whiteboard
              </MenuItem>
              <div className="text-faint px-2 pt-2 pb-1 text-[11px] font-semibold uppercase">From a template</div>
              {BOARD_TEMPLATES.map((t) => (
                <MenuItem key={t.key} onClick={() => (a.create(t), newPop.close())}>
                  <span>{t.emoji}</span> {t.title}
                </MenuItem>
              ))}
            </Popover>
          </div>
        </div>

        <section className="mb-6">
          <h2 className="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">Templates</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {BOARD_TEMPLATES.map((t) => (
              <button key={t.key} onClick={() => a.create(t)} className="border-app surface-subtle hover:border-brand-500 flex items-center gap-3 rounded-xl border p-3 text-left">
                <span className="surface border-app flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-xl">{t.emoji}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{t.title}</span>
                  <span className="text-faint block truncate text-xs">{t.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button onClick={sortPop.toggle} className="border-app hover-surface inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium">
            <ArrowUpDown size={13} /> Sort: {SORTS[sort]}
          </button>
          <Popover open={sortPop.open} anchor={sortPop.anchor} onClose={sortPop.close} width={180}>
            {(Object.keys(SORTS) as SortKey[]).map((k) => (
              <MenuItem key={k} active={sort === k} onClick={() => (setSort(k), sortPop.close())}>
                {SORTS[k]}
              </MenuItem>
            ))}
          </Popover>
          <span className="text-faint text-xs">{shown.length} whiteboards</span>
          <div className="border-app ml-auto flex h-8 items-center gap-2 rounded-md border px-2">
            <Search size={14} className="text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search boards and stickies" className="w-44 bg-transparent text-sm outline-none" />
          </div>
          <div className="border-app flex rounded-md border p-0.5">
            {(
              [
                ['table', ListIcon],
                ['grid', LayoutGrid],
              ] as const
            ).map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)} aria-label={`${v} view`} aria-pressed={view === v} className={cn('rounded p-1', view === v ? 'surface-muted text-app' : 'text-faint')}>
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>

        {view === 'table' ? (
          <div className="border-app overflow-x-auto rounded-xl border">
            <div className="min-w-[760px]">
              <div className="text-faint border-app grid grid-cols-[minmax(0,1fr)_110px_110px_110px_110px_70px_36px] items-center gap-2 border-b px-3 py-2 text-xs font-medium">
                {head('title')}
                <span>Location</span>
                {head('updated')}
                {head('created')}
                {head('viewed')}
                <span>Creator</span>
                <span />
              </div>
              {shown.map((w) => {
                const fav = favorites.includes(w.id)
                return (
                  <div key={w.id} className="group border-app hover-surface grid grid-cols-[minmax(0,1fr)_110px_110px_110px_110px_70px_36px] items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <PenTool size={15} className="text-brand-600 shrink-0" />
                      <Link to={`/app/whiteboards/${w.id}`} className="truncate font-medium hover:underline">
                        {w.title || 'Untitled whiteboard'}
                      </Link>
                      <span className={cn('flex shrink-0 items-center gap-0.5', !fav && 'opacity-0 group-hover:opacity-100')}>
                        <button
                          onClick={() => {
                            a.copyLink(w)
                            setCopied(w.id)
                            setTimeout(() => setCopied(null), 1200)
                          }}
                          className="text-faint hover:text-app rounded p-1"
                          title={copied === w.id ? 'Copied!' : 'Copy link'}
                          aria-label="Copy link"
                        >
                          <Link2 size={13} className={cn(copied === w.id && 'text-emerald-500')} />
                        </button>
                        <button onClick={() => toggleFavorite(w.id)} className="rounded p-1" title={fav ? 'Remove from favorites' : 'Add to favorites'} aria-label="Toggle favorite">
                          <Star size={13} className={fav ? 'fill-amber-400 text-amber-400' : 'text-faint'} />
                        </button>
                        <button onClick={() => a.rename(w)} className="text-faint hover:text-app rounded p-1" title="Rename" aria-label="Rename">
                          <Pencil size={13} />
                        </button>
                      </span>
                    </div>
                    <span className="text-muted truncate text-xs">Workspace</span>
                    <span className="text-muted text-xs">{when(w.updatedAt)}</span>
                    <span className="text-muted text-xs">{when(w.createdAt)}</span>
                    <span className="text-muted text-xs">{when(viewed[w.id])}</span>
                    <Avatar userId={w.createdBy} size={22} />
                    <RowMenu w={w} />
                  </div>
                )
              })}
              {shown.length === 0 && <p className="text-muted py-12 text-center text-sm">{q ? 'No whiteboards match.' : mine ? 'You haven’t created a whiteboard yet.' : 'No whiteboards yet.'}</p>}
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((w) => (
                <div key={w.id} className="group border-app hover:border-brand-500 relative overflow-hidden rounded-xl border transition-colors">
                  <Link to={`/app/whiteboards/${w.id}`} className="block">
                    <div className="surface-subtle h-40 p-3" style={{ backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '14px 14px' }}>
                      <Thumb items={w.items} />
                    </div>
                    <div className="flex items-center gap-2 p-3">
                      <Avatar userId={w.createdBy} size={20} />
                      <span className="truncate text-sm font-semibold">{w.title}</span>
                      {favorites.includes(w.id) && <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" />}
                      <span className="text-faint ml-auto shrink-0 text-xs">{timeAgo(w.updatedAt)}</span>
                    </div>
                  </Link>
                  <div className="surface absolute top-2 right-2 hidden rounded-md shadow group-hover:block">
                    <RowMenu w={w} />
                  </div>
                </div>
              ))}
            </div>
            {shown.length === 0 && <p className="text-muted py-16 text-center text-sm">{q ? 'No whiteboards match.' : 'No whiteboards yet.'}</p>}
          </>
        )}
      </div>
    </div>
  )
}
