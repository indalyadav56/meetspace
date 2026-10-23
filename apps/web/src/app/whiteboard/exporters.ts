import type { BoardItem } from '../../store/types'
import { arrowEnds, arrowHead, bounds, darker, fontSize, isShape, labelBox, textAlign, textColor, type Lookup } from './shapes'

const FONT = 'Figtree, system-ui, sans-serif'
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

let ctx: CanvasRenderingContext2D | null = null
function wrap(text: string, width: number, size: number, weight: number) {
  ctx ??= document.createElement('canvas').getContext('2d')
  ctx!.font = `${weight} ${size}px ${FONT}`
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (line && ctx!.measureText(next).width > width) {
        lines.push(line)
        line = word
      } else line = next
    }
    lines.push(line)
  }
  return lines
}

function label(i: BoardItem, find: Lookup) {
  if (!i.text) return ''
  const b = labelBox(i, find)
  const size = fontSize(i)
  const weight = i.bold || i.kind === 'text' || i.kind === 'frame' ? 700 : 500
  const padX = i.kind === 'arrow' ? 6 : 12
  const lineH = size * 1.35
  const lines = wrap(i.text, b.w - padX * 2, size, weight).slice(0, Math.max(1, Math.floor((b.h - 12) / lineH)) + (i.kind === 'arrow' ? 1 : 0))
  const center = textAlign(i) === 'center' || i.kind === 'arrow'
  const x = center ? b.x + b.w / 2 : b.x + padX
  const vCenter = isShape(i) || i.kind === 'arrow'
  const top = vCenter ? b.y + b.h / 2 - (lines.length * lineH) / 2 : b.y + 12
  const textW = Math.max(...lines.map((l) => ctx!.measureText(l).width)) + 12
  const bg = i.kind === 'arrow' ? `<rect x="${x - textW / 2}" y="${top - 2}" width="${textW}" height="${lines.length * lineH + 4}" rx="4" fill="#fff" fill-opacity="0.9"/>` : ''
  return (
    bg +
    `<text font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${textColor(i)}" text-anchor="${center ? 'middle' : 'start'}">` +
    lines.map((l, n) => `<tspan x="${x}" y="${top + n * lineH + size}">${esc(l)}</tspan>`).join('') +
    '</text>'
  )
}

function shape(i: BoardItem, find: Lookup) {
  const dash = i.dashed ? ' stroke-dasharray="8 6"' : ''
  switch (i.kind) {
    case 'note':
      return `<rect x="${i.x + 2}" y="${i.y + 4}" width="${i.w}" height="${i.h}" rx="6" fill="#000" fill-opacity="0.08"/><rect x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}" rx="6" fill="${i.color}"/>`
    case 'rect':
      return `<rect x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}" rx="10" fill="${i.color}" stroke="${darker(i.color)}" stroke-width="1.5"${dash}/>`
    case 'ellipse':
      return `<ellipse cx="${i.x + i.w / 2}" cy="${i.y + i.h / 2}" rx="${i.w / 2}" ry="${i.h / 2}" fill="${i.color}" stroke="${darker(i.color)}" stroke-width="1.5"${dash}/>`
    case 'diamond':
      return `<polygon points="${i.x + i.w / 2},${i.y} ${i.x + i.w},${i.y + i.h / 2} ${i.x + i.w / 2},${i.y + i.h} ${i.x},${i.y + i.h / 2}" fill="${i.color}" stroke="${darker(i.color)}" stroke-width="1.5" stroke-linejoin="round"${dash}/>`
    case 'frame':
      return `<rect x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}" rx="14" fill="${i.color}" stroke="#000" stroke-opacity="0.14" stroke-width="1.2"/>`
    case 'path':
      return `<polyline points="${(i.points ?? []).map((p) => p.join(',')).join(' ')}" fill="none" stroke="${i.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"${dash}/>`
    case 'arrow': {
      const [a, b] = arrowEnds(i, find)
      return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${i.color}" stroke-width="2.5" stroke-linecap="round"${dash}/><polygon points="${arrowHead(a, b)}" fill="${i.color}"/>`
    }
    default:
      return ''
  }
}

/** A standalone SVG of the given items (frames drawn first, like on the board). */
export function boardToSvg(items: BoardItem[], all: BoardItem[] = items) {
  const byId = new Map(all.map((i) => [i.id, i]))
  const find: Lookup = (id) => byId.get(id)
  const bs = items.map((i) => bounds(i, find))
  const P = 40
  const minX = Math.min(...bs.map((b) => b.x)) - P
  const minY = Math.min(...bs.map((b) => b.y)) - P
  const w = Math.max(...bs.map((b) => b.x + b.w)) - minX + P
  const h = Math.max(...bs.map((b) => b.y + b.h)) - minY + P
  const ordered = [...items.filter((i) => i.kind === 'frame'), ...items.filter((i) => i.kind !== 'frame')]
  const body = ordered.map((i) => `<g>${shape(i, find)}${label(i, find)}</g>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="${minX} ${minY} ${w} ${h}"><rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#faf9f6"/>${body}</svg>`
  return { svg, w: Math.ceil(w), h: Math.ceil(h) }
}

export async function svgToPng(svg: string, w: number, h: number, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const k = Math.min(scale, 8000 / Math.max(w, h))
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(w * k), height: Math.round(h * k) })
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('Export failed'))), 'image/png'))
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function saveBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
