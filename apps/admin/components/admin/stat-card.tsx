import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatPercent } from "@/lib/format"
import { Sparkline } from "./charts"

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  spark,
  hint,
  invertDelta = false,
}: {
  label: string
  value: string
  /** Percent change; sign drives the arrow + color. */
  delta?: number
  icon: LucideIcon
  spark?: number[]
  hint?: string
  /** When true, a negative delta is "good" (e.g. churn). */
  invertDelta?: boolean
}) {
  const up = (delta ?? 0) >= 0
  const good = invertDelta ? !up : up
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm font-medium">
            {label}
          </span>
          <span className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg">
            <Icon className="size-4" />
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              {value}
            </div>
            {delta !== undefined && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                )}
              >
                {up ? (
                  <ArrowUpRight className="size-3.5" />
                ) : (
                  <ArrowDownRight className="size-3.5" />
                )}
                {formatPercent(delta)}
                {hint && (
                  <span className="text-muted-foreground font-normal">
                    {hint}
                  </span>
                )}
              </div>
            )}
          </div>
          {spark && (
            <div className="w-24 shrink-0">
              <Sparkline
                data={spark}
                color={
                  good ? "var(--primary)" : "var(--destructive)"
                }
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
