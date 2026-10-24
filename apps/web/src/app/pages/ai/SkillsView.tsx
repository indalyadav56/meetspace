import { useState } from 'react'
import { Pencil, Play, Plus, Search, Trash2, Wand2, X } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import { useAssistant, type SavedAgent } from '../../ai/useAssistant'
import { errorText, useAgents } from './agentsStore'
import { Modal } from '../../components/ui'
import { cn } from '../../../lib/utils'

type Draft = Omit<SavedAgent, 'id'> & { id?: string }

/** Ready-made skills: each teaches the assistant to do one job your way. */
export const SKILL_TEMPLATES: Draft[] = [
  { kind: 'skill', icon: '✍️', name: 'Write Like Me', description: 'Writes in your voice and tone', instructions: 'Before writing, read a few of my recent comments, task descriptions and docs to learn my tone: sentence length, formality, emoji use and how I open and close messages. Then write the requested text the same way. Keep it concise and avoid filler.' },
  { kind: 'skill', icon: '🧭', name: 'Plan Like Me', description: 'Structures tasks and subtasks the way you usually would', instructions: 'Break the request into a parent task with 3–8 subtasks, each starting with a verb and small enough for one day. Set priorities (urgent only for blockers) and suggest due dates working back from any deadline. Ask before creating anything.' },
  { kind: 'skill', icon: '📣', name: 'Update Like Me', description: 'Drafts standups and status updates in your voice', instructions: 'Summarize my recent activity and open tasks as a status update with sections Done, Next and Risks. Mention task keys like MS-12. Keep each bullet under 15 words.' },
  { kind: 'skill', icon: '🗂️', name: 'Triage Tasks Like Me', description: 'Prioritizes and sorts incoming work', instructions: 'Look at unassigned and newly created tasks. For each, suggest a priority, an owner based on current workload and a due date. Flag duplicates and anything missing a clear outcome. Present a table, then offer to apply the changes.' },
  { kind: 'skill', icon: '📏', name: 'Scope Like Me', description: 'Breaks down and sizes new work', instructions: 'For the work described, list assumptions, open questions, a rough breakdown with story points (1, 2, 3, 5, 8) and the riskiest part. Suggest what to cut to ship sooner.' },
  { kind: 'skill', icon: '🤝', name: 'Delegate Like Me', description: 'Assigns and hands off work the way you would', instructions: 'Given tasks to hand off, pick owners by skills shown in their past tasks and current workload, write a short handoff note per task (context, definition of done, deadline) and ask before assigning.' },
  { kind: 'skill', icon: '🎨', name: 'Brand Voice', description: 'Keeps copy on-brand', instructions: 'Write in a warm, plain, confident voice. Prefer short sentences and active verbs, avoid jargon and hype words, and use sentence case for headings. Point out anything in the input that sounds off-brand.' },
]

