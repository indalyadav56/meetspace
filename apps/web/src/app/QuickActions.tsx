import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, type NavigateFunction } from 'react-router-dom'
import { AlarmClock, Briefcase, CheckSquare, FilePlus2, Film, LayoutDashboard, Mic, NotebookPen, NotepadText, PenTool, Play, Timer, Users, Video, type LucideIcon } from 'lucide-react'
import { addHours, format, setMinutes } from 'date-fns'
import { Popover } from './components/ui'
import { useMe, useStore } from '../store/useStore'
import { useCall } from './calls/useCall'
import { useRecorder } from './clips/Recorder'
import { cn } from '../lib/utils'
import { usePersonal, type PopupTool, type ToolId } from './personal'

/*
 * One-click capture from anywhere: a compact group of icons in the top bar.
 * Quick task, reminder and timer open small inline forms; the rest act at once.
 */

const input = 'border-app surface w-full rounded-md border px-2.5 py-1.5 text-sm outline-none focus:border-brand-500'

export interface Tool {
  id: ToolId
  label: string
  icon: LucideIcon
  /** popup tools open a small form anchored to whatever was clicked */
  popup?: PopupTool
  run?: (nav: NavigateFunction) => void
}

const startCall = () => {
  const me = useStore.getState().users.find((u) => u.id === useStore.getState().currentUserId)
  void useCall.getState().prepare({ title: `${me?.name.split(' ')[0] ?? 'My'}’s meeting`, kind: 'video', channelId: null, meetingId: null, invitees: [] })
}

/** Everything the account menu lists under Personal tools; pinned ones also sit in the top bar. */
export const TOOLS: Tool[] = [
  { id: 'task', label: 'Create task', icon: CheckSquare, popup: 'task' },
  { id: 'myWork', label: 'My Work', icon: Briefcase, run: (nav) => nav('/app/everything?mine=1') },
  { id: 'timer', label: 'Track time', icon: Timer, popup: 'timer' },
  { id: 'notepad', label: 'Notepad', icon: NotebookPen, popup: 'notepad' },
  { id: 'clip', label: 'Record a clip', icon: Film, run: () => useRecorder.getState().open({ mode: 'screen+camera' }) },
  { id: 'voice', label: 'Record a voice note', icon: Mic, run: () => useRecorder.getState().open({ mode: 'audio' }) },
  { id: 'reminder', label: 'Create reminder', icon: AlarmClock, popup: 'reminder' },
  { id: 'doc', label: 'Create doc', icon: FilePlus2, run: (nav) => nav(`/app/docs/${useStore.getState().addDoc(null)}`) },
  { id: 'whiteboard', label: 'Create whiteboard', icon: PenTool, run: (nav) => nav(`/app/whiteboards/${useStore.getState().addWhiteboard()}`) },
  { id: 'people', label: 'View people', icon: Users, run: (nav) => nav('/app/teams') },
  { id: 'dashboard', label: 'Create dashboard', icon: LayoutDashboard, run: (nav) => nav(`/app/dashboards/${useStore.getState().addDashboard()}`) },
  { id: 'notetaker', label: 'Meetings & AI notes', icon: NotepadText, run: (nav) => nav('/app/meetings') },
  { id: 'call', label: 'Start a video call', icon: Video, run: startCall },
]

export function useRunTool() {
  const nav = useNavigate()
  const openPopup = usePersonal((s) => s.openPopup)
  return (t: Tool, anchor: HTMLElement) => (t.popup ? openPopup(t.popup, anchor) : t.run?.(nav))
}

