import { useState } from 'react'
import { useQueryState } from '../../lib/useQueryState'
import { ArrowRight, Plus, Trash2, Workflow, X, Zap } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { ActionType, Automation, AutomationAction, ID, Space, TriggerType } from '../../store/types'
import { Modal } from '../components/ui'
import { PRIORITIES, cn, timeAgo } from '../../lib/utils'

export const TRIGGERS: { type: TriggerType; label: string }[] = [
  { type: 'status_changed', label: 'When status changes to' },
  { type: 'task_created', label: 'When a task is created' },
  { type: 'priority_changed', label: 'When priority changes to' },
  { type: 'assignee_added', label: 'When an assignee is added' },
]

export const ACTIONS: { type: ActionType; label: string }[] = [
  { type: 'set_status', label: 'Change status to' },
  { type: 'set_priority', label: 'Set priority to' },
  { type: 'add_assignee', label: 'Assign to' },
  { type: 'add_tag', label: 'Add tag' },
  { type: 'add_comment', label: 'Post a comment' },
  { type: 'set_due_in', label: 'Set due date in (days)' },
  { type: 'notify', label: 'Send me a notification' },
]

/** Human-readable value for a trigger/action given its space. */
function useDescribe() {
  const users = useStore((s) => s.users)
  return (kind: TriggerType | ActionType, value: string, space?: Space) => {
    if (!value) return kind === 'status_changed' || kind === 'priority_changed' || kind === 'assignee_added' ? 'any' : ''
    if (kind === 'status_changed' || kind === 'set_status') return space?.statuses.find((s) => s.id === value)?.name ?? value
    if (kind === 'priority_changed' || kind === 'set_priority') return PRIORITIES.find((p) => p.value === value)?.label ?? value
    if (kind === 'assignee_added' || kind === 'add_assignee') return users.find((u) => u.id === value)?.name ?? value
    if (kind === 'set_due_in') return `${value} day${value === '1' ? '' : 's'}`
    if (kind === 'add_tag') return `#${value}`
    return `“${value}”`
  }
}

const RECIPES: { name: string; build: (s: Space) => Omit<Automation, 'id' | 'runs' | 'lastRun' | 'spaceId' | 'enabled'> }[] = [
  {
    name: 'When done, notify me',
    build: (s) => ({ name: 'When done, notify me', trigger: { type: 'status_changed', value: s.statuses.find((x) => x.type === 'done')?.id ?? '' }, actions: [{ type: 'notify', value: 'A task was completed' }] }),
  },
  {
    name: 'Urgent → move to in progress',
    build: (s) => ({ name: 'Urgent → in progress', trigger: { type: 'priority_changed', value: 'urgent' }, actions: [{ type: 'set_status', value: s.statuses.find((x) => x.type === 'active')?.id ?? '' }] }),
  },
  {
    name: 'New tasks get a 3-day deadline',
    build: () => ({ name: 'Default deadline', trigger: { type: 'task_created', value: '' }, actions: [{ type: 'set_due_in', value: '3' }] }),
  },
  {
    name: 'Assigned → set priority normal',
    build: () => ({ name: 'Assigned tasks get a priority', trigger: { type: 'assignee_added', value: '' }, actions: [{ type: 'set_priority', value: 'normal' }] }),
  },
]

