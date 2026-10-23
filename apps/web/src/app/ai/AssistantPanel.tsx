import { Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUp, CheckSquare, FileText, Info, Plus, Sparkles, Square, X } from 'lucide-react'
import { useMe, useStore } from '../../store/useStore'
import { useAssistant, type ChatItem } from './useAssistant'
import { cn } from '../../lib/utils'

const SUGGESTIONS = ['What should I work on next?', "What's overdue?", 'Write my standup', 'Give me a status report', 'Create task Review Q4 budget for me due Friday']
const TASK_SUGGESTIONS = ['Summarize this task', 'Break this task into subtasks']

/* ---------------- tiny markdown renderer ---------------- */

function Inline({ text }: { text: string }) {
  const { tasks, openTask } = useStore()
  const parts: React.ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\bMS-\d+\b)/g
  let last = 0
  for (const m of text.matchAll(re)) {
    parts.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) parts.push(<strong key={m.index}>{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith('_')) parts.push(<em key={m.index}>{tok.slice(1, -1)}</em>)
    else if (tok.startsWith('`')) parts.push(<code key={m.index} className="surface-muted rounded px-1 text-[0.9em]">{tok.slice(1, -1)}</code>)
    else {
      const t = tasks.find((x) => x.key === Number(tok.slice(3)))
      parts.push(
        t ? (
          <button key={m.index} onClick={() => openTask(t.id)} className="bg-brand-50 text-brand-700 dark:bg-brand-600/25 dark:text-brand-100 rounded px-1 font-medium hover:underline">
            {tok}
          </button>
        ) : (
          tok
        ),
      )
    }
    last = (m.index ?? 0) + tok.length
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}

export function RichAnswer({ text }: { text: string }) {
  const blocks: React.ReactNode[] = []
  let bullets: { ordered: boolean; items: string[] } | null = null
  const flush = () => {
    if (!bullets) return
    const L = bullets.ordered ? 'ol' : 'ul'
    blocks.push(
      <L key={blocks.length} className={cn('my-1 space-y-0.5 pl-5', bullets.ordered ? 'list-decimal' : 'list-disc')}>
        {bullets.items.map((b, i) => (
          <li key={i}>
            <Inline text={b} />
          </li>
        ))}
      </L>,
    )
    bullets = null
  }
  for (const line of text.split('\n')) {
    const b = line.match(/^\s*[-*•]\s+(.*)/)
    const n = line.match(/^\s*\d+[.)]\s+(.*)/)
    const h = line.match(/^#{1,4}\s+(.*)/)
    if (b || n) {
      const ordered = !!n
      if (bullets && bullets.ordered !== ordered) flush()
      bullets ??= { ordered, items: [] }
      bullets.items.push((b ?? n)![1])
    } else {
      flush()
      if (h) blocks.push(<p key={blocks.length} className="mt-2 font-semibold"><Inline text={h[1]} /></p>)
      else if (line.trim()) blocks.push(<p key={blocks.length} className="my-1"><Inline text={line} /></p>)
    }
  }
  flush()
  return <>{blocks}</>
}

/* ---------------- panel ---------------- */

/** "gemini-3.5-flash" → "Gemini 3.5 Flash" */
function modelName(id: string) {
  return id ? id.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join(' ') : 'Assistant'
}

