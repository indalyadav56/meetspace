import type { BoardItem } from '../../store/types'
import { cn } from '../../lib/utils'

export type Pt = [number, number]
export interface Box {
  x: number
  y: number
  w: number
  h: number
}
export type Lookup = (id: string) => BoardItem | undefined

export const GRID = 20
export const NOTE_COLORS = ['#fde68a', '#bbf7d0', '#bae6fd', '#fbcfe8', '#ddd6fe', '#fecaca', '#fed7aa', '#ffffff']
export const SHAPE_COLORS = ['#c7d2fe', '#99f6e4', '#fde68a', '#fbcfe8', '#fed7aa', '#e9d5ff', '#e2e8f0', '#ffffff']
export const INK_COLORS = ['#1f2128', '#0b7f71', '#f45f2f', '#ef4444', '#f59e0b', '#2563eb', '#7c3aed', '#64748b']
export const FRAME_COLORS = ['#f1f5f9', '#ecfdf5', '#eff6ff', '#fff7ed', '#fdf2f8', '#f5f3ff']
export const FONT_SIZES = [
  { label: 'S', size: 12 },
  { label: 'M', size: 15 },
  { label: 'L', size: 20 },
  { label: 'XL', size: 28 },
]

export const hasText = (i: BoardItem) => i.kind !== 'path'
export const isShape = (i: BoardItem) => i.kind === 'rect' || i.kind === 'ellipse' || i.kind === 'diamond'
/** Things an arrow can attach to. */
export const connectable = (i: BoardItem) => i.kind !== 'arrow' && i.kind !== 'path'

export function fontSize(i: BoardItem) {
  return i.fontSize ?? (i.kind === 'note' ? 15 : i.kind === 'text' ? 22 : i.kind === 'arrow' ? 12 : 14)
}
export function textAlign(i: BoardItem) {
  return i.align ?? (i.kind === 'note' || i.kind === 'text' || i.kind === 'frame' ? 'left' : 'center')
}
export const textColor = (i: BoardItem) => (i.kind === 'text' || i.kind === 'arrow' ? i.color : '#1f2128')

