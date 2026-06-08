import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export function UserAvatar({
  user,
  className,
}: {
  user: { initials: string; color: string }
  className?: string
}) {
  return (
    <Avatar className={cn("size-6", className)}>
      <AvatarFallback
        className="text-[10px] font-semibold text-white"
        style={{ backgroundColor: user.color }}
      >
        {user.initials}
      </AvatarFallback>
    </Avatar>
  )
}
