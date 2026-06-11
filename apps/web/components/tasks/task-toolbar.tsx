"use client"

import * as React from "react"
import { 
  LayoutGrid, 
  List, 
  Plus, 
  Search, 
  X, 
  SlidersHorizontal,
  FolderKanban,
  User,
  AlertCircle,
  ArrowUpDown,
  Group,
  History
} from "lucide-react"

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
  tab: "all" | "my" | "backlog" | "closed"
  groupBy: "status" | "priority"
  sortBy: "priority" | "dueDate" | "created"
}

export const EMPTY_FILTERS: TaskFilters = {
  search: "",
  teamId: "all",
  assigneeId: "all",
  priority: "all",
  tab: "all",
  groupBy: "status",
  sortBy: "priority",
}

export function TaskToolbar({
  view,
  onViewChange,
  filters,
  onFiltersChange,
  onNewTask,
  showTeamFilter = true,
}: {
  view: ViewMode | "timeline"
  onViewChange: (v: ViewMode | "timeline") => void
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
    filters.priority !== "all" ||
    filters.tab !== "all"

  return (
    <div className="flex flex-col border-b bg-background/50 backdrop-blur-md">
      
      {/* 🚀 QUICK LINEAR/JIRA STYLE TABS */}
      <div className="flex items-center justify-between px-6 py-2 border-b">
        <div className="flex gap-1.5">
          {[
            { id: "all", label: "All Issues" },
            { id: "my", label: "My Issues" },
            { id: "backlog", label: "Backlog" },
            { id: "closed", label: "Done" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => set({ tab: tab.id as any })}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                filters.tab === tab.id
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Button size="sm" onClick={onNewTask} className="h-8 gap-1.5 shadow-sm">
          <Plus className="size-3.5" />
          Create Task
        </Button>
      </div>

      {/* ⚙️ ADVANCED FILTER CONTROLS */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3">
        {/* Search */}
        <InputGroup className="w-full max-w-52">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Filter issues..."
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            className="h-8.5 text-xs"
          />
        </InputGroup>

        {/* Team filter */}
        {showTeamFilter && (
          <Select value={filters.teamId} onValueChange={(v) => set({ teamId: v })}>
            <SelectTrigger className="h-8.5 text-xs gap-1.5 w-auto">
              <FolderKanban className="size-3.5 text-muted-foreground" />
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All Projects</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span>{t.icon}</span> {t.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}

        {/* Assignee filter */}
        <Select value={filters.assigneeId} onValueChange={(v) => set({ assigneeId: v })}>
          <SelectTrigger className="h-8.5 text-xs gap-1.5 w-auto">
            <User className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="Assignee" />
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

        {/* Priority filter */}
        <Select value={filters.priority} onValueChange={(v) => set({ priority: v })}>
          <SelectTrigger className="h-8.5 text-xs gap-1.5 w-auto">
            <AlertCircle className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">Any Priority</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-1.5">
                    <PriorityFlag priority={p.id} />
                    <span>{p.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <div className="h-5 w-px bg-muted mx-1" />

        {/* Group By */}
        <Select value={filters.groupBy} onValueChange={(v) => set({ groupBy: v as any })}>
          <SelectTrigger className="h-8.5 text-xs gap-1.5 w-auto">
            <Group className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="Group by" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="status">Group by Status</SelectItem>
              <SelectItem value="priority">Group by Priority</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Sort By */}
        <Select value={filters.sortBy} onValueChange={(v) => set({ sortBy: v as any })}>
          <SelectTrigger className="h-8.5 text-xs gap-1.5 w-auto">
            <ArrowUpDown className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="priority">Sort by Priority</SelectItem>
              <SelectItem value="dueDate">Sort by Due Date</SelectItem>
              <SelectItem value="created">Sort by Date Created</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground hover:text-foreground h-8 text-[11px]"
            onClick={() => onFiltersChange(EMPTY_FILTERS)}
          >
            <X className="size-3" />
            Reset
          </Button>
        )}

        {/* Layout Toggle */}
        <div className="ml-auto flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && onViewChange(v as any)}
            variant="outline"
            size="sm"
            className="h-8.5"
          >
            <ToggleGroupItem value="board" className="text-xs py-1 px-2.5 gap-1" aria-label="Board view">
              <LayoutGrid className="size-3.5" />
              Board
            </ToggleGroupItem>
            <ToggleGroupItem value="list" className="text-xs py-1 px-2.5 gap-1" aria-label="List view">
              <List className="size-3.5" />
              List
            </ToggleGroupItem>
            <ToggleGroupItem value="timeline" className="text-xs py-1 px-2.5 gap-1" aria-label="Timeline view">
              <History className="size-3.5" />
              Gantt
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
    </div>
  )
}
