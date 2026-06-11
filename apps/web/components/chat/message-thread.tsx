"use client"

import * as React from "react"
import { MessageItem } from "@/components/chat/message-item"
import { dayKey, dayLabel } from "@/lib/date"
import { useWorkspace } from "@/lib/store"
import type { Message } from "@/lib/types"

const GROUP_GAP_MS = 5 * 60 * 1000

type Row =
  | { type: "divider"; key: string; label: string }
  | { type: "message"; key: string; message: Message; showAuthor: boolean }

function buildRows(messages: Message[]): Row[] {
  const rows: Row[] = []
  let lastDay: string | null = null
  let prev: Message | null = null

  for (const message of messages) {
    const day = dayKey(message.createdAt)
    if (day !== lastDay) {
      rows.push({ type: "divider", key: `d-${day}`, label: dayLabel(message.createdAt) })
      lastDay = day
      prev = null
    }
    const gap = prev
      ? new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime()
      : Infinity
    const showAuthor =
      !prev ||
      prev.authorId !== message.authorId ||
      prev.system ||
      message.system ||
      gap > GROUP_GAP_MS
    rows.push({ type: "message", key: message.id, message, showAuthor })
    prev = message
  }
  return rows
}

export function MessageThread({
  conversationId,
  onOpenThread,
  intro,
}: {
  conversationId: string
  onOpenThread?: (message: Message) => void
  intro?: React.ReactNode
}) {
  const { messagesForConversation } = useWorkspace()
  const messages = messagesForConversation(conversationId)
  const bottomRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [conversationId, messages.length])

  const rows = buildRows(messages)

  return (
    <div className="flex flex-1 flex-col overflow-y-auto py-2">
      {intro}
      {rows.map((row) =>
        row.type === "divider" ? (
          <div key={row.key} className="my-3 flex items-center gap-3 px-4">
            <div className="h-px flex-1 bg-border" />
            <span className="rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {row.label}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
        ) : (
          <MessageItem
            key={row.key}
            message={row.message}
            showAuthor={row.showAuthor}
            onOpenThread={onOpenThread}
          />
        ),
      )}
      <div ref={bottomRef} className="h-2" />
    </div>
  )
}
