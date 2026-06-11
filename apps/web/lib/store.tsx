"use client"

import * as React from "react"
import type {
  ActivityItem,
  Channel,
  Chat,
  IssueTypeId,
  Meeting,
  Message,
  PriorityId,
  StatusId,
  Task,
  Team,
  User,
} from "./types"
import {
  ACTIVITY,
  CHANNELS,
  CHATS,
  CURRENT_USER_ID,
  MEETINGS,
  MESSAGES,
  TASKS,
  TEAMS,
  USERS,
} from "./mock-data"

export interface NewTaskInput {
  title: string
  description?: string
  status?: StatusId
  priority?: PriorityId
  type?: IssueTypeId
  teamId: string
  assigneeIds?: string[]
  tags?: string[]
  dueDate?: string | null
}

export interface NewTeamInput {
  name: string
  key: string
  description?: string
  color: string
  icon: string
  memberIds?: string[]
  leadId?: string
}

interface WorkspaceContextValue {
  users: User[]
  teams: Team[]
  tasks: Task[]
  channels: Channel[]
  chats: Chat[]
  messages: Message[]
  activity: ActivityItem[]
  meetings: Meeting[]
  currentUser: User
  activeProjectId: string
  setActiveProjectId: (id: string) => void
  // selectors
  getUser: (id: string) => User | undefined
  getTeam: (id: string) => Team | undefined
  getChannel: (id: string) => Channel | undefined
  getChat: (id: string) => Chat | undefined
  channelsForTeam: (teamId: string) => Channel[]
  messagesForConversation: (conversationId: string) => Message[]
  repliesForMessage: (messageId: string) => Message[]
  getMessage: (id: string) => Message | undefined
  lastMessageForConversation: (conversationId: string) => Message | undefined
  unreadActivityCount: number
  // task mutations
  createTask: (input: NewTaskInput) => Task
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  moveTask: (id: string, status: StatusId) => void
  toggleSubtask: (taskId: string, subtaskId: string) => void
  addSubtask: (taskId: string, title: string) => void
  addComment: (taskId: string, body: string) => void
  createTeam: (input: NewTeamInput) => Team
  // chat mutations
  sendMessage: (conversationId: string, body: string, parentId?: string | null) => Message
  toggleReaction: (messageId: string, emoji: string) => void
  createChannel: (teamId: string, name: string, description?: string) => Channel
  markActivityRead: (id: string) => void
  markAllActivityRead: () => void
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null)

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function slugify(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [teams, setTeams] = React.useState<Team[]>(TEAMS)
  const [tasks, setTasks] = React.useState<Task[]>(TASKS)
  const [channels, setChannels] = React.useState<Channel[]>(CHANNELS)
  const [chats] = React.useState<Chat[]>(CHATS)
  const [messages, setMessages] = React.useState<Message[]>(MESSAGES)
  const [activity, setActivity] = React.useState<ActivityItem[]>(ACTIVITY)
  const [meetings] = React.useState<Meeting[]>(MEETINGS)
  const [activeProjectId, setActiveProjectId] = React.useState<string>("all")

  const currentUser = React.useMemo(
    () => USERS.find((u) => u.id === CURRENT_USER_ID) ?? USERS[0],
    [],
  )

  const getUser = React.useCallback((id: string) => USERS.find((u) => u.id === id), [])
  const getTeam = React.useCallback((id: string) => teams.find((t) => t.id === id), [teams])
  const getChannel = React.useCallback(
    (id: string) => channels.find((c) => c.id === id),
    [channels],
  )
  const getChat = React.useCallback((id: string) => chats.find((c) => c.id === id), [chats])

  const channelsForTeam = React.useCallback(
    (teamId: string) => channels.filter((c) => c.teamId === teamId),
    [channels],
  )

  const messagesForConversation = React.useCallback(
    (conversationId: string) =>
      messages
        .filter((msg) => msg.conversationId === conversationId && !msg.parentId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [messages],
  )

  const repliesForMessage = React.useCallback(
    (messageId: string) =>
      messages
        .filter((msg) => msg.parentId === messageId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [messages],
  )

  const getMessage = React.useCallback(
    (id: string) => messages.find((msg) => msg.id === id),
    [messages],
  )

  const lastMessageForConversation = React.useCallback(
    (conversationId: string) => {
      let latest: Message | undefined
      for (const msg of messages) {
        if (msg.conversationId !== conversationId || msg.parentId || msg.system) continue
        if (!latest || msg.createdAt > latest.createdAt) latest = msg
      }
      return latest
    },
    [messages],
  )

  const unreadActivityCount = React.useMemo(
    () => activity.filter((a) => !a.read).length,
    [activity],
  )

  /* ---- task mutations ---- */

  const createTask = React.useCallback(
    (input: NewTaskInput) => {
      const team = teams.find((t) => t.id === input.teamId)
      const now = today()
      // Next key derives from the highest existing number for the team, so new
      // issues never duplicate or sort below the seeded keys.
      const nextKey = (list: Task[]) => {
        const maxNum = list
          .filter((t) => t.teamId === input.teamId)
          .reduce((mx, t) => {
            const n = Number(t.key.split("-")[1])
            return Number.isFinite(n) && n > mx ? n : mx
          }, 100)
        return `${team?.key ?? "TSK"}-${maxNum + 1}`
      }
      const task: Task = {
        id: uid("task"),
        key: nextKey(tasks),
        title: input.title.trim(),
        description: input.description?.trim() ?? "",
        status: input.status ?? "backlog",
        priority: input.priority ?? "none",
        type: input.type ?? "task",
        assigneeIds: input.assigneeIds ?? [],
        teamId: input.teamId,
        tags: input.tags ?? [],
        dueDate: input.dueDate ?? null,
        subtasks: [],
        comments: [],
        createdAt: now,
        updatedAt: now,
      }
      // Recompute against the live list inside the updater to stay correct even
      // if two issues are created in the same tick.
      setTasks((prev) => {
        task.key = nextKey(prev)
        return [task, ...prev]
      })
      return task
    },
    [teams, tasks],
  )

  const updateTask = React.useCallback((id: string, patch: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: today() } : t)),
    )
  }, [])

  const deleteTask = React.useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const moveTask = React.useCallback((id: string, status: StatusId) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status, updatedAt: today() } : t)),
    )
  }, [])

  const toggleSubtask = React.useCallback((taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: t.subtasks.map((s) =>
                s.id === subtaskId ? { ...s, done: !s.done } : s,
              ),
            }
          : t,
      ),
    )
  }, [])

  const addSubtask = React.useCallback((taskId: string, title: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: [...t.subtasks, { id: uid("sub"), title: title.trim(), done: false }] }
          : t,
      ),
    )
  }, [])

  const addComment = React.useCallback((taskId: string, body: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              comments: [
                ...t.comments,
                {
                  id: uid("cmt"),
                  authorId: CURRENT_USER_ID,
                  body: body.trim(),
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : t,
      ),
    )
  }, [])

  const createTeam = React.useCallback((input: NewTeamInput) => {
    const team: Team = {
      id: uid("team"),
      name: input.name.trim(),
      key: input.key.trim().toUpperCase(),
      description: input.description?.trim() ?? "",
      color: input.color,
      icon: input.icon,
      memberIds: input.memberIds ?? [CURRENT_USER_ID],
      leadId: input.leadId ?? CURRENT_USER_ID,
      createdAt: today(),
    }
    setTeams((prev) => [...prev, team])
    // Every team starts with a #general channel.
    setChannels((prev) => [
      ...prev,
      {
        id: uid("chan"),
        teamId: team.id,
        name: "general",
        description: "Team-wide announcements and chatter",
        private: false,
      },
    ])
    return team
  }, [])

  /* ---- chat mutations ---- */

  const sendMessage = React.useCallback(
    (conversationId: string, body: string, parentId: string | null = null) => {
      const message: Message = {
        id: uid("msg"),
        conversationId,
        authorId: CURRENT_USER_ID,
        body: body.trim(),
        createdAt: new Date().toISOString(),
        reactions: [],
        attachments: [],
        replyIds: [],
        parentId,
        edited: false,
        system: false,
      }
      setMessages((prev) => {
        const next = [...prev, message]
        if (parentId) {
          return next.map((msg) =>
            msg.id === parentId
              ? { ...msg, replyIds: [...msg.replyIds, message.id] }
              : msg,
          )
        }
        return next
      })
      return message
    },
    [],
  )

  const toggleReaction = React.useCallback((messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg
        const existing = msg.reactions.find((r) => r.emoji === emoji)
        let reactions
        if (!existing) {
          reactions = [...msg.reactions, { emoji, userIds: [CURRENT_USER_ID] }]
        } else if (existing.userIds.includes(CURRENT_USER_ID)) {
          const userIds = existing.userIds.filter((id) => id !== CURRENT_USER_ID)
          reactions = userIds.length
            ? msg.reactions.map((r) => (r.emoji === emoji ? { ...r, userIds } : r))
            : msg.reactions.filter((r) => r.emoji !== emoji)
        } else {
          reactions = msg.reactions.map((r) =>
            r.emoji === emoji ? { ...r, userIds: [...r.userIds, CURRENT_USER_ID] } : r,
          )
        }
        return { ...msg, reactions }
      }),
    )
  }, [])

  const createChannel = React.useCallback(
    (teamId: string, name: string, description = "") => {
      const channel: Channel = {
        id: uid("chan"),
        teamId,
        name: slugify(name) || "channel",
        description: description.trim(),
        private: false,
      }
      setChannels((prev) => [...prev, channel])
      return channel
    },
    [],
  )

  const markActivityRead = React.useCallback((id: string) => {
    setActivity((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)))
  }, [])

  const markAllActivityRead = React.useCallback(() => {
    setActivity((prev) => prev.map((a) => ({ ...a, read: true })))
  }, [])

  const value = React.useMemo<WorkspaceContextValue>(
    () => ({
      users: USERS,
      teams,
      tasks,
      channels,
      chats,
      messages,
      activity,
      meetings,
      currentUser,
      getUser,
      getTeam,
      getChannel,
      getChat,
      channelsForTeam,
      messagesForConversation,
      repliesForMessage,
      getMessage,
      lastMessageForConversation,
      unreadActivityCount,
      createTask,
      updateTask,
      deleteTask,
      moveTask,
      toggleSubtask,
      addSubtask,
      addComment,
      createTeam,
      sendMessage,
      toggleReaction,
      createChannel,
      markActivityRead,
      markAllActivityRead,
      activeProjectId,
      setActiveProjectId,
    }),
    [
      teams, tasks, channels, chats, messages, activity, meetings, currentUser,
      getUser, getTeam, getChannel, getChat, channelsForTeam, messagesForConversation,
      repliesForMessage, getMessage, lastMessageForConversation, unreadActivityCount,
      createTask, updateTask, deleteTask, moveTask, toggleSubtask, addSubtask, addComment,
      createTeam, sendMessage, toggleReaction, createChannel, markActivityRead, markAllActivityRead,
      activeProjectId, setActiveProjectId,
    ],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = React.useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider")
  return ctx
}

/** Resolve a chat's display name and members for the current viewer. */
export function chatDisplay(
  chat: Chat,
  currentUserId: string,
  getUser: (id: string) => User | undefined,
) {
  const others = chat.memberIds.filter((id) => id !== currentUserId)
  const members = others.map(getUser).filter((u): u is User => Boolean(u))
  if (chat.group) {
    const name = chat.name ?? members.map((u) => u.name.split(" ")[0]).join(", ")
    return { name, members, isGroup: true as const }
  }
  const other = members[0]
  return { name: other?.name ?? "Unknown", members, isGroup: false as const }
}
