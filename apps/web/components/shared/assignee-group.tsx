import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { User } from "@/lib/types"

/** Overlapping stack of assignee avatars with an overflow counter. */
export function AssigneeGroup({
  users,
  max = 3,
  size = "size-6",
  className,
}: {
  users: User[]
  max?: number
  size?: string
  className?: string
}) {
  const shown = users.slice(0, max)
  const extra = users.length - shown.length

  return (
    <div className={cn("flex items-center", className)}>
      {shown.map((user, i) => (
        <Avatar
          key={user.id}
          title={user.name}
          className={cn(
            size,
            "ring-2 ring-background",
            i > 0 && "-ml-2",
          )}
        >
          <AvatarFallback
            className="text-[10px] font-semibold text-white"
            style={{ backgroundColor: user.color }}
          >
            {user.initials}
          </AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <Avatar className={cn(size, "-ml-2 ring-2 ring-background")}>
          <AvatarFallback className="bg-muted text-[10px] font-semibold text-muted-foreground">
            +{extra}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