export default function AssistantPanel() {
  const { open, items, busy, status, agent, setOpen, ask, stop, reset } = useAssistant()
  const { openTaskId, tasks, docs } = useStore()
  const me = useMe()
  const nav = useNavigate()
  const [text, setText] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [items, status])
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  // The AI page shows the same conversation full-size, so the panel steps aside there.
  if (!open || location.pathname.startsWith('/app/ai')) return null
  const engine = agent?.enabled ? 'server' : 'local'
  const send = (t: string) => {
    ask(t)
    setText('')
  }

  return (
    <aside className="surface border-app shadow-pop fixed inset-y-0 right-0 z-[45] flex w-full flex-col border-l sm:w-[420px]" aria-label="AI assistant">
      <header className="border-app flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Sparkles size={15} />
        </span>
        <span className="font-semibold">Assistant</span>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', engine === 'server' ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200' : 'surface-muted text-muted')}>
          {engine === 'server' ? modelName(agent!.model) : 'Offline mode'}
        </span>
        <div className="ml-auto flex items-center">
          <button onClick={reset} className="hover-surface text-muted rounded-md p-1.5" title="New conversation">
            <Plus size={16} />
          </button>
          <button onClick={() => setOpen(false)} className="hover-surface text-muted rounded-md p-1.5" aria-label="Close assistant">
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scroll-thin">
        {items.length === 0 && (
          <div className="mt-6">
            <div className="text-2xl font-bold tracking-tight">Hi {me.name.split(' ')[0]} 👋</div>
            <p className="text-muted mt-1 text-sm">Ask about your work, or tell me what to change. I can search, create and update tasks, write docs, and summarise progress.</p>
            {engine === 'local' && (
              <p className="border-app mt-3 flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-xs">
                <Info size={14} className="text-brand-600 mt-0.5 shrink-0" /> Running in offline mode with a fixed set of requests. An admin can turn on the full assistant by setting a Gemini API key on the server.
              </p>
            )}
            <div className="mt-5 flex flex-col gap-1.5">
              {[...(openTaskId ? TASK_SUGGESTIONS : []), ...SUGGESTIONS].map((s) => (
                <button key={s} onClick={() => send(s)} className="border-app hover-surface rounded-lg border px-3 py-2 text-left text-sm">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {items.map((it, i) => (
          <Fragment key={it.id}>
            <Message item={it} last={i === items.length - 1} status={status} onTask={(id) => useStore.getState().openTask(id)} onDoc={(id) => nav(`/app/docs/${id}`)} />
          </Fragment>
        ))}
        <div ref={bottom} />
      </div>

      <div className="border-app shrink-0 border-t p-3">
        {openTaskId && (
          <div className="text-muted mb-1.5 flex items-center gap-1.5 text-xs">
            <CheckSquare size={12} /> Context: MS-{tasks.find((t) => t.id === openTaskId)?.key} {tasks.find((t) => t.id === openTaskId)?.title}
          </div>
        )}
        {!openTaskId && location.pathname.startsWith('/app/docs/') && (
          <div className="text-muted mb-1.5 flex items-center gap-1.5 text-xs">
            <FileText size={12} /> Context: {docs.find((d) => location.pathname.endsWith(d.id))?.title || 'this doc'}
          </div>
        )}
        <div className="border-app focus-within:border-brand-500 flex items-end gap-2 rounded-xl border p-2">
          <textarea
            ref={input}
            value={text}
            rows={1}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(text)
              }
              if (e.key === 'Escape') setOpen(false)
            }}
            placeholder={engine === 'server' ? 'Ask anything or tell me what to do…' : 'Try “What’s overdue?”'}
            className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent px-1 text-sm outline-none [field-sizing:content]"
          />
          {busy ? (
            <button onClick={stop} className="rounded-lg bg-stone-900 p-1.5 text-white dark:bg-white dark:text-stone-900" aria-label="Stop">
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button onClick={() => send(text)} disabled={!text.trim()} className="bg-brand-600 rounded-lg p-1.5 text-white disabled:opacity-40" aria-label="Send">
              <ArrowUp size={16} />
            </button>
          )}
        </div>
        <p className="text-faint mt-1 px-1 text-[11px]">{engine === 'server' ? 'AI can make mistakes — check important changes.' : 'Offline mode · ⌘J to toggle'}</p>
      </div>
    </aside>
  )
}

export function Message({ item, last, status, onTask, onDoc }: { item: ChatItem; last: boolean; status: string | null; onTask: (id: string) => void; onDoc: (id: string) => void }) {
  if (item.role === 'user')
    return (
      <div className="mt-4 flex justify-end">
        <div className="bg-brand-600 max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm whitespace-pre-wrap text-white">{item.text}</div>
      </div>
    )
  return (
    <div className="mt-3 flex gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
        <Sparkles size={12} />
      </span>
      <div className={cn('min-w-0 flex-1 text-sm leading-relaxed', item.error && 'text-red-600 dark:text-red-400')}>
        {item.effects.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {item.effects.map((e, i) => (
              <button
                key={i}
                onClick={() => (e.taskId ? onTask(e.taskId) : e.docId ? onDoc(e.docId) : undefined)}
                className="border-app hover-surface text-muted inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]"
              >
                {e.docId ? <FileText size={11} /> : <CheckSquare size={11} />} {e.label}
              </button>
            ))}
          </div>
        )}
        <RichAnswer text={item.text} />
        {item.pending && last && (
          <div className="text-muted flex items-center gap-2 text-xs">
            <span className="flex gap-0.5">
              {[0, 1, 2].map((d) => (
                <span key={d} className="bg-brand-500 h-1.5 w-1.5 animate-bounce rounded-full" style={{ animationDelay: `${d * 120}ms` }} />
              ))}
            </span>
            {status ?? (item.text ? '' : 'Thinking')}
          </div>
        )}
      </div>
    </div>
  )
}
