"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  ChevronsUpDown,
  CreditCard,
  FlaskConical,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogOut,
  Settings,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
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
import { ADMIN_USER } from "@/lib/mock-data"
import {
  activeWorkspaces,
  totalUsers,
  WORKSPACES,
} from "@/lib/data"

const OVERVIEW = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, exact: true },
  { title: "Analytics", href: "/analytics", icon: TrendingUp },
]

const MANAGE = [
  { title: "Workspaces", href: "/workspaces", icon: Building2, badge: WORKSPACES.length },
  { title: "Users", href: "/users", icon: Users, badge: totalUsers },
  { title: "Tasks", href: "/tasks", icon: ListChecks },
  { title: "Billing", href: "/billing", icon: CreditCard },
]

const SYSTEM = [
  { title: "Feature flags", href: "/feature-flags", icon: FlaskConical },
  { title: "Security", href: "/security", icon: Shield },
  { title: "Settings", href: "/settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  const renderItems = (
    items: { title: string; href: string; icon: typeof Users; exact?: boolean; badge?: number }[],
  ) =>
    items.map((item) => (
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
        {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
      </SidebarMenuItem>
    ))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                  <Shield className="size-4.5" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">Meetspace</span>
                  <span className="text-muted-foreground truncate text-xs">
                    Admin console
                  </span>
                </div>
                <ChevronsUpDown className="text-muted-foreground ml-auto size-4" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(OVERVIEW)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(MANAGE)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(SYSTEM)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Status: all systems operational"
              className="text-muted-foreground"
            >
              <span className="relative flex size-2 items-center justify-center">
                <span className="absolute size-2 animate-ping rounded-full bg-emerald-500/60" />
                <span className="size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs">
                {activeWorkspaces} workspaces active
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent"
                >
                  <UserAvatar user={ADMIN_USER} className="size-8 rounded-lg" />
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-semibold">
                      {ADMIN_USER.name}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {ADMIN_USER.email}
                    </span>
                  </div>
                  <ChevronsUpDown className="text-muted-foreground ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-2 font-normal">
                  <UserAvatar user={ADMIN_USER} className="size-8 rounded-lg" />
                  <div className="grid leading-tight">
                    <span className="truncate text-sm font-semibold">
                      {ADMIN_USER.name}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {ADMIN_USER.role}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <Settings />
                    Account settings
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <LifeBuoy />
                    Support
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
  )
}
