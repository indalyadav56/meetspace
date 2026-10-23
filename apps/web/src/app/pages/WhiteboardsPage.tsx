import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckSquare,
  Circle,
  Copy,
  Hand,
  Maximize,
  Minus,
  MousePointer2,
  Pencil,
  Plus,
  PenTool,
  Redo2,
  Square,
  StickyNote,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { BoardItem, BoardItemKind, Whiteboard } from '../../store/types'
import { Avatar, MenuItem, Popover, usePopover } from '../components/ui'
import { cn, timeAgo, uid } from '../../lib/utils'

const NOTE_COLORS = ['#fde68a', '#bbf7d0', '#bae6fd', '#fbcfe8', '#ddd6fe', '#fecaca', '#e0e7ff', '#ffffff']
const INK_COLORS = ['#1f2128', '#4f46e5', '#14b8a6', '#ef4444', '#f59e0b', '#64748b']

export default function WhiteboardsPage() {
  const { boardId } = useParams()
  const board = useStore((s) => s.whiteboards.find((w) => w.id === boardId))
  return board ? <BoardEditor key={board.id} board={board} /> : <BoardIndex />
}

/* ---------------- Index ---------------- */

function Thumb({ items }: { items: BoardItem[] }) {
  if (!items.length) return <div className="text-faint flex h-full items-center justify-center text-xs">Empty board</div>
  const xs = items.flatMap((i) => (i.points ? i.points.map((p) => p[0]) : [i.x, i.x + i.w]))
  const ys = items.flatMap((i) => (i.points ? i.points.map((p) => p[1]) : [i.y, i.y + i.h]))
  const minX = Math.min(...xs) - 20
  const minY = Math.min(...ys) - 20
  const w = Math.max(...xs) - minX + 20
  const h = Math.max(...ys) - minY + 20
  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      {items.map((i) => (
        <ItemShape key={i.id} item={i} static />
      ))}
    </svg>
  )
}

