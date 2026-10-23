import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { ArrowUp, CheckSquare, Film, Hash, MessageSquare, MessagesSquare, Pencil, Phone, Plus, SmilePlus, Trash2, Video, X } from 'lucide-react'
import { useCall } from '../calls/useCall'
import ClipPlayer from '../clips/ClipPlayer'
import { clockFrom } from '../calls/CallLayer'
import { useMe, useStore } from '../../store/useStore'
import type { Channel, ID, Message } from '../../store/types'
import { Avatar, MenuItem, Modal, Popover, usePopover } from '../components/ui'
import { cn, initials } from '../../lib/utils'

const QUICK_EMOJI = ['👍', '🎉', '❤️', '😂', '👀', '🙏', '🔥', '✅']

function useChannelTitle() {
  const users = useStore((s) => s.users)
  const me = useMe()
  return (c: Channel) => (c.kind === 'dm' ? users.find((u) => u.id === c.members.find((m) => m !== me.id))?.name ?? 'Direct message' : c.name)
}

export function useUnreadChat() {
  const { channels, messages, lastRead, currentUserId } = useStore()
  return useMemo(() => {
    const m = new Map<ID, number>()
    for (const c of channels) {
      const since = lastRead[c.id] ?? ''
      m.set(c.id, messages.filter((x) => x.channelId === c.id && !x.parentId && x.userId !== currentUserId && x.createdAt > since).length)
    }
    return m
  }, [channels, messages, lastRead, currentUserId])
}

export default function ChatPage() {
  const { channelId } = useParams()
  const channels = useStore((s) => s.channels)
  if (!channelId) return <Navigate to={`/app/chat/${channels[0]?.id ?? ''}`} replace />
  const channel = channels.find((c) => c.id === channelId)
  return (
    <div className="flex h-full min-h-0">
      <ChannelList active={channelId} />
      {channel ? <ChannelView key={channel.id} channel={channel} /> : <div className="text-muted m-auto text-sm">Channel not found.</div>}
    </div>
  )
}

function ChannelList({ active }: { active: ID }) {
  const { channels, users, addChannel, openDM } = useStore()
  const me = useMe()
  const nav = useNavigate()
  const title = useChannelTitle()
  const unread = useUnreadChat()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const dmPop = usePopover()

  const row = (c: Channel) => {
    const n = unread.get(c.id) ?? 0
    const other = c.kind === 'dm' ? c.members.find((m) => m !== me.id) : null
    return (
      <button
        key={c.id}
        onClick={() => nav(`/app/chat/${c.id}`)}
        className={cn('flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px]', c.id === active ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-100 font-medium' : 'hover-surface', n > 0 && 'font-semibold')}
      >
        {other ? <Avatar userId={other} size={18} /> : <Hash size={14} className="text-muted" />}
        <span className="truncate">{title(c)}</span>
        {n > 0 && <span className="bg-brand-600 ml-auto rounded-full px-1.5 text-[10px] font-bold text-white">{n}</span>}
      </button>
    )
  }

  return (
    <aside className="surface-subtle border-app hidden w-60 shrink-0 flex-col overflow-y-auto border-r p-2 scroll-thin sm:flex">
      <div className="flex items-center px-2 py-2">
        <MessagesSquare size={17} className="text-brand-600 mr-2" />
        <h1 className="font-semibold">Chat</h1>
      </div>
      <div className="flex items-center px-2 pt-2 pb-1">
        <span className="text-faint text-[11px] font-semibold uppercase">Channels</span>
        <button onClick={() => setCreating(true)} className="text-muted hover-surface ml-auto rounded p-0.5" aria-label="New channel">
          <Plus size={14} />
        </button>
      </div>
      {channels.filter((c) => c.kind === 'channel').map(row)}
      <div className="flex items-center px-2 pt-4 pb-1">
        <span className="text-faint text-[11px] font-semibold uppercase">Direct messages</span>
        <button onClick={dmPop.toggle} className="text-muted hover-surface ml-auto rounded p-0.5" aria-label="New message">
          <Plus size={14} />
        </button>
        <Popover open={dmPop.open} anchor={dmPop.anchor} onClose={dmPop.close} width={220}>
          {users
            .filter((u) => u.id !== me.id)
            .map((u) => (
              <MenuItem key={u.id} onClick={() => (nav(`/app/chat/${openDM(u.id)}`), dmPop.close())}>
                <Avatar userId={u.id} size={20} /> {u.name}
              </MenuItem>
            ))}
        </Popover>
      </div>
      {channels.filter((c) => c.kind === 'dm').map(row)}

      <Modal open={creating} onClose={() => setCreating(false)} className="mt-[15vh] max-w-md">
        <form
          className="p-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            const id = addChannel(name.trim(), topic.trim())
            setCreating(false)
            setName('')
            setTopic('')
            nav(`/app/chat/${id}`)
          }}
        >
          <h2 className="mb-4 text-lg font-semibold">Create a channel</h2>
          <label className="text-sm font-medium">Name</label>
          <div className="border-app focus-within:border-brand-500 mt-1 mb-3 flex items-center gap-1 rounded-lg border px-2">
            <Hash size={14} className="text-faint" />
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. design-crit" className="h-9 flex-1 bg-transparent outline-none" />
          </div>
          <label className="text-sm font-medium">Topic (optional)</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What’s this channel about?" className="border-app focus:border-brand-500 mt-1 h-9 w-full rounded-lg border bg-transparent px-2 outline-none" />
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className="hover-surface rounded-lg px-3 py-1.5 text-sm">
              Cancel
            </button>
            <button disabled={!name.trim()} className="bg-brand-600 rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
              Create
            </button>
          </div>
        </form>
      </Modal>
    </aside>
  )
}

