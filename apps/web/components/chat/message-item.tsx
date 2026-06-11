"use client"

import {
  FileText,
  Image as ImageIcon,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Reply,
  Sheet as SheetIcon,
  SmilePlus,
  UserPlus,
} from "lucide-react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PresenceAvatar } from "@/components/shared/presence-avatar"
import { QUICK_REACTIONS } from "@/lib/config"
import { formatTime } from "@/lib/date"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/lib/store"
import type { Attachment, Message } from "@/lib/types"

const ATTACHMENT_ICON = {
  doc: FileText,
  pdf: FileText,
  image: ImageIcon,
  sheet: SheetIcon,
  link: Link2,
} as const

function AttachmentCard({ attachment }: { attachment: Attachment }) {
  const Icon = ATTACHMENT_ICON[attachment.kind]
  return (
    <div className="mt-1.5 inline-flex max-w-xs items-center gap-2.5 rounded-lg border bg-card px-3 py-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{attachment.name}</p>
        {attachment.meta && (
          <p className="truncate text-xs text-muted-foreground">{attachment.meta}</p>
        )}
      </div>
    </div>
  )
}

export function MessageItem({
  message,
  showAuthor,
  onOpenThread,
  inThread = false,
}: {
  message: Message
  showAuthor: boolean
  onOpenThread?: (message: Message) => void
  inThread?: boolean
}) {
  const { getUser, currentUser, toggleReaction, repliesForMessage } = useWorkspace()
  const author = getUser(message.authorId)

  if (message.system) {
    return (
      <div className="flex items-center gap-2 py-1.5 pl-13 text-xs text-muted-foreground">
        <UserPlus className="size-3.5" />
        <span>{message.body}</span>
        <span>·</span>
        <span>{formatTime(message.createdAt)}</span>
      </div>
    )
  }

  if (!author) return null

  const replies = !inThread ? repliesForMessage(message.id) : []
  const replyAuthors = [...new Set(replies.map((r) => r.authorId))]
    .map(getUser)
    .filter(Boolean)
    .slice(0, 3)

  const react = (emoji: string) => toggleReaction(message.id, emoji)

  return (
    <div
      className={cn(
        "group/msg relative flex gap-3 px-4 transition-colors hover:bg-muted/40",
        showAuthor ? "mt-3 pt-1" : "py-0.5",
      )}
    >
      {/* Avatar / hover timestamp gutter */}
      <div className="w-9 shrink-0">
        {showAuthor ? (
          <PresenceAvatar user={author} className="size-9" />
        ) : (
          <span className="mt-0.5 hidden text-[10px] leading-5 text-muted-foreground group-hover/msg:block">
            {formatTime(message.createdAt)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {showAuthor && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{author.name}</span>
            <span className="text-xs text-muted-foreground">
              {formatTime(message.createdAt)}
            </span>
          </div>
        )}

        <div className="text-sm leading-relaxed text-foreground/90">
          {message.body}
          {message.edited && (
            <span className="ml-1 text-xs text-muted-foreground">(edited)</span>
          )}
        </div>

        {message.attachments.map((a) => (
          <AttachmentCard key={a.id} attachment={a} />
        ))}

        {/* Reactions */}
        {message.reactions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {message.reactions.map((r) => {
              const mine = r.userIds.includes(currentUser.id)
              return (
                <button
                  key={r.emoji}
                  onClick={() => react(r.emoji)}
                  aria-pressed={mine}
                  aria-label={`${r.emoji}, ${r.userIds.length} ${r.userIds.length === 1 ? "reaction" : "reactions"}, ${mine ? "remove yours" : "add yours"}`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    mine
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <span>{r.emoji}</span>
                  <span className="tabular-nums">{r.userIds.length}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Reply summary */}
        {replies.length > 0 && onOpenThread && (
          <button
            onClick={() => onOpenThread(message)}
            className="mt-1.5 inline-flex items-center gap-2 rounded-md py-1 text-xs font-medium text-primary hover:underline"
          >
            <span className="flex items-center -space-x-1.5">
              {replyAuthors.map(
                (u) =>
                  u && (
                    <span
                      key={u.id}
                      className="flex size-4 items-center justify-center rounded-full text-[8px] font-semibold text-white ring-2 ring-background"
                      style={{ backgroundColor: u.color }}
                    >
                      {u.initials}
                    </span>
                  ),
              )}
            </span>
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>

      {/* Hover toolbar — revealed on hover and on keyboard focus */}
      <div className="absolute -top-3 right-3 z-10 flex items-center gap-0.5 rounded-lg border bg-popover p-0.5 opacity-0 shadow-sm transition-opacity pointer-events-none group-hover/msg:pointer-events-auto group-hover/msg:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
        {QUICK_REACTIONS.slice(0, 3).map((emoji) => (
          <button
            key={emoji}
            onClick={() => react(emoji)}
            aria-label={`React with ${emoji}`}
            className="flex size-7 items-center justify-center rounded-md text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {emoji}
          </button>
        ))}
        <Popover>
          <PopoverTrigger
            aria-label="Add reaction"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <SmilePlus className="size-4" />
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-auto gap-1 p-1">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => react(emoji)}
                aria-label={`React with ${emoji}`}
                className="flex size-8 items-center justify-center rounded-md text-base hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {emoji}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        {onOpenThread && !inThread && (
          <button
            onClick={() => onOpenThread(message)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            title="Reply in thread"
            aria-label="Reply in thread"
          >
            <Reply className="size-4" />
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Message actions"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onOpenThread && !inThread && (
              <DropdownMenuItem onSelect={() => onOpenThread(message)}>
                <MessageSquare />
                Reply in thread
              </DropdownMenuItem>
            )}
            <DropdownMenuItem>Copy link</DropdownMenuItem>
            <DropdownMenuItem>Save message</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
