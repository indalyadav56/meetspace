import type { Editor } from '@tiptap/react'
import { cn } from '../../lib/utils'

export interface Heading {
  level: number
  text: string
  pos: number
}

export function headings(editor: Editor | null): Heading[] {
  const out: Heading[] = []
  editor?.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') out.push({ level: node.attrs.level as number, text: node.textContent, pos })
    return node.type.name !== 'heading'
  })
  return out
}

/** Clickable table of contents built from the doc's headings. */
export function Outline({ editor, className }: { editor: Editor | null; className?: string }) {
  const list = headings(editor)
  const current = editor ? editor.state.selection.from : -1
  const active = list.reduce((a, h, i) => (h.pos <= current ? i : a), -1)
  const jump = (h: Heading) => {
    if (!editor) return
    const dom = editor.view.nodeDOM(h.pos)
    if (dom instanceof HTMLElement) dom.scrollIntoView({ behavior: 'smooth', block: 'start' })
    editor.chain().setTextSelection(h.pos + 1).focus(undefined, { scrollIntoView: false }).run()
  }
  return (
    <nav aria-label="Outline" className={className}>
      <div className="text-faint mb-2 px-2 text-[11px] font-semibold tracking-wide uppercase">On this page</div>
      {list.length === 0 ? (
        <p className="text-faint px-2 text-xs">Add headings to build an outline.</p>
      ) : (
        list.map((h, i) => (
          <button
            key={h.pos}
            onClick={() => jump(h)}
            className={cn('block w-full truncate rounded px-2 py-1 text-left text-[13px]', i === active ? 'text-brand-700 dark:text-brand-300 font-medium' : 'text-muted hover:text-app')}
            style={{ paddingLeft: 8 + (h.level - 1) * 12 }}
          >
            {h.text || 'Untitled heading'}
          </button>
        ))
      )}
    </nav>
  )
}
