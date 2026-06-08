"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AssigneeGroup } from "@/components/shared/assignee-group"
import { useWorkspace } from "@/lib/store"
import type { Team } from "@/lib/types"

export function TeamCard({ team }: { team: Team }) {
  const { tasks, getUser } = useWorkspace()

  const teamTasks = tasks.filter((t) => t.teamId === team.id)
  const done = teamTasks.filter((t) => t.status === "done").length
  const total = teamTasks.length
  const open = total - done
  const pct = total ? Math.round((done / total) * 100) : 0

  const members = team.memberIds
    .map((id) => getUser(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))

  return (
    <Link href={`/teams/${team.id}`} className="group block">
      <Card className="relative gap-4 overflow-hidden pt-0 transition-all hover:border-foreground/15 hover:shadow-md">
        <div className="h-1.5 w-full" style={{ backgroundColor: team.color }} />
        <CardHeader className="pt-1">
          <div className="flex items-center gap-3">
            <span
              className="flex size-10 items-center justify-center rounded-xl text-xl"
              style={{ backgroundColor: `${team.color}22` }}
            >
              {team.icon}
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center gap-2">
                {team.name}
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                  {team.key}
                </span>
              </CardTitle>
              <CardDescription className="line-clamp-1">
                {members.length} {members.length === 1 ? "member" : "members"}
              </CardDescription>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {team.description}
          </p>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="size-3.5" />
                {done} of {total} done
              </span>
              <span>{open} open</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>

          <div className="flex items-center justify-between">
            <AssigneeGroup users={members} max={5} size="size-7" />
            <span className="text-xs font-medium text-muted-foreground">
              {pct}%
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
