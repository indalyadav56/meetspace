import { Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUp, Bot, CalendarClock, ClipboardList, ListChecks, Pencil, Plus, Sparkles, Square, Target, Trash2, X } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import { useAssistant, type SavedAgent } from '../../ai/useAssistant'
import { Message } from '../../ai/AssistantPanel'
import { Modal } from '../../components/ui'
import { useQueryState } from '../../../lib/useQueryState'
import { AGENT_TEMPLATES, errorText, useAgents } from './agentsStore'
import SkillsView from './SkillsView'
import { cn } from '../../../lib/utils'
import AskWorkspace from './AskWorkspace'

/** Full-page assistant: ask anything, or run a saved agent. */
export default function AIPage() {
  const [view, setView] = useQueryState<'ask' | 'agents' | 'skills' | 'workspace'>('view', 'ask')
  const ws = useStore((s) => s.currentWorkspaceId)
  const { workspaceId, load } = useAgents()
  useEffect(() => {
    if (ws && workspaceId !== ws) void load(ws)
  }, [ws, workspaceId, load])
  if (view === 'skills') return <SkillsView onChat={() => setView('ask')} />
  if (view === 'workspace') return <AskWorkspace />
  return view === 'agents' ? <AgentsView onChat={() => setView('ask')} /> : <AskView onAgents={() => setView('agents')} />
}

const QUICK = [
  { icon: Target, title: 'Plan my day', hint: 'What to work on next', prompt: 'What should I work on next?' },
  { icon: CalendarClock, title: 'What’s overdue', hint: 'Late work across projects', prompt: "What's overdue?" },
  { icon: ListChecks, title: 'Write my standup', hint: 'From recent activity', prompt: 'Write my standup' },
  { icon: ClipboardList, title: 'Status report', hint: 'Progress by project', prompt: 'Give me a status report' },
]

