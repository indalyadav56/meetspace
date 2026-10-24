import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, Flag, UserRound } from 'lucide-react'
import type { Details } from '../../store/types'
import { AssigneeMenu, DateButton, PriorityMenu } from './ui'
import { cn } from '../../lib/utils'

/** Description, owner, priority and dates for a Space or List, edited in place. */
export default function DetailsBar({ value, onChange, what, className }: { value: Details; onChange: (patch: Partial<Details>) => void; what: 'Space' | 'List'; className?: string }) {
  const [desc, setDesc] = useState(value.description ?? '')
  const [editing, setEditing] = useState(false)
  useEffect(() => setDesc(value.description ?? ''), [value.description])
  const save = () => {
    setEditing(false)
    if (desc.trim() !== (value.description ?? '')) onChange({ description: desc.trim() })
  }
  const chip = 'text-muted inline-flex items-center gap-1 text-xs'
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {editing ? (
        <textarea
          autoFocus
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) (e.preventDefault(), save())
            if (e.key === 'Escape') (setDesc(value.description ?? ''), setEditing(false))
          }}
          rows={2}
          maxLength={5000}
          placeholder={`What is this ${what.toLowerCase()} for?`}
          className="border-app surface-subtle w-full max-w-2xl resize-none rounded-md border px-2 py-1 text-sm outline-none [field-sizing:content]"
          aria-label={`${what} description`}
        />
      ) : (
        <button onClick={() => setEditing(true)} className={cn('max-w-2xl truncate text-left text-sm', value.description ? 'text-muted hover:text-app' : 'text-faint hover:text-muted')} title="Edit description">
          {value.description || '+ Add description'}
        </button>
      )}
      <span className={chip} title={`${what} owner`}>
        <UserRound size={13} />
        <AssigneeMenu value={value.ownerId ? [value.ownerId] : []} onChange={(ids) => onChange({ ownerId: ids.find((x) => x !== value.ownerId) ?? (ids.length ? ids[0] : null) })} size={20} />
      </span>
      <span className={chip} title={`${what} priority`}>
        <Flag size={13} />
        <PriorityMenu value={value.priority ?? null} onChange={(p) => onChange({ priority: p })} showLabel />
      </span>
      <span className={chip} title={`${what} dates`}>
        <CalendarDays size={13} />
        <DateButton value={value.startDate ?? null} onChange={(v) => onChange({ startDate: v })} placeholder={<span className="text-faint">Start</span>} />
        <ArrowRight size={11} className="text-faint" />
        <DateButton value={value.dueDate ?? null} onChange={(v) => onChange({ dueDate: v })} placeholder={<span className="text-faint">Due</span>} />
      </span>
    </div>
  )
}
