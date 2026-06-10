"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Calendar,
  Home,
  MessagesSquare,
  Search,
  SquareKanban,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { ProjectSwitcher } from "@/components/project-switcher"
import { NavUser } from "@/components/nav-user"

const NAV = [
  { title: "Home", href: "/", icon: Home, exact: true },
  { title: "Tasks", href: "/tasks", icon: SquareKanban },
  { title: "Chat", href: "/chat", icon: MessagesSquare },
  { title: "Calendar", href: "/calendar", icon: Calendar },
]

function openCommandMenu() {
  window.dispatchEvent(new CustomEvent("meetspace:command"))
}

export function AppSidebar() {
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  return (
    <Sidebar collapsible="icon" className="bg-sidebar/85 backdrop-blur-lg border-r border-sidebar-border/35 custom-scrollbar">
      <SidebarHeader className="gap-2">
        <ProjectSwitcher />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Search Item */}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={openCommandMenu} tooltip="Search">
                  <Search />
                  <span>Search</span>
                  <kbd className="ml-auto hidden items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden sm:flex">
                    ⌘K
                  </kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Main Apps Navigation */}
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
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
