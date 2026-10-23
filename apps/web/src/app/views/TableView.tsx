import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { formatMinutes, useStore } from '../../store/useStore'
import { CustomValueEditor, fieldIcon } from '../task/TaskExtras'
import { useTaskResolver } from '../hooks'
import { AssigneeMenu, DateButton, InlineEdit, PriorityMenu, StatusMenu, Tag } from '../components/ui'
import type { ViewProps } from './ListView'
import { format, parseISO } from 'date-fns'

export default function TableView({ tasks, defaultListId }: ViewProps) {
  const { updateTask, openTask, addTask, fields, setCustomValue, timeEntries } = useStore()
  const r = useTaskResolver()
  const listIds = useMemo(() => new Set([defaultListId, ...tasks.map((t) => t.listId)]), [tasks, defaultListId])
  const cols = fields.filter((f) => listIds.has(f.listId))
  const tracked = useMemo(() => {
    const m = new Map<string, number>()
    timeEntries.forEach((e) => m.set(e.taskId, (m.get(e.taskId) ?? 0) + e.duration))
    return m
  }, [timeEntries])
  const [draft, setDraft] = useState('')
  const th = 'border-app surface-subtle sticky top-0 z-10 border-r border-b px-3 py-2 text-left text-[11px] font-semibold uppercase text-faint whitespace-nowrap'
  const td = 'border-app border-r border-b px-3 py-1.5 whitespace-nowrap'

  return (
    <div className="h-full overflow-auto scroll-thin">
      <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className={`${th} w-14`}>#</th>
            <th className={`${th} min-w-[280px]`}>Task name</th>
            <th className={th}>Status</th>
            <th className={th}>Assignees</th>
            <th className={th}>Priority</th>
            <th className={th}>Start</th>
            <th className={th}>Due</th>
            <th className={th}>Estimate</th>
            <th className={th}>Tracked</th>
            {cols.map((f) => {
              const I = fieldIcon(f.type)
              return (
                <th key={f.id} className={th}>
                  <span className="inline-flex items-center gap-1">
                    <I size={12} /> {f.name}
                  </span>
                </th>
              )
            })}
            <th className={th}>Tags</th>
            <th className={th}>List</th>
            <th className={th}>Created</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const space = r.spaceOf(t)
            const st = r.statusOf(t)
            return (
              <tr key={t.id} className="hover-surface">
                <td className={`${td} text-faint`}>
                  <button onClick={() => openTask(t.id)} className="hover:underline">
                    {t.key}
                  </button>
                </td>
                <td className={td}>
                  <InlineEdit value={t.title} onSave={(v) => updateTask(t.id, { title: v })} className="w-full font-medium" />
                </td>
                <td className={td}>
                  {space && (
                    <StatusMenu statuses={space.statuses} value={t.statusId} onChange={(v) => updateTask(t.id, { statusId: v })}>
                      <span className="rounded px-2 py-0.5 text-[11px] font-semibold uppercase text-white" style={{ background: st?.color }}>
                        {st?.name}
                      </span>
                    </StatusMenu>
                  )}
                </td>
                <td className={td}>
                  <AssigneeMenu value={t.assignees} onChange={(v) => updateTask(t.id, { assignees: v })} size={22} />
                </td>
                <td className={td}>
                  <PriorityMenu value={t.priority} onChange={(v) => updateTask(t.id, { priority: v })} showLabel />
                </td>
                <td className={td}>
                  <DateButton value={t.startDate} onChange={(v) => updateTask(t.id, { startDate: v })} placeholder="—" />
                </td>
                <td className={td}>
                  <DateButton value={t.dueDate} onChange={(v) => updateTask(t.id, { dueDate: v })} done={r.isDone(t)} placeholder="—" />
                </td>
                <td className={td}>
                  <input
                    type="number"
                    min={0}
                    value={t.estimate ?? ''}
                    onChange={(e) => updateTask(t.id, { estimate: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder="—"
                    className="w-14 bg-transparent outline-none"
                  />
                </td>
                <td className={`${td} text-muted tabular-nums`}>{tracked.get(t.id) ? formatMinutes(tracked.get(t.id)!) : '—'}</td>
                {cols.map((f) => (
                  <td key={f.id} className={`${td} min-w-[120px]`}>
                    {f.listId === t.listId ? <CustomValueEditor field={f} value={t.custom[f.id]} onChange={(v) => setCustomValue(t.id, f.id, v)} compact /> : <span className="text-faint">·</span>}
                  </td>
                ))}
                <td className={td}>
                  <span className="flex gap-1">
                    {t.tags.map((x) => (
                      <Tag key={x} name={x} />
                    ))}
                  </span>
                </td>
                <td className={`${td} text-muted`}>{r.listName(t.listId)}</td>
                <td className={`${td} text-muted`}>{format(parseISO(t.createdAt), 'MMM d')}</td>
              </tr>
            )
          })}
          <tr>
            <td className={td} />
            <td className={td} colSpan={11 + cols.length}>
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (draft.trim()) addTask({ listId: defaultListId, title: draft.trim() })
                  setDraft('')
                }}
              >
                <Plus size={14} className="text-faint" />
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="New row — type a task name and press Enter" className="flex-1 bg-transparent outline-none" />
              </form>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="text-faint px-3 py-2 text-xs">{tasks.length} rows</div>
    </div>
  )
}
