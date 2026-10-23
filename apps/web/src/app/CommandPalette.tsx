import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  CalendarClock,
  CheckSquare,
  ClipboardList,
  CornerDownLeft,
  ExternalLink,
  FileText,
  Film,
  Folder,
  Hash,
  Inbox,
  Layers,
  Link2,
  List as ListIcon,
  MessageSquare,
  MessagesSquare,
  Moon,
  PenTool,
  Plus,
  Search,
  Settings,
  Sparkles,
  Timer,
  Trophy,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { Modal } from './components/ui'
import { useAssistant } from './ai/useAssistant'
import { useCall } from './calls/useCall'
import { useRecorder } from './clips/Recorder'
import { api } from '../api/client'
import { cn, timeAgo } from '../lib/utils'

/*
 * Search everything in the workspace (server-side, OpenSearch) or run a command.
 * Results stream in as you type; ↑↓ to move, ↵ to open, ⌘↵ to open in a new tab.
 */

type DocType = 'task' | 'doc' | 'message' | 'comment' | 'clip' | 'goal' | 'whiteboard' | 'form' | 'list' | 'folder' | 'project' | 'meeting' | 'channel'

interface Hit {
  type: DocType
  entity_id: string
  title: string
  parent?: string
  key?: string
  snippet?: string
  updated_at: string
}

interface Results {
  total: number
  hits: Hit[]
  counts: Record<string, number>
}

const TYPE_META: Record<DocType, { icon: LucideIcon; label: string }> = {
  task: { icon: CheckSquare, label: 'Task' },
  doc: { icon: FileText, label: 'Doc' },
  message: { icon: MessagesSquare, label: 'Message' },
  comment: { icon: MessageSquare, label: 'Comment' },
  clip: { icon: Film, label: 'Clip' },
  goal: { icon: Trophy, label: 'Goal' },
  whiteboard: { icon: PenTool, label: 'Whiteboard' },
  form: { icon: ClipboardList, label: 'Form' },
  list: { icon: ListIcon, label: 'List' },
  folder: { icon: Folder, label: 'Folder' },
  project: { icon: Layers, label: 'Project' },
  meeting: { icon: CalendarClock, label: 'Meeting' },
  channel: { icon: Hash, label: 'Channel' },
}

// Scope tabs; "More" groups the less common types.
const SCOPES: { key: string; label: string; types: DocType[] }[] = [
  { key: 'all', label: 'All', types: [] },
  { key: 'tasks', label: 'Tasks', types: ['task', 'comment'] },
  { key: 'docs', label: 'Docs', types: ['doc'] },
  { key: 'chat', label: 'Chat', types: ['message', 'channel'] },
  { key: 'clips', label: 'Clips', types: ['clip', 'meeting'] },
  { key: 'more', label: 'More', types: ['project', 'folder', 'list', 'goal', 'whiteboard', 'form'] },
]

