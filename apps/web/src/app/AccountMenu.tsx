import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDays, addHours, addMinutes, endOfDay, endOfWeek, format, isToday, parseISO, setHours, startOfDay } from 'date-fns'
import { Bell, BellOff, Check, ChevronLeft, ChevronRight, Keyboard, LogOut, Moon, Palette, Pin, PinOff, Settings, SmilePlus, Sun, Trash2, X } from 'lucide-react'
import { api } from '../api/client'
import { useMe, useStore } from '../store/useStore'
import type { User, UserStatus } from '../store/types'
import { Avatar, Modal, Popover } from './components/ui'
import { TOOLS, useRunTool } from './QuickActions'
import { isMuted, usePersonal } from './personal'
import { cn } from '../lib/utils'

const row = 'hover-surface flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left'

/** The avatar menu: status, mute, settings, theme, personal tools and log out. */
export default function AccountMenu({ open, anchor, onClose, onLogout }: { open: boolean; anchor: HTMLElement | null; onClose: () => void; onLogout: () => void }) {
  const me = useMe()
  const nav = useNavigate()
  const { theme, setTheme } = useStore()
  const online = useStore((s) => s.presence.includes(me.id))
  const { pinned, togglePin, mutedUntil, mute } = usePersonal()
  const runTool = useRunTool()
  const [screen, setScreen] = useState<'main' | 'mute' | 'theme'>('main')
  const [statusOpen, setStatusOpen] = useState(false)
  useEffect(() => {
    if (!open) setScreen('main')
  }, [open])
  const go = (to: string) => (nav(to), onClose())
  const muted = isMuted(mutedUntil)
  const status = liveStatus(me)

  const back = (title: string) => (
    <button onClick={() => setScreen('main')} className="text-muted hover:text-app flex w-full items-center gap-1 px-2 py-1.5 text-xs font-semibold">
      <ChevronLeft size={14} /> {title}
    </button>
  )

  return (
    <>
      <Popover open={open} anchor={anchor} onClose={onClose} align="end" width={272}>
        <div className="scroll-thin max-h-[calc(100vh-72px)] overflow-y-auto">
          {screen === 'mute' ? (
            <>
              {back('Mute notifications')}
              {MUTE_OPTIONS.map((o) => (
                <button key={o.label} onClick={() => (mute(o.at()), onClose())} className={row}>
                  {o.label}
                </button>
              ))}
              <label className="text-muted flex items-center gap-2 px-2 py-1.5 text-xs">
                Custom
                <input
                  type="datetime-local"
                  min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                  onChange={(e) => {
                    const d = e.target.value ? new Date(e.target.value) : null
                    if (d && d > new Date()) (mute(d), onClose())
                  }}
                  className="border-app surface min-w-0 flex-1 rounded border px-1.5 py-1 text-xs"
                  aria-label="Mute until a custom date and time"
                />
              </label>
              {muted && (
                <>
                  <div className="border-app my-1 border-t" />
                  <button onClick={() => (mute(null), onClose())} className={row}>
                    <Bell size={15} className="text-muted" /> Unmute now
                  </button>
                </>
              )}
            </>
          ) : screen === 'theme' ? (
            <>
              {back('Themes')}
              {(['light', 'dark'] as const).map((t) => (
                <button key={t} onClick={() => setTheme(t)} className={row}>
                  {t === 'light' ? <Sun size={15} className="text-muted" /> : <Moon size={15} className="text-muted" />}
                  {t === 'light' ? 'Light' : 'Dark'}
                  {theme === t && <Check size={14} className="text-brand-600 ml-auto" />}
                </button>
              ))}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5 px-2 pt-2 pb-1.5">
                <span className="relative">
                  <Avatar userId={me.id} size={34} />
                  <span className={cn('absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full ring-2 ring-[var(--bg)]', muted ? 'bg-amber-500' : online ? 'bg-emerald-500' : 'bg-stone-400')} />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{me.name}</div>
                  <div className="text-muted truncate text-xs">{muted ? `Notifications muted until ${untilLabel(mutedUntil!)}` : online ? 'Online' : me.email}</div>
                </div>
              </div>
              <button onClick={() => (setStatusOpen(true), onClose())} className="border-app hover-surface mx-1 mb-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-md border px-2 py-1.5 text-left">
                {status ? <span className="w-4 text-center">{status.emoji || '💬'}</span> : <SmilePlus size={15} className="text-faint" />}
                <span className={cn('min-w-0 flex-1 truncate', !status && 'text-faint')}>{status ? status.text || 'Status set' : 'Set status'}</span>
                {status?.until && <span className="text-faint shrink-0 text-[11px]">until {untilLabel(status.until)}</span>}
              </button>

              <button onClick={() => setScreen('mute')} className={row}>
                {muted ? <BellOff size={15} className="text-amber-500" /> : <BellOff size={15} className="text-muted" />}
                {muted ? 'Notifications muted' : 'Mute notifications'}
                <ChevronRight size={14} className="text-faint ml-auto" />
              </button>
              <div className="border-app my-1 border-t" />
              <button onClick={() => go('/app/settings')} className={row}>
                <Settings size={15} className="text-muted" /> Settings & members
              </button>
              <button onClick={() => go('/app/settings?tab=notifications')} className={row}>
                <Bell size={15} className="text-muted" /> Notifications
              </button>
              <button onClick={() => setScreen('theme')} className={row}>
                <Palette size={15} className="text-muted" /> Themes
                <span className="text-faint ml-auto text-xs capitalize">{theme}</span>
                <ChevronRight size={14} className="text-faint" />
              </button>
              <button onClick={() => (window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' })), onClose())} className={row}>
                <Keyboard size={15} className="text-muted" /> Keyboard shortcuts
              </button>

              <div className="border-app my-1 border-t" />
              <div className="text-faint px-2 pt-1 pb-0.5 text-[11px] font-semibold tracking-wide uppercase">Personal tools</div>
              {TOOLS.map((t) => {
                const on = pinned.includes(t.id)
                return (
                  <div key={t.id} className="group flex items-center rounded-md hover:bg-[var(--bg-hover)]">
                    <button
                      onClick={(e) => {
                        // Popup tools anchor to the avatar, which stays put once this menu closes.
                        const el = anchor ?? e.currentTarget
                        onClose()
                        runTool(t, el)
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-left"
                    >
                      <t.icon size={15} className="text-muted shrink-0" /> <span className="truncate">{t.label}</span>
                    </button>
                    <button
                      onClick={() => togglePin(t.id)}
                      className={cn('mr-1 rounded p-1', on ? 'text-brand-600' : 'text-faint opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}
                      title={on ? 'Unpin from top bar' : 'Pin to top bar'}
                      aria-label={`${on ? 'Unpin' : 'Pin'} ${t.label}`}
                      aria-pressed={on}
                    >
                      {on ? <Pin size={13} className="fill-current" /> : <PinOff size={13} />}
                    </button>
                  </div>
                )
              })}

              <div className="border-app my-1 border-t" />
              <button onClick={() => go('/app/settings?tab=trash')} className={row}>
                <Trash2 size={15} className="text-muted" /> Trash
              </button>
              <button onClick={() => (onClose(), onLogout())} className={row}>
                <LogOut size={15} className="text-muted" /> Log out
              </button>
            </>
          )}
        </div>
      </Popover>
      <StatusDialog open={statusOpen} onClose={() => setStatusOpen(false)} />
    </>
  )
}

const MUTE_OPTIONS: { label: string; at: () => Date }[] = [
  { label: 'For 30 minutes', at: () => addMinutes(new Date(), 30) },
  { label: 'For 1 hour', at: () => addHours(new Date(), 1) },
  { label: 'For 4 hours', at: () => addHours(new Date(), 4) },
  { label: 'Until tomorrow', at: () => setHours(startOfDay(addDays(new Date(), 1)), 9) },
  { label: 'Until next week', at: () => setHours(startOfDay(addDays(endOfWeek(new Date(), { weekStartsOn: 1 }), 1)), 9) },
]

/** A user's status, or undefined once its clear-after time has passed. */
export function liveStatus(u: Pick<User, 'status'> | undefined): UserStatus | undefined {
  const st = u?.status
  if (!st || (!st.emoji && !st.text)) return undefined
  return st.until && st.until <= new Date().toISOString() ? undefined : st
}

const untilLabel = (iso: string) => {
  const d = parseISO(iso)
  return isToday(d) ? format(d, 'h:mm a') : format(d, 'EEE h:mm a')
}

const PRESETS: { emoji: string; text: string; clear: ClearKey }[] = [
  { emoji: '📅', text: 'In a meeting', clear: '1h' },
  { emoji: '🎧', text: 'Focusing', clear: '2h' },
  { emoji: '🚌', text: 'Commuting', clear: '30m' },
  { emoji: '🤒', text: 'Out sick', clear: 'today' },
  { emoji: '🌴', text: 'On vacation', clear: 'never' },
  { emoji: '🏠', text: 'Working remotely', clear: 'today' },
]
const EMOJIS = ['💬', '📅', '🎧', '🚌', '🤒', '🌴', '🏠', '☕', '🍽️', '✈️', '🔕', '🚀']
type ClearKey = 'never' | '30m' | '1h' | '2h' | '4h' | 'today' | 'week'
const CLEAR: Record<ClearKey, { label: string; at: () => Date | null }> = {
  never: { label: "Don't clear", at: () => null },
  '30m': { label: '30 minutes', at: () => addMinutes(new Date(), 30) },
  '1h': { label: '1 hour', at: () => addHours(new Date(), 1) },
  '2h': { label: '2 hours', at: () => addHours(new Date(), 2) },
  '4h': { label: '4 hours', at: () => addHours(new Date(), 4) },
  today: { label: 'Today', at: () => endOfDay(new Date()) },
  week: { label: 'This week', at: () => endOfWeek(new Date(), { weekStartsOn: 1 }) },
}

/** Set or clear the status teammates see next to your name. */
function StatusDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe()
  const toast = useStore((s) => s.toast)
  const current = liveStatus(me)
  const [emoji, setEmoji] = useState('')
  const [text, setText] = useState('')
  const [clear, setClear] = useState<ClearKey>('today')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setEmoji(current?.emoji ?? '')
    setText(current?.text ?? '')
    setClear(current ? (current.until ? 'today' : 'never') : 'today')
  }, [open]) // reset only when the dialog opens

  const save = async (status: UserStatus | null) => {
    setBusy(true)
    try {
      const p = await api.patch<User>('/users/me', { status })
      useStore.setState((s) => ({ users: s.users.map((u) => (u.id === p.id ? { ...u, ...p, status: p.status } : u)) }))
      toast(status ? 'Status updated' : 'Status cleared')
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save your status', 'error')
    } finally {
      setBusy(false)
    }
  }
  const submit = () => {
    if (!emoji && !text.trim()) return void save(null)
    const until = CLEAR[clear].at()
    void save({ emoji, text: text.trim(), ...(until ? { until: until.toISOString() } : {}) })
  }

  return (
    <Modal open={open} onClose={onClose} className="mt-[14vh] max-w-md">
      <form onSubmit={(e) => (e.preventDefault(), submit())} className="p-5">
        <div className="mb-4 flex items-center">
          <h2 className="text-lg font-semibold">Set a status</h2>
          <button type="button" onClick={onClose} className="hover-surface text-muted ml-auto rounded p-1" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="border-app focus-within:border-brand-500 flex items-center gap-2 rounded-lg border px-2">
          <EmojiButton value={emoji} onChange={setEmoji} />
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={100} placeholder="What's your status?" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Status" />
          {(emoji || text) && (
            <button type="button" onClick={() => (setEmoji(''), setText(''))} className="text-faint hover:text-app p-1" aria-label="Clear text">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="mt-3 space-y-0.5">
          {PRESETS.map((p) => (
            <button key={p.text} type="button" onClick={() => (setEmoji(p.emoji), setText(p.text), setClear(p.clear))} className={cn(row, 'text-sm')}>
              <span className="w-5 text-center">{p.emoji}</span> {p.text}
              <span className="text-faint ml-auto text-xs">{CLEAR[p.clear].label}</span>
            </button>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-muted">Clear after</span>
          <select value={clear} onChange={(e) => setClear(e.target.value as ClearKey)} className="border-app surface ml-auto h-8 rounded-md border px-2 text-sm">
            {(Object.keys(CLEAR) as ClearKey[]).map((k) => (
              <option key={k} value={k}>
                {CLEAR[k].label}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-5 flex items-center gap-2">
          {current && (
            <button type="button" disabled={busy} onClick={() => void save(null)} className="text-muted hover-surface rounded-lg px-3 py-2 text-sm font-medium">
              Clear status
            </button>
          )}
          <button type="button" onClick={onClose} className="hover-surface ml-auto rounded-lg px-3.5 py-2 text-sm font-medium">
            Cancel
          </button>
          <button disabled={busy} className="bg-brand-600 hover:bg-brand-700 rounded-lg px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EmojiButton({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <button type="button" onClick={(e) => setAnchor(anchor ? null : e.currentTarget)} className="hover-surface flex h-7 w-7 items-center justify-center rounded text-base" aria-label="Pick an emoji">
        {value || <SmilePlus size={16} className="text-faint" />}
      </button>
      <Popover open={!!anchor} anchor={anchor} onClose={() => setAnchor(null)} width={208}>
        <div className="grid grid-cols-6 gap-0.5 p-1">
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => (onChange(e), setAnchor(null))} className={cn('hover-surface rounded p-1 text-lg', value === e && 'bg-brand-50 dark:bg-brand-500/20')}>
              {e}
            </button>
          ))}
        </div>
      </Popover>
    </>
  )
}