function AskView({ onAgents }: { onAgents: () => void }) {
  const { items, busy, status, persona, agent: server, ask, stop, choosePersona } = useAssistant()
  const openTask = useStore((s) => s.openTask)
  const me = useStore((s) => s.users.find((u) => u.id === s.currentUserId))
  const nav = useNavigate()
  const [text, setText] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Block body: scrollIntoView returns a Promise in newer browsers, which React would treat as a cleanup.
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [items, status])
  useEffect(() => {
    if (!useAssistant.getState().agent) void useAssistant.getState().loadAgent()
  }, [])

  const send = (t: string) => {
    if (!t.trim() || busy) return
    ask(t, { panel: false })
    setText('')
  }
  const engine = server?.enabled ? 'server' : 'local'

  const composer = (
    <div className={cn('surface border-app focus-within:border-brand-500 rounded-2xl border p-3 shadow-sm transition-colors', !items.length && 'shadow-[0_8px_30px_-12px_rgb(11_127_113/0.35)]')}>
      {persona && (
        <div className="mb-2 flex items-center gap-1.5">
          <span className="bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium">
            <span>{persona.icon}</span> {persona.name}
            <button onClick={() => choosePersona(null)} className="opacity-60 hover:opacity-100" aria-label="Stop using this agent">
              <X size={12} />
            </button>
          </span>
        </div>
      )}
      <textarea
        autoFocus
        value={text}
        rows={items.length ? 1 : 3}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            send(text)
          }
        }}
        placeholder={persona ? `Ask ${persona.name}…` : engine === 'server' ? 'Ask about your work, or tell me what to change…' : 'Try “What’s overdue?” or “Write my standup”'}
        className="max-h-48 min-h-[24px] w-full resize-none bg-transparent text-[15px] outline-none [field-sizing:content]"
      />
      <div className="mt-2 flex items-center gap-2">
        <button onClick={onAgents} className="hover-surface text-muted inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium">
          <Bot size={14} /> {persona ? 'Switch agent' : 'Use an agent'}
        </button>
        <span className="text-faint text-[11px]">{engine === 'server' ? server?.model : 'Offline mode'}</span>
        {busy ? (
          <button onClick={stop} className="ml-auto rounded-lg bg-stone-900 p-2 text-white dark:bg-white dark:text-stone-900" aria-label="Stop">
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button onClick={() => send(text)} disabled={!text.trim()} className="bg-brand-600 ml-auto rounded-lg p-2 text-white disabled:opacity-40" aria-label="Send">
            <ArrowUp size={16} />
          </button>
        )}
      </div>
    </div>
  )

  if (!items.length)
    return (
      <div className="h-full overflow-y-auto scroll-thin">
        <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-5 py-10">
          <div className="mb-6 text-center">
            <span className="bg-brand-600 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm">
              {persona ? <span className="text-2xl">{persona.icon}</span> : <Sparkles size={22} />}
            </span>
            <h1 className="text-3xl font-bold">{persona ? persona.name : `What can I help with, ${me?.name.split(' ')[0] ?? 'there'}?`}</h1>
            <p className="text-muted mt-2 text-sm">{persona ? persona.description || 'Ask anything — this agent follows the team’s instructions.' : 'I can search, create and update tasks, write docs and summarise progress across the workspace.'}</p>
          </div>
          {composer}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUICK.map((q) => (
              <button key={q.title} onClick={() => send(q.prompt)} className="surface border-app hover:border-brand-300 rounded-xl border p-3 text-left transition-colors">
                <q.icon size={16} className="text-accent-500" />
                <div className="mt-2 text-[13px] font-semibold">{q.title}</div>
                <div className="text-muted text-xs">{q.hint}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        <div className="mx-auto max-w-3xl px-5 py-6">
          {items.map((it, i) => (
            <Fragment key={it.id}>
              <Message item={it} last={i === items.length - 1} status={status} onTask={(id) => openTask(id)} onDoc={(id) => nav(`/app/docs/${id}`)} />
            </Fragment>
          ))}
          <div ref={bottom} />
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl shrink-0 px-5 pb-5">{composer}</div>
    </div>
  )
}

function AgentsView({ onChat }: { onChat: () => void }) {
  const { list: all, remove } = useAgents()
  const list = all.filter((a) => a.kind !== 'skill')
  const persona = useAssistant((s) => s.persona)
  const [editing, setEditing] = useState<(Omit<SavedAgent, 'id'> & { id?: string }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const chat = (a: SavedAgent) => {
    useAssistant.getState().choosePersona(a)
    onChat()
  }
  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-5xl p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">Agents</h1>
            <p className="text-muted text-sm">Saved assistants with standing instructions — for standups, triage, release notes or anything your team repeats.</p>
          </div>
          <button onClick={() => setEditing({ name: '', description: '', instructions: '', icon: '✨' })} className="bg-brand-600 hover:bg-brand-700 ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-white">
            <Plus size={15} /> Create agent
          </button>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-200">{error}</p>}

        <h2 className="text-faint mt-8 mb-3 text-[11px] font-semibold tracking-wide uppercase">Your agents</h2>
        {list.length === 0 ? (
          <p className="border-app text-muted rounded-xl border border-dashed p-6 text-center text-sm">No agents yet. Start from a template below or create your own.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((a) => (
              <div key={a.id} className={cn('surface border-app flex flex-col rounded-xl border p-4', persona?.id === a.id && 'ring-brand-500 ring-2')}>
                <div className="flex items-start gap-3">
                  <span className="bg-brand-50 dark:bg-brand-500/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl">{a.icon}</span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{a.name}</div>
                    <p className="text-muted line-clamp-2 text-xs">{a.description || a.instructions}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1">
                  <button onClick={() => chat(a)} className="bg-brand-600 hover:bg-brand-700 inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white">
                    <Sparkles size={13} /> Chat
                  </button>
                  <button onClick={() => setEditing(a)} className="hover-surface text-muted ml-auto rounded-md p-1.5" aria-label={`Edit ${a.name}`}>
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => confirm(`Delete the agent “${a.name}”?`) && remove(a.id).catch((e) => setError(errorText(e)))}
                    className="hover-surface rounded-md p-1.5 text-red-500"
                    aria-label={`Delete ${a.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-faint mt-8 mb-3 text-[11px] font-semibold tracking-wide uppercase">Start from a template</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {AGENT_TEMPLATES.map((t) => (
            <button key={t.name} onClick={() => setEditing(t)} className="surface border-app hover:border-brand-300 rounded-xl border p-4 text-left transition-colors">
              <span className="text-2xl">{t.icon}</span>
              <div className="mt-2 text-sm font-semibold">{t.name}</div>
              <p className="text-muted text-xs">{t.description}</p>
            </button>
          ))}
        </div>
      </div>
      {editing && <AgentEditor initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

const ICONS = ['✨', '📝', '🐞', '🚀', '📅', '📊', '🧭', '💡', '🛟', '🧪']

function AgentEditor({ initial, onClose }: { initial: Omit<SavedAgent, 'id'> & { id?: string }; onClose: () => void }) {
  const save = useAgents((s) => s.save)
  const [a, setA] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const field = 'border-app surface focus:border-brand-500 mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none'
  return (
    <Modal open onClose={onClose} className="mt-[8vh] max-w-lg">
      <form
        className="p-5"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError(null)
          try {
            await save(a)
            onClose()
          } catch (err) {
            setError(errorText(err))
            setBusy(false)
          }
        }}
      >
        <h2 className="text-lg font-semibold">{initial.id ? 'Edit agent' : 'Create agent'}</h2>
        <div className="mt-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icon">
          {ICONS.map((i) => (
            <button type="button" key={i} onClick={() => setA({ ...a, icon: i })} aria-pressed={a.icon === i} className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-lg', a.icon === i ? 'bg-brand-100 ring-brand-500 ring-2 dark:bg-brand-500/20' : 'hover-surface')}>
              {i}
            </button>
          ))}
        </div>
        <label className="mt-4 block text-sm font-medium">
          Name
          <input required maxLength={80} value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="e.g. Sprint reviewer" className={field} />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Description <span className="text-faint font-normal">(optional)</span>
          <input maxLength={255} value={a.description} onChange={(e) => setA({ ...a, description: e.target.value })} placeholder="What it’s for" className={field} />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Instructions
          <textarea rows={6} maxLength={4000} value={a.instructions} onChange={(e) => setA({ ...a, instructions: e.target.value })} placeholder="How should this agent answer? What should it focus on?" className={field} />
        </label>
        <p className="text-faint mt-1 text-xs">Instructions are added to every question asked through this agent.</p>
        <ScheduleFields a={a} setA={setA} field={field} />
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-200">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="hover-surface rounded-lg px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button disabled={busy || !a.name.trim()} className="bg-brand-600 rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Saving…' : 'Save agent'}
          </button>
        </div>
      </form>
    </Modal>
  )
}


const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Let an agent run by itself and post what it finds to a channel. */
function ScheduleFields({ a, setA, field }: { a: Omit<SavedAgent, 'id'> & { id?: string }; setA: (a: Omit<SavedAgent, 'id'> & { id?: string }) => void; field: string }) {
  const channels = useStore((s) => s.channels.filter((c) => c.kind === 'channel'))
  const schedule = a.schedule ?? 'none'
  const set = (patch: Partial<SavedAgent>) =>
    setA({ ...a, schedule, scheduleTime: a.scheduleTime ?? '09:00', scheduleDay: a.scheduleDay ?? 1, timezone: a.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', schedulePrompt: a.schedulePrompt ?? '', channelId: a.channelId ?? channels[0]?.id ?? null, ...patch })
  const sel = 'border-app surface h-8 rounded-md border px-2 text-sm'
  return (
    <section className="border-app mt-4 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        Run on a schedule
        <select value={schedule} onChange={(e) => set({ schedule: e.target.value as SavedAgent['schedule'] })} className={cn(sel, 'ml-auto')} aria-label="Schedule">
          <option value="none">Off</option>
          <option value="daily">Every day</option>
          <option value="weekdays">Weekdays</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>
      {schedule !== 'none' && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {schedule === 'weekly' && (
              <select value={a.scheduleDay ?? 1} onChange={(e) => set({ scheduleDay: Number(e.target.value) })} className={sel} aria-label="Day">
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            )}
            at
            <input type="time" value={a.scheduleTime ?? '09:00'} onChange={(e) => set({ scheduleTime: e.target.value })} className={sel} aria-label="Time" />
            <span className="text-faint text-xs">{a.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
          </div>
          <label className="block text-sm">
            What to do each time
            <textarea rows={2} maxLength={2000} value={a.schedulePrompt ?? ''} onChange={(e) => set({ schedulePrompt: e.target.value })} placeholder="e.g. Write the team standup from yesterday’s activity and flag anything overdue." className={field} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            Post the result in
            <select value={a.channelId ?? ''} onChange={(e) => set({ channelId: e.target.value || null })} className={sel} aria-label="Channel">
              <option value="">Nowhere (just keep the last result)</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
          </label>
          {a.nextRunAt && <p className="text-faint text-xs">Next run {new Date(a.nextRunAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.</p>}
          {a.lastResult && (
            <details className="text-xs">
              <summary className="text-muted cursor-pointer">Last run{a.lastRunAt && ` · ${new Date(a.lastRunAt).toLocaleString()}`}</summary>
              <p className="surface-muted mt-1 max-h-40 overflow-y-auto rounded-md p-2 whitespace-pre-wrap">{a.lastResult}</p>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
