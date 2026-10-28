import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EditorContent, useEditor } from '@tiptap/react'
import { Lock } from 'lucide-react'
import { api } from '../api/client'
import { Logo } from '../app/components/ui'
import { docExtensions } from '../app/docs/extensions'
import { ItemShape, bounds } from '../app/whiteboard/shapes'
import type { BoardItem, Status } from '../store/types'
import { PRIORITIES, cn, friendlyDate } from '../lib/utils'
import { IssueIcon } from '../app/components/issue'

interface Shared {
  kind: 'doc' | 'list' | 'whiteboard'
  title: string
  emoji?: string
  content?: string
  items?: BoardItem[]
  updatedAt?: string
  space?: string
  color?: string
  statuses?: Status[]
  people?: Record<string, string>
  tasks?: { id: string; key: number; title: string; statusId: string; priority: string | null; assignees: string[]; tags: string[]; dueDate: string | null; parentId: string | null; issueType?: 'task' | 'story' | 'bug' | 'epic' }[]
}

/** Read-only page behind a share link; no sign-in. */
export default function SharedPage() {
  const { token } = useParams()
  const [data, setData] = useState<Shared | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api.raw<Shared>('GET', `/public/share/${token}`, { anonymous: true }).then(setData, (e) => setError(e instanceof Error ? e.message : 'This link isn’t available.'))
  }, [token])
  useEffect(() => {
    if (data) document.title = `${data.title} · Meetspace`
  }, [data])

  return (
    <div className="min-h-full bg-white text-stone-900">
      <header className="flex items-center gap-3 border-b border-stone-200 px-5 py-3">
        <Link to="/">
          <Logo size={24} />
        </Link>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
          <Lock size={11} /> View only
        </span>
        <Link to="/signup" className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white">
          Try Meetspace
        </Link>
      </header>
      {error ? (
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <h1 className="text-xl font-bold">This link isn’t available</h1>
          <p className="mt-2 text-stone-600">{error} Ask whoever shared it for a new one.</p>
        </div>
      ) : !data ? (
        <p className="p-10 text-center text-stone-500">Loading…</p>
      ) : data.kind === 'doc' ? (
        <SharedDoc data={data} />
      ) : data.kind === 'list' ? (
        <SharedList data={data} />
      ) : (
        <SharedBoard data={data} />
      )}
    </div>
  )
}

function SharedDoc({ data }: { data: Shared }) {
  // The editor's schema renders only known nodes and marks, so stored HTML can't inject markup.
  const editor = useEditor({ extensions: docExtensions(''), content: data.content ?? '', editable: false, editorProps: { attributes: { class: 'prose-doc' } } })
  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      {data.emoji && <div className="mb-2 text-4xl">{data.emoji}</div>}
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{data.title || 'Untitled'}</h1>
      <EditorContent editor={editor} />
    </article>
  )
}

function SharedList({ data }: { data: Shared }) {
  const tasks = data.tasks ?? []
  const byStatus = (data.statuses ?? []).map((st) => ({ st, tasks: tasks.filter((t) => t.statusId === st.id && !t.parentId) }))
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center gap-2">
        <span className="h-3 w-3 rounded" style={{ background: data.color }} />
        <span className="text-sm text-stone-500">{data.space}</span>
        <span className="text-stone-300">/</span>
        <h1 className="text-2xl font-bold">{data.title}</h1>
        <span className="ml-auto text-sm text-stone-500">{tasks.filter((t) => !t.parentId).length} tasks</span>
      </div>
      {byStatus.map(({ st, tasks: ts }) => (
        <section key={st.id} className="mb-6">
          <h2 className="mb-2 flex items-center gap-2">
            <span className="rounded px-2 py-0.5 text-[11px] font-semibold uppercase text-white" style={{ background: st.color }}>
              {st.name}
            </span>
            <span className="text-xs text-stone-500">{ts.length}</span>
          </h2>
          {ts.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full min-w-[560px] text-sm">
                <tbody>
                  {ts.map((t) => {
                    const pr = PRIORITIES.find((p) => p.value === t.priority)
                    return (
                      <tr key={t.id} className="border-b border-stone-100 last:border-0">
                        <td className="w-20 px-3 py-2 font-mono text-xs text-stone-400">MS-{t.key}</td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1.5">
                            {t.issueType && t.issueType !== 'task' && <IssueIcon type={t.issueType} size={14} />}
                            {t.title}
                          </span>
                        </td>
                        <td className="w-40 px-3 py-2 text-xs text-stone-600">{t.assignees.map((a) => data.people?.[a]).filter(Boolean).join(', ') || '—'}</td>
                        <td className="w-24 px-3 py-2 text-xs" style={{ color: pr?.color }}>
                          {pr?.label ?? ''}
                        </td>
                        <td className="w-24 px-3 py-2 text-xs text-stone-600">{t.dueDate ? friendlyDate(t.dueDate) : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

function SharedBoard({ data }: { data: Shared }) {
  const items = useMemo(() => (Array.isArray(data.items) ? data.items : []), [data.items])
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const find = (id: string) => byId.get(id)
  const box = useMemo(() => {
    if (!items.length) return { x: 0, y: 0, w: 800, h: 500 }
    const bs = items.map((i) => bounds(i, find))
    const x = Math.min(...bs.map((b) => b.x)) - 40
    const y = Math.min(...bs.map((b) => b.y)) - 40
    return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x + 40, h: Math.max(...bs.map((b) => b.y + b.h)) - y + 40 }
  }, [items]) // find reads the same items
  return (
    <div className="px-6 py-6">
      <h1 className="mb-4 text-2xl font-bold">{data.title}</h1>
      <div className={cn('overflow-auto rounded-xl border border-stone-200 bg-stone-50')}>
        <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className="h-[75vh] w-full">
          {items.map((i) => (
            <ItemShape key={i.id} item={i} find={find} static />
          ))}
        </svg>
      </div>
    </div>
  )
}
