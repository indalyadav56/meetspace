"use client"

import Link from "next/link"
import { ArrowRight, Hash } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AssigneeGroup } from "@/components/shared/assignee-group"
import { useWorkspace } from "@/lib/store"
import type { Team } from "@/lib/types"

export function TeamCard({ team }: { team: Team }) {
  const { channelsForTeam, getUser } = useWorkspace()

  const channels = channelsForTeam(team.id)
  const general = channels.find((c) => c.name === "general") ?? channels[0]
  const href = general ? `/teams/${team.id}/${general.id}` : `/teams/${team.id}`

  const members = team.memberIds
    .map((id) => getUser(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))

  return (
    <Link href={href} className="group block">
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
                {members.length} {members.length === 1 ? "member" : "members"} ·{" "}
                {channels.length} {channels.length === 1 ? "channel" : "channels"}
              </CardDescription>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="line-clamp-2 text-sm text-muted-foreground">{team.description}</p>

          <div className="flex flex-wrap gap-1.5">
            {channels.slice(0, 4).map((channel) => (
              <span
                key={channel.id}
                className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                <Hash className="size-3" />
                {channel.name}
              </span>
            ))}
            {channels.length > 4 && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                +{channels.length - 4}
              </span>
            )}
          </div>

          <AssigneeGroup users={members} max={5} size="size-7" />
        </CardContent>
      </Card>
    </Link>
  )
}
