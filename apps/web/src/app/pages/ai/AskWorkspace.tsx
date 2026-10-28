import { Fragment, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUp, BookOpenCheck, Loader2 } from 'lucide-react'
import { api } from '../../../api/client'
import { useStore } from '../../../store/useStore'
import { TYPE_META, routeForHit, type DocType } from '../../CommandPalette'
import { cn } from '../../../lib/utils'

interface Source {
  type: DocType
  id: string
  title: string
  key?: string
  parent?: string
}
interface Answer {
  answer: string
  sources: Source[]
}

const EXAMPLES = ['What did we decide about the launch date?', 'Which bugs are blocking the release?', 'What has Priya been working on this week?', 'Where are the onboarding docs?']

/** Inline text: **bold**, `code` and [n] citations that jump to their source. */
function inline(text: string, onCite: (n: number) => void): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g)
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (/^`[^`]+`$/.test(p)) return <code key={i} className="surface-muted rounded px-1 text-[0.9em]">{p.slice(1, -1)}</code>
    const m = p.match(/^\[(\d+)\]$/)
    if (m)
      return (
        <button key={i} onClick={() => onCite(Number(m[1]))} className="bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100 mx-0.5 rounded px-1 align-super text-[10px] font-semibold">
          {m[1]}
        </button>
      )
    return <Fragment key={i}>{p}</Fragment>
  })
}

/** Ask a question; the answer comes only from this workspace, with sources. */
export default function AskWorkspace() {
  const s = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<{ q: string; a: Answer }[]>([])

  const ask = async (question: string) => {
    if (!question.trim()) return
    setBusy(true)
    setError(null)
    try {
      const a = await api.raw<Answer>('POST', `/workspaces/${s.currentWorkspaceId}/assistant/ask`, { body: { question: question.trim() } })
      setHistory((h) => [{ q: question.trim(), a }, ...h].slice(0, 10))
      setQ('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t get an answer')
    } finally {
      setBusy(false)
    }
  }
  const open = (src: Source) => nav(routeForHit({ type: src.type, entity_id: src.id, parent: src.parent, title: src.title, key: src.key, updated_at: '' }))

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <BookOpenCheck size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">Ask the workspace</h1>
        </div>
        <p className="text-muted mb-4 text-sm">Answers come only from tasks, docs, chat and meetings you can see, with links to where each fact came from.</p>
        <form onSubmit={(e) => (e.preventDefault(), void ask(q))} className="border-app focus-within:border-brand-500 surface flex items-end gap-2 rounded-xl border p-2">
          <textarea
            autoFocus
            rows={2}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), void ask(q))}
            placeholder="Ask anything about your work…"
            className="min-w-0 flex-1 resize-none bg-transparent px-1 text-sm outline-none"
            aria-label="Question"
          />
          <button disabled={busy || !q.trim()} className="bg-brand-600 hover:bg-brand-700 flex h-8 w-8 items-center justify-center rounded-lg text-white disabled:opacity-40" aria-label="Ask">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={15} />}
          </button>
        </form>
        {history.length === 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => void ask(e)} className="border-app text-muted hover:text-app rounded-full border px-3 py-1 text-xs">
                {e}
              </button>
            ))}
          </div>
        )}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}

        {history.map(({ q: question, a }, idx) => (
          <article key={idx} className={cn('mt-6', idx > 0 && 'opacity-80')}>
            <h2 className="mb-2 text-sm font-semibold">{question}</h2>
            <div className="border-app rounded-xl border p-4 text-[14px] leading-relaxed">
              {a.answer.split('\n').map((line, i) => {
                const bullet = line.match(/^\s*[-*•]\s+(.*)/)
                if (!line.trim()) return <div key={i} className="h-2" />
                return bullet ? (
                  <div key={i} className="flex gap-2 pl-1">
                    <span className="text-faint">•</span>
                    <span>{inline(bullet[1], (n) => a.sources[n - 1] && open(a.sources[n - 1]))}</span>
                  </div>
                ) : (
                  <p key={i}>{inline(line, (n) => a.sources[n - 1] && open(a.sources[n - 1]))}</p>
                )
              })}
              {a.sources.length > 0 && (
                <div className="border-app mt-4 border-t pt-3">
                  <div className="text-faint mb-2 text-[11px] font-semibold tracking-wide uppercase">Sources</div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {a.sources.map((src, i) => {
                      const meta = TYPE_META[src.type] ?? TYPE_META.task
                      return (
                        <button key={src.type + src.id} onClick={() => open(src)} className="border-app hover-surface flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs">
                          <span className="bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100 rounded px-1 text-[10px] font-semibold">{i + 1}</span>
                          <meta.icon size={13} className="text-muted shrink-0" />
                          <span className="min-w-0 flex-1 truncate">
                            {src.key && <span className="text-faint font-mono">{src.key} </span>}
                            {src.title || meta.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
