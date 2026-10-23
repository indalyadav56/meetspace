import type { ReactNode } from 'react'
import { BubbleMenu, type Editor } from '@tiptap/react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  Code,
  Code2,
  Highlighter,
  Image as ImageIcon,
  Info,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
  CheckSquare,
  type LucideIcon,
} from 'lucide-react'
import { Popover, usePopover } from '../components/ui'
import { CODE_LANGUAGES } from './extensions'
import { useDocUi } from './slash'
import { cn } from '../../lib/utils'

const TEXT_COLORS = ['', '#b91c1c', '#c2410c', '#a16207', '#15803d', '#0b7f71', '#1d4ed8', '#7e22ce', '#78716c']
const HIGHLIGHTS = ['#fef08a', '#bbf7d0', '#a5f3fc', '#fbcfe8', '#fed7aa', '#ddd6fe']

function Btn({ on, label, icon: Icon, onClick, disabled }: { on?: boolean; label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn('rounded-md p-1.5 disabled:opacity-30', on ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/25 dark:text-brand-100' : 'text-muted hover-surface')}
    >
      <Icon size={15} />
    </button>
  )
}

const Sep = () => <span className="border-app mx-1 h-5 border-l" />

export function setLink(editor: Editor) {
  const prev = editor.getAttributes('link').href as string | undefined
  const url = window.prompt('Link URL (leave empty to remove)', prev ?? 'https://')
  if (url === null) return
  if (url.trim() === '' || url === 'https://') editor.chain().focus().extendMarkRange('link').unsetLink().run()
  else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
}

function Swatches({ editor, kind, onPick }: { editor: Editor; kind: 'color' | 'highlight'; onPick: () => void }) {
  const list = kind === 'color' ? TEXT_COLORS : ['', ...HIGHLIGHTS]
  return (
    <div className="grid grid-cols-5 gap-1 p-1">
      {list.map((c) => (
        <button
          key={c || 'none'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const ch = editor.chain().focus()
            if (kind === 'color') (c ? ch.setColor(c) : ch.unsetColor()).run()
            else (c ? ch.setHighlight({ color: c }) : ch.unsetHighlight()).run()
            onPick()
          }}
          className="border-app flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold"
          style={kind === 'color' ? { color: c || undefined } : { background: c || undefined }}
          aria-label={c ? `${kind} ${c}` : `No ${kind}`}
        >
          {kind === 'color' ? 'A' : c ? '' : '∅'}
        </button>
      ))}
    </div>
  )
}

function ColorButtons({ editor }: { editor: Editor }) {
  const color = usePopover()
  const mark = usePopover()
  return (
    <>
      <button type="button" title="Text color" aria-label="Text color" onMouseDown={(e) => e.preventDefault()} onClick={color.toggle} className="text-muted hover-surface rounded-md p-1.5">
        <Baseline size={15} style={{ color: editor.getAttributes('textStyle').color }} />
      </button>
      <Popover open={color.open} anchor={color.anchor} onClose={color.close} width={180}>
        <Swatches editor={editor} kind="color" onPick={color.close} />
      </Popover>
      <Btn on={editor.isActive('highlight')} label="Highlight" icon={Highlighter} onClick={mark.toggle as () => void} />
      <Popover open={mark.open} anchor={mark.anchor} onClose={mark.close} width={180}>
        <Swatches editor={editor} kind="highlight" onPick={mark.close} />
      </Popover>
    </>
  )
}

function BlockType({ editor }: { editor: Editor }) {
  const value = editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : editor.isActive('codeBlock') ? 'code' : editor.isActive('blockquote') ? 'quote' : 'p'
  return (
    <select
      value={value}
      onChange={(e) => {
        const c = editor.chain().focus()
        const v = e.target.value
        if (v === 'p') c.setParagraph().run()
        else if (v === 'code') c.setCodeBlock().run()
        else if (v === 'quote') c.toggleBlockquote().run()
        else c.setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run()
      }}
      className="border-app surface h-7 rounded-md border px-1.5 text-xs"
      aria-label="Block type"
    >
      <option value="p">Text</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
      <option value="quote">Quote</option>
      <option value="code">Code</option>
    </select>
  )
}

