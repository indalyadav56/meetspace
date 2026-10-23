import { create } from 'zustand'
import type { Editor, Range } from '@tiptap/core'
import type { SuggestionProps } from '@tiptap/suggestion'
import { format } from 'date-fns'
import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Info,
  Lightbulb,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Table2,
  Type,
  type LucideIcon,
} from 'lucide-react'

export interface SlashCommand {
  key: string
  title: string
  hint: string
  group: 'Basic' | 'Lists' | 'Blocks' | 'Insert'
  icon: LucideIcon
  keywords?: string
  run: (editor: Editor, range: Range) => void
}

/** Requests from the editor for UI the page owns (pickers, dialogs). */
interface DocUi {
  request: null | { kind: 'task' | 'image'; editor: Editor }
  ask: (kind: 'task' | 'image', editor: Editor) => void
  done: () => void
}

export const useDocUi = create<DocUi>()((set) => ({
  request: null,
  ask: (kind, editor) => set({ request: { kind, editor } }),
  done: () => set({ request: null }),
}))

const chain = (e: Editor, r: Range) => e.chain().focus().deleteRange(r)

export const SLASH_COMMANDS: SlashCommand[] = [
  { key: 'text', title: 'Text', hint: 'Plain paragraph', group: 'Basic', icon: Type, keywords: 'paragraph', run: (e, r) => chain(e, r).setParagraph().run() },
  { key: 'h1', title: 'Heading 1', hint: 'Big section title', group: 'Basic', icon: Heading1, keywords: 'title h1', run: (e, r) => chain(e, r).setHeading({ level: 1 }).run() },
  { key: 'h2', title: 'Heading 2', hint: 'Medium section title', group: 'Basic', icon: Heading2, keywords: 'subtitle h2', run: (e, r) => chain(e, r).setHeading({ level: 2 }).run() },
  { key: 'h3', title: 'Heading 3', hint: 'Small section title', group: 'Basic', icon: Heading3, keywords: 'h3', run: (e, r) => chain(e, r).setHeading({ level: 3 }).run() },
  { key: 'bullets', title: 'Bulleted list', hint: 'Simple list', group: 'Lists', icon: List, keywords: 'ul unordered', run: (e, r) => chain(e, r).toggleBulletList().run() },
  { key: 'numbers', title: 'Numbered list', hint: 'Ordered steps', group: 'Lists', icon: ListOrdered, keywords: 'ol ordered', run: (e, r) => chain(e, r).toggleOrderedList().run() },
  { key: 'todo', title: 'Checklist', hint: 'Track to-dos', group: 'Lists', icon: ListChecks, keywords: 'task todo check', run: (e, r) => chain(e, r).toggleTaskList().run() },
  { key: 'quote', title: 'Quote', hint: 'Call out a quotation', group: 'Blocks', icon: Quote, keywords: 'blockquote', run: (e, r) => chain(e, r).toggleBlockquote().run() },
  { key: 'note', title: 'Note callout', hint: 'Highlight information', group: 'Blocks', icon: Info, keywords: 'callout info', run: (e, r) => chain(e, r).setCallout('info').run() },
  { key: 'tip', title: 'Tip callout', hint: 'Share a good practice', group: 'Blocks', icon: Lightbulb, keywords: 'callout success idea', run: (e, r) => chain(e, r).setCallout('success').run() },
  { key: 'warn', title: 'Warning callout', hint: 'Flag a risk', group: 'Blocks', icon: AlertTriangle, keywords: 'callout caution danger', run: (e, r) => chain(e, r).setCallout('warning').run() },
  { key: 'code', title: 'Code block', hint: 'With syntax highlighting', group: 'Blocks', icon: Code2, keywords: 'snippet pre', run: (e, r) => chain(e, r).setCodeBlock().run() },
  { key: 'table', title: 'Table', hint: '3 × 3 grid', group: 'Blocks', icon: Table2, keywords: 'grid rows columns', run: (e, r) => chain(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { key: 'divider', title: 'Divider', hint: 'Separate sections', group: 'Blocks', icon: Minus, keywords: 'hr line rule', run: (e, r) => chain(e, r).setHorizontalRule().run() },
  {
    key: 'task',
    title: 'Link a task',
    hint: 'Mention a task by name',
    group: 'Insert',
    icon: CheckSquare,
    keywords: 'mention ms reference',
    run: (e, r) => {
      chain(e, r).run()
      useDocUi.getState().ask('task', e)
    },
  },
  {
    key: 'image',
    title: 'Image',
    hint: 'Upload or paste a link',
    group: 'Insert',
    icon: ImageIcon,
    keywords: 'picture photo',
    run: (e, r) => {
      chain(e, r).run()
      useDocUi.getState().ask('image', e)
    },
  },
  { key: 'date', title: 'Today’s date', hint: format(new Date(), 'MMM d, yyyy'), group: 'Insert', icon: CalendarDays, keywords: 'now today', run: (e, r) => chain(e, r).insertContent(format(new Date(), 'MMMM d, yyyy') + ' ').run() },
  {
    key: 'link',
    title: 'Web link',
    hint: 'Insert a URL',
    group: 'Insert',
    icon: Link2,
    keywords: 'url href',
    run: (e, r) => {
      const url = window.prompt('Link URL')
      if (!url) return chain(e, r).run()
      chain(e, r).insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).insertContent(' ').run()
    },
  },
]

export function filterCommands(query: string) {
  const q = query.toLowerCase().trim()
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter((c) => (c.title + ' ' + (c.keywords ?? '')).toLowerCase().includes(q)).slice(0, 12)
}

/** State of the open "/" menu, driven by the suggestion plugin. */
interface SlashState {
  open: boolean
  items: SlashCommand[]
  index: number
  rect: DOMRect | null
  pick: ((c: SlashCommand) => void) | null
  show: (p: SuggestionProps<SlashCommand>) => void
  hide: () => void
  key: (e: KeyboardEvent) => boolean
  choose: (i: number) => void
}

export const useSlash = create<SlashState>()((set, get) => ({
  open: false,
  items: [],
  index: 0,
  rect: null,
  pick: null,
  show: (p) => set((s) => ({ open: true, items: p.items, rect: p.clientRect?.() ?? null, pick: (c) => p.command(c), index: s.open ? Math.min(s.index, Math.max(0, p.items.length - 1)) : 0 })),
  hide: () => set({ open: false, pick: null }),
  choose: (i) => {
    const { items, pick } = get()
    if (items[i] && pick) pick(items[i])
  },
  key: (e) => {
    const s = get()
    if (!s.open || !s.items.length) return false
    if (e.key === 'ArrowDown') return set({ index: (s.index + 1) % s.items.length }), true
    if (e.key === 'ArrowUp') return set({ index: (s.index - 1 + s.items.length) % s.items.length }), true
    if (e.key === 'Enter' || e.key === 'Tab') return s.choose(s.index), true
    if (e.key === 'Escape') return s.hide(), true
    return false
  },
}))
