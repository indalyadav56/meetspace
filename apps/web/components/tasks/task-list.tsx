"use client"

import * as React from "react"
import { ChevronRight, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AssigneeGroup } from "@/components/shared/assignee-group"
import {
  DueDateBadge,
  PriorityFlag,
  TagBadge,
  TaskTypeIcon,
} from "@/components/shared/meta-badges"
import { STATUSES } from "@/lib/config"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/lib/store"
import type { StatusId, Task } from "@/lib/types"

export function TaskList({
  tasks,
  onOpenTask,
  onAddTask,
  showTeam = true,
}: {
  tasks: Task[]
  onOpenTask: (task: Task) => void
  onAddTask: (status: StatusId) => void
  showTeam?: boolean
}) {
  const { getUser, getTeam } = useWorkspace()
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set())

  const byStatus = React.useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const s of STATUSES) map[s.id] = []
    for (const t of tasks) map[t.status]?.push(t)
    return map
  }, [tasks])

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex flex-col gap-5 p-4">
      {STATUSES.map((status) => {
        const items = byStatus[status.id] ?? []
        const isCollapsed = collapsed.has(status.id)
        return (
          <section key={status.id}>
            <div className="mb-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggle(status.id)}
                className="flex items-center gap-2 rounded-md py-1 pr-2 text-sm font-semibold hover:text-foreground/80"
              >
                <ChevronRight
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    !isCollapsed && "rotate-90",
                  )}
                />
                <span className={cn("size-2.5 rounded-full", status.dot)} />
                {status.label}
                <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                  {items.length}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground"
                aria-label={`Add issue to ${status.label}`}
                onClick={() => onAddTask(status.id)}
              >
                <Plus />
              </Button>
            </div>

            {!isCollapsed && (
              <div className="overflow-hidden rounded-xl border">
                {items.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">
                    No issues here yet.
                  </p>
                ) : (
                  items.map((task, i) => {
                    const assignees = task.assigneeIds
                      .map((id) => getUser(id))
                      .filter((u): u is NonNullable<typeof u> => Boolean(u))
                    const team = getTeam(task.teamId)
                    return (
                      <div
                        key={task.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenTask(task)}
                        onKeyDown={(e) => e.key === "Enter" && onOpenTask(task)}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
                          i > 0 && "border-t",
                        )}
                      >
                        <TaskTypeIcon task={task} />
                        <PriorityFlag priority={task.priority} />
                        <span className="hidden w-16 shrink-0 font-mono text-xs text-muted-foreground sm:inline">
                          {task.key}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {task.title}
                        </span>
                        <div className="hidden items-center gap-1 md:flex">
                          {task.tags.slice(0, 2).map((tag) => (
                            <TagBadge key={tag} tag={tag} />
                          ))}
                        </div>
                        {showTeam && team && (
                          <span
                            className="hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium lg:inline-flex"
                            style={{
                              backgroundColor: `${team.color}1a`,
                              color: team.color,
                            }}
                          >
                            {team.icon} {team.key}
                          </span>
                        )}
                        <div className="hidden w-24 shrink-0 justify-end sm:flex">
                          {task.dueDate && <DueDateBadge date={task.dueDate} />}
                        </div>
                        <div className="w-14 shrink-0">
                          {assignees.length > 0 && (
                            <AssigneeGroup users={assignees} max={2} size="size-6" />
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
