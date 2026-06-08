import type { Metadata } from "next"
import { ShieldCheck, UserPlus, Users, UserX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/admin/page-header"
import { StatCard } from "@/components/admin/stat-card"
import { UsersTable } from "@/components/admin/users-table"
import { activeUsers, totalUsers, USERS } from "@/lib/data"

export const metadata: Metadata = { title: "Users · Meetspace Admin" }

export default function UsersPage() {
  const suspended = USERS.filter((u) => u.status === "suspended").length
  const mfa = USERS.filter((u) => u.mfa).length
  const mfaPct = Math.round((mfa / USERS.length) * 100)

  return (
    <>
      <PageHeader
        title="Users"
        description="People across every workspace on the platform."
      >
        <Button variant="outline" size="sm">
          Export CSV
        </Button>
        <Button size="sm">
          <UserPlus />
          Invite user
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total users" value={String(totalUsers)} icon={Users} />
        <StatCard label="Active" value={String(activeUsers)} icon={Users} />
        <StatCard label="Suspended" value={String(suspended)} icon={UserX} />
        <StatCard
          label="2FA enabled"
          value={`${mfaPct}%`}
          icon={ShieldCheck}
        />
      </div>

      <UsersTable />
    </>
  )
}
