import type { Metadata } from "next"
import { Activity, TrendingUp, UserPlus, Zap } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PageHeader } from "@/components/admin/page-header"
import { StatCard } from "@/components/admin/stat-card"
import { AreaChart, BarChart } from "@/components/admin/charts"
import { formatCompact, formatNumber } from "@/lib/format"
import {
  DAU_SERIES,
  periodTrend,
  seriesTotal,
  SIGNUPS_SERIES,
  THROUGHPUT_SERIES,
  WORKSPACES,
} from "@/lib/data"

export const metadata: Metadata = { title: "Analytics · Meetspace Admin" }

const REGION_LABEL: Record<string, string> = {
  "us-east": "US East",
  "us-west": "US West",
  "eu-west": "EU West",
  "ap-south": "AP South",
}

const REGION_FILL: Record<string, string> = {
  "us-east": "#6366f1",
  "us-west": "#8b5cf6",
  "eu-west": "#0ea5e9",
  "ap-south": "#10b981",
}

export default function AnalyticsPage() {
  const dau = DAU_SERIES[DAU_SERIES.length - 1].value
  const signups = seriesTotal(SIGNUPS_SERIES)
  const completed = seriesTotal(THROUGHPUT_SERIES)
  const avgThroughput = Math.round(completed / THROUGHPUT_SERIES.length)

  const signupBars = SIGNUPS_SERIES.slice(-14).map((p) => ({
    label: p.date.slice(8),
    value: p.value,
  }))

  const regionCounts = WORKSPACES.reduce<Record<string, number>>((acc, w) => {
    acc[w.region] = (acc[w.region] ?? 0) + 1
    return acc
  }, {})
  const regionBars = Object.entries(regionCounts).map(([region, value]) => ({
    label: REGION_LABEL[region] ?? region,
    value,
    color: REGION_FILL[region] ?? "var(--primary)",
  }))

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Engagement, growth, and throughput across the platform."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Daily active users"
          value={formatCompact(dau)}
          delta={periodTrend(DAU_SERIES)}
          icon={Activity}
          spark={DAU_SERIES.map((p) => p.value)}
        />
        <StatCard
          label="Signups (30d)"
          value={formatNumber(signups)}
          delta={periodTrend(SIGNUPS_SERIES)}
          icon={UserPlus}
          spark={SIGNUPS_SERIES.map((p) => p.value)}
        />
        <StatCard
          label="Tasks / day"
          value={formatNumber(avgThroughput)}
          delta={periodTrend(THROUGHPUT_SERIES)}
          icon={Zap}
          spark={THROUGHPUT_SERIES.map((p) => p.value)}
        />
        <StatCard
          label="Trial conversion"
          value="34.2%"
          delta={4.1}
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active users</CardTitle>
            <CardDescription>Daily active users, last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <AreaChart data={DAU_SERIES} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspaces by region</CardTitle>
            <CardDescription>Where accounts are hosted</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-56 items-end pb-2">
              <BarChart data={regionBars} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New signups</CardTitle>
            <CardDescription>Daily signups, last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <BarChart data={signupBars} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Task throughput</CardTitle>
            <CardDescription>Tasks completed per day, last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <AreaChart data={THROUGHPUT_SERIES} color="var(--chart-2)" />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
