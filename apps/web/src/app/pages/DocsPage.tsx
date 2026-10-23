import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import {
  ArrowLeft,
  Copy,
  Download,
  FileCode2,
  FileText,
  LayoutGrid,
  Link2,
  List as ListIcon,
  ListTree,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Plus,
  Printer,
  Search,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react'
import { useAssistant } from '../ai/useAssistant'
import { format, parseISO } from 'date-fns'
import { useStore } from '../../store/useStore'
import type { Doc } from '../../store/types'
import { Avatar, MenuItem, Popover, usePopover } from '../components/ui'
import { cn, timeAgo } from '../../lib/utils'
import { useQueryState } from '../../lib/useQueryState'
import { docExtensions } from '../docs/extensions'
import { DocToolbar, SelectionBar } from '../docs/DocToolbar'
import { SlashMenu } from '../docs/SlashMenu'
import { InsertDialogs, insertImage } from '../docs/InsertDialogs'
import { Outline } from '../docs/Outline'
import { DOC_TEMPLATES, type DocTemplate } from '../docs/templates'
import { download, fileName, htmlToMarkdown, standaloneHtml } from '../docs/exporters'

const EMOJIS = ['📄', '📘', '🚀', '📝', '💡', '📊', '🧭', '🎯', '🛠️', '📣', '✅', '🗂️', '🗓️', '📐', '🔁', '🧪', '🎨', '📚']

const pref = {
  get: (k: string) => {
    try {
      return localStorage.getItem(`ms.docs.${k}`)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(`ms.docs.${k}`, v)
    } catch {
      /* private mode */
    }
  },
}

const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

export default function DocsPage() {
  const { docId } = useParams()
  const doc = useStore((s) => s.docs.find((d) => d.id === docId))
  return doc ? <DocEditor key={doc.id} doc={doc} /> : <DocsIndex />
}

function useCreateDoc() {
  const s = useStore()
  const nav = useNavigate()
  return (t?: DocTemplate, spaceId: string | null = null) => {
    const id = s.addDoc(spaceId)
    if (t) s.updateDoc(id, { title: t.title, emoji: t.emoji, content: t.content().trim() })
    nav(`/app/docs/${id}`)
  }
}

function DocsIndex() {
  const s = useStore()
  const create = useCreateDoc()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useQueryState<string>('in', 'all')
  const [sort, setSort] = useQueryState<'edited' | 'title'>('sort', 'edited')
  const [view, setViewState] = useState<'grid' | 'list'>(() => (pref.get('view') === 'list' ? 'list' : 'grid'))
  const setView = (v: 'grid' | 'list') => (setViewState(v), pref.set('view', v))

  const docs = useMemo(() => {
    const needle = q.toLowerCase()
    return s.docs
      .filter((d) => (filter === 'all' ? true : filter === 'favorites' ? s.favorites.includes(d.id) : filter === 'mine' ? d.createdBy === s.currentUserId : (d.spaceId ?? 'ws') === filter))
      .filter((d) => !needle || (d.title || 'Untitled').toLowerCase().includes(needle) || plain(d.content).toLowerCase().includes(needle))
      .sort((a, b) => (sort === 'title' ? (a.title || 'Untitled').localeCompare(b.title || 'Untitled') : b.updatedAt.localeCompare(a.updatedAt)))
  }, [s.docs, s.favorites, s.currentUserId, q, filter, sort])

  const where = (d: Doc) => (d.spaceId ? s.spaces.find((sp) => sp.id === d.spaceId)?.name : 'Workspace')

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <FileText size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">Docs</h1>
          <button onClick={() => create()} className="bg-brand-600 hover:bg-brand-700 ml-auto inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-semibold text-white">
            <Plus size={15} /> New doc
          </button>
        </div>

        <section className="mb-7">
          <h2 className="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">Start from a template</h2>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button onClick={() => create()} className="border-app hover:border-brand-500 flex w-40 shrink-0 flex-col items-start rounded-xl border border-dashed p-3 text-left">
              <Plus size={22} className="text-muted mb-2" />
              <span className="text-sm font-semibold">Blank doc</span>
              <span className="text-faint text-xs">Start from scratch</span>
            </button>
            {DOC_TEMPLATES.map((t) => (
              <button key={t.key} onClick={() => create(t)} className="border-app surface-subtle hover:border-brand-500 flex w-40 shrink-0 flex-col items-start rounded-xl border p-3 text-left">
                <span className="mb-1.5 text-2xl">{t.emoji}</span>
                <span className="text-sm font-semibold">{t.title}</span>
                <span className="text-faint line-clamp-2 text-xs">{t.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="border-app flex h-8 items-center gap-2 rounded-md border px-2">
            <Search size={14} className="text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles and content" className="w-44 bg-transparent text-sm outline-none" />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border-app surface h-8 rounded-md border px-2 text-sm" aria-label="Filter docs">
            <option value="all">All docs</option>
            <option value="favorites">Favorites</option>
            <option value="mine">Created by me</option>
            <option value="ws">Workspace</option>
            {s.spaces.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as 'edited' | 'title')} className="border-app surface h-8 rounded-md border px-2 text-sm" aria-label="Sort docs">
            <option value="edited">Last edited</option>
            <option value="title">Title A–Z</option>
          </select>
          <span className="text-faint text-xs">{docs.length} docs</span>
          <div className="border-app ml-auto flex rounded-md border p-0.5">
            {(
              [
                ['grid', LayoutGrid],
                ['list', ListIcon],
              ] as const
            ).map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)} aria-label={`${v} view`} aria-pressed={view === v} className={cn('rounded p-1', view === v ? 'surface-muted text-app' : 'text-faint')}>
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>

        {view === 'grid' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((d) => (
              <Link key={d.id} to={`/app/docs/${d.id}`} className="border-app group hover:border-brand-500 flex flex-col rounded-xl border p-4 transition-colors">
                <div className="mb-3 text-3xl">{d.emoji}</div>
                <div className="truncate font-semibold">{d.title || 'Untitled'}</div>
                <div className="text-muted mt-1 line-clamp-2 min-h-[2.5em] text-sm">{plain(d.content) || 'Empty doc'}</div>
                <div className="text-faint mt-3 flex items-center gap-2 text-xs">
                  <Avatar userId={d.createdBy} size={18} />
                  {where(d)} · edited {timeAgo(d.updatedAt)}
                  {s.favorites.includes(d.id) && <Star size={12} className="ml-auto fill-amber-400 text-amber-400" />}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border-app overflow-hidden rounded-xl border">
            {docs.map((d) => (
              <Link key={d.id} to={`/app/docs/${d.id}`} className="border-app hover-surface flex items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0">
                <span className="w-6 text-center text-lg">{d.emoji}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{d.title || 'Untitled'}</span>
                {s.favorites.includes(d.id) && <Star size={12} className="fill-amber-400 text-amber-400" />}
                <span className="text-faint hidden w-32 truncate text-xs sm:block">{where(d)}</span>
                <Avatar userId={d.createdBy} size={18} />
                <span className="text-faint w-24 text-right text-xs">{timeAgo(d.updatedAt)}</span>
              </Link>
            ))}
          </div>
        )}
        {docs.length === 0 && <p className="text-muted py-16 text-center text-sm">No docs found.</p>}
      </div>
    </div>
  )
}

function DocEditor({ doc }: { doc: Doc }) {
  const s = useStore()
  const nav = useNavigate()
  const [saved, setSaved] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [wide, setWide] = useState(() => pref.get('wide') === '1')
  const [outline, setOutline] = useState(() => pref.get('outline') !== '0')
  const ref = useRef<Editor | null>(null)
  const flash = (m: string) => {
    setNotice(m)
    setTimeout(() => setNotice(null), 2500)
  }

  const editor = useEditor({
    extensions: docExtensions('Type / for blocks, or just start writing…'),
    content: doc.content,
    editorProps: {
      attributes: { class: 'prose-doc doc-editor' },
      handlePaste: (_view, e) => {
        const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith('image/'))
        if (!f || !ref.current) return false
        insertImage(ref.current, f, flash)
        return true
      },
      handleDrop: (_view, e) => {
        const f = Array.from((e as DragEvent).dataTransfer?.files ?? []).find((x) => x.type.startsWith('image/'))
        if (!f || !ref.current) return false
        e.preventDefault()
        insertImage(ref.current, f, flash)
        return true
      },
    },
    onUpdate: ({ editor }) => {
      setSaved(false)
      s.updateDoc(doc.id, { content: editor.isEmpty ? '' : editor.getHTML() })
    },
  })
  ref.current = editor

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

  const words = editor?.storage.characterCount?.words() ?? 0
  const minutes = Math.max(1, Math.round(words / 220))
  const html = () => (editor ? editor.getHTML() : doc.content)
  const title = doc.title || 'Untitled'

  // Task links open in the app; web links open in a new tab on ⌘/Ctrl-click.
  const onEditorClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a')
    if (!a) return
    const href = a.getAttribute('href') ?? ''
    if (href.startsWith('/app/')) {
      e.preventDefault()
      nav(href)
    } else if (e.metaKey || e.ctrlKey) {
      e.preventDefault()
      window.open(href, '_blank', 'noopener')
    }
  }

  const print = () => {
    const w = window.open('', '_blank')
    if (!w) return flash('Allow pop-ups to print')
    w.document.write(standaloneHtml(title, html()))
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }
  const duplicate = () => {
    const id = s.addDoc(doc.spaceId)
    s.updateDoc(id, { title: `${title} (copy)`, emoji: doc.emoji, content: html() })
    nav(`/app/docs/${id}`)
  }
  const toggle = (k: 'wide' | 'outline', v: boolean) => {
    pref.set(k, v ? '1' : '0')
    if (k === 'wide') setWide(v)
    else setOutline(v)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-app flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Link to="/app/docs" className="hover-surface text-muted rounded p-1.5" aria-label="All docs">
          <ArrowLeft size={16} />
        </Link>
        <span className="truncate text-sm font-medium">{title}</span>
        <span className={cn('shrink-0 text-xs', notice ? 'text-brand-600' : saved ? 'text-faint' : 'text-amber-500')}>{notice ?? (saved ? 'Saved' : 'Saving…')}</span>
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
          <button
            onClick={() => {
              void navigator.clipboard.writeText(`${location.origin}/app/docs/${doc.id}`)
              flash('Link copied')
            }}
            className="hover-surface text-muted hidden rounded p-1.5 sm:block"
            aria-label="Copy link"
            title="Copy link"
          >
            <Link2 size={16} />
          </button>
          <button onClick={() => toggle('outline', !outline)} className={cn('hover-surface hidden rounded p-1.5 xl:block', outline ? 'text-brand-600' : 'text-muted')} aria-label="Toggle outline" aria-pressed={outline} title="Outline">
            <ListTree size={16} />
          </button>
          <button onClick={() => toggle('wide', !wide)} className="hover-surface text-muted hidden rounded p-1.5 md:block" aria-label={wide ? 'Normal width' : 'Full width'} title={wide ? 'Normal width' : 'Full width'}>
            {wide ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button onClick={() => s.toggleFavorite(doc.id)} className="hover-surface rounded p-1.5" aria-label="Favorite">
            <Star size={16} className={fav ? 'fill-amber-400 text-amber-400' : 'text-muted'} />
          </button>
          <button onClick={morePop.toggle} className="hover-surface text-muted rounded p-1.5" aria-label="More">
            <MoreHorizontal size={16} />
          </button>
          <Popover open={morePop.open} anchor={morePop.anchor} onClose={morePop.close} align="end" width={210}>
            <MenuItem onClick={() => (duplicate(), morePop.close())}>
              <Copy size={14} /> Duplicate
            </MenuItem>
            <MenuItem onClick={() => (download(`${fileName(title)}.md`, `# ${title}\n\n${htmlToMarkdown(html())}`, 'text/markdown'), morePop.close())}>
              <Download size={14} /> Export as Markdown
            </MenuItem>
            <MenuItem onClick={() => (download(`${fileName(title)}.html`, standaloneHtml(title, html()), 'text/html'), morePop.close())}>
              <FileCode2 size={14} /> Export as HTML
            </MenuItem>
            <MenuItem onClick={() => (print(), morePop.close())}>
              <Printer size={14} /> Print / save as PDF
            </MenuItem>
            <div className="border-app my-1 border-t" />
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
      <div className="border-app shrink-0 border-b px-3 py-1">
        <DocToolbar editor={editor} />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
          <div className={cn('mx-auto px-5 py-10 sm:px-10', wide ? 'max-w-6xl' : 'max-w-3xl')}>
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
            <div className="text-faint mt-2 mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <Avatar userId={doc.createdBy} size={18} />
              {s.users.find((u) => u.id === doc.createdBy)?.name} · Last edited {format(parseISO(doc.updatedAt), 'MMM d, h:mm a')} · {words} words · {minutes} min read
            </div>
            <div onClick={onEditorClick}>
              <EditorContent editor={editor} />
            </div>
            <SelectionBar editor={editor} />
          </div>
        </div>
        {outline && (
          <aside className="border-app hidden w-56 shrink-0 overflow-y-auto border-l py-6 pr-2 pl-3 scroll-thin xl:block">
            <Outline editor={editor} />
          </aside>
        )}
      </div>
      <SlashMenu />
      <InsertDialogs />
    </div>
  )
}