function SkillEditor({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const save = useAgents((s) => s.save)
  const [d, setD] = useState<Draft>(draft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await save({ ...d, kind: 'skill', enabled: d.enabled ?? true })
      onClose()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  const input = 'border-app surface-subtle mt-1 w-full rounded-md border px-2.5 py-1.5 text-sm outline-none'
  return (
    <Modal open onClose={onClose} className="mt-[8vh] max-w-lg">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="space-y-3 p-5"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">{d.id ? 'Edit skill' : 'New skill'}</h2>
          <button type="button" onClick={onClose} className="hover-surface text-muted ml-auto rounded p-1" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-2">
          <label className="w-16">
            <span className="text-muted text-xs font-medium">Icon</span>
            <input value={d.icon} onChange={(e) => setD({ ...d, icon: e.target.value })} maxLength={4} className={cn(input, 'text-center')} />
          </label>
          <label className="flex-1">
            <span className="text-muted text-xs font-medium">Name</span>
            <input autoFocus value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={80} placeholder="e.g. Write release notes" className={input} />
          </label>
        </div>
        <label className="block">
          <span className="text-muted text-xs font-medium">What it does</span>
          <input value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} maxLength={255} placeholder="One line people see in the skill list" className={input} />
        </label>
        <label className="block">
          <span className="text-muted text-xs font-medium">How to do it</span>
          <textarea value={d.instructions} onChange={(e) => setD({ ...d, instructions: e.target.value })} rows={7} maxLength={4000} placeholder="Step-by-step: what to read first, the format to use, what to ask before acting…" className={cn(input, 'resize-y')} />
          <span className="text-faint text-[11px]">{d.instructions.length}/4000 · the assistant follows these whenever someone runs the skill</span>
        </label>
        {error && <p className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="border-app hover-surface rounded-md border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button disabled={busy || !d.name.trim() || !d.instructions.trim()} className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Saving…' : 'Save skill'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function RunSkill({ skill, onClose, onRun }: { skill: SavedAgent; onClose: () => void; onRun: () => void }) {
  const [text, setText] = useState('')
  return (
    <Modal open onClose={onClose} className="mt-[12vh] max-w-lg">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          const a = useAssistant.getState()
          a.choosePersona(skill)
          a.ask(text.trim(), { panel: false })
          onRun()
        }}
        className="space-y-3 p-5"
      >
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <span className="text-xl">{skill.icon}</span> Run “{skill.name}”
        </h2>
        <p className="text-muted text-sm">{skill.description}</p>
        <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="What should it work on? e.g. “the launch tasks in Q4 launch” or paste text" className="border-app surface-subtle w-full resize-none rounded-md border px-2.5 py-1.5 text-sm outline-none" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="border-app hover-surface rounded-md border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button disabled={!text.trim()} className="bg-brand-600 hover:bg-brand-700 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            <Play size={14} /> Run skill
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Skills teach the assistant how you work, so you never explain a workflow twice. */
export default function SkillsView({ onChat }: { onChat: () => void }) {
  const me = useStore((s) => s.currentUserId)
  const { list, save, remove } = useAgents()
  const skills = list.filter((a) => a.kind === 'skill')
  const [tab, setTab] = useState<'all' | 'enabled' | 'mine'>('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Draft | null>(null)
  const [running, setRunning] = useState<SavedAgent | null>(null)
  const shown = skills.filter((k) => (tab === 'enabled' ? k.enabled !== false : tab === 'mine' ? k.createdBy === me : true) && `${k.name} ${k.description}`.toLowerCase().includes(q.toLowerCase()))
  const have = new Set(skills.map((k) => k.name))

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Wand2 size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">Skills</h1>
          <span className="text-muted hidden text-sm sm:inline">Teach the assistant how you work</span>
          <button onClick={() => setEditing({ kind: 'skill', icon: '✨', name: '', description: '', instructions: '', enabled: true })} className="bg-brand-600 hover:bg-brand-700 ml-auto inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-semibold text-white">
            <Plus size={15} /> New skill
          </button>
        </div>

        <h2 className="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">Start from a template</h2>
        <div className="no-scrollbar -mx-1 mb-7 flex gap-2 overflow-x-auto px-1 pb-1">
          {SKILL_TEMPLATES.map((t) => (
            <div key={t.name} className="border-app surface-subtle flex w-56 shrink-0 flex-col rounded-xl border p-3">
              <span className="text-2xl">{t.icon}</span>
              <span className="mt-1 text-sm font-semibold">{t.name}</span>
              <span className="text-muted mb-3 line-clamp-2 text-xs">{t.description}</span>
              <button
                disabled={have.has(t.name)}
                onClick={() => setEditing(t)}
                className="border-app hover-surface mt-auto rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50"
              >
                {have.has(t.name) ? 'Added' : 'Create skill'}
              </button>
            </div>
          ))}
        </div>

        <div className="border-app mb-3 flex flex-wrap items-center gap-1 border-b">
          {(
            [
              ['all', 'All skills'],
              ['enabled', 'Enabled'],
              ['mine', 'Created by me'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={cn('relative flex h-10 items-center px-2.5 text-[13px] font-medium', tab === k ? 'after:bg-brand-600 after:absolute after:inset-x-1 after:bottom-0 after:h-0.5' : 'text-muted')}>
              {label}
            </button>
          ))}
          <div className="border-app mb-1 ml-auto flex h-8 items-center gap-2 rounded-md border px-2">
            <Search size={14} className="text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search skills" className="w-36 bg-transparent text-sm outline-none" />
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="border-app flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-12 text-center">
            <Wand2 size={22} className="text-faint" />
            <p className="font-semibold">Skills teach the assistant how you work</p>
            <p className="text-muted max-w-md text-sm">Turn a repetitive workflow into a skill it reuses, so you never explain it again. Start from a template above or write your own.</p>
          </div>
        ) : (
          <div className="border-app overflow-hidden rounded-xl border">
            {shown.map((k) => {
              const on = k.enabled !== false
              return (
                <div key={k.id} className="border-app hover-surface group flex items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0">
                  <span className="text-xl">{k.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate font-medium', !on && 'text-faint')}>{k.name}</span>
                    <span className="text-muted block truncate text-xs">{k.description || k.instructions.slice(0, 120)}</span>
                  </span>
                  <label className="text-muted flex items-center gap-1.5 text-xs" title={on ? 'Turn off' : 'Turn on'}>
                    <input type="checkbox" checked={on} onChange={(e) => void save({ ...k, enabled: e.target.checked })} className="accent-brand-600 h-3.5 w-3.5" />
                    {on ? 'On' : 'Off'}
                  </label>
                  <button disabled={!on} onClick={() => setRunning(k)} className="bg-brand-600 hover:bg-brand-700 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40">
                    <Play size={12} /> Run
                  </button>
                  <button onClick={() => setEditing(k)} className="hover-surface text-muted rounded p-1 opacity-0 group-hover:opacity-100" aria-label={`Edit ${k.name}`}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => confirm(`Delete the skill “${k.name}”?`) && void remove(k.id)} className="rounded p-1 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-500/10" aria-label={`Delete ${k.name}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {editing && <SkillEditor draft={editing} onClose={() => setEditing(null)} />}
      {running && <RunSkill skill={running} onClose={() => setRunning(null)} onRun={() => (setRunning(null), onChat())} />}
    </div>
  )
}
