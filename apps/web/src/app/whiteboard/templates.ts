import type { BoardItem } from '../../store/types'
import { uid } from '../../lib/utils'
import { arrowEnds, type Lookup } from './shapes'

export interface BoardTemplate {
  key: string
  title: string
  emoji: string
  hint: string
  /** Items laid out around (0, 0). */
  items: () => BoardItem[]
}

type Partial0 = Omit<BoardItem, 'id' | 'text' | 'color'> & { text?: string; color?: string; id?: string }
const mk = (p: Partial0): BoardItem => ({ id: p.id ?? uid('b'), text: '', color: '#ffffff', taskId: null, ...p })
const frame = (x: number, y: number, w: number, h: number, text: string, color: string) => mk({ kind: 'frame', x, y, w, h, text, color })
const note = (x: number, y: number, text: string, color: string) => mk({ kind: 'note', x, y, w: 170, h: 120, text, color })
const arrow = (fromId: string, toId: string, text = '') => mk({ kind: 'arrow', x: 0, y: 0, w: 0, h: 0, color: '#64748b', fromId, toId, text })

function columns(titles: [string, string, string][], hints: string[]): BoardItem[] {
  return titles.flatMap(([title, fill, sticky], i) => {
    const x = -570 + i * 390
    return [frame(x, -260, 360, 520, title, fill), note(x + 24, -190, hints[i], sticky)]
  })
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    key: 'retro',
    title: 'Retrospective',
    emoji: '🔁',
    hint: 'Went well · To improve · Actions',
    items: () =>
      columns(
        [
          ['😀 Went well', '#ecfdf5', '#bbf7d0'],
          ['🤔 To improve', '#fff7ed', '#fed7aa'],
          ['✅ Action items', '#eff6ff', '#bae6fd'],
        ],
        ['Add a sticky for each win', 'What slowed us down?', 'Turn a sticky into a task'],
      ),
  },
  {
    key: 'kanban',
    title: 'Kanban',
    emoji: '🗂️',
    hint: 'To do · Doing · Done',
    items: () =>
      columns(
        [
          ['To do', '#f1f5f9', '#fde68a'],
          ['Doing', '#eff6ff', '#bae6fd'],
          ['Done', '#ecfdf5', '#bbf7d0'],
        ],
        ['Drag notes between columns', 'Work in progress', 'Shipped 🎉'],
      ),
  },
  {
    key: 'flow',
    title: 'Flowchart',
    emoji: '🔀',
    hint: 'Start, steps, a decision, outcomes',
    items: () => {
      const start = mk({ kind: 'ellipse', x: -80, y: -300, w: 160, h: 70, text: 'Start', color: '#99f6e4' })
      const step = mk({ kind: 'rect', x: -90, y: -170, w: 180, h: 80, text: 'Do the thing', color: '#c7d2fe' })
      const ask = mk({ kind: 'diamond', x: -100, y: -40, w: 200, h: 130, text: 'Did it work?', color: '#fde68a' })
      const yes = mk({ kind: 'rect', x: -330, y: 150, w: 180, h: 80, text: 'Ship it', color: '#bbf7d0' })
      const no = mk({ kind: 'rect', x: 150, y: 150, w: 180, h: 80, text: 'Fix and retry', color: '#fecaca' })
      return [start, step, ask, yes, no, arrow(start.id, step.id), arrow(step.id, ask.id), arrow(ask.id, yes.id, 'Yes'), arrow(ask.id, no.id, 'No'), arrow(no.id, step.id)]
    },
  },
  {
    key: 'mind',
    title: 'Mind map',
    emoji: '🧠',
    hint: 'One idea, many branches',
    items: () => {
      const hub = mk({ kind: 'ellipse', x: -110, y: -55, w: 220, h: 110, text: 'Big idea', color: '#c7d2fe', bold: true, fontSize: 18 })
      const spots: [number, number, string, string][] = [
        [-420, -230, 'Why', '#fde68a'],
        [250, -230, 'Who', '#bbf7d0'],
        [-420, 150, 'How', '#bae6fd'],
        [250, 150, 'When', '#fbcfe8'],
      ]
      const branches = spots.map(([x, y, text, color]) => mk({ kind: 'rect', x, y, w: 170, h: 70, text, color }))
      return [hub, ...branches, ...branches.map((b) => arrow(hub.id, b.id))]
    },
  },
  {
    key: 'swot',
    title: 'SWOT',
    emoji: '🧭',
    hint: 'Strengths, weaknesses, opportunities, threats',
    items: () => [
      frame(-420, -320, 410, 310, '💪 Strengths', '#ecfdf5'),
      frame(10, -320, 410, 310, '⚠️ Weaknesses', '#fff7ed'),
      frame(-420, 10, 410, 310, '🌱 Opportunities', '#eff6ff'),
      frame(10, 10, 410, 310, '⛈️ Threats', '#fdf2f8'),
    ],
  },
]

/** Copies items with fresh ids (keeping arrows attached) and moves them by dx, dy. */
export function cloneItems(items: BoardItem[], dx: number, dy: number, find?: Lookup) {
  const ids = new Map(items.map((i) => [i.id, uid('b')]))
  return items.map((i) => {
    const copy: BoardItem = { ...i, id: ids.get(i.id)!, x: i.x + dx, y: i.y + dy, taskId: null, locked: false, points: i.points?.map(([x, y]) => [x + dx, y + dy] as [number, number]) }
    if (i.kind === 'arrow') {
      const loose = (i.fromId && !ids.has(i.fromId)) || (i.toId && !ids.has(i.toId))
      if (loose) {
        // Ends attached to items outside the copy become fixed points.
        const [a, b] = arrowEnds(i, find)
        copy.points = [
          [a[0] + dx, a[1] + dy],
          [b[0] + dx, b[1] + dy],
        ]
      }
      copy.fromId = i.fromId ? (ids.get(i.fromId) ?? null) : null
      copy.toId = i.toId ? (ids.get(i.toId) ?? null) : null
    }
    return copy
  })
}
