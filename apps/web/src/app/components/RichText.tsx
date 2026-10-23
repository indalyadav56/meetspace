import { useEffect } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Bold, Code, Heading1, Heading2, Heading3, Italic, List, ListChecks, ListOrdered, Minus, Quote, Strikethrough } from 'lucide-react'
import { cn } from '../../lib/utils'

export function useRichEditor(content: string, onChange: (html: string) => void, placeholder: string) {
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder }), TaskList, TaskItem.configure({ nested: true })],
    content,
    editorProps: { attributes: { class: 'prose-doc' } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  })
  return editor
}

export function Toolbar({ editor, className }: { editor: Editor | null; className?: string }) {
  if (!editor) return null
  const btn = (active: boolean, onClick: () => void, Icon: typeof Bold, label: string) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn('rounded p-1.5', active ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/25 dark:text-brand-100' : 'text-muted hover-surface')}
    >
      <Icon size={15} />
    </button>
  )
  const c = () => editor.chain().focus()
  return (
    <div className={cn('flex flex-wrap items-center gap-0.5', className)}>
      {btn(editor.isActive('heading', { level: 1 }), () => c().toggleHeading({ level: 1 }).run(), Heading1, 'Heading 1')}
      {btn(editor.isActive('heading', { level: 2 }), () => c().toggleHeading({ level: 2 }).run(), Heading2, 'Heading 2')}
      {btn(editor.isActive('heading', { level: 3 }), () => c().toggleHeading({ level: 3 }).run(), Heading3, 'Heading 3')}
      <span className="border-app mx-1 h-5 border-l" />
      {btn(editor.isActive('bold'), () => c().toggleBold().run(), Bold, 'Bold')}
      {btn(editor.isActive('italic'), () => c().toggleItalic().run(), Italic, 'Italic')}
      {btn(editor.isActive('strike'), () => c().toggleStrike().run(), Strikethrough, 'Strikethrough')}
      {btn(editor.isActive('code'), () => c().toggleCode().run(), Code, 'Inline code')}
      <span className="border-app mx-1 h-5 border-l" />
      {btn(editor.isActive('bulletList'), () => c().toggleBulletList().run(), List, 'Bulleted list')}
      {btn(editor.isActive('orderedList'), () => c().toggleOrderedList().run(), ListOrdered, 'Numbered list')}
      {btn(editor.isActive('taskList'), () => c().toggleTaskList().run(), ListChecks, 'Checklist')}
      {btn(editor.isActive('blockquote'), () => c().toggleBlockquote().run(), Quote, 'Quote')}
      {btn(false, () => c().setHorizontalRule().run(), Minus, 'Divider')}
    </div>
  )
}

/** Compact editor used inside task descriptions. Re-syncs when the source id changes. */
export function RichText({ sourceId, value, onChange, placeholder = 'Add a description…', toolbar = true }: { sourceId: string; value: string; onChange: (html: string) => void; placeholder?: string; toolbar?: boolean }) {
  const editor = useRichEditor(value, onChange, placeholder)
  useEffect(() => {
    if (editor && editor.getHTML() !== value) editor.commands.setContent(value, false)
    // only on identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, editor])
  return (
    <div className="group/rt">
      {toolbar && <Toolbar editor={editor} className="mb-1 opacity-60 group-focus-within/rt:opacity-100" />}
      <EditorContent editor={editor} />
    </div>
  )
}