export default function AutomationsPage() {
  const { automations, spaces, updateAutomation, deleteAutomation, addAutomation } = useStore()
  const describe = useDescribe()
  const [spaceId, setSpaceId] = useQueryState<ID>('project', spaces[0]?.id ?? '')
  const [editing, setEditing] = useState<Automation | 'new' | null>(null)
  const space = spaces.find((s) => s.id === spaceId)
  const list = automations.filter((a) => a.spaceId === spaceId)

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Workflow size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">Automations</h1>
          <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className="border-app surface ml-auto h-8 rounded-md border px-2 text-sm" aria-label="Project">
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button onClick={() => setEditing('new')} disabled={!space} className="bg-brand-600 hover:bg-brand-700 inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-semibold text-white disabled:opacity-40">
            <Plus size={15} /> New automation
          </button>
        </div>
        <p className="text-muted mb-5 text-sm">Automations run instantly in this workspace whenever a matching change happens in the selected project.</p>

        <div className="space-y-2">
          {list.map((a) => (
            <div key={a.id} className={cn('border-app group flex flex-wrap items-center gap-3 rounded-xl border p-4', !a.enabled && 'opacity-60')}>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15">
                <Zap size={18} />
              </span>
              <button onClick={() => setEditing(a)} className="min-w-0 flex-1 text-left">
                <div className="truncate font-semibold">{a.name}</div>
                <div className="text-muted flex flex-wrap items-center gap-1 text-xs">
                  {TRIGGERS.find((t) => t.type === a.trigger.type)?.label} <b className="text-app">{describe(a.trigger.type, a.trigger.value, space)}</b>
                  <ArrowRight size={12} />
                  {a.actions.map((x, i) => (
                    <span key={i}>
                      {i > 0 && ' · '}
                      {ACTIONS.find((y) => y.type === x.type)?.label.toLowerCase()} <b className="text-app">{describe(x.type, x.value, space)}</b>
                    </span>
                  ))}
                </div>
              </button>
              <span className="text-faint text-xs">
                {a.runs} run{a.runs === 1 ? '' : 's'}
                {a.lastRun && ` · last ${timeAgo(a.lastRun)}`}
              </span>
              <label className="relative inline-flex cursor-pointer items-center" title={a.enabled ? 'Turn off' : 'Turn on'}>
                <input type="checkbox" checked={a.enabled} onChange={(e) => updateAutomation(a.id, { enabled: e.target.checked })} className="peer sr-only" />
                <span className="peer-checked:bg-brand-600 h-5 w-9 rounded-full bg-stone-300 transition-colors dark:bg-stone-600" />
                <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
              </label>
              <button onClick={() => confirm(`Delete “${a.name}”?`) && deleteAutomation(a.id)} className="text-faint hidden hover:text-red-500 group-hover:block" aria-label="Delete automation">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {list.length === 0 && <p className="text-muted border-app rounded-xl border border-dashed p-10 text-center text-sm">No automations in this project yet.</p>}
        </div>

        {space && (
          <section className="mt-10">
            <h2 className="mb-3 text-sm font-semibold">Recipes</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {RECIPES.map((r) => (
                <button key={r.name} onClick={() => addAutomation({ ...r.build(space), spaceId: space.id, enabled: true })} className="border-app hover:border-brand-500 flex items-center gap-3 rounded-xl border p-4 text-left transition-colors">
                  <Zap size={16} className="shrink-0 text-amber-500" />
                  <span className="flex-1 text-sm font-medium">{r.name}</span>
                  <Plus size={15} className="text-muted" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
      {editing && space && <Builder key={editing === 'new' ? 'new' : editing.id} space={space} initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ValuePicker({ kind, value, onChange, space }: { kind: TriggerType | ActionType; value: string; onChange: (v: string) => void; space: Space }) {
  const users = useStore((s) => s.users)
  const cls = 'border-app surface rounded-md border px-2 py-1.5 text-sm'
  if (kind === 'task_created') return null
  if (kind === 'status_changed' || kind === 'set_status')
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        {kind === 'status_changed' && <option value="">Any status</option>}
        {space.statuses.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    )
  if (kind === 'priority_changed' || kind === 'set_priority')
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        {kind === 'priority_changed' && <option value="">Any priority</option>}
        {PRIORITIES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    )
  if (kind === 'assignee_added' || kind === 'add_assignee')
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        {kind === 'assignee_added' && <option value="">Anyone</option>}
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    )
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      type={kind === 'set_due_in' ? 'number' : 'text'}
      placeholder={kind === 'add_tag' ? 'tag name' : kind === 'set_due_in' ? 'days' : 'message'}
      className={cn(cls, 'min-w-0 flex-1')}
    />
  )
}

function defaultValue(kind: TriggerType | ActionType, space: Space, users: { id: string }[]) {
  if (kind === 'set_status') return space.statuses[0]?.id ?? ''
  if (kind === 'set_priority') return 'normal'
  if (kind === 'add_assignee') return users[0]?.id ?? ''
  if (kind === 'set_due_in') return '3'
  return ''
}

function Builder({ space, initial, onClose }: { space: Space; initial: Automation | null; onClose: () => void }) {
  const { addAutomation, updateAutomation, users } = useStore()
  const [name, setName] = useState(initial?.name ?? '')
  const [trigger, setTrigger] = useState(initial?.trigger ?? { type: 'status_changed' as TriggerType, value: '' })
  const [actions, setActions] = useState<AutomationAction[]>(initial?.actions ?? [{ type: 'add_comment', value: 'Heads up — this task changed.' }])

  const save = () => {
    const clean = actions.filter((a) => a.value || a.type === 'notify')
    if (!clean.length) return
    const data = { name: name.trim() || 'Untitled automation', trigger, actions: clean }
    if (initial) updateAutomation(initial.id, data)
    else addAutomation({ ...data, spaceId: space.id, enabled: true })
    onClose()
  }

  return (
    <Modal open onClose={onClose} className="mt-[8vh] max-w-xl">
      <div className="border-app flex items-center border-b px-5 py-3">
        <Zap size={17} className="mr-2 text-amber-500" />
        <h2 className="font-semibold">{initial ? 'Edit automation' : 'New automation'}</h2>
        <span className="text-muted ml-2 text-sm">in project {space.name}</span>
        <button onClick={onClose} className="hover-surface text-muted ml-auto rounded p-1" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this automation" className="border-app w-full rounded-lg border bg-transparent px-3 py-2 font-medium outline-none" />
        <div>
          <div className="text-faint mb-1.5 text-[11px] font-semibold uppercase">Trigger</div>
          <div className="surface-subtle flex flex-wrap items-center gap-2 rounded-lg p-3">
            <select value={trigger.type} onChange={(e) => setTrigger({ type: e.target.value as TriggerType, value: '' })} className="border-app surface rounded-md border px-2 py-1.5 text-sm">
              {TRIGGERS.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
            <ValuePicker kind={trigger.type} value={trigger.value} onChange={(v) => setTrigger({ ...trigger, value: v })} space={space} />
          </div>
        </div>
        <div>
          <div className="text-faint mb-1.5 text-[11px] font-semibold uppercase">Then</div>
          <div className="space-y-2">
            {actions.map((a, i) => (
              <div key={i} className="surface-subtle flex flex-wrap items-center gap-2 rounded-lg p-3">
                <select
                  value={a.type}
                  onChange={(e) => {
                    const type = e.target.value as ActionType
                    setActions(actions.map((x, j) => (j === i ? { type, value: defaultValue(type, space, users) } : x)))
                  }}
                  className="border-app surface rounded-md border px-2 py-1.5 text-sm"
                >
                  {ACTIONS.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <ValuePicker kind={a.type} value={a.value} onChange={(v) => setActions(actions.map((x, j) => (j === i ? { ...x, value: v } : x)))} space={space} />
                {actions.length > 1 && (
                  <button onClick={() => setActions(actions.filter((_, j) => j !== i))} className="text-faint ml-auto" aria-label="Remove action">
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => setActions([...actions, { type: 'add_tag', value: '' }])} className="text-muted hover:text-app flex items-center gap-1.5 text-sm">
              <Plus size={14} /> Add action
            </button>
          </div>
        </div>
      </div>
      <div className="border-app flex justify-end gap-2 border-t px-5 py-3">
        <button onClick={onClose} className="hover-surface rounded-lg px-3 py-1.5 text-sm">
          Cancel
        </button>
        <button onClick={save} className="bg-brand-600 rounded-lg px-3 py-1.5 text-sm font-semibold text-white">
          {initial ? 'Save' : 'Create automation'}
        </button>
      </div>
    </Modal>
  )
}
