"use client"

import * as React from "react"
import { Phone, UserPlus, Video } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { PresenceAvatar } from "@/components/shared/presence-avatar"
import { PRESENCE } from "@/lib/config"
import { cn } from "@/lib/utils"
import type { User } from "@/lib/types"

export function ConversationHeader({
  leading,
  title,
  subtitle,
  members = [],
  tabs,
}: {
  leading?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  members?: User[]
  tabs?: React.ReactNode
}) {
  return (
    <div className="shrink-0 border-b">
      <div className="flex items-center gap-3 px-4 py-2.5">
        {leading}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight">{title}</div>
          {subtitle && (
            <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
          )}
        </div>

        {members.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                aria-label="View members"
                className="flex items-center rounded-full p-0.5 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="flex items-center -space-x-2">
                  {members.slice(0, 4).map((m) => (
                    <PresenceAvatar
                      key={m.id}
                      user={m}
                      showPresence={false}
                      className="size-7 ring-2 ring-background"
                    />
                  ))}
                </span>
                {members.length > 4 && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    +{members.length - 4}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-1">
              <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {members.length} members
              </p>
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5">
                  <PresenceAvatar user={m} className="size-7" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.statusMessage ?? PRESENCE[m.presence].label}
                    </p>
                  </div>
                </div>
              ))}
            </PopoverContent>
          </Popover>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Start a call"
            onClick={() => toast.info("Calling…")}
          >
            <Phone />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.success("Meeting started")}
          >
            <Video />
            Meet
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Add people"
            onClick={() => toast.info("Add people")}
          >
            <UserPlus />
          </Button>
        </div>
      </div>

      {tabs && <div className="flex items-center gap-1 px-3">{tabs}</div>}
    </div>
  )
}

export function ChannelTabs({ active = "Posts" }: { active?: string }) {
  const tabs = ["Posts", "Files", "Notes"]
  return (
    <>
      {tabs.map((tab) => {
        const isActive = tab === active
        return (
          <button
            key={tab}
            disabled={!isActive}
            title={isActive ? undefined : "Coming soon"}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground/60 cursor-not-allowed",
            )}
          >
            {tab}
          </button>
        )
      })}
    </>
  )
}
