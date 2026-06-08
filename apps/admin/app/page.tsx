import Link from "next/link"
import {
  ArrowUpRight,
  CircleDollarSign,
  Download,
  ListChecks,
  UserPlus,
  Users,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/admin/page-header"
import { StatCard } from "@/components/admin/stat-card"
import { AreaChart, DonutChart } from "@/components/admin/charts"
import { ToneBadge } from "@/components/admin/tone-badge"
import { PLANS, WORKSPACE_STATUS } from "@/lib/config"
import { formatCurrency, formatCompact, formatNumber } from "@/lib/format"
import { timeAgo } from "@/lib/date"
import {
  ACTIVITY,
  DAU_SERIES,
  getUser,
  getWorkspace,
  MRR_SERIES,
  periodTrend,
  planBreakdown,
  seriesTotal,
  seriesTrend,
  SIGNUPS_SERIES,
  THROUGHPUT_SERIES,
  topWorkspaces,
} from "@/lib/data"

const ACTIVITY_DOT: Record<string, string> = {
  upgrade: "bg-emerald-500",
  signup: "bg-sky-500",
  payment: "bg-amber-500",
  invite: "bg-violet-500",
  flag: "bg-indigo-500",
  suspend: "bg-red-500",
  cancel: "bg-red-500",
  downgrade: "bg-orange-500",
}

const PLAN_FILL: Record<string, string> = {
  free: "#a1a1aa",
  pro: "#0ea5e9",
  business: "#8b5cf6",
  enterprise: "#f59e0b",
}

export default function DashboardPage() {
  const mrr = MRR_SERIES[MRR_SERIES.length - 1].value
  const mrrPrev = MRR_SERIES[MRR_SERIES.length - 2].value
  const mrrDelta = ((mrr - mrrPrev) / mrrPrev) * 100
  const dau = DAU_SERIES[DAU_SERIES.length - 1].value
  const signups = seriesTotal(SIGNUPS_SERIES)
  const completed = seriesTotal(THROUGHPUT_SERIES)

  const plans = planBreakdown().filter((p) => p.count > 0)
  const totalPlans = plans.reduce((s, p) => s + p.count, 0)
  const leaders = topWorkspaces(5)

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Platform health at a glance — last 30 days."
      >
        <Button variant="outline" size="sm">
          <Download />
          Export
        </Button>
        <Button size="sm" asChild>
          <Link href="/analytics">
            View analytics
            <ArrowUpRight />
          </Link>
        </Button>
      </PageHeader>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Monthly revenue"
          value={formatCurrency(mrr)}
          delta={mrrDelta}
          hint="vs last month"
          icon={CircleDollarSign}
          spark={MRR_SERIES.map((p) => p.value)}
        />
        <StatCard
          label="Active users"
          value={formatCompact(dau)}
          delta={periodTrend(DAU_SERIES)}
          hint="vs prior 15d"
          icon={Users}
          spark={DAU_SERIES.map((p) => p.value)}
        />
        <StatCard
          label="New signups"
          value={formatNumber(signups)}
          delta={periodTrend(SIGNUPS_SERIES)}
          hint="vs prior 15d"
          icon={UserPlus}
          spark={SIGNUPS_SERIES.map((p) => p.value)}
        />
        <StatCard
          label="Tasks completed"
          value={formatCompact(completed)}
          delta={periodTrend(THROUGHPUT_SERIES)}
          hint="vs prior 15d"
          icon={ListChecks}
          spark={THROUGHPUT_SERIES.map((p) => p.value)}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Recurring revenue</CardTitle>
                <CardDescription>
                  Monthly recurring revenue, trailing 12 months
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold tracking-tight">
                  {formatCurrency(mrr)}
                </div>
                <Badge
                  variant="ghost"
                  className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                >
                  <ArrowUpRight className="size-3" />
                  {seriesTrend(MRR_SERIES).toFixed(0)}% YTD
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <AreaChart data={MRR_SERIES} />
            </div>
            <div className="text-muted-foreground mt-3 flex justify-between text-xs">
              <span>Jul 2025</span>
              <span>Jun 2026</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan distribution</CardTitle>
            <CardDescription>Workspaces by subscription tier</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-5">
            <DonutChart
              segments={plans.map((p) => ({
                label: PLANS[p.plan].label,
                value: p.count,
                color: PLAN_FILL[p.plan],
              }))}
              centerLabel={String(totalPlans)}
              centerSub="workspaces"
            />
            <div className="grid w-full grid-cols-2 gap-2">
              {plans.map((p) => (
                <div key={p.plan} className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: PLAN_FILL[p.plan] }}
                  />
                  <span className="text-muted-foreground">
                    {PLANS[p.plan].label}
                  </span>
                  <span className="ml-auto font-medium tabular-nums">
                    {p.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top workspaces</CardTitle>
                <CardDescription>Highest revenue accounts</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/workspaces">
                  View all
                  <ArrowUpRight />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {leaders.map((w) => {
              const owner = getUser(w.ownerId)
              return (
                <div
                  key={w.id}
                  className="hover:bg-muted/50 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors"
                >
                  <span
                    className="flex size-9 items-center justify-center rounded-lg text-base"
                    style={{ backgroundColor: `${w.color}1a` }}
                  >
                    {w.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {w.name}
                      </span>
                      <ToneBadge
                        tone={PLANS[w.plan]}
                        dot={false}
                        className="h-4 px-1.5 text-[10px]"
                      />
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {owner?.name} · {w.seatsUsed} seats
                    </span>
                  </div>
                  <ToneBadge
                    tone={WORKSPACE_STATUS[w.status]}
                    className="hidden sm:inline-flex"
                  />
                  <span className="w-20 text-right text-sm font-semibold tabular-nums">
                    {formatCurrency(w.mrr, { compact: true })}
                    <span className="text-muted-foreground text-xs font-normal">
                      /mo
                    </span>
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest platform events</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="before:bg-border relative space-y-4 before:absolute before:top-1 before:bottom-1 before:left-[3px] before:w-px">
              {ACTIVITY.slice(0, 6).map((a) => {
                const ws = a.workspaceId ? getWorkspace(a.workspaceId) : null
                return (
                  <li key={a.id} className="relative flex gap-3 pl-5">
                    <span
                      className={`ring-background absolute top-1.5 left-0 size-2 rounded-full ring-4 ${ACTIVITY_DOT[a.kind] ?? "bg-zinc-400"}`}
                    />
                    <div className="space-y-0.5">
                      <p className="text-sm leading-snug">{a.message}</p>
                      <p className="text-muted-foreground text-xs">
                        {ws ? `${ws.name} · ` : ""}
                        {timeAgo(a.createdAt)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
