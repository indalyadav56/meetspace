import { ArrowDownWideNarrow, ArrowUpDown, ArrowUpNarrowWide, Eye, EyeOff, Filter, Search, User as UserIcon, X } from 'lucide-react'
import { emptyFilters, useMe, useStore, type DueFilter, type SortKey } from '../../store/useStore'
import { Avatar, MenuItem, Popover, usePopover } from '../components/ui'
import { PRIORITIES, cn } from '../../lib/utils'

export const SORT_LABELS: Record<SortKey, string> = {
  manual: 'Manual',
  title: 'Task name',
  due: 'Due date',
  start: 'Start date',
  priority: 'Priority',
  created: 'Date created',
  updated: 'Date updated',
  estimate: 'Time estimate',
  points: 'Sprint points',
}

const DUE_LABELS: [DueFilter, string][] = [
  ['overdue', 'Overdue'],
  ['today', 'Due today'],
  ['week', 'Due in the next 7 days'],
  ['none', 'No due date'],
]

export default function FilterBar({ right }: { right?: React.ReactNode }) {
  const { filters: f, setFilters, users, tasks } = useStore()
  const me = useMe()
  const filterPop = usePopover()
  const sortPop = usePopover()
  const meMode = f.assignees.length === 1 && f.assignees[0] === me.id
  const tags = [...new Set(tasks.flatMap((t) => t.tags))].sort()
  const activeCount = f.assignees.length + f.priorities.length + (f.tags?.length ?? 0) + (f.due ? 1 : 0)
  const chip = 'border-app hover-surface inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium'

  return (
    <div className="border-app flex flex-wrap items-center gap-2 border-b px-4 py-2">
      <div className="surface-subtle border-app flex h-7 items-center gap-1.5 rounded-md border px-2">
        <Search size={13} className="text-faint" />
        <input
          value={f.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          placeholder="Search tasks"
          className="w-28 bg-transparent text-xs outline-none sm:w-40"
        />
      </div>

      <button onClick={filterPop.toggle} className={cn(chip, activeCount && 'border-brand-500 text-brand-600')}>
        <Filter size={13} /> Filter{activeCount ? ` · ${activeCount}` : ''}
      </button>
      <Popover open={filterPop.open} anchor={filterPop.anchor} onClose={filterPop.close} width={260}>
        <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">Assignee</div>
        {users.map((u) => (
          <MenuItem
            key={u.id}
            active={f.assignees.includes(u.id)}
            onClick={() => setFilters({ assignees: f.assignees.includes(u.id) ? f.assignees.filter((x) => x !== u.id) : [...f.assignees, u.id] })}
          >
            <Avatar userId={u.id} size={20} /> {u.name}
          </MenuItem>
        ))}
        <div className="text-faint mt-1 px-2 py-1 text-[11px] font-semibold uppercase">Priority</div>
        {[...PRIORITIES, { value: 'none', label: 'No priority', color: '#cbd5e1' }].map((p) => (
          <MenuItem
            key={p.value}
            active={f.priorities.includes(p.value)}
            onClick={() => setFilters({ priorities: f.priorities.includes(p.value) ? f.priorities.filter((x) => x !== p.value) : [...f.priorities, p.value] })}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} /> {p.label}
          </MenuItem>
        ))}
        <div className="text-faint mt-1 px-2 py-1 text-[11px] font-semibold uppercase">Due date</div>
        {DUE_LABELS.map(([k, label]) => (
          <MenuItem key={k} active={f.due === k} onClick={() => setFilters({ due: f.due === k ? '' : k })}>
            {label}
          </MenuItem>
        ))}
        {tags.length > 0 && (
          <>
            <div className="text-faint mt-1 px-2 py-1 text-[11px] font-semibold uppercase">Tags</div>
            <div className="max-h-36 overflow-y-auto scroll-thin">
              {tags.map((g) => (
                <MenuItem key={g} active={f.tags?.includes(g)} onClick={() => setFilters({ tags: f.tags?.includes(g) ? f.tags.filter((x) => x !== g) : [...(f.tags ?? []), g] })}>
                  # {g}
                </MenuItem>
              ))}
            </div>
          </>
        )}
        {activeCount > 0 && (
          <>
            <div className="border-app my-1 border-t" />
            <MenuItem onClick={() => setFilters({ assignees: [], priorities: [], tags: [], due: '' })}>
              <X size={14} /> Clear filters
            </MenuItem>
          </>
        )}
      </Popover>

      <button onClick={sortPop.toggle} className={cn(chip, f.sort !== 'manual' && 'border-brand-500 text-brand-600')}>
        <ArrowUpDown size={13} /> Sort{f.sort !== 'manual' ? `: ${SORT_LABELS[f.sort]}${f.sortDir === 'desc' ? ' ↓' : ''}` : ''}
      </button>
      <Popover open={sortPop.open} anchor={sortPop.anchor} onClose={sortPop.close} width={200}>
        {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
          <MenuItem key={k} active={f.sort === k} onClick={() => (setFilters({ sort: k }), sortPop.close())}>
            {SORT_LABELS[k]}
          </MenuItem>
        ))}
        {f.sort !== 'manual' && (
          <>
            <div className="border-app my-1 border-t" />
            <MenuItem onClick={() => setFilters({ sortDir: f.sortDir === 'desc' ? 'asc' : 'desc' })}>
              {f.sortDir === 'desc' ? <ArrowDownWideNarrow size={14} /> : <ArrowUpNarrowWide size={14} />} {f.sortDir === 'desc' ? 'Descending' : 'Ascending'}
            </MenuItem>
          </>
        )}
      </Popover>

      <button onClick={() => setFilters({ assignees: meMode ? [] : [me.id] })} className={cn(chip, meMode && 'bg-brand-600 border-brand-600 text-white hover:bg-brand-700')}>
        <UserIcon size={13} /> Me mode
      </button>
      <button onClick={() => setFilters({ showClosed: !f.showClosed })} className={chip}>
        {f.showClosed ? <Eye size={13} /> : <EyeOff size={13} />} {f.showClosed ? 'Showing closed' : 'Closed hidden'}
      </button>
      {(f.search || activeCount > 0 || f.sort !== 'manual' || !f.showClosed) && (
        <button onClick={() => setFilters(emptyFilters)} className="text-muted text-xs hover:underline">
          Reset
        </button>
      )}
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </div>
  )
}
