import { PageHeader } from "@/components/page-header"
import { TasksWorkspace } from "@/components/tasks/tasks-workspace"

export default function TasksPage() {
  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <PageHeader>
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold">All tasks</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Everything across your teams
          </p>
        </div>
      </PageHeader>
      <TasksWorkspace />
    </div>
  )
}
