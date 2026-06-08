"use client"

import * as React from "react"
import { ClipboardList, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { TaskBoard } from "@/components/tasks/task-board"
import { TaskList } from "@/components/tasks/task-list"
import {
  EMPTY_FILTERS,
  TaskFilters,
  TaskToolbar,
} from "@/components/tasks/task-toolbar"
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog"
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet"
import { useWorkspace } from "@/lib/store"
import type { StatusId, Task, ViewMode } from "@/lib/types"

export function TasksWorkspace({
  scopeTeamId,
  scopeAssigneeId,
  defaultView = "board",
}: {
  scopeTeamId?: string
  scopeAssigneeId?: string
  defaultView?: ViewMode
}) {
  const { tasks } = useWorkspace()
  const [view, setView] = React.useState<ViewMode>(defaultView)
  const [filters, setFilters] = React.useState<TaskFilters>(EMPTY_FILTERS)
  const [openTaskId, setOpenTaskId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createDefaults, setCreateDefaults] = React.useState<{
    status: StatusId
    teamId?: string
  }>({ status: "backlog", teamId: scopeTeamId })

  const filtered = React.useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return tasks.filter((t) => {
      if (scopeTeamId && t.teamId !== scopeTeamId) return false
      if (scopeAssigneeId && !t.assigneeIds.includes(scopeAssigneeId)) return false
      if (filters.teamId !== "all" && t.teamId !== filters.teamId) return false
      if (filters.assigneeId !== "all" && !t.assigneeIds.includes(filters.assigneeId))
        return false
      if (filters.priority !== "all" && t.priority !== filters.priority) return false
      if (q) {
        const haystack = `${t.title} ${t.key} ${t.description} ${t.tags.join(" ")}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [tasks, filters, scopeTeamId, scopeAssigneeId])

  const openTask = (task: Task) => setOpenTaskId(task.id)

  const addTask = (status: StatusId) => {
    setCreateDefaults({ status, teamId: scopeTeamId })
    setCreateOpen(true)
  }

  const scopeHasTasks = tasks.some((t) => {
    if (scopeTeamId && t.teamId !== scopeTeamId) return false
    if (scopeAssigneeId && !t.assigneeIds.includes(scopeAssigneeId)) return false
    return true
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TaskToolbar
        view={view}
        onViewChange={setView}
        filters={filters}
        onFiltersChange={setFilters}
        onNewTask={() => addTask("backlog")}
        showTeamFilter={!scopeTeamId}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClipboardList />
              </EmptyMedia>
              <EmptyTitle>
                {scopeHasTasks ? "No matching tasks" : "No tasks yet"}
              </EmptyTitle>
              <EmptyDescription>
                {scopeHasTasks
                  ? "Try adjusting your filters or search."
                  : "Create your first task to get the ball rolling."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {scopeHasTasks ? (
                <Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => addTask("backlog")}>
                  <Plus />
                  New task
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : view === "board" ? (
          <TaskBoard tasks={filtered} onOpenTask={openTask} onAddTask={addTask} />
        ) : (
          <TaskList
            tasks={filtered}
            onOpenTask={openTask}
            onAddTask={addTask}
            showTeam={!scopeTeamId}
          />
        )}
      </div>

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultStatus={createDefaults.status}
        defaultTeamId={createDefaults.teamId}
      />
      <TaskDetailSheet
        taskId={openTaskId}
        onOpenChange={(open) => !open && setOpenTaskId(null)}
      />
    </div>
  )
}
