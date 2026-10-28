import { useMemo, useState, type ReactNode } from 'react'
import { Bookmark, Bug, Check, CheckSquare, Search, Zap } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { ID, IssueType, Task } from '../../store/types'
import { useTaskResolver } from '../hooks'
import { MenuItem, Popover, usePopover } from './ui'
import { cn } from '../../lib/utils'

export const ISSUE_TYPES: { type: IssueType; label: string; color: string; icon: typeof CheckSquare }[] = [
  { type: 'task', label: 'Task', color: '#3b82f6', icon: CheckSquare },
  { type: 'story', label: 'Story', color: '#22c55e', icon: Bookmark },
  { type: 'bug', label: 'Bug', color: '#ef4444', icon: Bug },
  { type: 'epic', label: 'Epic', color: '#8b5cf6', icon: Zap },
]
export const issueMeta = (t?: IssueType) => ISSUE_TYPES.find((x) => x.type === t) ?? ISSUE_TYPES[0]

/** A small filled square with the type's glyph, like Jira's issue icons. */
export function IssueIcon({ type, size = 16, className }: { type?: IssueType; size?: number; className?: string }) {
  const m = issueMeta(type)
  return (
    <span title={m.label} className={cn('inline-flex shrink-0 items-center justify-center rounded-[4px] text-white', className)} style={{ width: size, height: size, background: m.color }}>
      <m.icon size={Math.round(size * 0.66)} strokeWidth={2.5} />
    </span>
  )
}

export function IssueTypeMenu({ value, onChange, children, className }: { value: IssueType; onChange: (t: IssueType) => void; children?: ReactNode; className?: string }) {
  const p = usePopover()
  return (
    <>
      <button type="button" onClick={p.toggle} className={cn('hover-surface inline-flex items-center gap-1.5 rounded px-1 py-0.5', className)} aria-label="Issue type">
        {children ?? (
          <>
            <IssueIcon type={value} /> <span>{issueMeta(value).label}</span>
          </>
        )}
      </button>
      <Popover open={p.open} anchor={p.anchor} onClose={p.close} width={180}>
        <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">Type</div>
        {ISSUE_TYPES.map((t) => (
          <MenuItem key={t.type} active={t.type === value} onClick={() => (onChange(t.type), p.close())}>
            <IssueIcon type={t.type} /> {t.label}
          </MenuItem>
        ))}
      </Popover>
    </>
  )
}

/** Progress of every epic: children done / total, and story points. */
export function useEpicProgress() {
  const tasks = useStore((s) => s.tasks)
  const r = useTaskResolver()
  return useMemo(() => {
    const m = new Map<ID, { done: number; total: number; points: number; donePoints: number }>()
    for (const t of tasks) {
      if (!t.epicId) continue
      const p = m.get(t.epicId) ?? { done: 0, total: 0, points: 0, donePoints: 0 }
      const finished = r.isDone(t)
      p.total++
      p.points += t.points ?? 0
      if (finished) {
        p.done++
        p.donePoints += t.points ?? 0
      }
      m.set(t.epicId, p)
    }
    return m
  }, [tasks, r])
}

/** Deterministic color per epic so chips are easy to tell apart. */
const EPIC_COLORS = ['#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#0ea5e9', '#84cc16', '#eab308', '#6366f1']
export function epicColor(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return EPIC_COLORS[h % EPIC_COLORS.length]
}

export function EpicChip({ epicId, onClick, className }: { epicId: ID; onClick?: () => void; className?: string }) {
  const epic = useStore((s) => s.tasks.find((t) => t.id === epicId))
  if (!epic) return null
  const color = epicColor(epic.id)
  return (
    <span
      onClick={onClick}
      className={cn('inline-flex max-w-40 items-center gap-1 truncate rounded px-1.5 py-px text-[11px] font-medium', onClick && 'cursor-pointer hover:brightness-95', className)}
      style={{ background: `${color}1f`, color }}
      title={`Epic: ${epic.title}`}
    >
      <Zap size={10} className="shrink-0" fill="currentColor" />
      <span className="truncate">{epic.title}</span>
    </span>
  )
}

/** Pick the epic a task belongs to, from every epic in the workspace. */
export function EpicMenu({ value, onChange, task, children, className }: { value: ID | null; onChange: (id: ID | null) => void; task?: Task; children?: ReactNode; className?: string }) {
  const p = usePopover()
  const [q, setQ] = useState('')
  const epics = useStore((s) => s.tasks.filter((t) => t.issueType === 'epic' && t.id !== task?.id))
  const r = useTaskResolver()
  const shown = epics.filter((e) => e.title.toLowerCase().includes(q.toLowerCase()) || `ms-${e.key}`.includes(q.toLowerCase())).slice(0, 30)
  return (
    <>
      <button type="button" onClick={p.toggle} className={cn('hover-surface inline-flex max-w-full items-center gap-1 rounded px-1 py-0.5 text-left', className)} aria-label="Epic">
        {children ?? (value ? <EpicChip epicId={value} /> : <span className="text-faint">No epic</span>)}
      </button>
      <Popover open={p.open} anchor={p.anchor} onClose={() => (p.close(), setQ(''))} width={280}>
        <div className="border-app mb-1 flex items-center gap-2 border-b px-2 pb-1.5">
          <Search size={13} className="text-faint" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an epic" className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none" />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {value && (
            <MenuItem onClick={() => (onChange(null), p.close())}>
              <span className="text-muted">Remove from epic</span>
            </MenuItem>
          )}
          {shown.map((e) => (
            <button key={e.id} type="button" onClick={() => (onChange(e.id), p.close(), setQ(''))} className="hover-surface flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: epicColor(e.id) }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{e.title}</span>
                <span className="text-faint block truncate text-[11px]">
                  MS-{e.key} · {r.spaceOf(e)?.name}
                </span>
              </span>
              {e.id === value && <Check size={14} className="text-brand-600" />}
            </button>
          ))}
          {shown.length === 0 && <p className="text-muted px-2 py-3 text-center text-xs">{epics.length ? 'No epics match.' : 'No epics yet. Set a task’s type to Epic to create one.'}</p>}
        </div>
      </Popover>
    </>
  )
}
