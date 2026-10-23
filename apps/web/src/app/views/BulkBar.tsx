import { Calendar, CircleDot, Flag, Trash2, UserPlus, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { ID } from '../../store/types'
import { useTaskResolver } from '../hooks'
import { Avatar, MenuItem, Popover, StatusDot, usePopover } from '../components/ui'
import { PRIORITIES } from '../../lib/utils'

/** Floating action bar for multi-selected tasks. Status options come from the first task's Space. */
export default function BulkBar({ ids, onClear }: { ids: ID[]; onClear: () => void }) {
  const { tasks, users, bulkUpdate, bulkDelete } = useStore()
  const r = useTaskResolver()
  const first = tasks.find((t) => t.id === ids[0])
  const space = first ? r.spaceOf(first) : undefined
  const sameSpace = ids.every((id) => {
    const t = tasks.find((x) => x.id === id)
    return t && r.spaceOf(t)?.id === space?.id
  })
  const status = usePopover()
  const assign = usePopover()
  const prio = usePopover()
  const btn = 'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium hover:bg-white/10'

  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-stone-900 px-2 py-1.5 text-white shadow-2xl">
      <span className="px-2 text-[13px] font-semibold">{ids.length} selected</span>
      <span className="mx-1 h-5 border-l border-white/20" />
      {sameSpace && space && (
        <>
          <button onClick={status.toggle} className={btn}>
            <CircleDot size={14} /> Status
          </button>
          <Popover open={status.open} anchor={status.anchor} onClose={status.close}>
            {space.statuses.map((s) => (
              <MenuItem key={s.id} onClick={() => (bulkUpdate(ids, { statusId: s.id }), status.close())}>
                <StatusDot status={s} /> {s.name}
              </MenuItem>
            ))}
          </Popover>
        </>
      )}
      <button onClick={assign.toggle} className={btn}>
        <UserPlus size={14} /> Assign
      </button>
      <Popover open={assign.open} anchor={assign.anchor} onClose={assign.close}>
        {users.map((u) => (
          <MenuItem
            key={u.id}
            onClick={() => {
              ids.forEach((id) => {
                const t = tasks.find((x) => x.id === id)
                if (t && !t.assignees.includes(u.id)) useStore.getState().updateTask(id, { assignees: [...t.assignees, u.id] })
              })
              assign.close()
            }}
          >
            <Avatar userId={u.id} size={20} /> {u.name}
          </MenuItem>
        ))}
      </Popover>
      <button onClick={prio.toggle} className={btn}>
        <Flag size={14} /> Priority
      </button>
      <Popover open={prio.open} anchor={prio.anchor} onClose={prio.close} width={180}>
        {PRIORITIES.map((p) => (
          <MenuItem key={p.value} onClick={() => (bulkUpdate(ids, { priority: p.value }), prio.close())}>
            <Flag size={14} fill={p.color} color={p.color} /> {p.label}
          </MenuItem>
        ))}
      </Popover>
      <label className={btn + ' relative cursor-pointer'}>
        <Calendar size={14} /> Due
        <input
          type="date"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => e.target.value && bulkUpdate(ids, { dueDate: e.target.value })}
          aria-label="Set due date for selected tasks"
        />
      </label>
      <button
        onClick={() => {
          if (confirm(`Delete ${ids.length} task${ids.length > 1 ? 's' : ''}?`)) {
            bulkDelete(ids)
            onClear()
          }
        }}
        className={btn + ' text-red-300'}
      >
        <Trash2 size={14} /> Delete
      </button>
      <button onClick={onClear} className="ml-1 rounded-md p-1.5 hover:bg-white/10" aria-label="Clear selection">
        <X size={15} />
      </button>
    </div>
  )
}
