"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  Calendar,
  CheckSquare,
  Hash,
  LayoutGrid,
  Lock,
  MessagesSquare,
  Users,
} from "lucide-react"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { chatDisplay, useWorkspace } from "@/lib/store"

export function CommandMenu() {
  const router = useRouter()
  const { teams, channels, chats, getTeam, currentUser, getUser } = useWorkspace()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    const onOpen = () => setOpen(true)
    document.addEventListener("keydown", onKey)
    window.addEventListener("meetspace:command", onOpen)
    return () => {
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("meetspace:command", onOpen)
    }
  }, [])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command menu"
      description="Search and jump to anywhere in meetspace"
    >
      <Command>
        <CommandInput placeholder="Search or jump to…" />
        <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem value="inbox activity" onSelect={() => go("/")}>
            <Bell />
            Inbox
          </CommandItem>
          <CommandItem value="my issues tasks" onSelect={() => go("/my-tasks")}>
            <CheckSquare />
            My Issues
          </CommandItem>
          <CommandItem value="all issues tasks board" onSelect={() => go("/tasks")}>
            <LayoutGrid />
            All Issues
          </CommandItem>
          <CommandItem value="chat messages" onSelect={() => go("/chat")}>
            <MessagesSquare />
            Chat
          </CommandItem>
          <CommandItem value="calendar meetings" onSelect={() => go("/calendar")}>
            <Calendar />
            Calendar
          </CommandItem>
          <CommandItem value="teams directory" onSelect={() => go("/teams")}>
            <Users />
            Teams
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Boards">
          {teams.map((team) => (
            <CommandItem
              key={team.id}
              value={`board ${team.name}`}
              onSelect={() => go(`/teams/${team.id}/board`)}
            >
              <LayoutGrid />
              {team.name} board
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Channels">
          {channels.map((channel) => {
            const team = getTeam(channel.teamId)
            return (
              <CommandItem
                key={channel.id}
                value={`${team?.name ?? ""} ${channel.name}`}
                onSelect={() => go(`/teams/${channel.teamId}/${channel.id}`)}
              >
                {channel.private ? <Lock /> : <Hash />}
                <span className="text-muted-foreground">{team?.name}</span>
                {channel.name}
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Direct messages">
          {chats.map((chat) => {
            const { name } = chatDisplay(chat, currentUser.id, getUser)
            return (
              <CommandItem
                key={chat.id}
                value={`chat ${name}`}
                onSelect={() => go(`/chat/${chat.id}`)}
              >
                <MessagesSquare />
                {name}
              </CommandItem>
            )
          })}
        </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
