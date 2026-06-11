"use client"

import { FolderKanban, ChevronsUpDown, Plus, Globe } from "lucide-react"
import { toast } from "sonner"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useWorkspace } from "@/lib/store"

export function ProjectSwitcher() {
  const { isMobile } = useSidebar()
  const { teams, activeProjectId, setActiveProjectId } = useWorkspace()

  // Find active project
  const activeProject = teams.find((t) => t.id === activeProjectId)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent border border-sidebar-border/30 rounded-xl"
            >
              <div 
                className="flex aspect-square size-8 items-center justify-center rounded-lg text-white shadow-sm transition-colors bg-gradient-to-br from-indigo-500 to-violet-600"
              >
                <span className="text-xs font-bold font-mono">MS</span>
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold text-xs text-foreground">
                  Meetspace
                </span>
                <span className="truncate text-[10px] text-muted-foreground flex items-center gap-1 font-semibold">
                  {activeProject ? (
                    <>
                      <span className="text-[10px]">{activeProject.icon}</span>
                      <span>{activeProject.name}</span>
                    </>
                  ) : (
                    <>
                      <Globe className="size-3 text-primary" />
                      <span>All Projects</span>
                    </>
                  )}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Project Spaces
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {/* Option for All Projects */}
              <DropdownMenuItem 
                className="gap-2 text-xs font-semibold"
                onSelect={() => {
                  setActiveProjectId("all")
                  toast.success("Switched scope to All Projects")
                }}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <Globe className="size-3.5" />
                </div>
                All Projects
              </DropdownMenuItem>

              {teams.map((team) => (
                <DropdownMenuItem 
                  key={team.id} 
                  className="gap-2 text-xs font-semibold"
                  onSelect={() => {
                    setActiveProjectId(team.id)
                    toast.success(`Switched project scope to ${team.name}`)
                  }}
                >
                  <div 
                    className="flex size-6 items-center justify-center rounded-md text-white text-[11px]"
                    style={{ backgroundColor: team.color }}
                  >
                    {team.icon}
                  </div>
                  {team.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="gap-2 text-xs text-muted-foreground"
              onSelect={() => toast.info("Create a new project from Members page")}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-3.5" />
              </div>
              Add Project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
