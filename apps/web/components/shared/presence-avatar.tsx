import { Minus } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { PRESENCE } from "@/lib/config"
import type { User } from "@/lib/types"

/** Avatar with a Microsoft Teams style presence dot in the corner. */
export function PresenceAvatar({
  user,
  className,
  dotClassName,
  showPresence = true,
}: {
  user: User
  className?: string
  dotClassName?: string
  showPresence?: boolean
}) {
  const presence = PRESENCE[user.presence]
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar className={cn("size-8", className)}>
        <AvatarFallback
          className="text-[11px] font-semibold text-white"
          style={{ backgroundColor: user.color }}
        >
          {user.initials}
        </AvatarFallback>
      </Avatar>
      {showPresence && (
        <span
          title={presence.label}
          className={cn(
            "absolute -right-0.5 -bottom-0.5 flex size-3 items-center justify-center rounded-full ring-2 ring-background",
            presence.dot,
            dotClassName,
          )}
        >
          {user.presence === "dnd" && (
            <Minus className="size-2 text-white" strokeWidth={4} />
          )}
        </span>
      )}
    </span>
  )
}
