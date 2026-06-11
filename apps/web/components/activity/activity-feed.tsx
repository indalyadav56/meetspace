"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AtSign, Bell, CheckCheck, MessageSquare, Reply, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { PresenceAvatar } from "@/components/shared/presence-avatar"
import { timeAgo } from "@/lib/date"
import { cn } from "@/lib/utils"
import { chatDisplay, useWorkspace } from "@/lib/store"
import type { ActivityItem, ActivityKind } from "@/lib/types"

const KIND_META: Record<ActivityKind, { icon: React.ElementType; verb: string }> = {
  mention: { icon: AtSign, verb: "mentioned you" },
  reply: { icon: Reply, verb: "replied in a thread" },
  reaction: { icon: MessageSquare, verb: "reacted to your message" },
  added: { icon: UserPlus, verb: "added you" },
  message: { icon: MessageSquare, verb: "messaged you" },
}

type Filter = "all" | "unread" | "mention"

export function ActivityFeed() {
  const router = useRouter()
  const {
    activity,
    getUser,
    getTeam,
    getChannel,
    getChat,
    currentUser,
    markActivityRead,
    markAllActivityRead,
  } = useWorkspace()
  const [filter, setFilter] = React.useState<Filter>("all")

  const items = activity
    .filter((a) => (filter === "unread" ? !a.read : filter === "mention" ? a.kind === "mention" : true))
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const targetFor = (item: ActivityItem) => {
    if (item.chatId) return `/chat/${item.chatId}`
    if (item.teamId && item.channelId) return `/teams/${item.teamId}/${item.channelId}`
    return "/"
  }

  const contextLabel = (item: ActivityItem) => {
    if (item.chatId) {
      const chat = getChat(item.chatId)
      if (chat) return chatDisplay(chat, currentUser.id, getUser).name
    }
    if (item.teamId && item.channelId) {
      const team = getTeam(item.teamId)
      const channel = getChannel(item.channelId)
      if (team && channel) return `${team.name} › #${channel.name}`
    }
    return ""
  }

  const open = (item: ActivityItem) => {
    markActivityRead(item.id)
    router.push(targetFor(item))
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v as Filter)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="unread">Unread</ToggleGroupItem>
          <ToggleGroupItem value="mention">Mentions</ToggleGroupItem>
        </ToggleGroup>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={markAllActivityRead}
        >
          <CheckCheck />
          Mark all read
        </Button>
      </div>

      {items.length === 0 ? (
        <Empty className="py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Bell />
            </EmptyMedia>
            <EmptyTitle>You&apos;re all caught up</EmptyTitle>
            <EmptyDescription>Nothing new to see here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          {items.map((item, i) => {
            const actor = getUser(item.actorId)
            if (!actor) return null
            const meta = KIND_META[item.kind]
            const Icon = meta.icon
            return (
              <button
                key={item.id}
                onClick={() => open(item)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                  i > 0 && "border-t",
                  !item.read && "bg-primary/[0.04]",
                )}
              >
                <div className="relative">
                  <PresenceAvatar user={actor} showPresence={false} className="size-9" />
                  <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-background">
                    <Icon className="size-3 text-muted-foreground" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{actor.name}</span>{" "}
                    <span className="text-muted-foreground">
                      {meta.verb}
                      {item.emoji ? ` ${item.emoji}` : ""}
                    </span>
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{item.preview}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{contextLabel(item)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
                  {!item.read && <span className="size-2 rounded-full bg-primary" />}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
