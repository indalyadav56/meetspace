"use client"

import { LayoutGrid, List, Plus, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PriorityFlag } from "@/components/shared/meta-badges"
import { PRIORITIES } from "@/lib/config"
import { useWorkspace } from "@/lib/store"
import type { ViewMode } from "@/lib/types"

export interface TaskFilters {
  search: string
  teamId: string
  assigneeId: string
  priority: string
}

export const EMPTY_FILTERS: TaskFilters = {
  search: "",
  teamId: "all",
  assigneeId: "all",
  priority: "all",
}

export function TaskToolbar({
  view,
  onViewChange,
  filters,
  onFiltersChange,
  onNewTask,
  showTeamFilter = true,
}: {
  view: ViewMode
  onViewChange: (v: ViewMode) => void
  filters: TaskFilters
  onFiltersChange: (f: TaskFilters) => void
  onNewTask: () => void
  showTeamFilter?: boolean
}) {
  const { teams, users } = useWorkspace()
  const set = (patch: Partial<TaskFilters>) =>
    onFiltersChange({ ...filters, ...patch })

  const hasActiveFilters =
    filters.search !== "" ||
    filters.teamId !== "all" ||
    filters.assigneeId !== "all" ||
    filters.priority !== "all"

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
      <InputGroup className="w-full max-w-56">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Search tasks…"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
        />
      </InputGroup>

      {showTeamFilter && (
        <Select value={filters.teamId} onValueChange={(v) => set({ teamId: v })}>
          <SelectTrigger className="w-auto gap-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span>{t.icon}</span>
                  {t.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}

      <Select
        value={filters.assigneeId}
        onValueChange={(v) => set({ assigneeId: v })}
      >
        <SelectTrigger className="w-auto gap-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">Anyone</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select value={filters.priority} onValueChange={(v) => set({ priority: v })}>
        <SelectTrigger className="w-auto gap-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">Any priority</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <PriorityFlag priority={p.id} />
                {p.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => onFiltersChange(EMPTY_FILTERS)}
        >
          <X />
          Clear
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && onViewChange(v as ViewMode)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="board" aria-label="Board view">
            <LayoutGrid />
            Board
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view">
            <List />
            List
          </ToggleGroupItem>
        </ToggleGroup>

        <Button size="sm" onClick={onNewTask}>
          <Plus />
          New task
        </Button>
      </div>
    </div>
  )
}
