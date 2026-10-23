import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckSquare, FileText, Hash, List as ListIcon, PenTool, Search, Trophy } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Modal } from './components/ui'
import { cn } from '../lib/utils'

type Result = { id: string; label: string; sub: string; kind: 'task' | 'doc' | 'list' | 'channel' | 'board' | 'goal'; go: () => void }

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tasks, docs, lists, openTask, channels, whiteboards, goals } = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)

  useEffect(() => {
    if (open) {
      setQ('')
      setI(0)
    }
  }, [open])

  const results = useMemo<Result[]>(() => {
    const needle = q.toLowerCase()
    const listName = (id: string) => lists.find((l) => l.id === id)?.name ?? ''
    const r: Result[] = [
      ...tasks.filter((t) => t.title.toLowerCase().includes(needle)).map((t) => ({ id: t.id, label: t.title, sub: `MS-${t.key} · ${listName(t.listId)}`, kind: 'task' as const, go: () => openTask(t.id) })),
      ...docs.filter((d) => (d.title || 'Untitled').toLowerCase().includes(needle)).map((d) => ({ id: d.id, label: d.title || 'Untitled', sub: 'Doc', kind: 'doc' as const, go: () => nav(`/app/docs/${d.id}`) })),
      ...lists.filter((l) => l.name.toLowerCase().includes(needle)).map((l) => ({ id: l.id, label: l.name, sub: 'List', kind: 'list' as const, go: () => nav(`/app/list/${l.id}`) })),
      ...channels.filter((c) => c.kind === 'channel' && c.name.includes(needle)).map((c) => ({ id: c.id, label: `#${c.name}`, sub: 'Channel', kind: 'channel' as const, go: () => nav(`/app/chat/${c.id}`) })),
      ...whiteboards.filter((w) => w.title.toLowerCase().includes(needle)).map((w) => ({ id: w.id, label: w.title, sub: 'Whiteboard', kind: 'board' as const, go: () => nav(`/app/whiteboards/${w.id}`) })),
      ...goals.filter((g) => g.name.toLowerCase().includes(needle)).map((g) => ({ id: g.id, label: g.name, sub: 'Goal', kind: 'goal' as const, go: () => nav('/app/goals') })),
    ]
    return r.slice(0, 12)
  }, [q, tasks, docs, lists, nav, openTask, channels, whiteboards, goals])

  const pick = (r: Result) => {
    r.go()
    onClose()
  }

  const Icon = { task: CheckSquare, doc: FileText, list: ListIcon, channel: Hash, board: PenTool, goal: Trophy }

  return (
    <Modal open={open} onClose={onClose} className="mt-[10vh] max-w-xl">
      <div className="border-app flex items-center gap-2 border-b px-4">
        <Search size={17} className="text-faint" />
        <input
          autoFocus
          value={q}
          onChange={(e) => (setQ(e.target.value), setI(0))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), setI((x) => Math.min(x + 1, results.length - 1)))
            if (e.key === 'ArrowUp') (e.preventDefault(), setI((x) => Math.max(x - 1, 0)))
            if (e.key === 'Enter' && results[i]) pick(results[i])
          }}
          placeholder="Search everything…"
          className="h-12 flex-1 bg-transparent text-[15px] outline-none"
        />
      </div>
      <div className="max-h-[50vh] overflow-y-auto p-1.5">
        {results.length === 0 && <div className="text-muted p-6 text-center text-sm">No results for “{q}”</div>}
        {results.map((r, idx) => {
          const I = Icon[r.kind]
          return (
            <button
              key={r.kind + r.id}
              onMouseEnter={() => setI(idx)}
              onClick={() => pick(r)}
              className={cn('flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm', idx === i && 'surface-muted')}
            >
              <I size={16} className="text-muted" />
              <span className="truncate">{r.label}</span>
              <span className="text-faint ml-auto shrink-0 text-xs">{r.sub}</span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
