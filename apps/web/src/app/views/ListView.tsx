import { useState } from 'react'
import { Ban, ChevronDown, ChevronRight, GitBranch, Plus, Repeat } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { ID, Status, Task } from '../../store/types'
import { useSubtaskCounts, useTaskResolver } from '../hooks'
import { AssigneeMenu, DateButton, PriorityMenu, StatusDot, StatusMenu, StatusPill, Tag } from '../components/ui'
import { cn } from '../../lib/utils'
import BulkBar from './BulkBar'

export interface ViewProps {
  tasks: Task[]
  statuses: Status[]
  defaultListId: ID
  showList?: boolean
}

const COLS = 'grid-cols-[minmax(0,1fr)_110px_110px_90px_150px]'

export default function ListView({ tasks, statuses, defaultListId, showList }: ViewProps) {
  const [collapsed, setCollapsed] = useState<Record<ID, boolean>>({})
  const [selected, setSelected] = useState<Set<ID>>(new Set())
  const toggle = (id: ID) =>
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const visible = new Set(tasks.map((t) => t.id))
  const sel = [...selected].filter((id) => visible.has(id))

  return (
    <div className="relative h-full overflow-auto px-2 pb-24 scroll-thin sm:px-4">
      <div className="min-w-[760px]">
        {statuses.map((st) => {
          const rows = tasks.filter((t) => t.statusId === st.id)
          const isClosed = collapsed[st.id]
          return (
            <section key={st.id} className="mt-4">
              <div className="sticky top-0 z-10 flex items-center gap-2 bg-[var(--bg)] py-1.5">
                <button onClick={() => setCollapsed((c) => ({ ...c, [st.id]: !c[st.id] }))} className="text-muted" aria-label="Toggle group">
                  {isClosed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                </button>
                <StatusPill status={st} />
                <span className="text-faint text-xs">{rows.length}</span>
              </div>
              {!isClosed && (
                <>
                  <div className={cn('text-faint border-app grid items-center border-b px-2 py-1 text-[11px] font-medium uppercase', COLS)}>
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        aria-label="Select all in group"
                        checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                        onChange={(e) =>
                          setSelected((cur) => {
                            const next = new Set(cur)
                            rows.forEach((r) => (e.target.checked ? next.add(r.id) : next.delete(r.id)))
                            return next
                          })
                        }
                        className="accent-brand-600 h-3.5 w-3.5"
                      />
                      Name
                    </span>
                    <span>Assignee</span>
                    <span>Due date</span>
                    <span>Priority</span>
                    <span>Tags</span>
                  </div>
                  {rows.map((t) => (
                    <TaskRow key={t.id} task={t} statuses={statuses} showList={showList} selected={selected.has(t.id)} onSelect={() => toggle(t.id)} anySelected={sel.length > 0} />
                  ))}
                  <AddRow listId={defaultListId} statusId={st.id} />
                </>
              )}
            </section>
          )
        })}
      </div>
      {sel.length > 0 && <BulkBar ids={sel} onClear={() => setSelected(new Set())} />}
    </div>
  )
}

function TaskRow({
  task,
  statuses,
  showList,
  depth = 0,
  selected,
  onSelect,
  anySelected,
}: {
  task: Task
  statuses: Status[]
  showList?: boolean
  depth?: number
  selected?: boolean
  onSelect?: () => void
  anySelected?: boolean
}) {
  const { updateTask, openTask, tasks } = useStore()
  const r = useTaskResolver()
  const subCounts = useSubtaskCounts()
  const [open, setOpen] = useState(false)
  const subs = open ? tasks.filter((t) => t.parentId === task.id) : []
  const count = subCounts.get(task.id) ?? 0
  const done = r.isDone(task)
  const space = r.spaceOf(task)
  const st = space ? space.statuses : statuses
  const blocked = task.blockedBy.some((b) => {
    const bt = tasks.find((x) => x.id === b)
    return bt && !r.isDone(bt)
  })

  return (
    <>
      <div
        onClick={() => (anySelected && onSelect ? onSelect() : openTask(task.id))}
        className={cn('group border-app hover-surface grid cursor-pointer items-center border-b px-2 text-[13px]', COLS, selected && 'bg-brand-50 dark:bg-brand-600/15')}
        style={{ minHeight: 40 }}
      >
        <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: depth * 24 }}>
          {onSelect && (
            <input
              type="checkbox"
              checked={!!selected}
              onClick={(e) => e.stopPropagation()}
              onChange={onSelect}
              aria-label={`Select ${task.title}`}
              className={cn('accent-brand-600 h-3.5 w-3.5 shrink-0', !selected && !anySelected && 'opacity-0 group-hover:opacity-100')}
            />
          )}
          <span className="w-4 shrink-0">
            {count > 0 && (
              <button onClick={(e) => (e.stopPropagation(), setOpen((o) => !o))} className="text-faint" aria-label="Toggle subtasks">
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
          </span>
          <span onClick={(e) => e.stopPropagation()}>
            <StatusMenu statuses={st} value={task.statusId} onChange={(v) => updateTask(task.id, { statusId: v })}>
              <StatusDot status={r.statusOf(task)} />
            </StatusMenu>
          </span>
          <span className={cn('truncate font-medium', done && 'text-faint line-through')}>{task.title}</span>
          {blocked && (
            <span title="Waiting on another task" className="shrink-0 text-red-500">
              <Ban size={13} />
            </span>
          )}
          {task.recurrence && (
            <span title={`Repeats ${task.recurrence}`} className="text-faint shrink-0">
              <Repeat size={12} />
            </span>
          )}
          {count > 0 && (
            <span className="text-faint inline-flex shrink-0 items-center gap-0.5 text-[11px]">
              <GitBranch size={11} /> {count}
            </span>
          )}
          {showList && <span className="surface-muted text-muted shrink-0 rounded px-1.5 text-[10px]">{r.listName(task.listId)}</span>}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <AssigneeMenu value={task.assignees} onChange={(v) => updateTask(task.id, { assignees: v })} />
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <DateButton value={task.dueDate} onChange={(v) => updateTask(task.id, { dueDate: v })} done={done} />
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <PriorityMenu value={task.priority} onChange={(v) => updateTask(task.id, { priority: v })} />
        </div>
        <div className="flex min-w-0 gap-1 overflow-hidden">
          {task.tags.slice(0, 2).map((t) => (
            <Tag key={t} name={t} />
          ))}
        </div>
      </div>
      {subs.map((s) => (
        <TaskRow key={s.id} task={s} statuses={statuses} depth={depth + 1} />
      ))}
    </>
  )
}

function AddRow({ listId, statusId }: { listId: ID; statusId: ID }) {
  const addTask = useStore((s) => s.addTask)
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState('')
  if (!editing)
    return (
      <button onClick={() => setEditing(true)} className="text-faint hover:text-app flex h-9 items-center gap-2 pl-8 text-[13px]">
        <Plus size={14} /> Add task
      </button>
    )
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (v.trim()) addTask({ listId, statusId, title: v.trim() })
        setV('')
      }}
      className="border-brand-500 flex h-10 items-center gap-2 rounded border px-2 pl-8"
    >
      <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={() => !v && setEditing(false)} onKeyDown={(e) => e.key === 'Escape' && setEditing(false)} placeholder="Task name — press Enter to save" className="flex-1 bg-transparent text-[13px] outline-none" />
      <button className="bg-brand-600 rounded px-2 py-1 text-xs font-semibold text-white">Save</button>
    </form>
  )
}
