"use client"

import * as React from "react"
import { ListChecks, Search } from "lucide-react"

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
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { UserAvatar } from "@/components/shared/user-avatar"
import { cn } from "@/lib/utils"
import {
  PRIORITIES,
  PRIORITY_MAP,
  STATUS_MAP,
  STATUSES,
  tagColor,
} from "@/lib/config"
import { formatDueDate, isOverdue } from "@/lib/date"
import { getTeam, getUser, getWorkspace, TASKS } from "@/lib/data"
import type { PriorityId, StatusId } from "@/lib/types"

export function TasksTable() {
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState<StatusId | "all">("all")
  const [priority, setPriority] = React.useState<PriorityId | "all">("all")

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return TASKS.filter((t) => {
      if (status !== "all" && t.status !== status) return false
      if (priority !== "all" && t.priority !== priority) return false
      if (q && !t.title.toLowerCase().includes(q) && !t.key.toLowerCase().includes(q))
        return false
      return true
    })
  }, [query, status, priority])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as StatusId | "all")}
          >
            <SelectTrigger size="sm" className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as PriorityId | "all")}
          >
            <SelectTrigger size="sm" className="w-36">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
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
              <TableHead className="w-24">Key</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Workspace</TableHead>
              <TableHead>Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => {
              const s = STATUS_MAP[t.status]
              const p = PRIORITY_MAP[t.priority]
              const assignee = getUser(t.assigneeId)
              const team = getTeam(t.teamId)
              const ws = getWorkspace(t.workspaceId)
              const StatusIcon = s.icon
              const PriorityIcon = p.icon
              return (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {t.key}
                  </TableCell>
                  <TableCell className="max-w-sm">
                    <div className="flex flex-col gap-1">
                      <span className="truncate text-sm font-medium">
                        {t.title}
                      </span>
                      {t.tags.length > 0 && (
                        <div className="flex gap-1">
                          {t.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="ghost"
                              className={cn("h-4 px-1.5 text-[10px]", tagColor(tag))}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <StatusIcon className={cn("size-3.5", s.text)} />
                      {s.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <PriorityIcon className={cn("size-3.5", p.color)} />
                      {p.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    {assignee ? (
                      <span className="inline-flex items-center gap-2">
                        <UserAvatar user={assignee} className="size-6" />
                        <span className="text-sm">{assignee.name}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        Unassigned
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <span>{ws?.icon}</span>
                      {team?.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.dueDate ? (
                      <span
                        className={cn(
                          isOverdue(t.dueDate)
                            ? "text-red-600 dark:text-red-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatDueDate(t.dueDate)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
                <ListChecks />
              </EmptyMedia>
              <EmptyTitle>No tasks found</EmptyTitle>
              <EmptyDescription>
                Try adjusting your search or filters.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Card>

      <p className="text-muted-foreground text-xs">
        Showing {rows.length} of {TASKS.length} tasks
      </p>
    </div>
  )
}
