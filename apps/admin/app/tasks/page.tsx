import type { Metadata } from "next"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PageHeader } from "@/components/admin/page-header"
import { TasksTable } from "@/components/admin/tasks-table"
import { cn } from "@/lib/utils"
import { STATUS_MAP } from "@/lib/config"
import { taskStatusBreakdown, TASKS } from "@/lib/data"

export const metadata: Metadata = { title: "Tasks · Meetspace Admin" }

export default function TasksPage() {
  const breakdown = taskStatusBreakdown()
  const total = TASKS.length

  return (
    <>
      <PageHeader
        title="Tasks"
        description="A sample of recent work across every workspace."
      />

      <Card>
        <CardHeader>
          <CardTitle>Status breakdown</CardTitle>
          <CardDescription>
            How the {total} most recent tasks are distributed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full">
            {breakdown.map((b) => {
              const s = STATUS_MAP[b.status]
              const pct = (b.count / total) * 100
              return (
                <div
                  key={b.status}
                  className={cn(s.dot)}
                  style={{ width: `${pct}%` }}
                  title={`${s.label}: ${b.count}`}
                />
              )
            })}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {breakdown.map((b) => {
              const s = STATUS_MAP[b.status]
              return (
                <div key={b.status} className="flex items-center gap-2 text-sm">
                  <span className={cn("size-2.5 rounded-full", s.dot)} />
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-medium tabular-nums">{b.count}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <TasksTable />
    </>
  )
}
