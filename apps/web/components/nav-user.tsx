"use client"

import { BadgeCheck, ChevronsUpDown, LogOut, Settings, Sparkles } from "lucide-react"
import { toast } from "sonner"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { PresenceAvatar } from "@/components/shared/presence-avatar"
import { PRESENCE } from "@/lib/config"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/lib/store"
import type { Presence } from "@/lib/types"

const PRESENCE_OPTIONS: Presence[] = ["available", "busy", "dnd", "away", "offline"]

export function NavUser() {
  const { isMobile } = useSidebar()
  const { currentUser } = useWorkspace()
  const presence = PRESENCE[currentUser.presence]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent"
            >
              <PresenceAvatar user={currentUser} className="size-8 rounded-lg" />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold">{currentUser.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {currentUser.statusMessage ?? presence.label}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="flex items-center gap-2 font-normal">
              <PresenceAvatar user={currentUser} className="size-9 rounded-lg" />
              <div className="grid leading-tight">
                <span className="truncate text-sm font-semibold">
                  {currentUser.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {currentUser.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span className={cn("size-2 rounded-full", presence.dot)} />
                {presence.label}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {PRESENCE_OPTIONS.map((p) => (
                  <DropdownMenuItem
                    key={p}
                    onSelect={() => toast.success(`Status set to ${PRESENCE[p].label}`)}
                  >
                    <span className={cn("size-2 rounded-full", PRESENCE[p].dot)} />
                    {PRESENCE[p].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Sparkles />
                Upgrade plan
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BadgeCheck />
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
  )
}
