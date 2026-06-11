"use client"

import * as React from "react"
import Link from "next/link"
import { 
  MessagesSquare, 
  PenSquare, 
  Search, 
  Users, 
  Hash, 
  Lock, 
  Plus, 
  Send, 
  Smile, 
  Paperclip,
  Bold,
  Italic,
  Code,
  Info,
  Maximize2
} from "lucide-react"
import { toast } from "sonner"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { PresenceAvatar } from "@/components/shared/presence-avatar"
import { ConversationHeader } from "@/components/chat/conversation-header"
import { MessageThread } from "@/components/chat/message-thread"
import { MessageComposer } from "@/components/chat/message-composer"
import { CreateChannelDialog } from "@/components/chat/create-channel-dialog"
import { PRESENCE } from "@/lib/config"
import { formatTime } from "@/lib/date"
import { cn } from "@/lib/utils"
import { chatDisplay, useWorkspace } from "@/lib/store"
import type { Chat, User, Channel, Team } from "@/lib/types"

export function ChatView({ activeChatId }: { activeChatId?: string }) {
  const {
    chats,
    channels,
    teams,
    currentUser,
    getUser,
    getChat,
    getChannel,
    getTeam,
    lastMessageForConversation,
    sendMessage,
    createChannel,
    activeProjectId,
  } = useWorkspace()

  const [query, setQuery] = React.useState("")
  const [selectedConv, setSelectedConv] = React.useState<{ type: "channel" | "chat"; id: string } | null>(null)
  const [createChannelOpen, setCreateChannelOpen] = React.useState(false)
  const [activeChannelTeamId, setActiveChannelTeamId] = React.useState("")

  // Set initial conversation if activeChatId is provided
  React.useEffect(() => {
    if (activeChatId) {
      const chatExists = getChat(activeChatId)
      if (chatExists) {
        setSelectedConv({ type: "chat", id: activeChatId })
      } else {
        const channelExists = getChannel(activeChatId)
        if (channelExists) {
          setSelectedConv({ type: "channel", id: activeChatId })
        }
      }
    } else {
      // Find the first channel in the active project scope
      const activeProjChans = activeProjectId === "all" 
        ? channels 
        : channels.filter(c => c.teamId === activeProjectId)
      if (activeProjChans.length > 0) {
        setSelectedConv({ type: "channel", id: activeProjChans[0].id })
      }
    }
  }, [activeChatId, channels, activeProjectId, getChat, getChannel])

  // Filter lists based on query
  const filteredChannels = React.useMemo(() => {
    let list = channels
    if (activeProjectId !== "all") {
      list = list.filter(c => c.teamId === activeProjectId)
    }
    if (!query.trim()) return list
    return list.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
  }, [channels, query, activeProjectId])

  const filteredChats = React.useMemo(() => {
    const sorted = [...chats].sort((a, b) => {
      const la = lastMessageForConversation(a.id)?.createdAt ?? ""
      const lb = lastMessageForConversation(b.id)?.createdAt ?? ""
      return lb.localeCompare(la)
    })
    if (!query.trim()) return sorted
    return sorted.filter((chat) => 
      chatDisplay(chat, currentUser.id, getUser).name.toLowerCase().includes(query.toLowerCase())
    )
  }, [chats, query, currentUser.id, getUser, lastMessageForConversation])

  const activeChannel = selectedConv?.type === "channel" ? getChannel(selectedConv.id) : null
  const activeChat = selectedConv?.type === "chat" ? getChat(selectedConv.id) : null
  const activeTeam = activeChannel ? getTeam(activeChannel.teamId) : null

  const handleOpenCreateChannel = (teamId: string) => {
    setActiveChannelTeamId(teamId)
    setCreateChannelOpen(true)
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background/50">
      <PageHeader>
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold">Chat Workspace</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Collaborate in channels and direct messages
          </p>
        </div>
      </PageHeader>

      <div className="flex min-h-0 flex-grow">
        
        {/* 💬 LEFT: REDESIGNED CHAT DIRECTORY */}
        <div className="flex w-72 shrink-0 flex-col border-r bg-card/25 backdrop-blur-md">
          {/* Search bar */}
          <div className="flex items-center gap-2 p-4 border-b">
            <InputGroup className="flex-1">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Filter messages or DMs"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8.5 text-xs"
              />
            </InputGroup>
            <Button
              size="icon"
              variant="outline"
              className="size-8.5 shrink-0"
              aria-label="New conversation"
              onClick={() => toast.info("Start a new DM or channel")}
            >
              <PenSquare className="size-4" />
            </Button>
          </div>

          {/* Directory Scrollable Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-5">
            
            {/* Channels Grouped by Team */}
            {teams.map((team) => {
              const teamChannels = filteredChannels.filter(c => c.teamId === team.id)
              if (teamChannels.length === 0) return null
              return (
                <div key={team.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-2">
                    <span className="flex items-center gap-1">
                      <span className="size-1.5 rounded-sm" style={{ backgroundColor: team.color }} />
                      {team.name}
                    </span>
                    <button 
                      onClick={() => handleOpenCreateChannel(team.id)} 
                      className="hover:text-foreground p-0.5 rounded transition-colors"
                      title="Add channel"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {teamChannels.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => setSelectedConv({ type: "channel", id: channel.id })}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors",
                          selectedConv?.type === "channel" && selectedConv.id === channel.id
                            ? "bg-primary text-white shadow-xs"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {channel.private ? <Lock className="size-3.5 shrink-0" /> : <Hash className="size-3.5 shrink-0" />}
                        <span className="truncate">{channel.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Direct Messages */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-2">
                <span>Direct Messages</span>
                <button 
                  onClick={() => toast.info("New Direct Message")}
                  className="hover:text-foreground p-0.5 rounded transition-colors"
                  title="New DM"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              <div className="flex flex-col gap-0.5">
                {filteredChats.map((chat) => {
                  const { name, members } = chatDisplay(chat, currentUser.id, getUser)
                  const isSelected = selectedConv?.type === "chat" && selectedConv.id === chat.id
                  const last = lastMessageForConversation(chat.id)
                  const lastAuthor = last ? getUser(last.authorId) : undefined
                  const member = members[0]

                  return (
                    <button
                      key={chat.id}
                      onClick={() => setSelectedConv({ type: "chat", id: chat.id })}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors",
                        isSelected
                          ? "bg-primary text-white shadow-xs"
                          : "hover:bg-muted"
                      )}
                    >
                      {member ? (
                        <PresenceAvatar user={member} className="size-7 rounded-md" showPresence={!isSelected} />
                      ) : (
                        <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Users className="size-3.5" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-1">
                          <span className={cn("truncate text-xs font-semibold", isSelected ? "text-white" : "text-foreground")}>{name}</span>
                          {last && (
                            <span className="shrink-0 text-[9px] text-muted-foreground opacity-80">
                              {formatTime(last.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className={cn("truncate text-[10px] opacity-75 mt-0.5", isSelected ? "text-white/80" : "text-muted-foreground")}>
                          {last
                            ? `${lastAuthor?.id === currentUser.id ? "You" : lastAuthor?.name.split(" ")[0]}: ${last.body}`
                            : "No messages yet"}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

          </div>
        </div>

        {/* 💬 RIGHT: REDESIGNED CHAT THREAD CONSOLE */}
        <div className="flex-1 flex min-w-0">
          {activeChannel ? (
            <div className="flex-grow flex flex-col min-w-0 bg-background/20">
              <ConversationHeader
                leading={
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {activeChannel.private ? <Lock className="size-4.5" /> : <Hash className="size-4.5" />}
                  </span>
                }
                title={activeChannel.name}
                subtitle={`${activeTeam?.name || "Workspace"} Project Channel &bull; ${activeChannel.description}`}
                members={[]}
              />
              <MessageThread conversationId={activeChannel.id} />
              <MessageComposer 
                placeholder={`Message #${activeChannel.name}`} 
                onSend={(body) => sendMessage(activeChannel.id, body)} 
              />
            </div>
          ) : activeChat ? (
            <div className="flex-grow flex flex-col min-w-0 bg-background/20">
              {(() => {
                const { name, members } = chatDisplay(activeChat, currentUser.id, getUser)
                const presenceLabel = !activeChat.group && members[0] ? PRESENCE[members[0].presence].label : `${activeChat.memberIds.length} members`
                return (
                  <>
                    <ConversationHeader
                      leading={
                        members[0] ? (
                          <PresenceAvatar user={members[0]} className="size-9 rounded-lg" />
                        ) : (
                          <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Users className="size-4.5" />
                          </span>
                        )
                      }
                      title={name}
                      subtitle={presenceLabel}
                      members={activeChat.group ? members : []}
                    />
                    <MessageThread conversationId={activeChat.id} />
                    <MessageComposer 
                      placeholder={`Message ${name}`} 
                      onSend={(body) => sendMessage(activeChat.id, body)} 
                    />
                  </>
                )
              })()}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-background/10">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MessagesSquare />
                  </EmptyMedia>
                  <EmptyTitle>No conversation selected</EmptyTitle>
                  <EmptyDescription>
                    Select a project channel or direct message from the left directory to start sync.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          )}
        </div>

      </div>

      <CreateChannelDialog
        teamId={activeChannelTeamId}
        open={createChannelOpen}
        onOpenChange={setCreateChannelOpen}
      />
    </div>
  )
}
