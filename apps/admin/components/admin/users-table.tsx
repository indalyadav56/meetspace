"use client"

import * as React from "react"
import {
  Ban,
  KeyRound,
  Mail,
  MoreHorizontal,
  Search,
  ShieldCheck,
  UserX,
  Users as UsersIcon,
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
import { Badge } from "@/components/ui/badge"
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { UserCell } from "@/components/admin/user-cell"
import { ToneBadge } from "@/components/admin/tone-badge"
import { USER_STATUS } from "@/lib/config"
import { timeAgo } from "@/lib/date"
import { getWorkspace, USERS } from "@/lib/data"
import type { UserStatus } from "@/lib/types"

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
}

export function UsersTable() {
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState<UserStatus | "all">("all")
  const [role, setRole] = React.useState<string>("all")

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return USERS.filter((u) => {
      if (status !== "all" && u.status !== status) return false
      if (role !== "all" && u.platformRole !== role) return false
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q))
        return false
      return true
    })
  }, [query, status, role])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as UserStatus | "all")}
          >
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(USER_STATUS) as UserStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {USER_STATUS[s].label}
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
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Workspace</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>2FA</TableHead>
              <TableHead className="text-right">Tasks</TableHead>
              <TableHead>Last active</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => {
              const ws = getWorkspace(u.workspaceId)
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <UserCell user={u} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={u.platformRole === "owner" ? "secondary" : "outline"}
                      className="font-normal"
                    >
                      {ROLE_LABEL[u.platformRole]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <span>{ws?.icon}</span>
                      {ws?.name ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ToneBadge tone={USER_STATUS[u.status]} />
                  </TableCell>
                  <TableCell>
                    {u.mfa ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="size-3.5" />
                        On
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Off</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {u.taskCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {timeAgo(u.lastActiveAt)}
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
                          <Mail />
                          Email user
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <KeyRound />
                          Reset password
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive">
                          {u.status === "suspended" ? <UserX /> : <Ban />}
                          {u.status === "suspended" ? "Reactivate" : "Suspend"}
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
                <UsersIcon />
              </EmptyMedia>
              <EmptyTitle>No users found</EmptyTitle>
              <EmptyDescription>
                Try adjusting your search or filters.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Card>

      <p className="text-muted-foreground text-xs">
        Showing {rows.length} of {USERS.length} users
      </p>
    </div>
  )
}
