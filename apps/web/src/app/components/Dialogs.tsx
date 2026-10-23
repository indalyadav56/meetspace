import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Keyboard, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { LIST_TEMPLATES } from '../../store/templates'
import type { ID } from '../../store/types'
import { Modal } from './ui'
import { cn } from '../../lib/utils'

export function TemplatePicker({ spaceId, open, onClose }: { spaceId: ID; open: boolean; onClose: () => void }) {
  const applyTemplate = useStore((s) => s.applyTemplate)
  const space = useStore((s) => s.spaces.find((sp) => sp.id === spaceId))
  const nav = useNavigate()
  const [key, setKey] = useState(LIST_TEMPLATES[0].key)
  const tpl = LIST_TEMPLATES.find((t) => t.key === key)!
  const [name, setName] = useState(tpl.name)

  return (
    <Modal open={open} onClose={onClose} className="mt-[8vh] flex max-h-[80vh] max-w-3xl flex-col">
      <div className="border-app flex items-center border-b px-5 py-3">
        <h2 className="font-semibold">New List from a template</h2>
        <span className="text-muted ml-2 text-sm">in {space?.name}</span>
        <button onClick={onClose} className="hover-surface text-muted ml-auto rounded p-1" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <div className="border-app flex shrink-0 gap-1 overflow-x-auto border-b p-2 sm:w-56 sm:flex-col sm:border-r sm:border-b-0">
          {LIST_TEMPLATES.map((t) => (
            <button
              key={t.key}
              onClick={() => (setKey(t.key), setName(t.name))}
              className={cn('flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm', key === t.key ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-100 font-medium' : 'hover-surface')}
            >
              <span className="text-lg">{t.emoji}</span> {t.name}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="text-4xl">{tpl.emoji}</div>
          <h3 className="mt-2 text-lg font-semibold">{tpl.name}</h3>
          <p className="text-muted text-sm">{tpl.description}</p>
          <div className="text-faint mt-4 mb-1 text-[11px] font-semibold uppercase">Includes {tpl.tasks.length} tasks</div>
          <ul className="border-app divide-y divide-[var(--border)] rounded-lg border text-sm">
            {tpl.tasks.map((t) => (
              <li key={t.title} className="flex items-center gap-2 px-3 py-2">
                <span className={cn('h-3 w-3 rounded-full border-2', t.status === 'done' ? 'border-emerald-500 bg-emerald-500' : t.status === 'active' ? 'border-blue-500' : 'border-slate-400')} />
                {t.title}
                {t.subtasks && <span className="text-faint ml-auto text-xs">+{t.subtasks.length} subtasks</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <form
        className="border-app flex items-center gap-2 border-t px-5 py-3"
        onSubmit={(e) => {
          e.preventDefault()
          const id = applyTemplate(spaceId, key, name.trim() || tpl.name)
          onClose()
          nav(`/app/list/${id}`)
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} className="border-app min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none" aria-label="List name" />
        <button className="bg-brand-600 rounded-lg px-3 py-1.5 text-sm font-semibold text-white">Use template</button>
      </form>
    </Modal>
  )
}

const SHORTCUTS: [string, string][] = [
  ['⌘ K', 'Search everything'],
  ['⌘ J', 'Open the AI assistant'],
  ['C', 'Create a task'],
  ['?', 'Show this help'],
  ['G then H', 'Go to Home'],
  ['G then I', 'Go to Inbox'],
  ['G then C', 'Go to Chat'],
  ['G then D', 'Go to Docs'],
  ['G then T', 'Go to Timesheets'],
  ['Esc', 'Close panels and menus'],
  ['Whiteboard: V H N R O T P', 'Select, pan, note, rect, ellipse, text, pen'],
  ['Whiteboard: ⌘ Z / ⇧⌘ Z', 'Undo / redo'],
  ['Comment: ⌘ Enter', 'Send comment'],
]

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} className="mt-[10vh] max-w-lg">
      <div className="border-app flex items-center border-b px-5 py-3">
        <Keyboard size={17} className="mr-2" />
        <h2 className="font-semibold">Keyboard shortcuts</h2>
        <button onClick={onClose} className="hover-surface text-muted ml-auto rounded p-1" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <ul className="divide-y divide-[var(--border)] px-5 py-2 text-sm">
        {SHORTCUTS.map(([k, d]) => (
          <li key={k} className="flex items-center gap-4 py-2">
            <span className="text-muted flex-1">{d}</span>
            <kbd className="surface-muted border-app rounded border px-2 py-0.5 font-mono text-xs">{k}</kbd>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
