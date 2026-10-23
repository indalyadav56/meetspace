import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignLeft,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowLeft,
  ArrowUpRight,
  Bold,
  BringToFront,
  CheckSquare,
  Circle,
  Copy,
  Diamond,
  Download,
  Frame,
  Grid3x3,
  Hand,
  Keyboard,
  LayoutTemplate,
  Lock,
  Magnet,
  Maximize,
  Minus,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  SendToBack,
  Square,
  Star,
  StickyNote,
  ThumbsUp,
  Trash2,
  Type,
  Undo2,
  Unlock,
  type LucideIcon,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { BoardItem, Whiteboard } from '../../store/types'
import { MenuItem, Popover, usePopover } from '../components/ui'
import { cn, uid } from '../../lib/utils'
import {
  FONT_SIZES,
  FRAME_COLORS,
  GRID,
  INK_COLORS,
  ItemShape,
  NOTE_COLORS,
  SHAPE_COLORS,
  bounds,
  connectable,
  fontSize,
  hasText,
  inside,
  isShape,
  textAlign,
  type Box,
  type Lookup,
  type Pt,
} from './shapes'
import { BOARD_TEMPLATES, cloneItems } from './templates'
import { boardToSvg, saveBlob, svgToPng } from './exporters'
import { markViewed } from './viewed'

type Tool = 'select' | 'hand' | 'note' | 'rect' | 'ellipse' | 'diamond' | 'text' | 'path' | 'arrow' | 'frame'
type Drag =
  | { type: 'pan'; sx: number; sy: number; px: number; py: number }
  | { type: 'marquee'; ox: number; oy: number; x: number; y: number; base: string[] }
  | { type: 'move'; sx: number; sy: number; orig: BoardItem[] }
  | { type: 'resize'; id: string; sx: number; sy: number; orig: BoardItem }
  | { type: 'create'; id: string; ox: number; oy: number }
  | { type: 'draw'; id: string }
  | { type: 'arrow'; id: string }

const TOOLS: { t: Tool; icon: LucideIcon; label: string; key: string }[] = [
  { t: 'select', icon: MousePointer2, label: 'Select', key: 'v' },
  { t: 'hand', icon: Hand, label: 'Pan (or hold Space)', key: 'h' },
  { t: 'note', icon: StickyNote, label: 'Sticky note', key: 'n' },
  { t: 'rect', icon: Square, label: 'Rectangle', key: 'r' },
  { t: 'ellipse', icon: Circle, label: 'Ellipse', key: 'o' },
  { t: 'diamond', icon: Diamond, label: 'Diamond', key: 'd' },
  { t: 'arrow', icon: ArrowUpRight, label: 'Arrow — drag between shapes to connect', key: 'a' },
  { t: 'text', icon: Type, label: 'Text', key: 't' },
  { t: 'path', icon: Pencil, label: 'Pen', key: 'p' },
  { t: 'frame', icon: Frame, label: 'Frame', key: 'f' },
]

const SHORTCUTS: [string, string][] = [
  ['V H N R O D A T P F', 'Tools'],
  ['Space + drag', 'Pan'],
  ['⌘/Ctrl + scroll', 'Zoom'],
  ['Shift + click', 'Add to selection'],
  ['⌘A', 'Select all'],
  ['⌘C / ⌘X / ⌘V', 'Copy / cut / paste'],
  ['⌘D', 'Duplicate'],
  ['⌘Z / ⇧⌘Z', 'Undo / redo'],
  ['⌘] / ⌘[', 'Bring to front / send to back'],
  ['⇧⌘L', 'Lock / unlock'],
  ['Arrow keys', 'Nudge (Shift: 10×)'],
  ['Double-click', 'Edit text · new sticky on empty canvas'],
  ['⇧1', 'Zoom to fit'],
]

/** Shared across boards so you can paste into another board. */
let clipboard: { items: BoardItem[]; pastes: number } = { items: [], pastes: 0 }

