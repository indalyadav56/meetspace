import { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { ArrowRight, CalendarDays, ChevronDown, Flag, Tag as TagIcon, UserRound, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { ID, IssueType, Priority, Status, StatusType } from '../../store/types'
import { EpicMenu, IssueTypeMenu } from '../components/issue'
import { AssigneeMenu, DateButton, Modal, PriorityMenu, StatusDot, StatusMenu, Tag } from '../components/ui'
import { cn } from '../../lib/utils'

export interface CreateTaskDefaults {
  listId?: ID
  /** an exact status of the List's Space */
  statusId?: ID
  /** or a status type, resolved against whichever List is picked (cross-space boards) */
  statusType?: StatusType
  dueDate?: string | null
  assignees?: ID[]
  priority?: Priority
  epicId?: ID | null
  issueType?: IssueType
}

/** Open the Create task dialog from anywhere: `useCreateTask.getState().open({ listId })`. */
export const useCreateTask = create<{ defaults: CreateTaskDefaults | null; open: (d?: CreateTaskDefaults) => void; close: () => void }>()((set) => ({
  defaults: null,
  open: (d = {}) => set({ defaults: d }),
  close: () => set({ defaults: null }),
}))

const LAST_LIST = 'ms.createTask.list'
const lastList = () => {
  try {
    return localStorage.getItem(LAST_LIST)
  } catch {
    return null
  }
}

export default function CreateTaskModal() {
  const defaults = useCreateTask((s) => s.defaults)
  const close = useCreateTask((s) => s.close)
  // Remount per opening so every field starts from the new defaults.
  const [n, setN] = useState(0)
  useEffect(() => {
    if (defaults) setN((x) => x + 1)
  }, [defaults])
  return (
    <Modal
      open={!!defaults}
      // Escape inside one of the field menus should close that menu, not the whole draft.
      onClose={() => document.querySelectorAll('.shadow-pop').length <= 1 && close()}
      className="mt-[10vh] max-w-xl"
    >
      {defaults && <Form key={n} defaults={defaults} onClose={close} />}
    </Modal>
  )
}

function Form({ defaults, onClose }: { defaults: CreateTaskDefaults; onClose: () => void }) {
  const s = useStore()
  const firstList = useMemo(() => {
    const ids = s.lists.map((l) => l.id)
    const last = lastList()
    return defaults.listId ?? (last && ids.includes(last) ? last : ids[0]) ?? ''
  }, []) // only the List the dialog opened with
  const [listId, setListId] = useState<ID>(firstList)
  const space = s.spaces.find((sp) => sp.id === s.lists.find((l) => l.id === listId)?.spaceId)
  const statuses: Status[] = space?.statuses ?? []
  const pickStatus = (type?: StatusType, exact?: ID) => (exact && statuses.some((st) => st.id === exact) ? exact : statuses.find((st) => st.type === (type ?? 'open'))?.id ?? statuses[0]?.id ?? '')
  const [statusId, setStatusId] = useState<ID>(() => pickStatus(defaults.statusType, defaults.statusId))
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignees, setAssignees] = useState<ID[]>(defaults.assignees ?? [])
  const [startDate, setStartDate] = useState<string | null>(null)
  const [dueDate, setDueDate] = useState<string | null>(defaults.dueDate ?? null)
  const [priority, setPriority] = useState<Priority>(defaults.priority ?? null)
  const [issueType, setIssueType] = useState<IssueType>(defaults.issueType ?? 'task')
  const [epicId, setEpicId] = useState<ID | null>(defaults.epicId ?? null)
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [another, setAnother] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  // Moving to a List in another Space keeps the same kind of status there.
  useEffect(() => {
    if (statuses.some((st) => st.id === statusId)) return
    setStatusId(pickStatus(defaults.statusType ?? s.spaces.flatMap((sp) => sp.statuses).find((st) => st.id === statusId)?.type))
  }, [listId]) // re-pick only when the List changes

  const status = statuses.find((st) => st.id === statusId)
  const knownTags = useMemo(() => [...new Set(s.tasks.flatMap((t) => t.tags))].sort(), [s.tasks])
  const addTag = (raw: string) => {
    const g = raw.trim().toLowerCase().replace(/\s+/g, '-')
    if (g && !tags.includes(g)) setTags([...tags, g])
    setTagDraft('')
  }

  const submit = (open: boolean) => {
    if (!title.trim() || !listId) return titleRef.current?.focus()
    const id = s.addTask({ listId, title: title.trim(), description: description.trim(), statusId, assignees, startDate, dueDate, priority, tags, issueType, epicId: issueType === 'epic' ? null : epicId })
    try {
      localStorage.setItem(LAST_LIST, listId)
    } catch {
      /* storage blocked */
    }
    s.toast(`Created “${title.trim()}”`)
    if (another && !open) {
      setTitle('')
      setDescription('')
      titleRef.current?.focus()
      return
    }
    onClose()
    if (open) s.openTask(id)
  }

  const chip = 'border-app hover-surface inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs'
  return (
    <form
      onSubmit={(e) => (e.preventDefault(), submit(false))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.preventDefault(), submit(false))
      }}
      aria-label="Create task"
    >
      <div className="border-app flex items-center gap-2 border-b px-4 py-2.5">
        <span className="text-sm font-semibold">Create task</span>
        <label className="surface-muted ml-2 flex min-w-0 items-center gap-1 rounded-md px-1.5 text-xs">
          <span className="text-faint">in</span>
          <select value={listId} onChange={(e) => setListId(e.target.value)} className="max-w-56 min-w-0 truncate bg-transparent py-1 font-medium outline-none" aria-label="List">
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
        </label>
        <button type="button" onClick={onClose} className="hover-surface text-muted ml-auto rounded p-1" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-2 px-4 pt-3">
        <input ref={titleRef} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} placeholder="Task name" className="w-full bg-transparent text-lg font-semibold outline-none" aria-label="Task name" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Add a description…" className="w-full resize-none bg-transparent text-sm outline-none [field-sizing:content] min-h-16 max-h-60" aria-label="Description" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
        <IssueTypeMenu value={issueType} onChange={setIssueType} className={chip} />
        {issueType !== 'epic' && (
          <span className={chip} title="Epic">
            <EpicMenu value={epicId} onChange={setEpicId} className="-mx-1" />
          </span>
        )}
        <StatusMenu statuses={statuses} value={statusId} onChange={setStatusId} className={cn(chip, 'font-semibold uppercase')}>
          <StatusDot status={status} size={12} /> {status?.name ?? 'Status'} <ChevronDown size={12} className="text-faint" />
        </StatusMenu>
        <span className={chip} title="Assignees">
          <UserRound size={13} className="text-muted" />
          <AssigneeMenu value={assignees} onChange={setAssignees} size={20} />
        </span>
        <span className={chip} title="Dates">
          <CalendarDays size={13} className="text-muted" />
          <DateButton value={startDate} onChange={setStartDate} placeholder={<span className="text-faint">Start</span>} />
          <ArrowRight size={11} className="text-faint" />
          <DateButton value={dueDate} onChange={setDueDate} placeholder={<span className="text-faint">Due</span>} />
        </span>
        <span className={chip} title="Priority">
          <Flag size={13} className="text-muted" />
          <PriorityMenu value={priority} onChange={setPriority} showLabel />
        </span>
        <span className={cn(chip, 'min-w-32')} title="Tags">
          <TagIcon size={13} className="text-muted" />
          {tags.map((g) => (
            <Tag key={g} name={g} onRemove={() => setTags(tags.filter((x) => x !== g))} />
          ))}
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addTag(tagDraft)
              }
              if (e.key === 'Backspace' && !tagDraft && tags.length) setTags(tags.slice(0, -1))
            }}
            onBlur={() => tagDraft && addTag(tagDraft)}
            list="create-task-tags"
            placeholder={tags.length ? '' : 'Tags'}
            className="w-16 min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--text-faint)]"
            aria-label="Add a tag"
          />
          <datalist id="create-task-tags">
            {knownTags.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </span>
      </div>

      <div className="border-app flex items-center gap-2 border-t px-4 py-2.5">
        <label className="text-muted flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={another} onChange={(e) => setAnother(e.target.checked)} className="accent-brand-600" /> Create another
        </label>
        <span className="text-faint hidden text-[11px] sm:inline">⌘↵ to create</span>
        <button type="button" onClick={() => submit(true)} disabled={!title.trim() || !listId} className="hover-surface ml-auto rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40">
          Create & open
        </button>
        <button disabled={!title.trim() || !listId} className="bg-brand-600 hover:bg-brand-700 rounded-md px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
          Create task
        </button>
      </div>
    </form>
  )
}
