import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, isToday, parseISO } from 'date-fns'
import { Hash, MessageSquare, Phone, Search, UserPlus, Video, X } from 'lucide-react'
import { useCall } from '../calls/useCall'
import { useMe, useStore } from '../../store/useStore'
import type { Channel, ID, User } from '../../store/types'
import { Avatar } from '../components/ui'
import { cn } from '../../lib/utils'

/** Avatar with a presence dot and the person's status emoji, for chat lists. */
export function PresenceAvatar({ userId, size = 18 }: { userId: ID; size?: number }) {
  const online = useStore((s) => s.presence.includes(userId))
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar userId={userId} size={size} />
      <span className={cn('absolute -right-0.5 -bottom-0.5 rounded-full ring-2 ring-[var(--bg-subtle)]', online ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-600')} style={{ width: size * 0.42, height: size * 0.42 }} />
    </span>
  )
}

export const liveStatusOf = (u?: User) => (u?.status && (!u.status.until || u.status.until > new Date().toISOString()) ? u.status : undefined)

/** Highlights every occurrence of `q` in `text`. */
function Hl({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'))
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-amber-200/70 px-px text-inherit dark:bg-amber-500/40">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  )
}

/** Short excerpt of `text` centred on the first match. */
const excerpt = (text: string, q: string) => {
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 40) return text.slice(0, 120)
  return `…${text.slice(i - 30, i + 90)}`
}

type Hit = { key: string; go: () => void }

/**
 * The Chat sidebar's search: people (start a DM or call), channels, and
 * messages (jump straight to the message). Arrow keys move, Enter opens.
 */
export default function ChatSearch({ q, setQ, channelTitle, renderIdle }: { q: string; setQ: (v: string) => void; channelTitle: (c: Channel) => string; renderIdle: () => ReactNode }) {
  const s = useStore()
  const me = useMe()
  const nav = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const [cursor, setCursor] = useState(0)
  const needle = q.trim().toLowerCase()

  // "/" focuses the search from anywhere in Chat, like Slack.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const memberIds = useMemo(() => new Set(s.workspaces.find((w) => w.id === s.currentWorkspaceId)?.members.filter((m) => !m.invited).map((m) => m.userId) ?? s.users.map((u) => u.id)), [s.workspaces, s.currentWorkspaceId, s.users])
  const people = useMemo(
    () =>
      needle
        ? s.users
            .filter((u) => memberIds.has(u.id) && (u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle) || (liveStatusOf(u)?.text ?? '').toLowerCase().includes(needle)))
            .sort((a, b) => Number(b.id === me.id) - Number(a.id === me.id) || Number(s.presence.includes(b.id)) - Number(s.presence.includes(a.id)) || a.name.localeCompare(b.name))
            .slice(0, 8)
        : [],
    [needle, s.users, memberIds, s.presence, me.id],
  )
  const channels = useMemo(() => (needle ? s.channels.filter((c) => channelTitle(c).toLowerCase().includes(needle) || c.topic.toLowerCase().includes(needle)).slice(0, 8) : []), [needle, s.channels, channelTitle])
  const messages = useMemo(
    () =>
      needle.length >= 2
        ? s.messages
            .filter((m) => m.text.toLowerCase().includes(needle))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 20)
        : [],
    [needle, s.messages],
  )

  const openPerson = (u: User) => nav(`/app/chat/${s.openDM(u.id)}`)
  const call = (u: User, kind: 'audio' | 'video') => {
    const channelId = s.openDM(u.id)
    void useCall.getState().prepare({ title: u.name, kind, channelId, meetingId: null, invitees: [me.id, u.id] })
  }
  const hits: Hit[] = [
    ...people.map((u) => ({ key: `p:${u.id}`, go: () => openPerson(u) })),
    ...channels.map((c) => ({ key: `c:${c.id}`, go: () => nav(`/app/chat/${c.id}`) })),
    ...messages.map((m) => ({ key: `m:${m.id}`, go: () => nav(`/app/chat/${m.channelId}?m=${m.id}`) })),
  ]
  useEffect(() => setCursor(0), [needle])
  const pick = (h?: Hit) => {
    if (!h) return
    h.go()
    setQ('')
    input.current?.blur()
  }
  const isActive = (key: string) => hits[cursor]?.key === key
  const rowCls = (key: string) => cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]', isActive(key) ? 'bg-[var(--bg-hover)]' : 'hover-surface')

  return (
    <>
      <div className="border-app focus-within:border-brand-500 surface mx-1 mb-1 flex h-8 items-center gap-2 rounded-md border px-2">
        <Search size={14} className="text-faint shrink-0" />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), setCursor((c) => Math.min(c + 1, hits.length - 1)))
            if (e.key === 'ArrowUp') (e.preventDefault(), setCursor((c) => Math.max(c - 1, 0)))
            if (e.key === 'Enter') (e.preventDefault(), pick(hits[cursor]))
            if (e.key === 'Escape') (setQ(''), input.current?.blur())
          }}
          placeholder="Search people, channels, messages"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          aria-label="Search chat"
          role="combobox"
          aria-expanded={!!needle}
        />
        {q ? (
          <button onClick={() => setQ('')} className="text-faint hover:text-app" aria-label="Clear search">
            <X size={13} />
          </button>
        ) : (
          <kbd className="surface-muted text-faint rounded px-1 text-[10px]">/</kbd>
        )}
      </div>

      {!needle ? (
        renderIdle()
      ) : (
        <div role="listbox" aria-label="Search results" className="pb-2">
          {hits.length === 0 && (
            <div className="text-muted px-3 py-8 text-center text-xs">
              Nothing matches “{q.trim()}”.
              <button onClick={() => nav('/app/settings?tab=members')} className="text-brand-600 mt-2 flex w-full items-center justify-center gap-1 font-medium hover:underline">
                <UserPlus size={13} /> Invite someone new
              </button>
            </div>
          )}

          {people.length > 0 && <Section label="People" n={people.length} />}
          {people.map((u) => {
            const st = liveStatusOf(u)
            const online = s.presence.includes(u.id)
            return (
              <div key={u.id} className={cn('group', rowCls(`p:${u.id}`))} onMouseEnter={() => setCursor(hits.findIndex((h) => h.key === `p:${u.id}`))}>
                <button onClick={() => pick(hits.find((h) => h.key === `p:${u.id}`))} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <PresenceAvatar userId={u.id} size={24} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      <Hl text={u.name} q={q.trim()} />
                      {u.id === me.id && <span className="text-faint font-normal"> (you)</span>}
                    </span>
                    <span className="text-faint block truncate text-[11px]">{st ? `${st.emoji} ${st.text}`.trim() : online ? 'Active now' : <Hl text={u.email} q={q.trim()} />}</span>
                  </span>
                </button>
                {u.id !== me.id && (
                  <span className="flex shrink-0 items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <IconBtn label={`Message ${u.name}`} onClick={() => pick(hits.find((h) => h.key === `p:${u.id}`))}>
                      <MessageSquare size={13} />
                    </IconBtn>
                    <IconBtn label={`Call ${u.name}`} onClick={() => (call(u, 'audio'), setQ(''))}>
                      <Phone size={13} />
                    </IconBtn>
                    <IconBtn label={`Video call ${u.name}`} onClick={() => (call(u, 'video'), setQ(''))}>
                      <Video size={13} />
                    </IconBtn>
                  </span>
                )}
              </div>
            )
          })}

          {channels.length > 0 && <Section label="Conversations" n={channels.length} />}
          {channels.map((c) => {
            const other = c.kind === 'dm' ? c.members.find((m) => m !== me.id) : null
            return (
              <button key={c.id} onClick={() => pick(hits.find((h) => h.key === `c:${c.id}`))} onMouseEnter={() => setCursor(hits.findIndex((h) => h.key === `c:${c.id}`))} className={rowCls(`c:${c.id}`)}>
                {other ? <PresenceAvatar userId={other} /> : <Hash size={14} className="text-muted shrink-0" />}
                <span className="min-w-0">
                  <span className="block truncate">
                    <Hl text={channelTitle(c)} q={q.trim()} />
                  </span>
                  {c.topic && (
                    <span className="text-faint block truncate text-[11px]">
                      <Hl text={c.topic} q={q.trim()} />
                    </span>
                  )}
                </span>
                <span className="text-faint ml-auto shrink-0 text-[11px]">{c.kind === 'channel' ? `${c.members.length || ''}` : ''}</span>
              </button>
            )
          })}

          {messages.length > 0 && <Section label="Messages" n={messages.length} />}
          {needle.length === 1 && <p className="text-faint px-3 py-1 text-[11px]">Type another letter to search messages.</p>}
          {messages.map((m) => {
            const c = s.channels.find((x) => x.id === m.channelId)
            const author = s.users.find((u) => u.id === m.userId)
            const d = parseISO(m.createdAt)
            return (
              <button key={m.id} onClick={() => pick(hits.find((h) => h.key === `m:${m.id}`))} onMouseEnter={() => setCursor(hits.findIndex((h) => h.key === `m:${m.id}`))} className={cn(rowCls(`m:${m.id}`), 'items-start')}>
                <Avatar userId={m.userId} size={20} />
                <span className="min-w-0 flex-1">
                  <span className="text-faint flex items-center gap-1 text-[11px]">
                    <span className="text-app truncate font-medium">{author?.name.split(' ')[0] ?? 'Someone'}</span>
                    <span className="truncate">
                      {c?.kind === 'channel' ? '#' : ''}
                      {c ? channelTitle(c) : ''}
                      {m.parentId ? ' · thread' : ''}
                    </span>
                    <span className="ml-auto shrink-0">{isToday(d) ? format(d, 'h:mm a') : format(d, 'MMM d')}</span>
                  </span>
                  <span className="line-clamp-2 text-[12px] leading-snug">
                    <Hl text={excerpt(m.text, q.trim())} q={q.trim()} />
                  </span>
                </span>
              </button>
            )
          })}
          {hits.length > 0 && <p className="text-faint px-3 pt-2 text-[10px]">↑↓ to move · Enter to open · Esc to clear</p>}
        </div>
      )}
    </>
  )
}

function Section({ label, n }: { label: string; n: number }) {
  return (
    <div className="text-faint flex items-center px-2 pt-2 pb-1 text-[11px] font-semibold uppercase">
      {label}
      <span className="ml-1 font-normal">{n}</span>
    </div>
  )
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="text-muted hover:text-app rounded p-1 hover:bg-[var(--bg)]" title={label} aria-label={label}>
      {children}
    </button>
  )
}
