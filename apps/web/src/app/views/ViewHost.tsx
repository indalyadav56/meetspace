import { useMemo } from 'react'
import { CalendarDays, GanttChart, KanbanSquare, List as ListIcon, Settings2, Table2, Users } from 'lucide-react'
import WorkloadView from './WorkloadView'
import { FieldManager } from '../task/TaskExtras'
import { applyFilters, useStore } from '../../store/useStore'
import type { ID, Status, Task, ViewKind } from '../../store/types'
import { useTaskResolver } from '../hooks'
import { cn } from '../../lib/utils'
import FilterBar from './FilterBar'
import ListView from './ListView'
import BoardView from './BoardView'
import CalendarView from './CalendarView'
import TableView from './TableView'
import GanttView from './GanttView'

export const VIEW_META: { kind: ViewKind; label: string; icon: typeof ListIcon }[] = [
  { kind: 'list', label: 'List', icon: ListIcon },
  { kind: 'board', label: 'Board', icon: KanbanSquare },
  { kind: 'calendar', label: 'Calendar', icon: CalendarDays },
  { kind: 'table', label: 'Table', icon: Table2 },
  { kind: 'gantt', label: 'Gantt', icon: GanttChart },
  { kind: 'workload', label: 'Workload', icon: Users },
]

/**
 * Renders the tab strip + filters + active view for a set of tasks.
 * When tasks span several spaces, `statuses` should be one virtual status per type and
 * tasks are re-keyed onto them for grouping (board drag is disabled in that case).
 */
export default function ViewHost({
  viewKey,
  sourceTasks,
  statuses,
  defaultListId,
  mixed = false,
  fieldListId,
}: {
  viewKey: ID
  sourceTasks: Task[]
  statuses: Status[]
  defaultListId: ID
  mixed?: boolean
  /** List whose custom fields can be managed from the toolbar (List pages only). */
  fieldListId?: ID
}) {
  const view = useStore((s) => s.listViews[viewKey] ?? 'list')
  const setListView = useStore((s) => s.setListView)
  const filters = useStore((s) => s.filters)
  const r = useTaskResolver()

  const available = VIEW_META
  const active = available.some((v) => v.kind === view) ? view : 'list'

  const tasks = useMemo(() => {
    const top = sourceTasks.filter((t) => !t.parentId)
    const filtered = applyFilters(top, filters, (t) => r.isDone(t))
    if (!mixed) return filtered
    return filtered.map((t) => ({ ...t, statusId: `v-${r.statusOf(t)?.type ?? 'open'}` }))
  }, [sourceTasks, filters, r, mixed])

  // In mixed mode the view gets virtual tasks; status edits must target real ids, so look them up.
  const real = useMemo(() => new Map(sourceTasks.map((t) => [t.id, t])), [sourceTasks])
  // List and Board group by the virtual status types; the other views need real tasks.
  const viewTasks = active === 'list' || active === 'board' || !mixed ? tasks : tasks.map((t) => real.get(t.id)!)

  const props = { tasks: viewTasks, statuses, defaultListId, showList: mixed, mixed, viewKey }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-app flex items-center gap-1 overflow-x-auto border-b px-4">
        {available.map(({ kind, label, icon: Icon }) => (
          <button
            key={kind}
            onClick={() => setListView(viewKey, kind)}
            className={cn(
              'relative flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-[13px] font-medium',
              active === kind ? 'text-app after:bg-brand-600 after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full' : 'text-muted hover:text-app',
            )}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      <FilterBar
        right={
          <>
            {!mixed && fieldListId && (
              <FieldManager listId={fieldListId} className="border-app hover-surface inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium">
                <Settings2 size={13} /> Fields
              </FieldManager>
            )}
            <span className="text-faint text-xs">{tasks.length} tasks</span>
          </>
        }
      />
      <div className="min-h-0 flex-1">
        {active === 'list' && <ListView {...props} tasks={tasks} viewKey={viewKey} fieldListId={mixed ? undefined : fieldListId} />}
        {active === 'board' && <BoardView {...props} />}
        {active === 'calendar' && <CalendarView {...props} />}
        {active === 'table' && <TableView {...props} />}
        {active === 'gantt' && <GanttView {...props} />}
        {active === 'workload' && <WorkloadView {...props} />}
      </div>
    </div>
  )
}

export const VIRTUAL_STATUSES: Status[] = [
  { id: 'v-open', name: 'Not started', color: '#94a3b8', type: 'open' },
  { id: 'v-active', name: 'Active', color: '#3b82f6', type: 'active' },
  { id: 'v-done', name: 'Done', color: '#10b981', type: 'done' },
  { id: 'v-closed', name: 'Closed', color: '#64748b', type: 'closed' },
]
