import { UserAvatar } from "@/components/shared/user-avatar"
import { cn } from "@/lib/utils"

/** Avatar + primary/secondary text, used in table rows and lists. */
export function UserCell({
  user,
  className,
}: {
  user: { name: string; email?: string; initials: string; color: string }
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <UserAvatar user={user} className="size-7 rounded-full" />
      <div className="grid leading-tight">
        <span className="truncate text-sm font-medium">{user.name}</span>
        {user.email && (
          <span className="text-muted-foreground truncate text-xs">
            {user.email}
          </span>
        )}
      </div>
    </div>
  )
}
