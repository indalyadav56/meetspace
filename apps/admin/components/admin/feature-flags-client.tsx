"use client"

import * as React from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { FEATURE_FLAGS } from "@/lib/mock-data"
import type { FeatureFlag } from "@/lib/types"

const GROUP_LABEL: Record<FeatureFlag["group"], string> = {
  product: "Product",
  billing: "Billing",
  experimental: "Experimental",
}

const GROUP_BADGE: Record<FeatureFlag["group"], string> = {
  product: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  billing: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  experimental: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
}

export function FeatureFlagsClient() {
  const [flags, setFlags] = React.useState<FeatureFlag[]>(FEATURE_FLAGS)

  const toggle = (id: string) =>
    setFlags((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, enabled: !f.enabled, rollout: !f.enabled ? Math.max(f.rollout, 5) : f.rollout }
          : f,
      ),
    )

  const groups = ["product", "billing", "experimental"] as const

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const items = flags.filter((f) => f.group === group)
        if (items.length === 0) return null
        return (
          <Card key={group}>
            <CardHeader>
              <CardTitle className="text-base">{GROUP_LABEL[group]}</CardTitle>
              <CardDescription>
                {items.filter((f) => f.enabled).length} of {items.length} enabled
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-border divide-y p-0">
              {items.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-4 px-6 py-4"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{f.name}</span>
                      <Badge
                        variant="ghost"
                        className={GROUP_BADGE[f.group]}
                      >
                        {GROUP_LABEL[f.group]}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {f.description}
                    </p>
                  </div>
                  <div className="hidden w-40 items-center gap-2 sm:flex">
                    <Progress
                      value={f.enabled ? f.rollout : 0}
                      className="h-1.5 flex-1"
                    />
                    <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">
                      {f.enabled ? f.rollout : 0}%
                    </span>
                  </div>
                  <Switch
                    checked={f.enabled}
                    onCheckedChange={() => toggle(f.id)}
                    aria-label={`Toggle ${f.name}`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
