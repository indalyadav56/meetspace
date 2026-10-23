import { CheckSquare, Layers } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import ViewHost, { VIRTUAL_STATUSES } from '../views/ViewHost'

/** All tasks across projects; ?mine=1 narrows it to tasks assigned to me. */
export default function Everything() {
  const [params] = useSearchParams()
  const mine = params.get('mine') === '1'
  const me = useStore((s) => s.currentUserId)
  const allTasks = useStore((s) => s.tasks)
  const tasks = mine && me ? allTasks.filter((t) => t.assignees.includes(me)) : allTasks
  const firstList = useStore((s) => s.lists[0]?.id)
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 px-4">
        {mine ? <CheckSquare size={18} className="text-brand-600" /> : <Layers size={18} className="text-brand-600" />}
        <h1 className="text-base font-semibold">{mine ? 'My tasks' : 'Everything'}</h1>
        <span className="text-muted text-sm">— {mine ? 'everything assigned to you, across spaces' : 'all tasks across every space'}</span>
      </div>
      <div className="min-h-0 flex-1">
        {firstList ? (
          <ViewHost key={mine ? 'mine' : 'all'} viewKey={mine ? 'my-tasks' : 'everything'} sourceTasks={tasks} statuses={VIRTUAL_STATUSES} defaultListId={firstList} mixed />
        ) : (
          <div className="text-muted p-10 text-center text-sm">Create a space to get started.</div>
        )}
      </div>
    </div>
  )
}