function BoardIndex() {
  const { whiteboards, addWhiteboard, deleteWhiteboard } = useStore()
  const nav = useNavigate()
  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <PenTool size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">Whiteboards</h1>
          <button onClick={() => nav(`/app/whiteboards/${addWhiteboard()}`)} className="bg-brand-600 hover:bg-brand-700 ml-auto inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-semibold text-white">
            <Plus size={15} /> New whiteboard
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {whiteboards.map((w) => (
            <div key={w.id} className="group border-app hover:border-brand-500 relative overflow-hidden rounded-xl border transition-colors">
              <Link to={`/app/whiteboards/${w.id}`} className="block">
                <div className="surface-subtle h-40 p-3" style={{ backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '14px 14px' }}>
                  <Thumb items={w.items} />
                </div>
                <div className="flex items-center gap-2 p-3">
                  <Avatar userId={w.createdBy} size={20} />
                  <span className="truncate text-sm font-semibold">{w.title}</span>
                  <span className="text-faint ml-auto shrink-0 text-xs">{timeAgo(w.updatedAt)}</span>
                </div>
              </Link>
              <button
                onClick={() => confirm(`Delete “${w.title}”?`) && deleteWhiteboard(w.id)}
                className="surface absolute top-2 right-2 hidden rounded-md p-1.5 text-red-500 shadow group-hover:block"
                aria-label="Delete whiteboard"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Shapes ---------------- */

function darker(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.round(c * 0.72))
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`
}

function ItemShape({ item: i, static: isStatic, editing, onText }: { item: BoardItem; static?: boolean; editing?: boolean; onText?: (t: string) => void }) {
  const label = (align: 'center' | 'top-left', size = 14) =>
    editing && onText ? (
      <foreignObject x={i.x} y={i.y} width={i.w} height={i.h}>
        <textarea
          autoFocus
          defaultValue={i.text}
          onBlur={(e) => onText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="h-full w-full resize-none bg-transparent p-3 outline-none"
          style={{ fontSize: size, textAlign: align === 'center' ? 'center' : 'left', color: i.kind === 'text' ? i.color : '#1f2128', fontWeight: i.kind === 'text' ? 700 : 500 }}
        />
      </foreignObject>
    ) : (
      i.text && (
        <foreignObject x={i.x} y={i.y} width={i.w} height={i.h} style={{ pointerEvents: 'none' }}>
          <div
            className={cn('flex h-full w-full overflow-hidden p-3 leading-snug break-words', align === 'center' ? 'items-center justify-center text-center' : 'items-start')}
            style={{ fontSize: size, color: i.kind === 'text' ? i.color : '#1f2128', fontWeight: i.kind === 'text' ? 700 : 500 }}
          >
            {i.text}
          </div>
        </foreignObject>
      )
    )

  switch (i.kind) {
    case 'note':
      return (
        <g>
          <rect x={i.x + 2} y={i.y + 4} width={i.w} height={i.h} rx={6} fill="rgb(0 0 0 / 0.08)" />
          <rect x={i.x} y={i.y} width={i.w} height={i.h} rx={6} fill={i.color} />
          {label('top-left', 15)}
          {i.taskId && !isStatic && (
            <g transform={`translate(${i.x + i.w - 22}, ${i.y + 6})`}>
              <rect width={16} height={16} rx={4} fill="#4f46e5" />
              <path d="M4 8.5l2.5 2.5L12 5.5" stroke="#fff" strokeWidth={2} fill="none" />
            </g>
          )}
        </g>
      )
    case 'rect':
      return (
        <g>
          <rect x={i.x} y={i.y} width={i.w} height={i.h} rx={10} fill={i.color} stroke={darker(i.color)} strokeWidth={1.5} />
          {label('center')}
        </g>
      )
    case 'ellipse':
      return (
        <g>
          <ellipse cx={i.x + i.w / 2} cy={i.y + i.h / 2} rx={i.w / 2} ry={i.h / 2} fill={i.color} stroke={darker(i.color)} strokeWidth={1.5} />
          {label('center')}
        </g>
      )
    case 'text':
      return <g>{label('top-left', 22) || (!isStatic && <rect x={i.x} y={i.y} width={i.w} height={i.h} fill="transparent" />)}</g>
    case 'path':
      return <polyline points={(i.points ?? []).map((p) => p.join(',')).join(' ')} fill="none" stroke={i.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  }
}

function bounds(i: BoardItem) {
  if (i.kind === 'path' && i.points?.length) {
    const xs = i.points.map((p) => p[0])
    const ys = i.points.map((p) => p[1])
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
  }
  return { x: i.x, y: i.y, w: i.w, h: i.h }
}

/* ---------------- Editor ---------------- */

type Tool = 'select' | 'hand' | BoardItemKind
type Drag =
  | { type: 'pan'; sx: number; sy: number; px: number; py: number }
  | { type: 'move'; id: string; sx: number; sy: number; orig: BoardItem }
  | { type: 'resize'; id: string; sx: number; sy: number; orig: BoardItem }
  | { type: 'create'; id: string; ox: number; oy: number }
  | { type: 'draw'; id: string }

const TOOLS: { t: Tool; icon: typeof Square; label: string; key: string }[] = [
  { t: 'select', icon: MousePointer2, label: 'Select', key: 'v' },
  { t: 'hand', icon: Hand, label: 'Pan', key: 'h' },
  { t: 'note', icon: StickyNote, label: 'Sticky note', key: 'n' },
  { t: 'rect', icon: Square, label: 'Rectangle', key: 'r' },
  { t: 'ellipse', icon: Circle, label: 'Ellipse', key: 'o' },
  { t: 'text', icon: Type, label: 'Text', key: 't' },
  { t: 'path', icon: Pencil, label: 'Pen', key: 'p' },
]

function BoardEditor({ board }: { board: Whiteboard }) {
  const { setBoardItems, updateWhiteboard, lists, addTask, openTask } = useStore()
  const [items, setItems] = useState<BoardItem[]>(board.items)
  const [tool, setTool] = useState<Tool>('select')
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
  const [drag, setDrag] = useState<Drag | null>(null)
  const [past, setPast] = useState<BoardItem[][]>([])
  const [future, setFuture] = useState<BoardItem[][]>([])
  const svg = useRef<SVGSVGElement>(null)
  const taskPop = usePopover()

  /** Commit a new item list: push undo history and persist. */
  const commit = useCallback(
    (next: BoardItem[], prev: BoardItem[] = items) => {
      setPast((p) => [...p.slice(-49), prev])
      setFuture([])
      setItems(next)
      setBoardItems(board.id, next)
    },
    [items, board.id, setBoardItems],
  )
  const undo = () => {
    const prev = past[past.length - 1]
    if (!prev) return
    setPast((p) => p.slice(0, -1))
    setFuture((f) => [items, ...f])
    setItems(prev)
    setBoardItems(board.id, prev)
  }
  const redo = () => {
    const next = future[0]
    if (!next) return
    setFuture((f) => f.slice(1))
    setPast((p) => [...p, items])
    setItems(next)
    setBoardItems(board.id, next)
  }

  const world = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / view.zoom + view.x, y: (e.clientY - r.top) / view.zoom + view.y }
  }

  const sel = items.find((i) => i.id === selected)

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing || (e.target as HTMLElement).closest('input, textarea')) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') return e.preventDefault(), e.shiftKey ? redo() : undo()
      if (mod && e.key.toLowerCase() === 'd' && sel) {
        e.preventDefault()
        const copy = { ...sel, id: uid('b'), x: sel.x + 24, y: sel.y + 24, points: sel.points?.map(([x, y]) => [x + 24, y + 24] as [number, number]), taskId: null }
        commit([...items, copy])
        setSelected(copy.id)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        commit(items.filter((i) => i.id !== selected))
        setSelected(null)
        return
      }
      if (e.key === 'Escape') return setSelected(null), setTool('select')
      const t = TOOLS.find((x) => x.key === e.key.toLowerCase())
      if (t && !mod) setTool(t.t)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onBgDown = (e: React.PointerEvent) => {
    if (editing) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const p = world(e)
    if (tool === 'hand' || e.button === 1) {
      setDrag({ type: 'pan', sx: e.clientX, sy: e.clientY, px: view.x, py: view.y })
      return
    }
    if (tool === 'select') {
      setSelected(null)
      setDrag({ type: 'pan', sx: e.clientX, sy: e.clientY, px: view.x, py: view.y })
      return
    }
    const id = uid('b')
    const base = { id, x: p.x, y: p.y, w: 0, h: 0, text: '', taskId: null }
    if (tool === 'note') {
      commit([...items, { ...base, kind: 'note', x: p.x - 85, y: p.y - 65, w: 170, h: 130, color: NOTE_COLORS[0] }])
      setSelected(id)
      setEditing(id)
      setTool('select')
      return
    }
    if (tool === 'text') {
      commit([...items, { ...base, kind: 'text', w: 260, h: 44, color: INK_COLORS[0] }])
      setSelected(id)
      setEditing(id)
      setTool('select')
      return
    }
    if (tool === 'path') {
      setItems([...items, { ...base, kind: 'path', color: INK_COLORS[1], points: [[p.x, p.y]] }])
      setDrag({ type: 'draw', id })
      return
    }
    setItems([...items, { ...base, kind: tool, color: tool === 'rect' ? '#c7d2fe' : '#99f6e4' }])
    setDrag({ type: 'create', id, ox: p.x, oy: p.y })
  }

  const onItemDown = (e: React.PointerEvent, item: BoardItem) => {
    if (tool !== 'select' || editing === item.id) return
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setSelected(item.id)
    setDrag({ type: 'move', id: item.id, sx: e.clientX, sy: e.clientY, orig: item })
  }

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return
    if (drag.type === 'pan') {
      setView((v) => ({ ...v, x: drag.px - (e.clientX - drag.sx) / v.zoom, y: drag.py - (e.clientY - drag.sy) / v.zoom }))
      return
    }
    const p = world(e)
    setItems((cur) =>
      cur.map((i) => {
        if (i.id !== drag.id) return i
        if (drag.type === 'move') {
          const dx = (e.clientX - drag.sx) / view.zoom
          const dy = (e.clientY - drag.sy) / view.zoom
          return { ...i, x: drag.orig.x + dx, y: drag.orig.y + dy, points: drag.orig.points?.map(([x, y]) => [x + dx, y + dy] as [number, number]) }
        }
        if (drag.type === 'resize') {
          return { ...i, w: Math.max(40, drag.orig.w + (e.clientX - drag.sx) / view.zoom), h: Math.max(30, drag.orig.h + (e.clientY - drag.sy) / view.zoom) }
        }
        if (drag.type === 'create') {
          return { ...i, x: Math.min(drag.ox, p.x), y: Math.min(drag.oy, p.y), w: Math.abs(p.x - drag.ox), h: Math.abs(p.y - drag.oy) }
        }
        return { ...i, points: [...(i.points ?? []), [p.x, p.y] as [number, number]] }
      }),
    )
  }

  const onUp = () => {
    if (!drag) return
    const d = drag
    setDrag(null)
    if (d.type === 'pan') return
    const before = d.type === 'move' || d.type === 'resize' ? items.map((i) => (i.id === d.id ? d.orig : i)) : items.filter((i) => i.id !== d.id)
    let next = items
    if (d.type === 'create') {
      // a click without drag makes a default-sized shape
      next = items.map((i) => (i.id === d.id && i.w < 8 && i.h < 8 ? { ...i, x: i.x - 70, y: i.y - 45, w: 140, h: 90 } : i))
      setSelected(d.id)
      setTool('select')
    }
    if (d.type === 'draw') {
      const it = items.find((i) => i.id === d.id)
      if (!it || (it.points?.length ?? 0) < 2) next = items.filter((i) => i.id !== d.id)
    }
    if (d.type === 'move') {
      const it = items.find((i) => i.id === d.id)
      if (it && it.x === d.orig.x && it.y === d.orig.y) return // plain click
    }
    commit(next, before)
  }

  const onWheel = (e: React.WheelEvent) => {
    const r = svg.current!.getBoundingClientRect()
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.01)
      setView((v) => {
        const zoom = Math.min(3, Math.max(0.2, v.zoom * factor))
        const mx = (e.clientX - r.left) / v.zoom + v.x
        const my = (e.clientY - r.top) / v.zoom + v.y
        return { zoom, x: mx - (e.clientX - r.left) / zoom, y: my - (e.clientY - r.top) / zoom }
      })
    } else {
      setView((v) => ({ ...v, x: v.x + e.deltaX / v.zoom, y: v.y + e.deltaY / v.zoom }))
    }
  }

  const zoomBy = (f: number) => setView((v) => ({ ...v, zoom: Math.min(3, Math.max(0.2, v.zoom * f)) }))
  const fit = () => {
    if (!items.length || !svg.current) return setView({ x: 0, y: 0, zoom: 1 })
    const bs = items.map(bounds)
    const minX = Math.min(...bs.map((b) => b.x))
    const minY = Math.min(...bs.map((b) => b.y))
    const maxX = Math.max(...bs.map((b) => b.x + b.w))
    const maxY = Math.max(...bs.map((b) => b.y + b.h))
    const r = svg.current.getBoundingClientRect()
    const zoom = Math.min(2, Math.max(0.2, Math.min(r.width / (maxX - minX + 120), r.height / (maxY - minY + 120))))
    setView({ zoom, x: minX - (r.width / zoom - (maxX - minX)) / 2, y: minY - (r.height / zoom - (maxY - minY)) / 2 })
  }
  useEffect(() => {
    fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patchSel = (patch: Partial<BoardItem>) => sel && commit(items.map((i) => (i.id === sel.id ? { ...i, ...patch } : i)))
  const selBounds = sel ? bounds(sel) : null
  const cursor = tool === 'hand' || drag?.type === 'pan' ? (drag ? 'grabbing' : 'grab') : tool === 'select' ? 'default' : 'crosshair'

  return (
    <div className="flex h-full flex-col">
      <header className="border-app flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Link to="/app/whiteboards" className="hover-surface text-muted rounded p-1.5" aria-label="All whiteboards">
          <ArrowLeft size={16} />
        </Link>
        <input value={board.title} onChange={(e) => updateWhiteboard(board.id, { title: e.target.value })} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" aria-label="Whiteboard title" />
        <button onClick={undo} disabled={!past.length} className="hover-surface text-muted rounded p-1.5 disabled:opacity-30" title="Undo (⌘Z)">
          <Undo2 size={16} />
        </button>
        <button onClick={redo} disabled={!future.length} className="hover-surface text-muted rounded p-1.5 disabled:opacity-30" title="Redo (⇧⌘Z)">
          <Redo2 size={16} />
        </button>
      </header>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <svg
          ref={svg}
          className="h-full w-full touch-none select-none"
          style={{ cursor, backgroundColor: 'var(--bg-subtle)', backgroundImage: 'radial-gradient(var(--border) 1.2px, transparent 1.2px)', backgroundSize: `${20 * view.zoom}px ${20 * view.zoom}px`, backgroundPosition: `${-view.x * view.zoom}px ${-view.y * view.zoom}px` }}
          onPointerDown={onBgDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onWheel={onWheel}
        >
          <g transform={`scale(${view.zoom}) translate(${-view.x} ${-view.y})`}>
            {items.map((i) => (
              <g
                key={i.id}
                onPointerDown={(e) => onItemDown(e, i)}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  if (i.kind !== 'path') {
                    setSelected(i.id)
                    setEditing(i.id)
                  }
                }}
                style={{ cursor: tool === 'select' ? 'move' : undefined }}
              >
                <ItemShape
                  item={i}
                  editing={editing === i.id}
                  onText={(t) => {
                    setEditing(null)
                    if (i.kind === 'text' && !t.trim()) {
                      commit(items.filter((x) => x.id !== i.id))
                      setSelected(null)
                    } else if (t !== i.text) commit(items.map((x) => (x.id === i.id ? { ...x, text: t } : x)))
                  }}
                />
                {i.kind === 'path' && <polyline points={(i.points ?? []).map((p) => p.join(',')).join(' ')} fill="none" stroke="transparent" strokeWidth={14} />}
              </g>
            ))}
            {selBounds && !editing && (
              <g pointerEvents="none">
                <rect x={selBounds.x - 4} y={selBounds.y - 4} width={selBounds.w + 8} height={selBounds.h + 8} fill="none" stroke="#4f46e5" strokeWidth={1.5 / view.zoom} strokeDasharray={`${4 / view.zoom} ${3 / view.zoom}`} rx={4} />
              </g>
            )}
            {sel && sel.kind !== 'path' && !editing && (
              <rect
                x={sel.x + sel.w - 5 / view.zoom}
                y={sel.y + sel.h - 5 / view.zoom}
                width={10 / view.zoom}
                height={10 / view.zoom}
                fill="#fff"
                stroke="#4f46e5"
                strokeWidth={1.5 / view.zoom}
                style={{ cursor: 'nwse-resize' }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  ;(e.target as Element).setPointerCapture?.(e.pointerId)
                  setDrag({ type: 'resize', id: sel.id, sx: e.clientX, sy: e.clientY, orig: sel })
                }}
              />
            )}
          </g>
        </svg>

        {/* Tool palette */}
        <div className="surface shadow-pop absolute top-1/2 left-3 flex -translate-y-1/2 flex-col gap-0.5 rounded-xl p-1">
          {TOOLS.map(({ t, icon: Icon, label, key }) => (
            <button key={t} onClick={() => setTool(t)} title={`${label} (${key.toUpperCase()})`} className={cn('rounded-lg p-2', tool === t ? 'bg-brand-600 text-white' : 'text-muted hover-surface')}>
              <Icon size={17} />
            </button>
          ))}
        </div>

        {/* Selection toolbar */}
        {sel && !editing && (
          <div className="surface shadow-pop absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl p-1.5">
            {(sel.kind === 'text' || sel.kind === 'path' ? INK_COLORS : NOTE_COLORS).map((c) => (
              <button key={c} onClick={() => patchSel({ color: c })} className={cn('h-6 w-6 rounded-full border border-black/10', sel.color === c && 'ring-brand-500 ring-2 ring-offset-1')} style={{ background: c }} aria-label={`Color ${c}`} />
            ))}
            <span className="border-app mx-1 h-5 border-l" />
            {sel.kind === 'note' && !sel.taskId && (
              <>
                <button onClick={taskPop.toggle} className="hover-surface flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium" title="Convert to task">
                  <CheckSquare size={14} /> To task
                </button>
                <Popover open={taskPop.open} anchor={taskPop.anchor} onClose={taskPop.close} width={220}>
                  <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">Create task in</div>
                  {lists.map((l) => (
                    <MenuItem
                      key={l.id}
                      onClick={() => {
                        const id = addTask({ listId: l.id, title: sel.text.split('\n')[0].slice(0, 80) || 'Whiteboard idea', description: `<p>From whiteboard “${board.title}”.</p>` })
                        patchSel({ taskId: id })
                        taskPop.close()
                      }}
                    >
                      {l.name}
                    </MenuItem>
                  ))}
                </Popover>
              </>
            )}
            {sel.taskId && (
              <button onClick={() => openTask(sel.taskId!)} className="hover-surface text-brand-600 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium">
                <CheckSquare size={14} /> Open task
              </button>
            )}
            <button
              onClick={() => {
                const copy = { ...sel, id: uid('b'), x: sel.x + 24, y: sel.y + 24, points: sel.points?.map(([x, y]) => [x + 24, y + 24] as [number, number]), taskId: null }
                commit([...items, copy])
                setSelected(copy.id)
              }}
              className="hover-surface text-muted rounded-md p-1.5"
              title="Duplicate (⌘D)"
            >
              <Copy size={14} />
            </button>
            <button onClick={() => (commit(items.filter((i) => i.id !== sel.id)), setSelected(null))} className="hover-surface rounded-md p-1.5 text-red-500" title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
        )}

        {/* Zoom */}
        <div className="surface shadow-pop absolute right-3 bottom-3 flex items-center gap-0.5 rounded-xl p-1 text-xs">
          <button onClick={() => zoomBy(0.8)} className="hover-surface rounded-lg p-1.5" aria-label="Zoom out">
            <Minus size={15} />
          </button>
          <span className="w-12 text-center tabular-nums">{Math.round(view.zoom * 100)}%</span>
          <button onClick={() => zoomBy(1.25)} className="hover-surface rounded-lg p-1.5" aria-label="Zoom in">
            <Plus size={15} />
          </button>
          <button onClick={fit} className="hover-surface rounded-lg p-1.5" title="Fit to content">
            <Maximize size={15} />
          </button>
        </div>
        {items.length === 0 && (
          <div className="text-muted pointer-events-none absolute inset-0 flex items-center justify-center text-sm">Pick a tool on the left — or press N for a sticky note — and click the canvas.</div>
        )}
      </div>
    </div>
  )
}