function Group({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>
}

/** The full toolbar above the page. Context rows appear inside tables and code blocks. */
export function DocToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null
  const c = () => editor.chain().focus()
  const inTable = editor.isActive('table')
  const inCode = editor.isActive('codeBlock')
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-wrap items-center justify-center gap-0.5">
        <Group>
          <Btn label="Undo" icon={Undo2} onClick={() => c().undo().run()} disabled={!editor.can().undo()} />
          <Btn label="Redo" icon={Redo2} onClick={() => c().redo().run()} disabled={!editor.can().redo()} />
        </Group>
        <Sep />
        <BlockType editor={editor} />
        <Sep />
        <Group>
          <Btn on={editor.isActive('bold')} label="Bold (⌘B)" icon={Bold} onClick={() => c().toggleBold().run()} />
          <Btn on={editor.isActive('italic')} label="Italic (⌘I)" icon={Italic} onClick={() => c().toggleItalic().run()} />
          <Btn on={editor.isActive('underline')} label="Underline (⌘U)" icon={UnderlineIcon} onClick={() => c().toggleUnderline().run()} />
          <Btn on={editor.isActive('strike')} label="Strikethrough" icon={Strikethrough} onClick={() => c().toggleStrike().run()} />
          <Btn on={editor.isActive('code')} label="Inline code" icon={Code} onClick={() => c().toggleCode().run()} />
          <ColorButtons editor={editor} />
          <Btn on={editor.isActive('link')} label="Link" icon={Link2} onClick={() => setLink(editor)} />
        </Group>
        <Sep />
        <Group>
          <Btn on={editor.isActive({ textAlign: 'left' })} label="Align left" icon={AlignLeft} onClick={() => c().setTextAlign('left').run()} />
          <Btn on={editor.isActive({ textAlign: 'center' })} label="Align center" icon={AlignCenter} onClick={() => c().setTextAlign('center').run()} />
          <Btn on={editor.isActive({ textAlign: 'right' })} label="Align right" icon={AlignRight} onClick={() => c().setTextAlign('right').run()} />
        </Group>
        <Sep />
        <Group>
          <Btn on={editor.isActive('bulletList')} label="Bulleted list" icon={List} onClick={() => c().toggleBulletList().run()} />
          <Btn on={editor.isActive('orderedList')} label="Numbered list" icon={ListOrdered} onClick={() => c().toggleOrderedList().run()} />
          <Btn on={editor.isActive('taskList')} label="Checklist" icon={ListChecks} onClick={() => c().toggleTaskList().run()} />
          <Btn on={editor.isActive('blockquote')} label="Quote" icon={Quote} onClick={() => c().toggleBlockquote().run()} />
          <Btn on={editor.isActive('callout')} label="Callout" icon={Info} onClick={() => c().toggleCallout('info').run()} />
          <Btn on={inCode} label="Code block" icon={Code2} onClick={() => c().toggleCodeBlock().run()} />
        </Group>
        <Sep />
        <Group>
          <Btn label="Insert table" icon={Table2} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
          <Btn label="Insert image" icon={ImageIcon} onClick={() => useDocUi.getState().ask('image', editor)} />
          <Btn label="Link a task" icon={CheckSquare} onClick={() => useDocUi.getState().ask('task', editor)} />
          <Btn label="Divider" icon={Minus} onClick={() => c().setHorizontalRule().run()} />
        </Group>
      </div>

      {inTable && (
        <div className="surface-subtle border-app flex flex-wrap items-center gap-1 rounded-lg border px-2 py-1 text-xs">
          <span className="text-faint mr-1 font-semibold">Table</span>
          {(
            [
              ['+ Row above', () => c().addRowBefore().run()],
              ['+ Row below', () => c().addRowAfter().run()],
              ['+ Column left', () => c().addColumnBefore().run()],
              ['+ Column right', () => c().addColumnAfter().run()],
              ['− Row', () => c().deleteRow().run()],
              ['− Column', () => c().deleteColumn().run()],
              ['Header row', () => c().toggleHeaderRow().run()],
              ['Merge / split', () => c().mergeOrSplit().run()],
            ] as const
          ).map(([label, fn]) => (
            <button key={label} onMouseDown={(e) => e.preventDefault()} onClick={fn} className="hover-surface rounded px-1.5 py-0.5">
              {label}
            </button>
          ))}
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => c().deleteTable().run()} className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
            <Trash2 size={12} /> Delete table
          </button>
        </div>
      )}
      {inCode && (
        <div className="surface-subtle border-app flex items-center gap-2 rounded-lg border px-2 py-1 text-xs">
          <span className="text-faint font-semibold">Language</span>
          <select value={editor.getAttributes('codeBlock').language ?? 'plaintext'} onChange={(e) => c().updateAttributes('codeBlock', { language: e.target.value }).run()} className="border-app surface h-6 rounded border px-1" aria-label="Code language">
            {CODE_LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

/** Appears over selected text for quick formatting. */
export function SelectionBar({ editor }: { editor: Editor | null }) {
  if (!editor) return null
  const c = () => editor.chain().focus()
  return (
    <BubbleMenu editor={editor} tippyOptions={{ duration: 120, maxWidth: 'none' }} shouldShow={({ editor: e, from, to }) => from !== to && !e.isActive('codeBlock') && !e.isActive('image')}>
      <div className="surface shadow-pop flex items-center gap-0.5 rounded-lg p-1">
        <Btn on={editor.isActive('bold')} label="Bold" icon={Bold} onClick={() => c().toggleBold().run()} />
        <Btn on={editor.isActive('italic')} label="Italic" icon={Italic} onClick={() => c().toggleItalic().run()} />
        <Btn on={editor.isActive('underline')} label="Underline" icon={UnderlineIcon} onClick={() => c().toggleUnderline().run()} />
        <Btn on={editor.isActive('strike')} label="Strikethrough" icon={Strikethrough} onClick={() => c().toggleStrike().run()} />
        <Btn on={editor.isActive('code')} label="Inline code" icon={Code} onClick={() => c().toggleCode().run()} />
        <Sep />
        <ColorButtons editor={editor} />
        {editor.isActive('link') ? <Btn label="Remove link" icon={Unlink} onClick={() => c().unsetLink().run()} /> : <Btn label="Link" icon={Link2} onClick={() => setLink(editor)} />}
      </div>
    </BubbleMenu>
  )
}
