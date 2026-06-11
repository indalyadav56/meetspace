import { PageHeader } from "@/components/page-header"
import { TasksWorkspace } from "@/components/tasks/tasks-workspace"

export default function TasksPage() {
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background/50">
      <PageHeader>
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold">Tasks Console</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Jira & Linear style board & planner
          </p>
        </div>
      </PageHeader>
      <TasksWorkspace />
    </div>
  )
}