function IconBtn({ icon: Icon, label, onClick, on, danger, disabled }: { icon: LucideIcon; label: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; on?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} aria-label={label} aria-pressed={on} className={cn('rounded-md p-1.5 disabled:opacity-30', on ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/25 dark:text-brand-100' : danger ? 'hover-surface text-red-500' : 'hover-surface text-muted')}>
      <Icon size={15} />
    </button>
  )
}

const Sep = () => <span className="border-app mx-0.5 h-5 border-l" />

const pref = (k: string, v?: string) => {
  try {
    if (v === undefined) return localStorage.getItem(`ms.board.${k}`)
    localStorage.setItem(`ms.board.${k}`, v)
  } catch {
    /* storage blocked */
  }
  return null
}

export function BoardEditor({ board }: { board: Whiteboard }) {
  const { setBoardItems, updateWhiteboard, lists, addTask, openTask, favorites, toggleFavorite, touchRecent } = useStore()
  const [items, setItems] = useState<BoardItem[]>(board.items)
  const [tool, setTool] = useState<Tool>('select')
  const [selected, setSelected] = useState<string[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
  const [drag, setDrag] = useState<Drag | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [space, setSpace] = useState(false)
  const [grid, setGrid] = useState(() => pref('grid') !== '0')
  const [snap, setSnap] = useState(() => pref('snap') === '1')
  const [past, setPast] = useState<BoardItem[][]>([])
  const [future, setFuture] = useState<BoardItem[][]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const taskPop = usePopover()
  const tplPop = usePopover()
  const exportPop = usePopover()
  const alignPop = usePopover()
  const keysPop = usePopover()

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const find: Lookup = useCallback((id) => byId.get(id), [byId])
  const sel = items.filter((i) => selected.includes(i.id))
  const one = sel.length === 1 ? sel[0] : null
  const flash = (m: string) => {
    setNotice(m)
    setTimeout(() => setNotice(null), 2200)
  }
  const snapV = (v: number) => (snap ? Math.round(v / GRID) * GRID : v)

  /** Commit a new item list: push undo history and persist. */
  const commit = useCallback(
    (next: BoardItem[], prev: BoardItem[] = items) => {
      setPast((p) => [...p.slice(-79), prev])
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
    setSelected((s) => s.filter((id) => prev.some((i) => i.id === id)))
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

  const world = (e: { clientX: number; clientY: number }): Pt => {
    const r = svg.current!.getBoundingClientRect()
    return [(e.clientX - r.left) / view.zoom + view.x, (e.clientY - r.top) / view.zoom + view.y]
  }
  const viewCenter = (): Pt => {
    const r = svg.current!.getBoundingClientRect()
    return [view.x + r.width / view.zoom / 2, view.y + r.height / view.zoom / 2]
  }

  /** The topmost item an arrow end could attach to at p (shapes beat frames). */
  const hitTest = (p: Pt, exclude?: string) => {
    const hit = (i: BoardItem) => {
      if (!connectable(i) || i.id === exclude) return false
      const b = bounds(i)
      return p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h
    }
    const rev = [...items].reverse()
    return rev.find((i) => i.kind !== 'frame' && hit(i)) ?? rev.find(hit)
  }

  /** Removes items and any arrows attached to them. Locked items stay. */
  const without = (ids: string[]) => {
    const gone = new Set(ids.filter((id) => !byId.get(id)?.locked))
    return items.filter((i) => !gone.has(i.id) && !(i.kind === 'arrow' && ((i.fromId && gone.has(i.fromId)) || (i.toId && gone.has(i.toId)))))
  }
  const remove = () => {
    if (!selected.length) return
    commit(without(selected))
    setSelected([])
  }

  /** Selected items plus arrows that connect two of them. */
  const withConnectors = (ids: string[]) => {
    const set = new Set(ids)
    return items.filter((i) => set.has(i.id) || (i.kind === 'arrow' && i.fromId && i.toId && set.has(i.fromId) && set.has(i.toId)))
  }
  const copy = () => {
    if (!sel.length) return
    clipboard = { items: withConnectors(selected).map((i) => ({ ...i })), pastes: 0 }
  }
  const paste = (from = clipboard.items, offset?: Pt) => {
    if (!from.length) return
    clipboard.pastes += 1
    const d = clipboard.pastes * 24
    const fresh = cloneItems(from, offset ? offset[0] : d, offset ? offset[1] : d, (id) => byId.get(id) ?? from.find((i) => i.id === id))
    commit([...items, ...fresh])
    setSelected(fresh.map((i) => i.id))
  }
  const duplicate = () => {
    if (!sel.length) return
    const fresh = cloneItems(withConnectors(selected), 24, 24, find)
    commit([...items, ...fresh])
    setSelected(fresh.map((i) => i.id))
  }
  const reorder = (front: boolean) => {
    const set = new Set(selected)
    const moving = items.filter((i) => set.has(i.id))
    const rest = items.filter((i) => !set.has(i.id))
    commit(front ? [...rest, ...moving] : [...moving, ...rest])
  }
  const patchSel = (patch: Partial<BoardItem> | ((i: BoardItem) => Partial<BoardItem>)) => {
    if (!sel.length) return
    const set = new Set(selected)
    commit(items.map((i) => (set.has(i.id) ? { ...i, ...(typeof patch === 'function' ? patch(i) : patch) } : i)))
  }
  const nudge = (dx: number, dy: number) => patchSel((i) => (i.locked ? {} : { x: i.x + dx, y: i.y + dy, points: i.points?.map(([x, y]) => [x + dx, y + dy] as Pt) }))
  const align = (how: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => {
    const bs = sel.map((i) => bounds(i, find))
    const left = Math.min(...bs.map((b) => b.x))
    const right = Math.max(...bs.map((b) => b.x + b.w))
    const top = Math.min(...bs.map((b) => b.y))
    const bottom = Math.max(...bs.map((b) => b.y + b.h))
    patchSel((i) => {
      if (i.locked || i.kind === 'arrow' || i.kind === 'path') return {}
      const x = how === 'left' ? left : how === 'right' ? right - i.w : how === 'hcenter' ? (left + right) / 2 - i.w / 2 : i.x
      const y = how === 'top' ? top : how === 'bottom' ? bottom - i.h : how === 'vcenter' ? (top + bottom) / 2 - i.h / 2 : i.y
      return { x, y }
    })
  }

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing || (e.target as HTMLElement).closest('input, textarea, select')) return
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (e.key === ' ') return e.preventDefault(), setSpace(true)
      if (mod && k === 'z') return e.preventDefault(), e.shiftKey ? redo() : undo()
      if (mod && k === 'y') return e.preventDefault(), redo()
      if (mod && k === 'a') return e.preventDefault(), setSelected(items.map((i) => i.id))
      if (mod && k === 'c') return copy()
      if (mod && k === 'x') return copy(), remove()
      if (mod && k === 'v') return e.preventDefault(), paste()
      if (mod && k === 'd') return e.preventDefault(), duplicate()
      if (mod && e.key === ']') return e.preventDefault(), reorder(true)
      if (mod && e.key === '[') return e.preventDefault(), reorder(false)
      if (mod && e.shiftKey && k === 'l') return e.preventDefault(), patchSel({ locked: !sel.every((i) => i.locked) })
      if (mod) return
      if (e.key === 'Delete' || e.key === 'Backspace') return e.preventDefault(), remove()
      if (e.key === 'Escape') return setSelected([]), setTool('select')
      if (e.key === '!' || (e.shiftKey && e.code === 'Digit1')) return fit()
      if (e.key === '=' || e.key === '+') return zoomBy(1.25)
      if (e.key === '-') return zoomBy(0.8)
      const arrows: Record<string, Pt> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      if (arrows[e.key] && sel.length) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        return nudge(arrows[e.key][0] * step, arrows[e.key][1] * step)
      }
      const t = TOOLS.find((x) => x.key === k)
      if (t && !e.shiftKey) setTool(t.t)
    }
    const onUpKey = (e: KeyboardEvent) => e.key === ' ' && setSpace(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onUpKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onUpKey)
    }
  })

  const startPan = (e: React.PointerEvent) => setDrag({ type: 'pan', sx: e.clientX, sy: e.clientY, px: view.x, py: view.y })

  const onBgDown = (e: React.PointerEvent) => {
    if (editing) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const [px, py] = world(e)
    if (tool === 'hand' || e.button === 1 || space) return startPan(e)
    if (tool === 'select') {
      if (!e.shiftKey) setSelected([])
      setDrag({ type: 'marquee', ox: px, oy: py, x: px, y: py, base: e.shiftKey ? selected : [] })
      return
    }
    const id = uid('b')
    const x = snapV(px)
    const y = snapV(py)
    const base = { id, x, y, w: 0, h: 0, text: '', taskId: null }
    if (tool === 'note') {
      commit([...items, { ...base, kind: 'note', x: snapV(px - 85), y: snapV(py - 60), w: 170, h: 120, color: NOTE_COLORS[0] }])
      setSelected([id])
      setEditing(id)
      setTool('select')
      return
    }
    if (tool === 'text') {
      commit([...items, { ...base, kind: 'text', w: 260, h: 44, color: INK_COLORS[0] }])
      setSelected([id])
      setEditing(id)
      setTool('select')
      return
    }
    if (tool === 'path') {
      setItems([...items, { ...base, kind: 'path', color: INK_COLORS[1], points: [[px, py]] }])
      setDrag({ type: 'draw', id })
      return
    }
    if (tool === 'arrow') {
      const from = hitTest([px, py])
      setItems([...items, { ...base, kind: 'arrow', color: '#64748b', fromId: from?.id ?? null, toId: null, points: [[px, py], [px, py]] }])
      setDrag({ type: 'arrow', id })
      return
    }
    const color = tool === 'frame' ? FRAME_COLORS[0] : tool === 'rect' ? SHAPE_COLORS[0] : tool === 'ellipse' ? SHAPE_COLORS[1] : SHAPE_COLORS[2]
    setItems([...items, { ...base, kind: tool, color, text: tool === 'frame' ? 'Frame' : '' }])
    setDrag({ type: 'create', id, ox: x, oy: y })
  }

  const onItemDown = (e: React.PointerEvent, item: BoardItem) => {
    if (tool !== 'select' || editing === item.id || space || e.button === 1) return
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    let ids = selected
    if (e.shiftKey) ids = selected.includes(item.id) ? selected.filter((x) => x !== item.id) : [...selected, item.id]
    else if (!selected.includes(item.id)) ids = [item.id]
    setSelected(ids)
    // Moving a frame carries what sits inside it.
    const moving = new Set(ids)
    for (const id of ids) {
      const f = byId.get(id)
      if (f?.kind === 'frame') for (const i of items) if (i.id !== f.id && i.kind !== 'arrow' && inside(bounds(i), bounds(f))) moving.add(i.id)
    }
    const orig = items.filter((i) => moving.has(i.id) && !i.locked && !(i.kind === 'arrow' && (i.fromId || i.toId) && !i.points))
    setDrag({ type: 'move', sx: e.clientX, sy: e.clientY, orig })
  }

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return
    if (drag.type === 'pan') return setView((v) => ({ ...v, x: drag.px - (e.clientX - drag.sx) / v.zoom, y: drag.py - (e.clientY - drag.sy) / v.zoom }))
    const p = world(e)
    if (drag.type === 'marquee') {
      const box: Box = { x: Math.min(drag.ox, p[0]), y: Math.min(drag.oy, p[1]), w: Math.abs(p[0] - drag.ox), h: Math.abs(p[1] - drag.oy) }
      setDrag({ ...drag, x: p[0], y: p[1] })
      const hits = items.filter((i) => inside(bounds(i, find), box)).map((i) => i.id)
      setSelected([...new Set([...drag.base, ...hits])])
      return
    }
    if (drag.type === 'move') {
      if (!drag.orig.length) return
      let dx = (e.clientX - drag.sx) / view.zoom
      let dy = (e.clientY - drag.sy) / view.zoom
      const lead = drag.orig[0]
      if (snap && lead.kind !== 'path' && lead.kind !== 'arrow') {
        dx = snapV(lead.x + dx) - lead.x
        dy = snapV(lead.y + dy) - lead.y
      }
      const orig = new Map(drag.orig.map((o) => [o.id, o]))
      setItems((cur) =>
        cur.map((i) => {
          const o = orig.get(i.id)
          return o ? { ...i, x: o.x + dx, y: o.y + dy, points: o.points?.map(([x, y]) => [x + dx, y + dy] as Pt) } : i
        }),
      )
      return
    }
    setItems((cur) =>
      cur.map((i) => {
        if (i.id !== drag.id) return i
        if (drag.type === 'resize') {
          const w = Math.max(40, drag.orig.w + (e.clientX - drag.sx) / view.zoom)
          const h = Math.max(30, drag.orig.h + (e.clientY - drag.sy) / view.zoom)
          return { ...i, w: snap ? snapV(drag.orig.x + w) - drag.orig.x : w, h: snap ? snapV(drag.orig.y + h) - drag.orig.y : h }
        }
        if (drag.type === 'create') {
          const [qx, qy] = [snapV(p[0]), snapV(p[1])]
          return { ...i, x: Math.min(drag.ox, qx), y: Math.min(drag.oy, qy), w: Math.abs(qx - drag.ox), h: Math.abs(qy - drag.oy) }
        }
        if (drag.type === 'arrow') return { ...i, points: [i.points![0], p] }
        return { ...i, points: [...(i.points ?? []), p] }
      }),
    )
    if (drag.type === 'arrow') {
      const from = byId.get(drag.id)?.fromId
      const t = hitTest(p, from ?? undefined)
      setHover(t && t.id !== drag.id ? t.id : null)
    }
  }

  const onUp = (e: React.PointerEvent) => {
    if (!drag) return
    const d = drag
    setDrag(null)
    setHover(null)
    if (d.type === 'pan' || d.type === 'marquee') return
    const before = d.type === 'move' ? items.map((i) => d.orig.find((o) => o.id === i.id) ?? i) : d.type === 'resize' ? items.map((i) => (i.id === d.id ? d.orig : i)) : items.filter((i) => i.id !== d.id)
    let next = items
    if (d.type === 'move') {
      const lead = d.orig[0]
      const now = lead && byId.get(lead.id)
      if (!now || (now.x === lead.x && now.y === lead.y)) return // plain click
    }
    if (d.type === 'create') {
      const def = (i: BoardItem) => (i.kind === 'frame' ? { w: 480, h: 340 } : { w: 150, h: 90 })
      next = items.map((i) => (i.id === d.id && i.w < 8 && i.h < 8 ? { ...i, x: i.x - def(i).w / 2, y: i.y - def(i).h / 2, ...def(i) } : i))
      setSelected([d.id])
      setTool('select')
    }
    if (d.type === 'draw') {
      const it = byId.get(d.id)
      if (!it || (it.points?.length ?? 0) < 2) next = items.filter((i) => i.id !== d.id)
    }
    if (d.type === 'arrow') {
      const it = byId.get(d.id)!
      const end = world(e)
      const target = hitTest(end, it.fromId ?? undefined)
      const [a] = it.points!
      if (!target && Math.hypot(end[0] - a[0], end[1] - a[1]) < 12) {
        setItems(items.filter((i) => i.id !== d.id))
        return
      }
      next = items.map((i) => (i.id === d.id ? { ...i, toId: target?.id ?? null } : i))
      setSelected([d.id])
      setTool('select')
    }
    commit(next, before)
  }

  const onBgDouble = (e: React.MouseEvent) => {
    if (tool !== 'select' || editing) return
    const [px, py] = world(e)
    const id = uid('b')
    commit([...items, { id, kind: 'note', x: snapV(px - 85), y: snapV(py - 60), w: 170, h: 120, color: NOTE_COLORS[0], text: '', taskId: null }])
    setSelected([id])
    setEditing(id)
  }

  const onWheel = (e: React.WheelEvent) => {
    const r = svg.current!.getBoundingClientRect()
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.01)
      setView((v) => {
        const zoom = Math.min(4, Math.max(0.1, v.zoom * factor))
        const mx = (e.clientX - r.left) / v.zoom + v.x
        const my = (e.clientY - r.top) / v.zoom + v.y
        return { zoom, x: mx - (e.clientX - r.left) / zoom, y: my - (e.clientY - r.top) / zoom }
      })
    } else setView((v) => ({ ...v, x: v.x + e.deltaX / v.zoom, y: v.y + e.deltaY / v.zoom }))
  }

  const zoomBy = (f: number) =>
    setView((v) => {
      const r = svg.current!.getBoundingClientRect()
      const zoom = Math.min(4, Math.max(0.1, v.zoom * f))
      const cx = v.x + r.width / v.zoom / 2
      const cy = v.y + r.height / v.zoom / 2
      return { zoom, x: cx - r.width / zoom / 2, y: cy - r.height / zoom / 2 }
    })
  const fit = (list = items) => {
    if (!list.length || !svg.current) return setView({ x: 0, y: 0, zoom: 1 })
    const bs = list.map((i) => bounds(i, find))
    const minX = Math.min(...bs.map((b) => b.x))
    const minY = Math.min(...bs.map((b) => b.y))
    const maxX = Math.max(...bs.map((b) => b.x + b.w))
    const maxY = Math.max(...bs.map((b) => b.y + b.h))
    const r = svg.current.getBoundingClientRect()
    const zoom = Math.min(2, Math.max(0.1, Math.min(r.width / (maxX - minX + 160), r.height / (maxY - minY + 160))))
    setView({ zoom, x: minX - (r.width / zoom - (maxX - minX)) / 2, y: minY - (r.height / zoom - (maxY - minY)) / 2 })
  }
  useEffect(() => {
    markViewed(board.id)
    touchRecent(board.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id])
  useEffect(() => {
    fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const insertTemplate = (key: string) => {
    const t = BOARD_TEMPLATES.find((x) => x.key === key)!
    const [cx, cy] = viewCenter()
    const fresh = cloneItems(t.items(), cx, cy)
    commit([...items, ...fresh])
    setSelected(fresh.map((i) => i.id))
    setTimeout(() => fit([...fresh]), 0)
  }

  const exportAs = async (kind: 'png' | 'svg') => {
    const list = sel.length ? withConnectors(selected) : items
    if (!list.length) return flash('Nothing to export yet')
    const { svg: text, w, h } = boardToSvg(list, items)
    const name = (board.title.trim() || 'Whiteboard').replace(/[\\/:*?"<>|]+/g, '-')
    try {
      if (kind === 'svg') saveBlob(`${name}.svg`, new Blob([text], { type: 'image/svg+xml' }))
      else saveBlob(`${name}.png`, await svgToPng(text, w, h))
    } catch (err) {
      flash((err as Error).message)
    }
  }

  const toggle = (k: 'grid' | 'snap') => {
    const v = k === 'grid' ? !grid : !snap
    pref(k, v ? '1' : '0')
    if (k === 'grid') setGrid(v)
    else setSnap(v)
  }

  const ordered = useMemo(() => [...items.filter((i) => i.kind === 'frame'), ...items.filter((i) => i.kind !== 'frame')], [items])
  const marquee = drag?.type === 'marquee' ? { x: Math.min(drag.ox, drag.x), y: Math.min(drag.oy, drag.y), w: Math.abs(drag.x - drag.ox), h: Math.abs(drag.y - drag.oy) } : null
  const panning = tool === 'hand' || space || drag?.type === 'pan'
  const cursor = panning ? (drag?.type === 'pan' ? 'grabbing' : 'grab') : tool === 'select' ? 'default' : 'crosshair'
  const z = view.zoom
  const palette = !sel.length ? [] : sel.every((i) => i.kind === 'note') ? NOTE_COLORS : sel.every((i) => i.kind === 'frame') ? FRAME_COLORS : sel.every((i) => isShape(i)) ? SHAPE_COLORS : sel.every((i) => i.kind === 'text' || i.kind === 'path' || i.kind === 'arrow') ? INK_COLORS : []
  const texty = sel.filter(hasText)
  const locked = sel.length > 0 && sel.every((i) => i.locked)

  return (
    <div className="flex h-full flex-col">
      <header className="border-app flex h-12 shrink-0 items-center gap-1.5 border-b px-3">
        <Link to="/app/whiteboards" className="hover-surface text-muted rounded p-1.5" aria-label="All whiteboards">
          <ArrowLeft size={16} />
        </Link>
        <input value={board.title} onChange={(e) => updateWhiteboard(board.id, { title: e.target.value })} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" aria-label="Whiteboard title" />
        <IconBtn icon={Star} label={favorites.includes(board.id) ? 'Remove from favorites' : 'Add to favorites'} on={favorites.includes(board.id)} onClick={() => toggleFavorite(board.id)} />
        {notice && <span className="text-brand-600 shrink-0 text-xs">{notice}</span>}
        <span className="text-faint hidden shrink-0 text-xs sm:inline">{items.length} items</span>
        <button onClick={tplPop.toggle} className="hover-surface text-muted inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium">
          <LayoutTemplate size={15} /> <span className="hidden sm:inline">Templates</span>
        </button>
        <Popover open={tplPop.open} anchor={tplPop.anchor} onClose={tplPop.close} align="end" width={260}>
          <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">Add to board</div>
          {BOARD_TEMPLATES.map((t) => (
            <MenuItem key={t.key} onClick={() => (insertTemplate(t.key), tplPop.close())}>
              <span className="text-lg">{t.emoji}</span>
              <span className="min-w-0">
                <span className="block font-medium">{t.title}</span>
                <span className="text-faint block truncate text-xs">{t.hint}</span>
              </span>
            </MenuItem>
          ))}
        </Popover>
        <button onClick={exportPop.toggle} className="hover-surface text-muted inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium">
          <Download size={15} /> <span className="hidden sm:inline">Export</span>
        </button>
        <Popover open={exportPop.open} anchor={exportPop.anchor} onClose={exportPop.close} align="end" width={220}>
          <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">{sel.length ? `Export ${sel.length} selected` : 'Export whole board'}</div>
          <MenuItem onClick={() => (void exportAs('png'), exportPop.close())}>PNG image</MenuItem>
          <MenuItem onClick={() => (void exportAs('svg'), exportPop.close())}>SVG vector</MenuItem>
        </Popover>
        <Sep />
        <IconBtn icon={Undo2} label="Undo (⌘Z)" onClick={undo} disabled={!past.length} />
        <IconBtn icon={Redo2} label="Redo (⇧⌘Z)" onClick={redo} disabled={!future.length} />
        <IconBtn icon={Keyboard} label="Keyboard shortcuts" onClick={keysPop.toggle} />
        <Popover open={keysPop.open} anchor={keysPop.anchor} onClose={keysPop.close} align="end" width={300}>
          <div className="p-1.5">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 py-1 text-xs">
                <span className="text-muted">{v}</span>
                <kbd className="surface-muted rounded px-1.5 py-0.5 font-mono text-[11px]">{k}</kbd>
              </div>
            ))}
          </div>
        </Popover>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <svg
          ref={svg}
          className="h-full w-full touch-none select-none"
          style={{
            cursor,
            backgroundColor: 'var(--bg-subtle)',
            backgroundImage: grid ? 'radial-gradient(var(--border) 1.2px, transparent 1.2px)' : undefined,
            backgroundSize: `${GRID * z}px ${GRID * z}px`,
            backgroundPosition: `${-view.x * z}px ${-view.y * z}px`,
          }}
          onPointerDown={onBgDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onDoubleClick={onBgDouble}
          onWheel={onWheel}
          role="application"
          aria-label="Whiteboard canvas"
        >
          <g transform={`scale(${z}) translate(${-view.x} ${-view.y})`}>
            {ordered.map((i) => (
              <g
                key={i.id}
                onPointerDown={(e) => onItemDown(e, i)}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  if (tool === 'select' && hasText(i) && !i.locked) {
                    setSelected([i.id])
                    setEditing(i.id)
                  }
                }}
                style={{ cursor: tool === 'select' && !panning ? (i.locked ? 'default' : 'move') : undefined }}
              >
                <ItemShape
                  item={i}
                  find={find}
                  editing={editing === i.id}
                  onText={(t) => {
                    setEditing(null)
                    if (i.kind === 'text' && !t.trim()) {
                      commit(items.filter((x) => x.id !== i.id))
                      setSelected([])
                    } else if (t !== i.text) commit(items.map((x) => (x.id === i.id ? { ...x, text: t } : x)))
                  }}
                />
              </g>
            ))}

            {hover && byId.get(hover) && (
              <rect {...(({ x, y, w, h }) => ({ x: x - 6, y: y - 6, width: w + 12, height: h + 12 }))(bounds(byId.get(hover)!))} rx={8} fill="none" stroke="#0b7f71" strokeWidth={2.5 / z} pointerEvents="none" />
            )}
            {!editing &&
              sel.map((i) => {
                const b = bounds(i, find)
                return <rect key={i.id} x={b.x - 4} y={b.y - 4} width={b.w + 8} height={b.h + 8} fill="none" stroke={i.locked ? '#94a3b8' : '#0b7f71'} strokeWidth={1.5 / z} strokeDasharray={`${4 / z} ${3 / z}`} rx={4} pointerEvents="none" />
              })}
            {one && one.kind !== 'path' && one.kind !== 'arrow' && !one.locked && !editing && (
              <rect
                x={one.x + one.w - 5 / z}
                y={one.y + one.h - 5 / z}
                width={10 / z}
                height={10 / z}
                fill="#fff"
                stroke="#0b7f71"
                strokeWidth={1.5 / z}
                style={{ cursor: 'nwse-resize' }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  ;(e.target as Element).setPointerCapture?.(e.pointerId)
                  setDrag({ type: 'resize', id: one.id, sx: e.clientX, sy: e.clientY, orig: one })
                }}
              />
            )}
            {marquee && <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill="rgb(11 127 113 / 0.08)" stroke="#0b7f71" strokeWidth={1 / z} pointerEvents="none" />}
          </g>
        </svg>

        {/* Tool palette */}
        <div className="surface shadow-pop absolute top-1/2 left-3 flex -translate-y-1/2 flex-col gap-0.5 rounded-xl p-1">
          {TOOLS.map(({ t, icon: Icon, label, key }) => (
            <button key={t} onClick={() => setTool(t)} title={`${label} (${key.toUpperCase()})`} aria-label={label} aria-pressed={tool === t} className={cn('rounded-lg p-2', tool === t ? 'bg-brand-600 text-white' : 'text-muted hover-surface')}>
              <Icon size={17} />
            </button>
          ))}
        </div>

        {/* Selection toolbar */}
        {sel.length > 0 && !editing && !drag && (
          <div className="surface shadow-pop absolute top-3 left-1/2 flex w-max max-w-[calc(100%-6rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-0.5 rounded-xl p-1.5">
            {sel.length > 1 && <span className="text-muted px-1.5 text-xs font-medium">{sel.length} selected</span>}
            {palette.map((c) => (
              <button key={c} onClick={() => patchSel({ color: c })} className={cn('mx-px h-6 w-6 rounded-full border border-black/10', sel.every((i) => i.color === c) && 'ring-brand-500 ring-2 ring-offset-1')} style={{ background: c }} aria-label={`Color ${c}`} />
            ))}
            {palette.length > 0 && <Sep />}
            {texty.length > 0 && (
              <>
                <select
                  value={texty.every((i) => fontSize(i) === fontSize(texty[0])) ? fontSize(texty[0]) : ''}
                  onChange={(e) => patchSel((i) => (hasText(i) ? { fontSize: Number(e.target.value) } : {}))}
                  className="border-app surface h-7 rounded-md border px-1 text-xs"
                  aria-label="Text size"
                >
                  <option value="" disabled>
                    Size
                  </option>
                  {FONT_SIZES.map((f) => (
                    <option key={f.size} value={f.size}>
                      {f.label}
                    </option>
                  ))}
                  {!FONT_SIZES.some((f) => f.size === fontSize(texty[0])) && <option value={fontSize(texty[0])}>{fontSize(texty[0])}</option>}
                </select>
                <IconBtn icon={Bold} label="Bold" on={texty.every((i) => i.bold)} onClick={() => patchSel({ bold: !texty.every((i) => i.bold) })} />
                <IconBtn
                  icon={texty.every((i) => textAlign(i) === 'center') ? AlignCenter : AlignLeft}
                  label="Text alignment"
                  onClick={() => {
                    const next = texty.every((i) => textAlign(i) === 'center') ? 'left' : 'center'
                    patchSel((i) => (hasText(i) ? { align: next } : {}))
                  }}
                />
              </>
            )}
            {sel.some((i) => isShape(i) || i.kind === 'arrow' || i.kind === 'path') && (
              <button onClick={() => patchSel({ dashed: !sel.every((i) => i.dashed) })} className={cn('rounded-md px-1.5 py-1 font-mono text-xs', sel.every((i) => i.dashed) ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/25' : 'hover-surface text-muted')} title="Dashed line">
                ┅
              </button>
            )}
            {one?.kind === 'note' && (
              <>
                <Sep />
                <IconBtn icon={ThumbsUp} label="Vote" onClick={() => patchSel({ votes: (one.votes ?? 0) + 1 })} />
                {!!one.votes && (
                  <button onClick={() => patchSel({ votes: one.votes! - 1 })} className="hover-surface text-muted rounded-md px-1.5 py-1 text-xs tabular-nums" title="Remove a vote">
                    +{one.votes} −
                  </button>
                )}
                {!one.taskId ? (
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
                            const id = addTask({ listId: l.id, title: one.text.split('\n')[0].slice(0, 80) || 'Whiteboard idea', description: `<p>From whiteboard “${board.title}”.</p>` })
                            patchSel({ taskId: id })
                            taskPop.close()
                          }}
                        >
                          {l.name}
                        </MenuItem>
                      ))}
                    </Popover>
                  </>
                ) : (
                  <button onClick={() => openTask(one.taskId!)} className="hover-surface text-brand-600 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium">
                    <CheckSquare size={14} /> Open task
                  </button>
                )}
              </>
            )}
            <Sep />
            {sel.length > 1 && (
              <>
                <IconBtn icon={AlignHorizontalJustifyCenter} label="Align" onClick={alignPop.toggle} />
                <Popover open={alignPop.open} anchor={alignPop.anchor} onClose={alignPop.close} width={180}>
                  {(
                    [
                      ['left', AlignHorizontalJustifyStart, 'Align left'],
                      ['hcenter', AlignHorizontalJustifyCenter, 'Align centers'],
                      ['right', AlignHorizontalJustifyEnd, 'Align right'],
                      ['top', AlignVerticalJustifyStart, 'Align top'],
                      ['vcenter', AlignVerticalJustifyCenter, 'Align middles'],
                      ['bottom', AlignVerticalJustifyEnd, 'Align bottom'],
                    ] as const
                  ).map(([k, Icon, label]) => (
                    <MenuItem key={k} onClick={() => (align(k), alignPop.close())}>
                      <Icon size={14} /> {label}
                    </MenuItem>
                  ))}
                </Popover>
              </>
            )}
            <IconBtn icon={BringToFront} label="Bring to front (⌘])" onClick={() => reorder(true)} />
            <IconBtn icon={SendToBack} label="Send to back (⌘[)" onClick={() => reorder(false)} />
            <IconBtn icon={locked ? Unlock : Lock} label={locked ? 'Unlock (⇧⌘L)' : 'Lock (⇧⌘L)'} on={locked} onClick={() => patchSel({ locked: !locked })} />
            <IconBtn icon={Copy} label="Duplicate (⌘D)" onClick={duplicate} />
            <IconBtn icon={Trash2} label="Delete" danger onClick={remove} disabled={locked} />
          </div>
        )}

        {/* View controls */}
        <div className="surface shadow-pop absolute right-3 bottom-3 flex items-center gap-0.5 rounded-xl p-1 text-xs">
          <IconBtn icon={Grid3x3} label="Show grid" on={grid} onClick={() => toggle('grid')} />
          <IconBtn icon={Magnet} label="Snap to grid" on={snap} onClick={() => toggle('snap')} />
          <Sep />
          <button onClick={() => zoomBy(0.8)} className="hover-surface rounded-lg p-1.5" aria-label="Zoom out">
            <Minus size={15} />
          </button>
          <button onClick={() => setView((v) => ({ ...v, zoom: 1 }))} className="hover-surface w-12 rounded-lg py-1 text-center tabular-nums" title="Reset to 100%">
            {Math.round(z * 100)}%
          </button>
          <button onClick={() => zoomBy(1.25)} className="hover-surface rounded-lg p-1.5" aria-label="Zoom in">
            <Plus size={15} />
          </button>
          <button onClick={() => fit()} className="hover-surface rounded-lg p-1.5" title="Zoom to fit (⇧1)" aria-label="Zoom to fit">
            <Maximize size={15} />
          </button>
        </div>
        {items.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
            <p className="text-muted text-sm">Pick a tool on the left, double-click to add a sticky, or start from a template.</p>
            <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
              {BOARD_TEMPLATES.map((t) => (
                <button key={t.key} onClick={() => insertTemplate(t.key)} className="surface border-app hover:border-brand-500 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm">
                  <span>{t.emoji}</span> {t.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
