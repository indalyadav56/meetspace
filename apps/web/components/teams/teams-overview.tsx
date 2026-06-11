"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TeamCard } from "@/components/teams/team-card"
import { CreateTeamDialog } from "@/components/teams/create-team-dialog"
import { useWorkspace } from "@/lib/store"

export function TeamsOverview() {
  const { teams, channels, users } = useWorkspace()
  const [createOpen, setCreateOpen] = React.useState(false)

  const stats = [
    { label: "Teams", value: teams.length },
    { label: "Channels", value: channels.length },
    { label: "People", value: users.length },
  ]

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Teams you belong to and the channels inside them.
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Create team
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>

      <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
