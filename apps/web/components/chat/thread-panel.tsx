"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { MessageItem } from "@/components/chat/message-item"
import { MessageComposer } from "@/components/chat/message-composer"
import { useWorkspace } from "@/lib/store"

export function ThreadPanel({
  rootMessageId,
  onOpenChange,
}: {
  rootMessageId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const { getMessage, repliesForMessage, sendMessage } = useWorkspace()
  const root = rootMessageId ? getMessage(rootMessageId) : undefined
  const replies = rootMessageId ? repliesForMessage(rootMessageId) : []

  return (
    <Sheet open={Boolean(rootMessageId)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-base">Thread</SheetTitle>
        </SheetHeader>

        {root && (
          <div className="flex flex-1 flex-col overflow-y-auto">
            <div className="py-2">
              <MessageItem message={root} showAuthor inThread />
            </div>
            <div className="my-1 flex items-center gap-3 px-4">
              <span className="text-xs font-medium text-muted-foreground">
                {replies.length} {replies.length === 1 ? "reply" : "replies"}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-col py-1">
              {replies.map((reply) => (
                <MessageItem key={reply.id} message={reply} showAuthor inThread />
              ))}
            </div>
          </div>
        )}

        {root && (
          <div className="border-t pt-2">
            <MessageComposer
              placeholder="Reply…"
              autoFocus
              onSend={(body) => sendMessage(root.conversationId, body, root.id)}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