export default function QuickActions() {
  const timerOn = useStore((s) => !!s.timer)
  const { pathname } = useLocation()
  const pinned = usePersonal((s) => s.pinned)
  const popup = usePersonal((s) => s.popup)
  const close = usePersonal((s) => s.closePopup)
  const run = useRunTool()
  const shown = TOOLS.filter((t) => pinned.includes(t.id))

  return (
    <>
      {shown.length > 0 && (
        <div className="border-app surface hidden h-8 shrink-0 items-center rounded-lg border px-0.5 xl:flex" role="toolbar" aria-label="Quick actions">
          {shown.map((t) => (
            <Action key={t.id} label={t.id === 'timer' && timerOn ? 'Timer is running' : t.label} onClick={(e) => run(t, e.currentTarget)} active={(!!t.popup && popup?.tool === t.popup && popup.anchor.closest('[role=toolbar]') !== null) || (t.id === 'timer' && timerOn)}>
              <t.icon size={16} />
            </Action>
          ))}
        </div>
      )}
      <Popover open={!!popup} anchor={popup?.anchor ?? null} onClose={close} align="end" width={popup?.tool === 'notepad' ? 340 : 300}>
        {popup?.tool === 'task' && <QuickTask listFromRoute={pathname.match(/\/app\/list\/([^/]+)/)?.[1]} onDone={close} />}
        {popup?.tool === 'reminder' && <QuickReminder onDone={close} />}
        {popup?.tool === 'timer' && <QuickTimer onDone={close} />}
        {popup?.tool === 'notepad' && <Notepad onDone={close} />}
      </Popover>
    </>
  )
}

function Action({ label, onClick, active, children }: { label: string; onClick: (e: React.MouseEvent<HTMLElement>) => void; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn('flex h-7 w-7 items-center justify-center rounded-md transition-colors', active ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100' : 'text-muted hover:bg-[var(--bg-hover)] hover:text-[var(--text)]')}
    >
      {children}
    </button>
  )
}

/** A private scratchpad kept in this browser; any line can become a task. */
function Notepad({ onDone }: { onDone: () => void }) {
  const s = useStore()
  const me = useMe()
  const key = `ms.notepad.${me.id}`
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(key) ?? ''
    } catch {
      return ''
    }
  })
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, text)
      } catch {
        /* storage blocked */
      }
    }, 300)
    return () => clearTimeout(t)
  }, [key, text])
  const listId = s.lists[0]?.id
  const toTask = () => {
    const [first, ...rest] = text.trim().split('\n')
    if (!first?.trim() || !listId) return
    const id = s.addTask({ listId, title: first.trim().slice(0, 200), description: rest.join('\n').trim(), assignees: [me.id] })
    s.toast(`Created “${first.trim().slice(0, 40)}”`)
    setText('')
    onDone()
    s.openTask(id)
  }
  return (
    <div className="space-y-2 p-2">
      <div className="flex items-center text-sm font-semibold">
        Notepad <span className="text-faint ml-auto text-[11px] font-normal">Only you see this</span>
      </div>
      <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={9} placeholder="Jot something down… The first line becomes the task name." className={cn(input, 'resize-y font-[inherit]')} aria-label="Notepad" />
      <div className="flex items-center justify-between">
        <span className="text-faint text-[11px]">{text.trim() ? `${text.trim().split(/\s+/).length} words · saved` : 'Saved as you type'}</span>
        <button onClick={toTask} disabled={!text.trim() || !listId} className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">
          Turn into task
        </button>
      </div>
    </div>
  )
}