function dayLabel(iso: string) {
  const d = parseISO(iso)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEEE, MMMM d')
}

function ChannelView({ channel }: { channel: Channel }) {
  const { messages, markChannelRead, sendMessage, users } = useStore()
  const title = useChannelTitle()
  const [thread, setThread] = useState<ID | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  const channels = useStore((s) => s.channels)

  const top = useMemo(() => messages.filter((m) => m.channelId === channel.id && !m.parentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [messages, channel.id])
  const replyCount = useMemo(() => {
    const r = new Map<ID, Message[]>()
    messages.forEach((m) => m.parentId && r.set(m.parentId, [...(r.get(m.parentId) ?? []), m]))
    return r
  }, [messages])

  useEffect(() => {
    markChannelRead(channel.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, top.length])
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [top.length, channel.id])

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-app flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <select value={channel.id} onChange={(e) => nav(`/app/chat/${e.target.value}`)} className="border-app surface rounded-md border px-1 py-1 text-sm sm:hidden" aria-label="Switch channel">
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.kind === 'dm' ? '@ ' : '# '}
                {title(c)}
              </option>
            ))}
          </select>
          <span className="hidden items-center gap-1 font-semibold sm:flex">
            {channel.kind === 'channel' ? <Hash size={16} className="text-muted" /> : null}
            {title(channel)}
          </span>
          {channel.topic && <span className="text-muted hidden truncate text-sm md:inline">— {channel.topic}</span>}
          <span className="ml-auto flex items-center gap-1">
            <button
              onClick={() => void useCall.getState().prepare({ title: channel.kind === 'dm' ? title(channel) : `#${channel.name}`, kind: 'audio', channelId: channel.id, meetingId: null, invitees: channel.members })}
              className="hover-surface text-muted rounded-md p-1.5"
              title="Start audio call"
            >
              <Phone size={17} />
            </button>
            <button
              onClick={() => void useCall.getState().prepare({ title: channel.kind === 'dm' ? title(channel) : `#${channel.name}`, kind: 'video', channelId: channel.id, meetingId: null, invitees: channel.members })}
              className="hover-surface text-muted rounded-md p-1.5"
              title="Start video call"
            >
              <Video size={17} />
            </button>
          </span>
          <span className="flex -space-x-1.5" title={channel.members.map((m) => users.find((u) => u.id === m)?.name).join(', ')}>
            {channel.members.slice(0, 5).map((m) => (
              <Avatar key={m} userId={m} size={24} ring />
            ))}
          </span>
        </header>
        <LiveCallBanner channelId={channel.id} />
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4 scroll-thin sm:px-4">
          {top.length === 0 && (
            <div className="text-muted mx-auto mt-16 max-w-sm text-center text-sm">
              <MessageSquare size={32} className="text-brand-500 mx-auto mb-3" />
              This is the very beginning of {channel.kind === 'dm' ? `your conversation with ${title(channel)}` : `#${channel.name}`}.
            </div>
          )}
          {top.map((m, i) => {
            const newDay = i === 0 || dayLabel(top[i - 1].createdAt) !== dayLabel(m.createdAt)
            const grouped = !newDay && top[i - 1].userId === m.userId && new Date(m.createdAt).getTime() - new Date(top[i - 1].createdAt).getTime() < 5 * 60000
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <div className="my-4 flex items-center gap-3">
                    <span className="border-app flex-1 border-t" />
                    <span className="border-app text-muted rounded-full border px-3 py-0.5 text-xs font-medium">{dayLabel(m.createdAt)}</span>
                    <span className="border-app flex-1 border-t" />
                  </div>
                )}
                <MessageItem message={m} grouped={grouped} replies={replyCount.get(m.id) ?? []} onThread={() => setThread(m.id)} />
              </Fragment>
            )
          })}
          <div ref={bottom} />
        </div>
        <Composer placeholder={`Message ${channel.kind === 'dm' ? title(channel) : '#' + channel.name}`} members={channel.members} onSend={(t) => sendMessage(channel.id, t)} />
      </div>
      {thread && <ThreadPanel parentId={thread} onClose={() => setThread(null)} channelId={channel.id} />}
    </div>
  )
}

