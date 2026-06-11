"use client"

import Link from "next/link"
import { SquareKanban } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { TasksWorkspace } from "@/components/tasks/tasks-workspace"
import { useWorkspace } from "@/lib/store"

export function TeamBoardView({ teamId }: { teamId: string }) {
  const { getTeam } = useWorkspace()
  const team = getTeam(teamId)

  if (!team) {
    return (
      <div className="flex h-svh flex-col">
        <PageHeader>
          <h1 className="text-sm font-semibold">Board</h1>
        </PageHeader>
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SquareKanban />
            </EmptyMedia>
            <EmptyTitle>Team not found</EmptyTitle>
            <EmptyDescription>This board may have been removed.</EmptyDescription>
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

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <PageHeader>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/teams/${team.id}`} className="flex items-center gap-1.5">
                  <span>{team.icon}</span>
                  {team.name}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="flex items-center gap-1.5">
                <SquareKanban className="size-3.5" />
                Board
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>

      <TasksWorkspace scopeTeamId={teamId} />
    </div>
  )
}
