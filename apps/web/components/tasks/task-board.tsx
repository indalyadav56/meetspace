"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TaskCard } from "@/components/tasks/task-card"
import { STATUSES } from "@/lib/config"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/lib/store"
import type { StatusId, Task } from "@/lib/types"

export function TaskBoard({
  tasks,
  onOpenTask,
  onAddTask,
}: {
  tasks: Task[]
  onOpenTask: (task: Task) => void
  onAddTask: (status: StatusId) => void
}) {
  const { moveTask } = useWorkspace()
  const [draggingId, setDraggingId] = React.useState<string | null>(null)
  const [overColumn, setOverColumn] = React.useState<StatusId | null>(null)

  const byStatus = React.useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const s of STATUSES) map[s.id] = []
    for (const t of tasks) map[t.status]?.push(t)
    return map
  }, [tasks])

  const handleDrop = (status: StatusId) => {
    if (draggingId) moveTask(draggingId, status)
    setDraggingId(null)
    setOverColumn(null)
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {STATUSES.map((status) => {
        const items = byStatus[status.id] ?? []
        const isOver = overColumn === status.id
        return (
          <section
            key={status.id}
            onDragOver={(e) => {
              e.preventDefault()
              setOverColumn(status.id)
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setOverColumn(null)
            }}
            onDrop={() => handleDrop(status.id)}
            className="flex w-80 shrink-0 flex-col rounded-2xl bg-muted/20 dark:bg-slate-950/20 border border-border/20 p-3"
          >
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className={cn("size-2.5 rounded-full", status.dot)} />
              <h3 className="text-sm font-semibold">{status.label}</h3>
              <span className="rounded-full bg-muted/60 dark:bg-slate-800/80 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {items.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto size-6 text-muted-foreground hover:bg-muted/50"
                aria-label={`Add issue to ${status.label}`}
                onClick={() => onAddTask(status.id)}
              >
                <Plus />
              </Button>
            </div>

            <div
              className={cn(
                "flex flex-1 flex-col gap-2 rounded-xl border border-transparent p-0.5 transition-colors custom-scrollbar overflow-y-auto max-h-[calc(100%-40px)]",
                isOver && "border-primary/20 bg-primary/[0.02] rounded-xl",
              )}
            >
              {items.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpen={onOpenTask}
                  dragging={draggingId === task.id}
                  onDragStart={(e) => {
                    setDraggingId(task.id)
                    e.dataTransfer.effectAllowed = "move"
                    e.dataTransfer.setData("text/plain", task.id)
                  }}
                  onDragEnd={() => {
                    setDraggingId(null)
                    setOverColumn(null)
                  }}
                />
              ))}

              <button
                type="button"
                onClick={() => onAddTask(status.id)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="size-4" />New issue</button>
            </div>
          </section>
        )
      })}
    </div>
  )
}
