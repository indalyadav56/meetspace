import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Tone } from "@/lib/config"

/** Renders a soft-pill badge with a leading status dot from a Tone. */
export function ToneBadge({
  tone,
  className,
  dot = true,
}: {
  tone: Tone
  className?: string
  dot?: boolean
}) {
  return (
    <Badge variant="ghost" className={cn(tone.soft, className)}>
      {dot && <span className={cn("size-1.5 rounded-full", tone.dot)} />}
      {tone.label}
    </Badge>
  )
}
