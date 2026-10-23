import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EditorContent } from '@tiptap/react'
import { ArrowLeft, FileText, MoreHorizontal, Plus, Search, Sparkles, Star, Trash2 } from 'lucide-react'
import { useAssistant } from '../ai/useAssistant'
import { format, parseISO } from 'date-fns'
import { useStore } from '../../store/useStore'
import type { Doc } from '../../store/types'
import { Toolbar, useRichEditor } from '../components/RichText'
import { Avatar, MenuItem, Popover, usePopover } from '../components/ui'
import { cn, timeAgo } from '../../lib/utils'

const EMOJIS = ['📄', '📘', '🚀', '📝', '💡', '📊', '🧭', '🎯', '🛠️', '📣', '✅', '🗂️']

export default function DocsPage() {
  const { docId } = useParams()
  const doc = useStore((s) => s.docs.find((d) => d.id === docId))
  return doc ? <DocEditor key={doc.id} doc={doc} /> : <DocsIndex />
}

function DocsIndex() {
  const s = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const docs = s.docs.filter((d) => (d.title || 'Untitled').toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <FileText size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">Docs</h1>
          <div className="border-app ml-auto flex h-8 items-center gap-2 rounded-md border px-2">
            <Search size={14} className="text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search docs" className="w-36 bg-transparent text-sm outline-none" />
          </div>
          <button onClick={() => nav(`/app/docs/${s.addDoc(null)}`)} className="bg-brand-600 hover:bg-brand-700 inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-semibold text-white">
            <Plus size={15} /> New doc
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <Link key={d.id} to={`/app/docs/${d.id}`} className="border-app group hover:border-brand-500 flex flex-col rounded-xl border p-4 transition-colors">
              <div className="mb-3 text-3xl">{d.emoji}</div>
              <div className="truncate font-semibold">{d.title || 'Untitled'}</div>
              <div className="text-muted mt-1 line-clamp-2 min-h-[2.5em] text-sm" >
                {d.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || 'Empty doc'}
              </div>
              <div className="text-faint mt-3 flex items-center gap-2 text-xs">
                <Avatar userId={d.createdBy} size={18} />
                {d.spaceId ? s.spaces.find((sp) => sp.id === d.spaceId)?.name : 'Workspace'} · edited {timeAgo(d.updatedAt)}
                {s.favorites.includes(d.id) && <Star size={12} className="ml-auto fill-amber-400 text-amber-400" />}
              </div>
            </Link>
          ))}
        </div>
        {docs.length === 0 && <p className="text-muted py-16 text-center text-sm">No docs found.</p>}
      </div>
    </div>
  )
}

function DocEditor({ doc }: { doc: Doc }) {
  const s = useStore()
  const nav = useNavigate()
  const [saved, setSaved] = useState(true)
  const editor = useRichEditor(doc.content, (html) => {
    setSaved(false)
    s.updateDoc(doc.id, { content: html })
  }, 'Start writing, or use the toolbar to add headings, lists and checklists…')
  const emojiPop = usePopover()
  const morePop = usePopover()
  const aiPop = usePopover()
  const fav = s.favorites.includes(doc.id)

  useEffect(() => {
    s.touchRecent(doc.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id])
  useEffect(() => {
    if (saved) return
    const t = setTimeout(() => setSaved(true), 600)
    return () => clearTimeout(t)
  }, [saved, doc.updatedAt])

  const words = editor?.getText().trim().split(/\s+/).filter(Boolean).length ?? 0

  return (
    <div className="flex h-full flex-col">
      <div className="border-app flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Link to="/app/docs" className="hover-surface text-muted rounded p-1.5" aria-label="All docs">
          <ArrowLeft size={16} />
        </Link>
        <span className="truncate text-sm font-medium">{doc.title || 'Untitled'}</span>
        <span className={cn('text-xs', saved ? 'text-faint' : 'text-amber-500')}>{saved ? 'Saved' : 'Saving…'}</span>
        <div className="ml-auto flex items-center gap-1">
          <select
            value={doc.spaceId ?? ''}
            onChange={(e) => s.updateDoc(doc.id, { spaceId: e.target.value || null })}
            className="border-app surface hidden h-7 rounded-md border px-1 text-xs sm:block"
            aria-label="Location"
          >
            <option value="">Workspace</option>
            {s.spaces.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>
          <button onClick={aiPop.toggle} className="hover-surface text-brand-600 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold">
            <Sparkles size={14} /> AI
          </button>
          <Popover open={aiPop.open} anchor={aiPop.anchor} onClose={aiPop.close} align="end" width={230}>
            {['Summarize this doc', 'Turn the action items in this doc into tasks', 'Suggest improvements to this doc'].map((p) => (
              <MenuItem key={p} onClick={() => (useAssistant.getState().ask(p), aiPop.close())}>
                <Sparkles size={14} className="text-brand-600" /> {p.replace(' in this doc', '').replace(' this doc', '').replace(' to', '')}
              </MenuItem>
            ))}
          </Popover>
          <button onClick={() => s.toggleFavorite(doc.id)} className="hover-surface rounded p-1.5" aria-label="Favorite">
            <Star size={16} className={fav ? 'fill-amber-400 text-amber-400' : 'text-muted'} />
          </button>
          <button onClick={morePop.toggle} className="hover-surface text-muted rounded p-1.5" aria-label="More">
            <MoreHorizontal size={16} />
          </button>
          <Popover open={morePop.open} anchor={morePop.anchor} onClose={morePop.close} align="end" width={180}>
            <MenuItem
              danger
              onClick={() => {
                if (confirm('Delete this doc?')) {
                  s.deleteDoc(doc.id)
                  nav('/app/docs')
                }
              }}
            >
              <Trash2 size={14} /> Delete doc
            </MenuItem>
          </Popover>
        </div>
      </div>
      <div className="border-app flex shrink-0 justify-center border-b px-3 py-1">
        <Toolbar editor={editor} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        <div className="mx-auto max-w-3xl px-5 py-10 sm:px-10">
          <button onClick={emojiPop.toggle} className="hover-surface mb-2 rounded-lg p-1 text-5xl" aria-label="Change icon">
            {doc.emoji}
          </button>
          <Popover open={emojiPop.open} anchor={emojiPop.anchor} onClose={emojiPop.close} width={232}>
            <div className="grid grid-cols-6 gap-1 p-1">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => (s.updateDoc(doc.id, { emoji: e }), emojiPop.close())} className="hover-surface rounded p-1 text-xl">
                  {e}
                </button>
              ))}
            </div>
          </Popover>
          <textarea
            value={doc.title}
            onChange={(e) => s.updateDoc(doc.id, { title: e.target.value.replace(/\n/g, '') })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                editor?.commands.focus('start')
              }
            }}
            placeholder="Untitled"
            rows={1}
            autoFocus={!doc.title}
            className="placeholder:text-faint w-full resize-none bg-transparent text-4xl font-bold tracking-tight outline-none [field-sizing:content]"
          />
          <div className="text-faint mt-2 mb-6 flex items-center gap-2 text-xs">
            <Avatar userId={doc.createdBy} size={18} />
            {s.users.find((u) => u.id === doc.createdBy)?.name} · Last edited {format(parseISO(doc.updatedAt), 'MMM d, h:mm a')} · {words} words
          </div>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
