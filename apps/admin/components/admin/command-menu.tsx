"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  CreditCard,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  Search,
  Settings,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { USERS, WORKSPACES } from "@/lib/data"

const PAGES = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Analytics", href: "/analytics", icon: TrendingUp },
  { title: "Workspaces", href: "/workspaces", icon: Building2 },
  { title: "Users", href: "/users", icon: Users },
  { title: "Tasks", href: "/tasks", icon: ListChecks },
  { title: "Billing", href: "/billing", icon: CreditCard },
  { title: "Feature flags", href: "/feature-flags", icon: FlaskConical },
  { title: "Security", href: "/security", icon: Shield },
  { title: "Settings", href: "/settings", icon: Settings },
]

export function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open, onOpenChange])

  const go = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, workspaces, users…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {PAGES.map((p) => (
            <CommandItem
              key={p.href}
              value={`page ${p.title}`}
              onSelect={() => go(p.href)}
            >
              <p.icon />
              {p.title}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Workspaces">
          {WORKSPACES.slice(0, 6).map((w) => (
            <CommandItem
              key={w.id}
              value={`workspace ${w.name}`}
              onSelect={() => go(`/workspaces`)}
            >
              <span className="text-sm">{w.icon}</span>
              {w.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Users">
          {USERS.slice(0, 6).map((u) => (
            <CommandItem
              key={u.id}
              value={`user ${u.name} ${u.email}`}
              onSelect={() => go(`/users`)}
            >
              <Search />
              {u.name}
              <span className="text-muted-foreground ml-auto text-xs">
                {u.email}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
