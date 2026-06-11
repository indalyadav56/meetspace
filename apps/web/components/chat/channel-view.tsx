"use client"

import * as React from "react"
import Link from "next/link"
import { Hash, Lock } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { PageHeader } from "@/components/page-header"
import {
  ChannelTabs,
  ConversationHeader,
} from "@/components/chat/conversation-header"
import { MessageThread } from "@/components/chat/message-thread"
import { MessageComposer } from "@/components/chat/message-composer"
import { ThreadPanel } from "@/components/chat/thread-panel"
import { useWorkspace } from "@/lib/store"
import type { Message } from "@/lib/types"

export function ChannelView({
  teamId,
  channelId,
}: {
  teamId: string
  channelId: string
}) {
  const { getTeam, getChannel, getUser, sendMessage } = useWorkspace()
  const team = getTeam(teamId)
  const channel = getChannel(channelId)
  const [threadRoot, setThreadRoot] = React.useState<string | null>(null)

  if (!team || !channel || channel.teamId !== teamId) {
    return (
      <div className="flex h-svh flex-col">
        <PageHeader>
          <h1 className="text-sm font-semibold">Channel</h1>
        </PageHeader>
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Hash />
            </EmptyMedia>
            <EmptyTitle>Channel not found</EmptyTitle>
            <EmptyDescription>This channel may have been moved or removed.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const members = team.memberIds
    .map((id) => getUser(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))

  const openThread = (message: Message) => setThreadRoot(message.id)

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <PageHeader>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/teams/${team.id}/board`}>{team.name}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="flex items-center gap-1">
                {channel.private ? <Lock className="size-3.5" /> : <Hash className="size-3.5" />}
                {channel.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>

      <ConversationHeader
        leading={
          <span
            className="flex size-9 items-center justify-center rounded-lg text-base"
            style={{ backgroundColor: `${team.color}22` }}
          >
            {channel.private ? <Lock className="size-4" /> : <Hash className="size-4" />}
          </span>
        }
        title={channel.name}
        subtitle={channel.description}
        members={members}
        tabs={<ChannelTabs active="Posts" />}
      />

      <MessageThread
        conversationId={channel.id}
        onOpenThread={openThread}
        intro={
          <div className="px-4 pt-6 pb-2">
            <span
              className="mb-3 flex size-12 items-center justify-center rounded-xl text-xl"
              style={{ backgroundColor: `${team.color}22` }}
            >
              {channel.private ? <Lock className="size-5" /> : <Hash className="size-5" />}
            </span>
            <h2 className="text-lg font-semibold">
              Welcome to #{channel.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {channel.description}. This is the very beginning of the channel.
            </p>
          </div>
        }
      />

      <MessageComposer
        placeholder={`Message #${channel.name}`}
        onSend={(body) => sendMessage(channel.id, body)}
      />

      <ThreadPanel rootMessageId={threadRoot} onOpenChange={(o) => !o && setThreadRoot(null)} />
    </div>
  )
}
