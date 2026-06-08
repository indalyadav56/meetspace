"use client"

import * as React from "react"
import { CheckSquare, MoreHorizontal, Trash2 } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AssigneeGroup } from "@/components/shared/assignee-group"
import {
  DueDateBadge,
  PriorityFlag,
  TagBadge,
} from "@/components/shared/meta-badges"
import { STATUSES } from "@/lib/config"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/lib/store"
import type { Task } from "@/lib/types"

export function TaskCard({
  task,
  onOpen,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  task: Task
  onOpen: (task: Task) => void
  dragging?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
}) {
  const { getUser, moveTask, deleteTask } = useWorkspace()
  const assignees = task.assigneeIds
    .map((id) => getUser(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
  const doneSubtasks = task.subtasks.filter((s) => s.done).length

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(task)
      }}
      className={cn(
        "group/card cursor-pointer rounded-xl border bg-card p-3 text-left shadow-xs transition-all hover:border-foreground/15 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        dragging && "opacity-40",
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <PriorityFlag priority={task.priority} />
        <span className="font-mono text-[11px] text-muted-foreground">
          {task.key}
        </span>
        <div
          className="ml-auto opacity-0 transition-opacity group-hover/card:opacity-100 data-[open=true]:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Task actions"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={task.status}
                onValueChange={(v) => moveTask(task.id, v as Task["status"])}
              >
                {STATUSES.map((s) => (
                  <DropdownMenuRadioItem key={s.id} value={s.id}>
                    {s.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => deleteTask(task.id)}
                >
                  <Trash2 />
                  Delete task
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <p className="line-clamp-2 text-sm font-medium leading-snug">
        {task.title}
      </p>

      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {task.dueDate && <DueDateBadge date={task.dueDate} />}
        {task.subtasks.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CheckSquare className="size-3.5" />
            {doneSubtasks}/{task.subtasks.length}
          </span>
        )}
        <div className="ml-auto">
          {assignees.length > 0 && <AssigneeGroup users={assignees} size="size-6" />}
        </div>
      </div>
    </div>
  )
}
