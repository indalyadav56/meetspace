import type { Metadata } from "next"
import {
  AlertCircle,
  CircleDollarSign,
  Download,
  TrendingUp,
  Wallet,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/admin/page-header"
import { StatCard } from "@/components/admin/stat-card"
import { AreaChart } from "@/components/admin/charts"
import { ToneBadge } from "@/components/admin/tone-badge"
import { INVOICE_STATUS, PLANS } from "@/lib/config"
import { formatCurrency } from "@/lib/format"
import { formatDate } from "@/lib/date"
import {
  getWorkspace,
  INVOICES,
  MRR_SERIES,
  payingWorkspaces,
  periodTrend,
  seriesTrend,
  totalArr,
  totalMrr,
  WORKSPACES,
} from "@/lib/data"
import type { PlanId } from "@/lib/types"

const PLAN_FILL: Record<PlanId, string> = {
  free: "#a1a1aa",
  pro: "#0ea5e9",
  business: "#8b5cf6",
  enterprise: "#f59e0b",
}

export const metadata: Metadata = { title: "Billing · Meetspace Admin" }

export default function BillingPage() {
  const pastDue = INVOICES.filter((i) => i.status === "past_due").reduce(
    (s, i) => s + i.amount,
    0,
  )

  // Revenue contribution by plan.
  const planRevenue = (Object.keys(PLANS) as PlanId[])
    .map((plan) => ({
      plan,
      revenue: WORKSPACES.filter((w) => w.plan === plan).reduce(
        (s, w) => s + w.mrr,
        0,
      ),
    }))
    .filter((p) => p.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
  const maxPlanRevenue = Math.max(...planRevenue.map((p) => p.revenue), 1)

  return (
    <>
      <PageHeader
        title="Billing"
        description="Revenue, subscriptions, and invoices."
      >
        <Button variant="outline" size="sm">
          <Download />
          Export invoices
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="MRR"
          value={formatCurrency(totalMrr)}
          delta={periodTrend(MRR_SERIES)}
          icon={CircleDollarSign}
        />
        <StatCard label="ARR" value={formatCurrency(totalArr)} icon={TrendingUp} />
        <StatCard
          label="Paying accounts"
          value={String(payingWorkspaces)}
          icon={Wallet}
        />
        <StatCard
          label="Past due"
          value={formatCurrency(pastDue)}
          icon={AlertCircle}
          delta={pastDue > 0 ? -100 : 0}
          invertDelta
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue growth</CardTitle>
            <CardDescription>
              MRR up {seriesTrend(MRR_SERIES).toFixed(0)}% over the last year
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <AreaChart data={MRR_SERIES} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by plan</CardTitle>
            <CardDescription>Monthly contribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {planRevenue.map((p) => (
              <div key={p.plan} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: PLAN_FILL[p.plan] }}
                    />
                    {PLANS[p.plan].label}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(p.revenue)}
                  </span>
                </div>
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(p.revenue / maxPlanRevenue) * 100}%`,
                      backgroundColor: PLAN_FILL[p.plan],
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle>Recent invoices</CardTitle>
          <CardDescription>Latest billing activity across accounts</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Invoice</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead className="pr-6 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {INVOICES.map((inv) => {
                const ws = getWorkspace(inv.workspaceId)
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="pl-6 font-mono text-xs">
                      {inv.number}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="inline-flex items-center gap-1.5">
                        <span>{ws?.icon}</span>
                        {ws?.name ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={PLANS[inv.plan]} dot={false} />
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={INVOICE_STATUS[inv.status]} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(inv.issuedAt)}
                    </TableCell>
                    <TableCell className="pr-6 text-right text-sm font-medium tabular-nums">
                      {formatCurrency(inv.amount)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
