"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Boxes,
  CheckSquare,
  ChevronsUpDown,
  Home,
  LogOut,
  Plus,
  Settings,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserAvatar } from "@/components/shared/user-avatar"
import { CreateTeamDialog } from "@/components/teams/create-team-dialog"
import { useWorkspace } from "@/lib/store"

const NAV = [
  { title: "Home", href: "/", icon: Home, exact: true },
  { title: "My Tasks", href: "/my-tasks", icon: CheckSquare },
  { title: "Tasks", href: "/tasks", icon: Boxes },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { teams, tasks, currentUser } = useWorkspace()
  const [createTeamOpen, setCreateTeamOpen] = React.useState(false)

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  const openTasks = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const t of tasks) {
      if (t.status === "done") continue
      map.set(t.teamId, (map.get(t.teamId) ?? 0) + 1)
    }
    return map
  }, [tasks])

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent"
                asChild
              >
                <Link href="/">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                    <Boxes className="size-4.5" />
                  </div>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-semibold">Meetspace</span>
                    <span className="truncate text-xs text-muted-foreground">
                      Free plan
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href, item.exact)}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Teams</SidebarGroupLabel>
            <SidebarGroupAction
              title="New team"
              onClick={() => setCreateTeamOpen(true)}
            >
              <Plus /> <span className="sr-only">New team</span>
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {teams.map((team) => {
                  const count = openTasks.get(team.id) ?? 0
                  return (
                    <SidebarMenuItem key={team.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(`/teams/${team.id}`)}
                        tooltip={team.name}
                      >
                        <Link href={`/teams/${team.id}`}>
                          <span
                            className="flex size-5 items-center justify-center rounded-md text-[11px]"
                            style={{ backgroundColor: `${team.color}22` }}
                          >
                            {team.icon}
                          </span>
                          <span>{team.name}</span>
                        </Link>
                      </SidebarMenuButton>
                      {count > 0 && <SidebarMenuBadge>{count}</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  )
                })}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/teams"}
                    tooltip="Browse all teams"
                    className="text-muted-foreground"
                  >
                    <Link href="/teams">
                      <Users />
                      <span>Browse all teams</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent"
                  >
                    <UserAvatar user={currentUser} className="size-8 rounded-lg" />
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate font-semibold">
                        {currentUser.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {currentUser.email}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="right"
                  align="end"
                  className="w-56"
                >
                  <DropdownMenuLabel className="flex items-center gap-2 font-normal">
                    <UserAvatar user={currentUser} className="size-8 rounded-lg" />
                    <div className="grid leading-tight">
                      <span className="truncate text-sm font-semibold">
                        {currentUser.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {currentUser.role}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem>
                      <Sparkles />
                      Upgrade plan
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <UserRound />
                      Account
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Settings />
                      Settings
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <LogOut />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <CreateTeamDialog open={createTeamOpen} onOpenChange={setCreateTeamOpen} />
    </>
  )
}
