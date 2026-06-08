import type { Metadata } from "next"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/admin/page-header"
import { StatCard } from "@/components/admin/stat-card"
import { WorkspacesTable } from "@/components/admin/workspaces-table"
import { Building2, CircleDollarSign, Users, Clock } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import {
  activeWorkspaces,
  totalMrr,
  trialWorkspaces,
  WORKSPACES,
} from "@/lib/data"

export const metadata: Metadata = { title: "Workspaces · Meetspace Admin" }

export default function WorkspacesPage() {
  return (
    <>
      <PageHeader
        title="Workspaces"
        description="Every customer account on the platform."
      >
        <Button size="sm">
          <Plus />
          New workspace
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total workspaces"
          value={String(WORKSPACES.length)}
          icon={Building2}
        />
        <StatCard
          label="Active"
          value={String(activeWorkspaces)}
          icon={CircleDollarSign}
        />
        <StatCard label="On trial" value={String(trialWorkspaces)} icon={Clock} />
        <StatCard
          label="Total MRR"
          value={formatCurrency(totalMrr)}
          icon={Users}
        />
      </div>

      <WorkspacesTable />
    </>
  )
}
