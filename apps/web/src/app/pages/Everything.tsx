import { Layers } from 'lucide-react'
import { useStore } from '../../store/useStore'
import ViewHost, { VIRTUAL_STATUSES } from '../views/ViewHost'

export default function Everything() {
  const tasks = useStore((s) => s.tasks)
  const firstList = useStore((s) => s.lists[0]?.id)
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 px-4">
        <Layers size={18} className="text-brand-600" />
        <h1 className="text-base font-semibold">Everything</h1>
        <span className="text-muted text-sm">— all tasks across every project</span>
      </div>
      <div className="min-h-0 flex-1">
        {firstList ? (
          <ViewHost viewKey="everything" sourceTasks={tasks} statuses={VIRTUAL_STATUSES} defaultListId={firstList} mixed />
        ) : (
          <div className="text-muted p-10 text-center text-sm">Create a project to get started.</div>
        )}
      </div>
    </div>
  )
}
