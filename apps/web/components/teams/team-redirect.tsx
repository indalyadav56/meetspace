"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Users } from "lucide-react"

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { useWorkspace } from "@/lib/store"

/** A team has no page of its own — send the viewer to its board (the team home). */
export function TeamRedirect({ teamId }: { teamId: string }) {
  const router = useRouter()
  const { getTeam } = useWorkspace()
  const team = getTeam(teamId)

  React.useEffect(() => {
    if (team) router.replace(`/teams/${teamId}/board`)
  }, [router, teamId, team])

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

  return (
    <div className="flex h-svh items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  )
}