/** Renders text with @Full Name mentions highlighted. */
function RichMessage({ text }: { text: string }) {
  const users = useStore((s) => s.users)
  const names = users.map((u) => u.name).sort((a, b) => b.length - a.length)
  if (!names.length) return <>{text}</>
  const re = new RegExp(`@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  const parts: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    parts.push(text.slice(last, m.index))
    parts.push(
      <span key={m.index} className="bg-brand-50 text-brand-700 dark:bg-brand-600/25 dark:text-brand-100 rounded px-0.5 font-medium">
        @{m[1]}
      </span>,
    )
    last = (m.index ?? 0) + m[0].length
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}

function MessageItem({ message: m, grouped, replies, onThread, inThread }: { message: Message; grouped?: boolean; replies?: Message[]; onThread?: () => void; inThread?: boolean }) {
  const { users, toggleReaction, deleteMessage, editMessage, messageToTask, lists, tasks, openTask } = useStore()
  const me = useMe()
  const user = users.find((u) => u.id === m.userId)
  const emoji = usePopover()
  const toTask = usePopover()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(m.text)
  const linked = m.taskId ? tasks.find((t) => t.id === m.taskId) : null
  const mine = m.userId === me.id

  return (
    <div className={cn('group hover-surface relative flex gap-3 rounded-lg px-2', grouped ? 'py-0.5' : 'mt-2 py-1.5')}>
      <div className="w-9 shrink-0">
        {!grouped ? <Avatar userId={m.userId} size={36} /> : <span className="text-faint hidden pt-1 text-[10px] group-hover:block">{format(parseISO(m.createdAt), 'h:mm')}</span>}
      </div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{user?.name ?? 'Unknown'}</span>
            <span className="text-faint text-xs">{format(parseISO(m.createdAt), 'h:mm a')}</span>
          </div>
        )}
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (draft.trim()) editMessage(m.id, draft.trim())
              setEditing(false)
            }}
          >
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setEditing(false)} className="border-brand-500 w-full rounded-md border bg-transparent px-2 py-1 text-sm outline-none" />
            <span className="text-faint text-[11px]">Enter to save · Esc to cancel</span>
          </form>
        ) : (
          <p className="text-[14px] leading-relaxed break-words whitespace-pre-wrap">
            <RichMessage text={m.text} />
            {m.edited && <span className="text-faint ml-1 text-[11px]">(edited)</span>}
          </p>
        )}
        {m.callId && <CallCard callId={m.callId} />}
        {m.clipId && <ClipPlayer clipId={m.clipId} compact className="mt-1.5" />}
        {linked && (
          <button onClick={() => openTask(linked.id)} className="border-app hover-surface mt-1 inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
            <CheckSquare size={13} className="text-brand-600" /> MS-{linked.key} · {linked.title}
          </button>
        )}
        {Object.keys(m.reactions).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(m.reactions).map(([e, us]) => (
              <button
                key={e}
                onClick={() => toggleReaction(m.id, e)}
                title={us.map((u) => users.find((x) => x.id === u)?.name).join(', ')}
                className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs', us.includes(me.id) ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/20' : 'border-app')}
              >
                {e} <span className="tabular-nums">{us.length}</span>
              </button>
            ))}
          </div>
        )}
        {!inThread && replies && replies.length > 0 && (
          <button onClick={onThread} className="text-brand-600 mt-1 inline-flex items-center gap-2 text-xs font-semibold hover:underline">
            <span className="flex -space-x-1">
              {[...new Set(replies.map((r) => r.userId))].slice(0, 3).map((u) => (
                <Avatar key={u} userId={u} size={18} ring />
              ))}
            </span>
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>
      {/* hover toolbar */}
      <div className="surface border-app absolute -top-3 right-2 hidden items-center rounded-lg border shadow-sm group-hover:flex">
        <button onClick={emoji.toggle} className="hover-surface text-muted rounded-md p-1.5" title="React">
          <SmilePlus size={15} />
        </button>
        {!inThread && (
          <button onClick={onThread} className="hover-surface text-muted rounded-md p-1.5" title="Reply in thread">
            <MessageSquare size={15} />
          </button>
        )}
        {!m.taskId && (
          <button onClick={toTask.toggle} className="hover-surface text-muted rounded-md p-1.5" title="Create task from message">
            <CheckSquare size={15} />
          </button>
        )}
        {mine && (
          <>
            <button onClick={() => (setDraft(m.text), setEditing(true))} className="hover-surface text-muted rounded-md p-1.5" title="Edit">
              <Pencil size={14} />
            </button>
            <button onClick={() => confirm('Delete this message?') && deleteMessage(m.id)} className="hover-surface rounded-md p-1.5 text-red-500" title="Delete">
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
      <Popover open={emoji.open} anchor={emoji.anchor} onClose={emoji.close} width={196} align="end">
        <div className="grid grid-cols-4 gap-1">
          {QUICK_EMOJI.map((e) => (
            <button key={e} onClick={() => (toggleReaction(m.id, e), emoji.close())} className="hover-surface rounded p-1 text-xl">
              {e}
            </button>
          ))}
        </div>
      </Popover>
      <Popover open={toTask.open} anchor={toTask.anchor} onClose={toTask.close} width={220} align="end">
        <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">Add task to List</div>
        {lists.map((l) => (
          <MenuItem key={l.id} onClick={() => (openTask(messageToTask(m.id, l.id)), toTask.close())}>
            {l.name}
          </MenuItem>
        ))}
      </Popover>
    </div>
  )
}

function ThreadPanel({ parentId, onClose, channelId }: { parentId: ID; onClose: () => void; channelId: ID }) {
  const { messages, sendMessage, channels } = useStore()
  const parent = messages.find((m) => m.id === parentId)
  const replies = messages.filter((m) => m.parentId === parentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const channel = channels.find((c) => c.id === channelId)
  if (!parent) return null
  return (
    <aside className="border-app surface fixed inset-0 z-30 flex flex-col md:static md:w-96 md:border-l">
      <header className="border-app flex h-12 shrink-0 items-center border-b px-4">
        <span className="font-semibold">Thread</span>
        <button onClick={onClose} className="hover-surface text-muted ml-auto rounded p-1.5" aria-label="Close thread">
          <X size={16} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 scroll-thin">
        <MessageItem message={parent} inThread />
        <div className="text-faint my-2 flex items-center gap-2 px-2 text-xs">
          {replies.length} {replies.length === 1 ? 'reply' : 'replies'} <span className="border-app flex-1 border-t" />
        </div>
        {replies.map((r) => (
          <MessageItem key={r.id} message={r} inThread />
        ))}
      </div>
      <Composer placeholder="Reply…" members={channel?.members ?? []} onSend={(t) => sendMessage(channelId, t, parentId)} />
    </aside>
  )
}

function Composer({ placeholder, onSend, members }: { placeholder: string; onSend: (text: string) => void; members: ID[] }) {
  const users = useStore((s) => s.users)
  const [text, setText] = useState('')
  const [mention, setMention] = useState<{ q: string; start: number } | null>(null)
  const [hi, setHi] = useState(0)
  const ref = useRef<HTMLTextAreaElement>(null)
  const matches = mention ? users.filter((u) => members.includes(u.id) && u.name.toLowerCase().includes(mention.q.toLowerCase())).slice(0, 6) : []

  const detect = (value: string, caret: number) => {
    const before = value.slice(0, caret)
    const m = before.match(/(?:^|\s)@([\w ]{0,20})$/)
    if (m && !m[1].includes('  ')) setMention({ q: m[1], start: caret - m[1].length - 1 })
    else setMention(null)
    setHi(0)
  }
  const pick = (name: string) => {
    if (!mention || !ref.current) return
    const caret = ref.current.selectionStart
    const next = text.slice(0, mention.start) + `@${name} ` + text.slice(caret)
    setText(next)
    setMention(null)
    requestAnimationFrame(() => {
      const pos = mention.start + name.length + 2
      ref.current?.setSelectionRange(pos, pos)
      ref.current?.focus()
    })
  }
  const send = () => {
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
    setMention(null)
  }

  return (
    <div className="relative shrink-0 p-3">
      {matches.length > 0 && (
        <div className="surface shadow-pop absolute bottom-full left-3 mb-1 w-64 rounded-lg p-1 text-sm">
          {matches.map((u, i) => (
            <button key={u.id} onMouseDown={(e) => (e.preventDefault(), pick(u.name))} className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left', i === hi && 'surface-muted')}>
              <Avatar userId={u.id} size={20} /> {u.name}
              <span className="text-faint ml-auto text-xs">{initials(u.name)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="border-app focus-within:border-brand-500 surface flex items-end gap-2 rounded-xl border p-2">
        <textarea
          ref={ref}
          value={text}
          rows={1}
          onChange={(e) => {
            setText(e.target.value)
            detect(e.target.value, e.target.selectionStart)
          }}
          onKeyDown={(e) => {
            if (matches.length) {
              if (e.key === 'ArrowDown') return e.preventDefault(), setHi((h) => (h + 1) % matches.length)
              if (e.key === 'ArrowUp') return e.preventDefault(), setHi((h) => (h - 1 + matches.length) % matches.length)
              if (e.key === 'Enter' || e.key === 'Tab') return e.preventDefault(), pick(matches[hi].name)
              if (e.key === 'Escape') return setMention(null)
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={`${placeholder} — type @ to mention`}
          className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent px-1 text-sm outline-none [field-sizing:content]"
        />
        <button onClick={send} disabled={!text.trim()} className="bg-brand-600 rounded-lg p-1.5 text-white disabled:opacity-40" aria-label="Send">
          <ArrowUp size={16} />
        </button>
      </div>
      <p className="text-faint mt-1 px-1 text-[11px]">Enter to send · Shift + Enter for a new line</p>
    </div>
  )
}

function LiveCallBanner({ channelId }: { channelId: ID }) {
  const ongoing = useCall((s) => Object.values(s.ongoing).find((o) => o.channelId === channelId && Object.keys(o.peers).length))
  const inThisCall = useCall((s) => s.phase === 'in-call' && s.call?.callId === ongoing?.callId)
  if (!ongoing || inThisCall) return null
  const people = [...new Set(Object.values(ongoing.peers))]
  return (
    <div className="flex items-center gap-3 border-b border-emerald-500/30 bg-emerald-50 px-4 py-2 text-sm dark:bg-emerald-500/10">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
      <span className="min-w-0 flex-1 truncate">
        {ongoing.kind === 'video' ? 'Video' : 'Audio'} call in progress · {people.length} {people.length === 1 ? 'person' : 'people'}
      </span>
      <span className="flex -space-x-1.5">
        {people.slice(0, 4).map((p) => (
          <Avatar key={p} userId={p} size={22} ring />
        ))}
      </span>
      <button
        onClick={() => void useCall.getState().prepare({ callId: ongoing.callId, title: ongoing.title, kind: ongoing.kind, channelId, meetingId: null, invitees: [] })}
        className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
      >
        Join
      </button>
    </div>
  )
}

function CallCard({ callId }: { callId: string }) {
  const log = useStore((s) => s.callLogs.find((c) => c.callId === callId))
  const live = useCall((s) => !!s.ongoing[callId] && Object.keys(s.ongoing[callId].peers).length > 0)
  if (!log) return null
  const ended = !!log.endedAt && !live
  return (
    <div className="border-app surface-subtle mt-1.5 flex max-w-sm items-center gap-3 rounded-lg border px-3 py-2 text-xs">
      <span className={ended ? 'text-muted' : 'text-emerald-600'}>{log.kind === 'video' ? <Video size={18} /> : <Phone size={18} />}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{ended ? 'Call ended' : 'Call in progress'}</span>
        <span className="text-muted">
          {ended ? clockFrom(new Date(log.endedAt!).getTime() - new Date(log.startedAt).getTime()) : 'Join from the banner above'} · {log.participants.length} joined
          {log.recordingClipId && ' · recorded'}
        </span>
      </span>
      {log.recordingClipId && <Film size={14} className="text-muted" />}
      {!ended && (
        <button
          onClick={() => void useCall.getState().prepare({ callId, title: log.title, kind: log.kind, channelId: log.channelId, meetingId: log.meetingId, invitees: [] })}
          className="rounded-md bg-emerald-500 px-2.5 py-1 font-semibold text-white"
        >
          Join
        </button>
      )}
    </div>
  )
}
