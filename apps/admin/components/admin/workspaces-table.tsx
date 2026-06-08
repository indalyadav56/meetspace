"use client"

import * as React from "react"
import {
  Building2,
  CreditCard,
  ExternalLink,
  MoreHorizontal,
  Search,
  Ban,
  Settings2,
} from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ToneBadge } from "@/components/admin/tone-badge"
import { PLANS, WORKSPACE_STATUS } from "@/lib/config"
import { formatCurrency } from "@/lib/format"
import { formatDate } from "@/lib/date"
import { getUser, WORKSPACES } from "@/lib/data"
import type { PlanId, WorkspaceStatus } from "@/lib/types"

export function WorkspacesTable() {
  const [query, setQuery] = React.useState("")
  const [plan, setPlan] = React.useState<PlanId | "all">("all")
  const [status, setStatus] = React.useState<WorkspaceStatus | "all">("all")

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return WORKSPACES.filter((w) => {
      if (plan !== "all" && w.plan !== plan) return false
      if (status !== "all" && w.status !== status) return false
      if (q && !w.name.toLowerCase().includes(q) && !w.slug.includes(q))
        return false
      return true
    })
  }, [query, plan, status])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspaces…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Select value={plan} onValueChange={(v) => setPlan(v as PlanId | "all")}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              {(Object.keys(PLANS) as PlanId[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PLANS[p].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as WorkspaceStatus | "all")}
          >
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(WORKSPACE_STATUS) as WorkspaceStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {WORKSPACE_STATUS[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>Workspace</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40">Seats</TableHead>
              <TableHead className="text-right">MRR</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((w) => {
              const owner = getUser(w.ownerId)
              const pct = Math.round((w.seatsUsed / w.seatsTotal) * 100)
              return (
                <TableRow key={w.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex size-8 items-center justify-center rounded-lg text-sm"
                        style={{ backgroundColor: `${w.color}1a` }}
                      >
                        {w.icon}
                      </span>
                      <div className="grid leading-tight">
                        <span className="text-sm font-medium">{w.name}</span>
                        <span className="text-muted-foreground text-xs">
                          meetspace.app/{w.slug}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ToneBadge tone={PLANS[w.plan]} />
                  </TableCell>
                  <TableCell>
                    <ToneBadge tone={WORKSPACE_STATUS[w.status]} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="h-1.5 w-16" />
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {w.seatsUsed}/{w.seatsTotal}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    {w.mrr > 0 ? formatCurrency(w.mrr) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {owner?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {w.region}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(w.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <ExternalLink />
                          Open workspace
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <CreditCard />
                          Manage billing
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Settings2 />
                          Edit settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive">
                          <Ban />
                          Suspend
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {rows.length === 0 && (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2 />
              </EmptyMedia>
              <EmptyTitle>No workspaces found</EmptyTitle>
              <EmptyDescription>
                Try adjusting your search or filters.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Card>

      <p className="text-muted-foreground text-xs">
        Showing {rows.length} of {WORKSPACES.length} workspaces
      </p>
    </div>
  )
}
