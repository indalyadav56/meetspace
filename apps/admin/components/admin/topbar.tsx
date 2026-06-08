"use client"

import * as React from "react"
import { Bell, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { CommandMenu } from "./command-menu"
import { ACTIVITY } from "@/lib/data"
import { timeAgo } from "@/lib/date"

export function Topbar() {
  const [commandOpen, setCommandOpen] = React.useState(false)
  const unread = ACTIVITY.slice(0, 5)

  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 !h-4" />

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="text-muted-foreground bg-muted/50 hover:bg-muted flex h-9 w-full max-w-72 items-center gap-2 rounded-lg border px-3 text-sm transition-colors"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="bg-background pointer-events-none hidden h-5 items-center gap-0.5 rounded border px-1.5 font-mono text-[10px] font-medium sm:flex">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="relative"
            >
              <Bell />
              <span className="bg-destructive absolute top-2 right-2 size-1.5 rounded-full" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Recent activity</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {unread.map((a) => (
              <DropdownMenuItem
                key={a.id}
                className="flex-col items-start gap-0.5 whitespace-normal"
              >
                <span className="text-sm">{a.message}</span>
                <span className="text-muted-foreground text-xs">
                  {timeAgo(a.createdAt)}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeToggle />
      </div>

      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </header>
  )
}