interface Command {
  id: string
  label: string
  hint?: string
  icon: LucideIcon
  keywords: string
  run: () => void
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [scope, setScope] = useState('all')
  const [sort, setSort] = useState<'relevance' | 'recent'>('relevance')
  const [cursor, setCursor] = useState(0)
  const [results, setResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(false)
  const [serverDown, setServerDown] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setScope('all')
      setCursor(0)
      setResults(null)
    }
  }, [open])

  const text = q.trim()
  const commandMode = text.startsWith('>')
  const term = commandMode ? text.slice(1).trim() : text

  // Server search, debounced; stale responses are dropped.
  useEffect(() => {
    if (!open || commandMode || term.length < 2) {
      setResults(null)
      setLoading(false)
      return
    }
    const types = SCOPES.find((x) => x.key === scope)!.types
    const ctrl = new AbortController()
    setLoading(true)
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q: term, sort, limit: '30' })
      if (types.length) params.set('type', types.join(','))
      api
        .get<Results>(`/workspaces/${s.currentWorkspaceId}/search?${params}`, { signal: ctrl.signal })
        .then((r) => (setResults(r), setServerDown(false), setLoading(false)))
        .catch((e) => {
          if (e.name === 'AbortError') return
          setServerDown(true)
          setLoading(false)
        })
    }, 150)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [open, term, scope, sort, commandMode, s.currentWorkspaceId])

  // Where each kind of result opens.
  const routeFor = (h: Hit): string => {
    switch (h.type) {
      case 'task':
        return `/app/t/${h.entity_id}`
      case 'comment':
        return `/app/t/${h.parent}`
      case 'doc':
        return `/app/docs/${h.entity_id}`
      case 'message':
        return `/app/chat/${h.parent}`
      case 'channel':
        return `/app/chat/${h.entity_id}`
      case 'clip':
        return '/app/clips'
      case 'meeting':
        return '/app/chat/calls'
      case 'goal':
        return '/app/goals'
      case 'whiteboard':
        return `/app/whiteboards/${h.entity_id}`
      case 'form':
        return `/app/forms/${h.entity_id}`
      case 'list':
        return `/app/list/${h.entity_id}`
      case 'folder':
        return `/app/space/${h.parent}`
      case 'project':
        return `/app/space/${h.entity_id}`
    }
  }

  const contextFor = (h: Hit): string => {
    const list = (id?: string) => s.lists.find((l) => l.id === id)
    const space = (id?: string) => s.spaces.find((x) => x.id === id)
    switch (h.type) {
      case 'task':
        return [h.key, list(h.parent)?.name && `in ${list(h.parent)!.name}`].filter(Boolean).join(' · ')
      case 'comment': {
        const t = s.tasks.find((x) => x.id === h.parent)
        return t ? `on MS-${t.key} ${t.title}` : 'Comment'
      }
      case 'message': {
        const c = s.channels.find((x) => x.id === h.parent)
        if (!c) return 'Chat'
        if (c.kind === 'channel') return `in #${c.name}`
        const other = s.users.find((u) => c.members.includes(u.id) && u.id !== s.currentUserId)
        return `with ${other?.name ?? 'someone'}`
      }
      case 'doc':
      case 'list':
      case 'folder':
        return space(h.parent)?.name ? `in ${space(h.parent)!.name}` : TYPE_META[h.type].label
      default:
        return TYPE_META[h.type].label
    }
  }

  // Local matches when server search is off or unreachable.
  const localHits = useMemo<Hit[]>(() => {
    if (!serverDown || term.length < 1) return []
    const needle = term.toLowerCase()
    const out: Hit[] = [
      ...s.tasks.filter((t) => t.title.toLowerCase().includes(needle) || `ms-${t.key}` === needle).map((t) => ({ type: 'task' as const, entity_id: t.id, title: t.title, parent: t.listId, key: `MS-${t.key}`, updated_at: t.updatedAt })),
      ...s.docs.filter((d) => (d.title || 'Untitled').toLowerCase().includes(needle)).map((d) => ({ type: 'doc' as const, entity_id: d.id, title: d.title || 'Untitled', parent: d.spaceId ?? undefined, updated_at: d.updatedAt })),
      ...s.lists.filter((l) => l.name.toLowerCase().includes(needle)).map((l) => ({ type: 'list' as const, entity_id: l.id, title: l.name, parent: l.spaceId, updated_at: '' })),
      ...s.channels.filter((c) => c.kind === 'channel' && c.name.includes(needle)).map((c) => ({ type: 'channel' as const, entity_id: c.id, title: `#${c.name}`, updated_at: '' })),
    ]
    return out.slice(0, 20)
  }, [serverDown, term, s.tasks, s.docs, s.lists, s.channels])

  const hits = serverDown ? localHits : (results?.hits ?? [])

  const go = (to: string) => {
    onClose()
    nav(to)
  }
  const firstList = () => s.lists[0]?.id
  const commands: Command[] = useMemo(
    () => [
      { id: 'new-task', label: 'Create a task', hint: 'C', icon: Plus, keywords: 'new add todo', run: () => { const l = firstList(); if (l && s.currentUserId) { onClose(); s.openTask(s.addTask({ listId: l, title: 'New task', assignees: [s.currentUserId] })) } } },
      { id: 'new-doc', label: 'Write a doc', icon: FileText, keywords: 'new page note', run: () => go(`/app/docs/${s.addDoc(null)}`) },
      { id: 'new-board', label: 'Open a blank whiteboard', icon: PenTool, keywords: 'new draw sketch', run: () => go(`/app/whiteboards/${s.addWhiteboard()}`) },
      { id: 'call', label: 'Start a video call', icon: Video, keywords: 'meet huddle', run: () => { onClose(); void useCall.getState().prepare({ title: 'Quick meeting', kind: 'video', channelId: null, meetingId: null, invitees: [] }) } },
      { id: 'clip', label: 'Record a clip', icon: Film, keywords: 'screen record loom', run: () => { onClose(); useRecorder.getState().open() } },
      { id: 'ask', label: 'Ask the AI assistant', hint: '⌘J', icon: Sparkles, keywords: 'ai brain help', run: () => { onClose(); useAssistant.getState().setOpen(true) } },
      { id: 'inbox', label: 'Go to Inbox', icon: Inbox, keywords: 'notifications', run: () => go('/app/inbox') },
      { id: 'chat', label: 'Go to Chat', icon: MessagesSquare, keywords: 'messages channels', run: () => go('/app/chat') },
      { id: 'time', label: 'Go to Timesheets', icon: Timer, keywords: 'time tracking hours', run: () => go('/app/timesheets') },
      { id: 'reminders', label: 'Set a reminder', icon: Bell, keywords: 'remind', run: () => go('/app/home') },
      { id: 'theme', label: s.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', icon: Moon, keywords: 'theme appearance', run: () => { s.setTheme(s.theme === 'dark' ? 'light' : 'dark'); onClose() } },
      { id: 'settings', label: 'Workspace settings', icon: Settings, keywords: 'members invite preferences', run: () => go('/app/settings') },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.theme, s.lists, s.currentUserId],
  )
  const shownCommands = useMemo(() => {
    if (!commandMode && term) return commands.filter((c) => (c.label + ' ' + c.keywords).toLowerCase().includes(term.toLowerCase())).slice(0, 4)
    const needle = term.toLowerCase()
    return commands.filter((c) => !needle || (c.label + ' ' + c.keywords).toLowerCase().includes(needle))
  }, [commands, commandMode, term])

  // Recently opened items when the box is empty.
  const recents = useMemo<Hit[]>(() => {
    if (term) return []
    return s.recents
      .map((id): Hit | null => {
        const t = s.tasks.find((x) => x.id === id)
        if (t) return { type: 'task', entity_id: t.id, title: t.title, parent: t.listId, key: `MS-${t.key}`, updated_at: t.updatedAt }
        const d = s.docs.find((x) => x.id === id)
        if (d) return { type: 'doc', entity_id: d.id, title: d.title || 'Untitled', parent: d.spaceId ?? undefined, updated_at: d.updatedAt }
        const l = s.lists.find((x) => x.id === id)
        if (l) return { type: 'list', entity_id: l.id, title: l.name, parent: l.spaceId, updated_at: '' }
        return null
      })
      .filter((x): x is Hit => !!x)
      .slice(0, 6)
  }, [term, s.recents, s.tasks, s.docs, s.lists])

  const rows: ({ kind: 'hit'; hit: Hit } | { kind: 'cmd'; cmd: Command })[] = [
    ...(commandMode ? [] : (term ? hits : recents).map((hit) => ({ kind: 'hit' as const, hit }))),
    ...shownCommands.map((cmd) => ({ kind: 'cmd' as const, cmd })),
  ]
  const at = Math.min(cursor, Math.max(rows.length - 1, 0))

  useEffect(() => {
    listRef.current?.querySelector(`[data-row="${at}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [at])

  const openHit = (h: Hit, newTab = false) => {
    const to = routeFor(h)
    if (newTab) window.open(to, '_blank', 'noopener')
    else if (h.type === 'task' || h.type === 'comment') {
      onClose()
      s.openTask(h.type === 'task' ? h.entity_id : h.parent!)
    } else go(to)
  }
  const copyLink = (h: Hit) => {
    void navigator.clipboard?.writeText(location.origin + routeFor(h))
    setCopied(h.type + h.entity_id)
    setTimeout(() => setCopied(null), 1200)
  }
  const activate = (i: number, newTab = false) => {
    const r = rows[i]
    if (!r) return
    if (r.kind === 'hit') openHit(r.hit, newTab)
    else r.cmd.run()
  }
  const askAI = () => {
    onClose()
    const a = useAssistant.getState()
    a.setOpen(true)
    if (term) a.ask(term)
  }

  const count = (key: string) => {
    if (!results) return null
    const types = SCOPES.find((x) => x.key === key)!.types
    const n = types.length ? types.reduce((a, t) => a + (results.counts[t] ?? 0), 0) : Object.values(results.counts).reduce((a, b) => a + b, 0)
    return n
  }

  let lastSection = ''
  return (
    <Modal open={open} onClose={onClose} className="mt-[8vh] flex max-h-[80vh] max-w-2xl flex-col">
      {/* query */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <Search size={18} className="text-brand-600 shrink-0" />
        <input
          autoFocus
          value={q}
          onChange={(e) => (setQ(e.target.value), setCursor(0))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), setCursor(Math.min(at + 1, rows.length - 1)))
            if (e.key === 'ArrowUp') (e.preventDefault(), setCursor(Math.max(at - 1, 0)))
            if (e.key === 'Enter') (e.preventDefault(), activate(at, e.metaKey || e.ctrlKey))
            if (e.key === 'Tab' && !commandMode) {
              e.preventDefault()
              const i = SCOPES.findIndex((x) => x.key === scope)
              setScope(SCOPES[(i + (e.shiftKey ? SCOPES.length - 1 : 1)) % SCOPES.length].key)
              setCursor(0)
            }
          }}
          placeholder="Search your workspace…  (type > for commands)"
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          aria-label="Search"
        />
        {loading && <span className="border-brand-600 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-transparent" aria-label="Searching" />}
        <button onClick={askAI} className="bg-brand-50 text-brand-700 ring-brand-200 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ring-1 ring-inset">
          <Sparkles size={14} /> {term ? 'Ask AI' : 'AI'}
        </button>
      </div>

      {/* scopes + sort */}
      {!commandMode && (
        <div className="border-app flex items-center gap-1 border-b px-3 pb-2">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto no-scrollbar" role="tablist">
            {SCOPES.map((x) => {
              const n = count(x.key)
              return (
                <button
                  key={x.key}
                  role="tab"
                  aria-selected={scope === x.key}
                  onClick={() => (setScope(x.key), setCursor(0))}
                  className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', scope === x.key ? 'bg-brand-600 text-white' : 'text-muted hover-surface')}
                >
                  {x.label}
                  {n !== null && term && <span className={cn('tabular-nums', scope === x.key ? 'text-white/80' : 'text-faint')}>{n}</span>}
                </button>
              )
            })}
          </div>
          <button onClick={() => setSort(sort === 'relevance' ? 'recent' : 'relevance')} className="text-muted hover-surface shrink-0 rounded-md px-2 py-1 text-xs" title="Change sort order">
            {sort === 'relevance' ? 'Best match' : 'Most recent'}
          </button>
        </div>
      )}

      {/* rows */}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5 scroll-thin">
        {serverDown && term && <p className="text-faint px-3 pt-1 pb-2 text-xs">Full-text search is unavailable right now — showing title matches only.</p>}
        {!commandMode && term.length >= 2 && !loading && hits.length === 0 && (
          <div className="text-muted px-4 py-8 text-center text-sm">
            Nothing matches “{term}”.{' '}
            <button onClick={askAI} className="text-brand-600 font-medium hover:underline">
              Ask the AI instead
            </button>
          </div>
        )}
        {rows.map((r, i) => {
          const section = r.kind === 'cmd' ? 'Commands' : term ? 'Results' : 'Recent'
          const header = section !== lastSection ? <SectionLabel key={`h-${section}`}>{section}</SectionLabel> : null
          lastSection = section
          if (r.kind === 'cmd') {
            const I = r.cmd.icon
            return (
              <div key={r.cmd.id}>
                {header}
                <button data-row={i} onMouseMove={() => setCursor(i)} onClick={() => activate(i)} className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm', i === at && 'surface-muted')}>
                  <I size={16} className="text-muted shrink-0" />
                  <span className="truncate">{r.cmd.label}</span>
                  {r.cmd.hint && <kbd className="surface-muted text-faint ml-auto rounded px-1.5 text-[11px]">{r.cmd.hint}</kbd>}
                  {i === at && !r.cmd.hint && <ArrowRight size={14} className="text-faint ml-auto" />}
                </button>
              </div>
            )
          }
          const h = r.hit
          const I = TYPE_META[h.type].icon
          const active = i === at
          return (
            <div key={h.type + h.entity_id}>
              {header}
              <div data-row={i} onMouseMove={() => setCursor(i)} className={cn('group flex items-center gap-3 rounded-lg px-3 py-2', active && 'surface-muted')}>
                <span className="surface-muted text-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                  <I size={16} />
                </span>
                <button onClick={() => openHit(h)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium">{h.title}</span>
                    <span className="text-faint shrink-0 truncate text-xs">{contextFor(h)}</span>
                  </span>
                  {h.snippet && <span className="text-muted search-snippet mt-0.5 block truncate text-xs" dangerouslySetInnerHTML={{ __html: h.snippet }} />}
                </button>
                {active ? (
                  <span className="flex shrink-0 items-center gap-0.5">
                    <RowAction label="Open in new tab" onClick={() => openHit(h, true)}>
                      <ExternalLink size={14} />
                    </RowAction>
                    <RowAction label={copied === h.type + h.entity_id ? 'Copied' : 'Copy link'} onClick={() => copyLink(h)}>
                      <Link2 size={14} className={copied === h.type + h.entity_id ? 'text-brand-600' : ''} />
                    </RowAction>
                    <RowAction label="Open" onClick={() => openHit(h)} primary>
                      <CornerDownLeft size={14} />
                    </RowAction>
                  </span>
                ) : (
                  h.updated_at && <span className="text-faint shrink-0 text-xs">{timeAgo(h.updated_at)}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* footer */}
      <div className="border-app text-faint flex items-center gap-3 border-t px-4 py-2 text-[11px]">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> move
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> open
        </span>
        <span className="hidden items-center gap-1 sm:flex">
          <Kbd>⌘↵</Kbd> new tab
        </span>
        <span className="hidden items-center gap-1 sm:flex">
          <Kbd>Tab</Kbd> switch scope
        </span>
        <span className="ml-auto">{results && !commandMode && term ? `${results.total} result${results.total === 1 ? '' : 's'}` : 'Type > for commands'}</span>
      </div>
    </Modal>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-faint px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide uppercase">{children}</div>
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="surface-muted border-app rounded border px-1 font-sans">{children}</kbd>
}

function RowAction({ label, onClick, primary, children }: { label: string; onClick: () => void; primary?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={(e) => (e.stopPropagation(), onClick())}
      title={label}
      aria-label={label}
      className={cn('flex h-7 w-7 items-center justify-center rounded-md', primary ? 'bg-brand-600 text-white' : 'text-muted hover:bg-[var(--bg-hover)] border-app border')}
    >
      {children}
    </button>
  )
}
