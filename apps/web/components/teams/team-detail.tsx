"use client"

import Link from "next/link"
import { Crown, Users } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { PageHeader } from "@/components/page-header"
import { TasksWorkspace } from "@/components/tasks/tasks-workspace"
import { useWorkspace } from "@/lib/store"
import { STATUSES } from "@/lib/config"
import { cn } from "@/lib/utils"

export function TeamDetail({ teamId }: { teamId: string }) {
  const { teams, tasks, getUser } = useWorkspace()
  const team = teams.find((t) => t.id === teamId)

  if (!team) {
    return (
      <div className="flex h-svh flex-col">
        <PageHeader>
          <h1 className="text-sm font-semibold">Team</h1>
        </PageHeader>
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>Team not found</EmptyTitle>
            <EmptyDescription>
              This team may have been removed or the link is incorrect.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="outline">
              <Link href="/teams">Back to teams</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  const teamTasks = tasks.filter((t) => t.teamId === team.id)
  const members = team.memberIds
    .map((id) => getUser(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))

  const counts = STATUSES.map((s) => ({
    ...s,
    count: teamTasks.filter((t) => t.status === s.id).length,
  }))

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <PageHeader>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/teams">Teams</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="flex items-center gap-1.5">
                <span>{team.icon}</span>
                {team.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>

      <div className="border-b px-4 py-4">
        <div className="flex flex-wrap items-start gap-4">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl"
            style={{ backgroundColor: `${team.color}22` }}
          >
            {team.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{team.name}</h1>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                {team.key}
              </span>
            </div>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
              {team.description}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center -space-x-2">
              {members.map((m) => (
                <span
                  key={m.id}
                  title={`${m.name} · ${m.role}${m.id === team.leadId ? " · Lead" : ""}`}
                  className="relative flex size-8 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-background"
                  style={{ backgroundColor: m.color }}
                >
                  {m.initials}
                  {m.id === team.leadId && (
                    <Crown className="absolute -top-1.5 -right-1 size-3.5 fill-amber-400 text-amber-500" />
                  )}
                </span>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {members.length} {members.length === 1 ? "member" : "members"}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {counts.map((c) => (
            <div
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-xs"
            >
              <span className={cn("size-2 rounded-full", c.dot)} />
              <span className="font-medium">{c.label}</span>
              <span className="tabular-nums text-muted-foreground">{c.count}</span>
            </div>
          ))}
        </div>
      </div>

      <TasksWorkspace scopeTeamId={team.id} />
    </div>
  )
}
