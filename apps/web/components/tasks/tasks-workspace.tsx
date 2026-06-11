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
import { TaskTimeline } from "@/components/tasks/task-timeline"
import {
  EMPTY_FILTERS,
  TaskFilters,
  TaskToolbar,
} from "@/components/tasks/task-toolbar"
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog"
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet"
import { useWorkspace } from "@/lib/store"
import { CURRENT_USER_ID } from "@/lib/mock-data"
import { PRIORITIES, STATUSES } from "@/lib/config"
import type { StatusId, Task, ViewMode } from "@/lib/types"

export function TasksWorkspace({
  scopeTeamId,
  scopeAssigneeId,
  defaultView = "board",
}: {
  scopeTeamId?: string
  scopeAssigneeId?: string
  defaultView?: ViewMode | "timeline"
}) {
  const { tasks, activeProjectId } = useWorkspace()
  const [view, setView] = React.useState<ViewMode | "timeline">(defaultView)
  const [filters, setFilters] = React.useState<TaskFilters>(EMPTY_FILTERS)
  const [openTaskId, setOpenTaskId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createDefaults, setCreateDefaults] = React.useState<{
    status: StatusId
    teamId?: string
  }>({ status: "backlog", teamId: scopeTeamId })

  React.useEffect(() => {
    if (activeProjectId !== "all") {
      setCreateDefaults((prev) => ({ ...prev, teamId: activeProjectId }))
    } else {
      setCreateDefaults((prev) => ({ ...prev, teamId: scopeTeamId }))
    }
  }, [activeProjectId, scopeTeamId])

  // Advanced filters + sorting + tabs
  const filteredAndSorted = React.useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    
    let list = tasks.filter((t) => {
      // Global project scope switcher
      if (activeProjectId !== "all" && t.teamId !== activeProjectId) return false
      // Team scope
      if (scopeTeamId && t.teamId !== scopeTeamId) return false
      // Assignee scope
      if (scopeAssigneeId && !t.assigneeIds.includes(scopeAssigneeId)) return false
      
      // Select filters
      if (filters.teamId !== "all" && t.teamId !== filters.teamId) return false
      if (filters.assigneeId !== "all" && !t.assigneeIds.includes(filters.assigneeId)) return false
      if (filters.priority !== "all" && t.priority !== filters.priority) return false
      
      // Tabs
      if (filters.tab === "my" && !t.assigneeIds.includes(CURRENT_USER_ID)) return false
      if (filters.tab === "backlog" && t.status !== "backlog") return false
      if (filters.tab === "closed" && t.status !== "done") return false
      if (filters.tab === "all" && filters.assigneeId === "all" && scopeAssigneeId !== CURRENT_USER_ID) {
        // default "all" tab shows everything
      }

      // Search query
      if (q) {
        const haystack = `${t.title} ${t.key} ${t.description} ${t.tags.join(" ")}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    // Sort operations
    return list.sort((a, b) => {
      if (filters.sortBy === "dueDate") {
        const da = a.dueDate ?? "9999-99-99"
        const db = b.dueDate ?? "9999-99-99"
        return da.localeCompare(db)
      }
      if (filters.sortBy === "created") {
        return b.createdAt.localeCompare(a.createdAt)
      }
      // default: Priority
      const rankA = PRIORITIES.find(p => p.id === a.priority)?.rank ?? 0
      const rankB = PRIORITIES.find(p => p.id === b.priority)?.rank ?? 0
      return rankB - rankA
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
        onNewTask={() => addTask("todo")}
        showTeamFilter={!scopeTeamId}
      />

      <div className="min-h-0 flex-1 overflow-auto bg-slate-900/[0.01]">
        {filteredAndSorted.length === 0 ? (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClipboardList />
              </EmptyMedia>
              <EmptyTitle>
                {scopeHasTasks ? "No matching tasks found" : "No tasks in this workspace"}
              </EmptyTitle>
              <EmptyDescription>
                {scopeHasTasks
                  ? "Adjust your filters or tab criteria above to reveal tasks."
                  : "Begin collaborating by writing your first workspace task."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {scopeHasTasks ? (
                <Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => addTask("todo")}>
                  <Plus /> New issue
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : view === "board" ? (
          <TaskBoard tasks={filteredAndSorted} onOpenTask={openTask} onAddTask={addTask} />
        ) : view === "timeline" ? (
          <TaskTimeline tasks={filteredAndSorted} onOpenTask={openTask} />
        ) : (
          <TaskList
            tasks={filteredAndSorted}
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
