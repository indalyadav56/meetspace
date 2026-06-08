import * as React from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

export function PageHeader({
  children,
  actions,
  className,
}: {
  children: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-sm",
        className,
      )}
    >
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />
      {children}
      <div className="ml-auto flex items-center gap-1">
        {actions}
        <ThemeToggle />
      </div>
    </header>
  )
}
