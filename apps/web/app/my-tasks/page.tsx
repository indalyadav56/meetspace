import { PageHeader } from "@/components/page-header"
import { TasksWorkspace } from "@/components/tasks/tasks-workspace"
import { CURRENT_USER_ID } from "@/lib/mock-data"

export default function MyTasksPage() {
  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <PageHeader>
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold">My Issues</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Issues assigned to you
          </p>
        </div>
      </PageHeader>
      <TasksWorkspace scopeAssigneeId={CURRENT_USER_ID} defaultView="list" />
    </div>
  )
}