function QuickTask({ listFromRoute, onDone }: { listFromRoute?: string; onDone: () => void }) {
  const s = useStore()
  const me = useMe()
  const [title, setTitle] = useState('')
  const [listId, setListId] = useState(listFromRoute ?? s.lists[0]?.id ?? '')
  const save = (open: boolean) => {
    if (!title.trim() || !listId) return
    const id = s.addTask({ listId, title: title.trim(), assignees: [me.id] })
    s.toast(`Created “${title.trim()}”`)
    setTitle('')
    onDone()
    if (open) s.openTask(id)
  }
  return (
    <form className="space-y-2 p-2" onSubmit={(e) => (e.preventDefault(), save(false))}>
      <div className="text-sm font-semibold">Quick task</div>
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" className={input} />
      <select value={listId} onChange={(e) => setListId(e.target.value)} className={input} aria-label="List">
        {s.spaces.map((sp) => (
          <optgroup key={sp.id} label={sp.name}>
            {s.lists
              .filter((l) => l.spaceId === sp.id)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => save(true)} disabled={!title.trim()} className="hover-surface rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-40">
          Create & open
        </button>
        <button disabled={!title.trim()} className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">
          Create
        </button>
      </div>
    </form>
  )
}

function QuickReminder({ onDone }: { onDone: () => void }) {
  const s = useStore()
  const nextHour = setMinutes(addHours(new Date(), 1), 0)
  const [text, setText] = useState('')
  const [due, setDue] = useState(format(nextHour, "yyyy-MM-dd'T'HH:mm"))
  const presets: [string, Date][] = [
    ['In 1 hour', addHours(new Date(), 1)],
    ['This evening', setMinutes(new Date(new Date().setHours(18)), 0)],
    ['Tomorrow 9:00', setMinutes(new Date(new Date(Date.now() + 864e5).setHours(9)), 0)],
  ]
  const save = () => {
    if (!text.trim()) return
    s.addReminder({ text: text.trim(), due: new Date(due).toISOString(), taskId: s.openTaskId })
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
    s.toast(`Reminder set for ${format(new Date(due), 'EEE p')}`)
    onDone()
  }
  return (
    <form className="space-y-2 p-2" onSubmit={(e) => (e.preventDefault(), save())}>
      <div className="text-sm font-semibold">Remind me</div>
      <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Remind me to…" className={input} />
      <div className="flex flex-wrap gap-1">
        {presets.map(([label, d]) => (
          <button key={label} type="button" onClick={() => setDue(format(d, "yyyy-MM-dd'T'HH:mm"))} className="surface-muted hover-surface rounded-full px-2 py-0.5 text-[11px]">
            {label}
          </button>
        ))}
      </div>
      <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={input} aria-label="When" />
      {s.openTaskId && <p className="text-faint text-[11px]">Linked to the open task.</p>}
      <div className="flex justify-end">
        <button disabled={!text.trim()} className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">
          Set reminder
        </button>
      </div>
    </form>
  )
}

function QuickTimer({ onDone }: { onDone: () => void }) {
  const s = useStore()
  const me = useMe()
  const [q, setQ] = useState('')
  const running = s.timer ? s.tasks.find((t) => t.id === s.timer!.taskId) : undefined
  const candidates = useMemo(() => {
    const needle = q.toLowerCase()
    const mine = s.tasks.filter((t) => !t.parentId && (needle ? t.title.toLowerCase().includes(needle) || `ms-${t.key}`.includes(needle) : t.assignees.includes(me.id)))
    return mine.slice(0, 6)
  }, [q, s.tasks, me.id])
  return (
    <div className="space-y-2 p-2">
      <div className="text-sm font-semibold">Track time</div>
      {running && (
        <div className="surface-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-xs">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span className="min-w-0 flex-1 truncate">Running on {running.title}</span>
          <button onClick={() => (s.stopTimer(), onDone())} className="rounded px-1.5 py-0.5 font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
            Stop
          </button>
        </div>
      )}
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a task…" className={input} />
      <div className="max-h-56 overflow-y-auto">
        {!q && <div className="text-faint px-1 pb-1 text-[11px]">Your tasks</div>}
        {candidates.map((t) => (
          <button key={t.id} onClick={() => (s.startTimer(t.id), onDone())} className="hover-surface flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm">
            <Play size={13} className="text-brand-600 shrink-0" />
            <span className="text-faint shrink-0 text-xs">MS-{t.key}</span>
            <span className="truncate">{t.title}</span>
          </button>
        ))}
        {candidates.length === 0 && <div className="text-muted px-2 py-3 text-center text-xs">No matching tasks.</div>}
      </div>
    </div>
  )
}
