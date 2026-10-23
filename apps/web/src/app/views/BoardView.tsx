import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GitBranch, ListChecks, MessageSquare, Plus } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { ID, Status, Task } from '../../store/types'
import { useSubtaskCounts, useTaskResolver } from '../hooks'
import { AvatarStack, PriorityFlag, StatusDot, Tag } from '../components/ui'
import { cn, friendlyDate, isOverdue } from '../../lib/utils'
import type { ViewProps } from './ListView'

/** In a cross-space board the columns are status types; find the task's own status of that type. */
function useRealStatus() {
  const r = useTaskResolver()
  const all = useStore((s) => s.tasks)
  const lists = useStore((s) => s.lists)
  const spaces = useStore((s) => s.spaces)
  return (virtualId: ID, taskId: ID | null, listId?: ID) => {
    const type = virtualId.replace(/^v-/, '')
    const t = taskId ? all.find((x) => x.id === taskId) : undefined
    const space = t ? r.spaceOf(t) : spaces.find((sp) => sp.id === lists.find((l) => l.id === listId)?.spaceId)
    return space?.statuses.find((st) => st.type === type)?.id ?? null
  }
}

export default function BoardView({ tasks, statuses, defaultListId, mixed }: ViewProps) {
  const moveTask = useStore((s) => s.moveTask)
  const updateTask = useStore((s) => s.updateTask)
  const realStatus = useRealStatus()
  const [activeId, setActiveId] = useState<ID | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const active = tasks.find((t) => t.id === activeId)

  const onEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const overId = String(over.id)
    const col = statuses.find((s) => s.id === overId)
    const overTask = tasks.find((t) => t.id === overId)
    if (mixed) {
      // Cross-space: change the status type; order within a column stays manual per List.
      const target = col?.id ?? overTask?.statusId
      const dragged = tasks.find((t) => t.id === active.id)
      if (!target || target === dragged?.statusId) return
      const real = realStatus(target, String(active.id))
      if (real) updateTask(String(active.id), { statusId: real })
      return
    }
    if (col) return moveTask(String(active.id), col.id, null)
    if (overTask && overTask.id !== active.id) moveTask(String(active.id), overTask.statusId, overTask.id)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onEnd} onDragCancel={() => setActiveId(null)}>
      <div className="flex h-full gap-3 overflow-x-auto p-4 scroll-thin">
        {statuses.map((st) => (
          <Column key={st.id} status={st} tasks={tasks.filter((t) => t.statusId === st.id)} listId={defaultListId} realStatusId={mixed ? realStatus(st.id, null, defaultListId) : st.id} />
        ))}
      </div>
      <DragOverlay>{active ? <Card task={active} overlay /> : null}</DragOverlay>
    </DndContext>
  )
}

function Column({ status, tasks, listId, realStatusId }: { status: Status; tasks: Task[]; listId: ID; realStatusId: ID | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id })
  const addTask = useStore((s) => s.addTask)
  const [adding, setAdding] = useState(false)
  const [v, setV] = useState('')
  return (
    <div className={cn('flex w-[280px] shrink-0 flex-col rounded-xl', isOver && 'ring-brand-500 ring-2')} style={{ background: `${status.color}12` }}>
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="rounded px-2 py-0.5 text-[11px] font-semibold uppercase text-white" style={{ background: status.color }}>
          {status.name}
        </span>
        <span className="text-muted text-xs">{tasks.length}</span>
        <button onClick={() => setAdding(true)} className="text-muted hover-surface ml-auto rounded p-1" aria-label="Add task">
          <Plus size={14} />
        </button>
      </div>
      <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 scroll-thin">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableCard key={t.id} task={t} />
          ))}
        </SortableContext>
        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (v.trim()) addTask({ listId, ...(realStatusId ? { statusId: realStatusId } : {}), title: v.trim() })
              setV('')
            }}
            className="surface border-brand-500 rounded-lg border p-2"
          >
            <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={() => !v && setAdding(false)} onKeyDown={(e) => e.key === 'Escape' && setAdding(false)} placeholder="Task name…" className="w-full bg-transparent text-sm outline-none" />
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className="text-muted hover-surface flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px]">
            <Plus size={14} /> Add task
          </button>
        )}
      </div>
    </div>
  )
}

function SortableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners} className={cn(isDragging && 'opacity-30')}>
      <Card task={task} />
    </div>
  )
}

function Card({ task: shown, overlay }: { task: Task; overlay?: boolean }) {
  const openTask = useStore((s) => s.openTask)
  // Cross-space boards pass tasks re-keyed onto virtual statuses; show the real one.
  const task = useStore((s) => s.tasks.find((t) => t.id === shown.id)) ?? shown
  const comments = useStore((s) => s.comments.filter((c) => c.taskId === task.id).length)
  const subCount = useSubtaskCounts().get(task.id) ?? 0
  const r = useTaskResolver()
  const done = r.isDone(task)
  const checks = task.checklist.length
  return (
    <div
      onClick={() => openTask(task.id)}
      className={cn('surface border-app cursor-pointer rounded-lg border p-3 text-[13px] shadow-sm transition-shadow hover:shadow-md', overlay && 'shadow-pop rotate-2')}
    >
      <div className="text-faint mb-1 text-[11px]">{r.listName(task.listId)}</div>
      <div className="flex items-start gap-2">
        <span className="mt-0.5">
          <StatusDot status={r.statusOf(task)} size={13} />
        </span>
        <span className={cn('font-medium leading-snug', done && 'text-faint line-through')}>{task.title}</span>
      </div>
      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.map((t) => (
            <Tag key={t} name={t} />
          ))}
        </div>
      )}
      <div className="text-muted mt-3 flex items-center gap-3 text-xs">
        {task.assignees.length > 0 && <AvatarStack ids={task.assignees} size={20} />}
        {task.dueDate && <span className={cn(isOverdue(task.dueDate, done) && 'text-red-500')}>{friendlyDate(task.dueDate)}</span>}
        {task.priority && <PriorityFlag priority={task.priority} />}
        <span className="ml-auto flex items-center gap-2">
          {subCount > 0 && (
            <span className="flex items-center gap-0.5">
              <GitBranch size={12} /> {subCount}
            </span>
          )}
          {checks > 0 && (
            <span className="flex items-center gap-0.5">
              <ListChecks size={12} /> {task.checklist.filter((c) => c.done).length}/{checks}
            </span>
          )}
          {comments > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare size={12} /> {comments}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