export function darker(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.round(c * 0.72))
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`
}

function edgePoint(b: Box, toward: Pt): Pt {
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const dx = toward[0] - cx
  const dy = toward[1] - cy
  if (!dx && !dy) return [cx, cy]
  const s = Math.min(b.w / 2 / Math.abs(dx || 1e-9), b.h / 2 / Math.abs(dy || 1e-9))
  return [cx + dx * s, cy + dy * s]
}
const center = (b: Box): Pt => [b.x + b.w / 2, b.y + b.h / 2]
const pad = (b: Box, p: number): Box => ({ x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p })

/** Where an arrow starts and ends: on the edge of attached items, else its own points. */
export function arrowEnds(a: BoardItem, find?: Lookup): [Pt, Pt] {
  const from = a.fromId ? find?.(a.fromId) : undefined
  const to = a.toId ? find?.(a.toId) : undefined
  const p1: Pt = from ? center(bounds(from)) : (a.points?.[0] ?? [a.x, a.y])
  const p2: Pt = to ? center(bounds(to)) : (a.points?.[1] ?? [a.x + a.w, a.y + a.h])
  return [from ? edgePoint(pad(bounds(from), 6), p2) : p1, to ? edgePoint(pad(bounds(to), 6), p1) : p2]
}

export function bounds(i: BoardItem, find?: Lookup): Box {
  if (i.kind === 'path' && i.points?.length) {
    const xs = i.points.map((p) => p[0])
    const ys = i.points.map((p) => p[1])
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
  }
  if (i.kind === 'arrow') {
    const [a, b] = arrowEnds(i, find)
    return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]), h: Math.abs(a[1] - b[1]) }
  }
  return { x: i.x, y: i.y, w: i.w, h: i.h }
}

export const inside = (b: Box, outer: Box) => b.x >= outer.x && b.y >= outer.y && b.x + b.w <= outer.x + outer.w && b.y + b.h <= outer.y + outer.h

/** The box a label is drawn in (arrows label their midpoint; frames their header). */
export function labelBox(i: BoardItem, find?: Lookup): Box {
  if (i.kind === 'arrow') {
    const [a, b] = arrowEnds(i, find)
    return { x: (a[0] + b[0]) / 2 - 80, y: (a[1] + b[1]) / 2 - 16, w: 160, h: 32 }
  }
  if (i.kind === 'frame') return { x: i.x, y: i.y, w: i.w, h: 40 }
  return { x: i.x, y: i.y, w: i.w, h: i.h }
}

export function arrowHead(a: Pt, b: Pt, size = 12) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
  const p = (d: number): Pt => [b[0] - size * Math.cos(ang + d), b[1] - size * Math.sin(ang + d)]
  return [b, p(0.45), p(-0.45)].map((q) => q.join(',')).join(' ')
}

export function ItemShape({
  item: i,
  find,
  static: isStatic,
  editing,
  onText,
}: {
  item: BoardItem
  find?: Lookup
  static?: boolean
  editing?: boolean
  onText?: (t: string) => void
}) {
  const size = fontSize(i)
  const align = textAlign(i)
  const style = { fontSize: size, textAlign: align, color: textColor(i), fontWeight: i.bold || i.kind === 'text' || i.kind === 'frame' ? 700 : 500 } as const
  const box = labelBox(i, find)
  const label =
    editing && onText ? (
      <foreignObject x={box.x} y={box.y} width={box.w} height={Math.max(box.h, size * 2)}>
        <textarea
          autoFocus
          defaultValue={i.text}
          onFocus={(e) => e.target.select()}
          onBlur={(e) => onText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) (e.target as HTMLTextAreaElement).blur()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn('h-full w-full resize-none outline-none', i.kind === 'arrow' ? 'rounded bg-white px-1 py-0.5' : 'bg-transparent p-3')}
          style={style}
        />
      </foreignObject>
    ) : (
      i.text && (
        <foreignObject x={box.x} y={box.y} width={box.w} height={box.h} style={{ pointerEvents: 'none', overflow: 'visible' }}>
          <div
            className={cn(
              'flex h-full w-full overflow-hidden leading-snug break-words whitespace-pre-wrap',
              i.kind === 'arrow' ? 'items-center justify-center' : cn('p-3', isShape(i) ? 'items-center' : 'items-start', align === 'center' && 'justify-center'),
            )}
            style={style}
          >
            {i.kind === 'arrow' ? <span className="rounded bg-white/90 px-1.5 py-0.5">{i.text}</span> : i.text}
          </div>
        </foreignObject>
      )
    )

  const dash = i.dashed ? '8 6' : undefined
  let body
  switch (i.kind) {
    case 'note':
      body = (
        <>
          <rect x={i.x + 2} y={i.y + 4} width={i.w} height={i.h} rx={6} fill="rgb(0 0 0 / 0.08)" />
          <rect x={i.x} y={i.y} width={i.w} height={i.h} rx={6} fill={i.color} />
          {label}
          {!!i.votes && (
            <g transform={`translate(${i.x + i.w - (i.taskId ? 48 : 26)}, ${i.y + i.h - 26})`}>
              <rect width={i.votes > 9 ? 30 : 22} height={20} rx={10} fill="#1f2128" />
              <text x={i.votes > 9 ? 15 : 11} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
                +{i.votes}
              </text>
            </g>
          )}
          {i.taskId && !isStatic && (
            <g transform={`translate(${i.x + i.w - 22}, ${i.y + 6})`}>
              <rect width={16} height={16} rx={4} fill="#0b7f71" />
              <path d="M4 8.5l2.5 2.5L12 5.5" stroke="#fff" strokeWidth={2} fill="none" />
            </g>
          )}
        </>
      )
      break
    case 'rect':
      body = (
        <>
          <rect x={i.x} y={i.y} width={i.w} height={i.h} rx={10} fill={i.color} stroke={darker(i.color)} strokeWidth={1.5} strokeDasharray={dash} />
          {label}
        </>
      )
      break
    case 'ellipse':
      body = (
        <>
          <ellipse cx={i.x + i.w / 2} cy={i.y + i.h / 2} rx={i.w / 2} ry={i.h / 2} fill={i.color} stroke={darker(i.color)} strokeWidth={1.5} strokeDasharray={dash} />
          {label}
        </>
      )
      break
    case 'diamond':
      body = (
        <>
          <polygon
            points={`${i.x + i.w / 2},${i.y} ${i.x + i.w},${i.y + i.h / 2} ${i.x + i.w / 2},${i.y + i.h} ${i.x},${i.y + i.h / 2}`}
            fill={i.color}
            stroke={darker(i.color)}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeDasharray={dash}
          />
          {label}
        </>
      )
      break
    case 'frame':
      body = (
        <>
          <rect x={i.x} y={i.y} width={i.w} height={i.h} rx={14} fill={i.color} fillOpacity={0.85} stroke="rgb(0 0 0 / 0.14)" strokeWidth={1.2} />
          {label}
        </>
      )
      break
    case 'text':
      body = label || (!isStatic && <rect x={i.x} y={i.y} width={i.w} height={i.h} fill="transparent" />)
      break
    case 'path':
      body = (
        <>
          <polyline points={(i.points ?? []).map((p) => p.join(',')).join(' ')} fill="none" stroke={i.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />
          {!isStatic && <polyline points={(i.points ?? []).map((p) => p.join(',')).join(' ')} fill="none" stroke="transparent" strokeWidth={14} />}
        </>
      )
      break
    case 'arrow': {
      const [a, b] = arrowEnds(i, find)
      body = (
        <>
          <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={i.color} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={dash} />
          <polygon points={arrowHead(a, b)} fill={i.color} />
          {!isStatic && <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="transparent" strokeWidth={16} />}
          {label}
        </>
      )
      break
    }
  }
  return (
    <g>
      {body}
      {i.locked && !isStatic && (
        <text x={bounds(i, find).x - 4} y={bounds(i, find).y - 6} fontSize={12}>
          🔒
        </text>
      )}
    </g>
  )
}
