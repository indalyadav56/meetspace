"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  CalendarClock,
  CircleDotDashed,
  ListTodo,
  Plus,
  TriangleAlert,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { AssigneeGroup } from "@/components/shared/assignee-group"
import {
  DueDateBadge,
  PriorityFlag,
  StatusPill,
} from "@/components/shared/meta-badges"
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog"
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet"
import { PRIORITY_MAP } from "@/lib/config"
import { daysUntil } from "@/lib/date"
import { useWorkspace } from "@/lib/store"
import type { Task } from "@/lib/types"

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

export function HomeOverview() {
  const { tasks, teams, currentUser, getUser } = useWorkspace()
  const [openTaskId, setOpenTaskId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)

  const mine = tasks.filter((t) => t.assigneeIds.includes(currentUser.id))
  const open = mine.filter((t) => t.status !== "done")
  const overdue = open.filter((t) => t.dueDate && daysUntil(t.dueDate) < 0)
  const dueSoon = open.filter(
    (t) => t.dueDate && daysUntil(t.dueDate) >= 0 && daysUntil(t.dueDate) <= 7,
  )
  const inProgress = mine.filter((t) => t.status === "in_progress")
  const completed = mine.filter((t) => t.status === "done")

  const focus = [...open].sort((a, b) => {
    const ao = a.dueDate && daysUntil(a.dueDate) < 0 ? 1 : 0
    const bo = b.dueDate && daysUntil(b.dueDate) < 0 ? 1 : 0
    if (ao !== bo) return bo - ao
    const pr = PRIORITY_MAP[b.priority].rank - PRIORITY_MAP[a.priority].rank
    if (pr !== 0) return pr
    const ad = a.dueDate ? daysUntil(a.dueDate) : 9999
    const bd = b.dueDate ? daysUntil(b.dueDate) : 9999
    return ad - bd
  })

  const stats = [
    { label: "Open tasks", value: open.length, icon: ListTodo, tone: "text-foreground" },
    { label: "Due this week", value: dueSoon.length, icon: CalendarClock, tone: "text-sky-500" },
    { label: "In progress", value: inProgress.length, icon: CircleDotDashed, tone: "text-amber-500" },
    { label: "Overdue", value: overdue.length, icon: TriangleAlert, tone: "text-red-500" },
  ]

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{today}</p>
          <h1 className="text-2xl font-semibold">
            {greeting()}, {currentUser.name.split(" ")[0]}
          </h1>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          New task
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <s.icon className={`mb-2 size-4 ${s.tone}`} />
            <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Focus list */}
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Your focus</h2>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link href="/my-tasks">
                View all
                <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="overflow-hidden rounded-xl border">
            {focus.length === 0 ? (
              <Empty className="py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ListTodo />
                  </EmptyMedia>
                  <EmptyTitle>You&apos;re all caught up</EmptyTitle>
                  <EmptyDescription>
                    Nothing open assigned to you right now.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              focus.slice(0, 7).map((task: Task, i) => {
                const assignees = task.assigneeIds
                  .map((id) => getUser(id))
                  .filter((u): u is NonNullable<typeof u> => Boolean(u))
                return (
                  <button
                    key={task.id}
                    onClick={() => setOpenTaskId(task.id)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${
                      i > 0 ? "border-t" : ""
                    }`}
                  >
                    <PriorityFlag priority={task.priority} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {task.title}
                    </span>
                    <StatusPill status={task.status} className="hidden sm:inline-flex" />
                    {task.dueDate && <DueDateBadge date={task.dueDate} />}
                    <AssigneeGroup users={assignees} max={2} size="size-6" />
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Teams + progress */}
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Your teams</h2>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link href="/teams">
                  All
                  <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {teams.map((team) => {
                const tt = tasks.filter((t) => t.teamId === team.id)
                const done = tt.filter((t) => t.status === "done").length
                const pct = tt.length ? Math.round((done / tt.length) * 100) : 0
                return (
                  <Link
                    key={team.id}
                    href={`/teams/${team.id}`}
                    className="group flex flex-col gap-2 rounded-xl border bg-card p-3 transition-colors hover:border-foreground/15"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="flex size-7 items-center justify-center rounded-lg text-sm"
                        style={{ backgroundColor: `${team.color}22` }}
                      >
                        {team.icon}
                      </span>
                      <span className="flex-1 truncate text-sm font-medium">
                        {team.name}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {pct}%
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-indigo-500/10 to-violet-500/10 p-4">
            <h3 className="text-sm font-semibold">
              {completed.length} {completed.length === 1 ? "task" : "tasks"} completed
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Nice work. Keep the momentum going across your {teams.length} teams.
            </p>
          </div>
        </div>
      </div>

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
      <TaskDetailSheet
        taskId={openTaskId}
        onOpenChange={(o) => !o && setOpenTaskId(null)}
      />
    </div>
  )
}
