export type StatusId = "backlog" | "todo" | "in_progress" | "in_review" | "done"

export type PriorityId = "urgent" | "high" | "medium" | "low" | "none"

export type IssueTypeId = "story" | "task" | "bug" | "epic"

export type ViewMode = "board" | "list"

export type Presence = "available" | "busy" | "away" | "dnd" | "offline"

export interface User {
  id: string
  name: string
  email: string
  initials: string
  /** Avatar background color (any CSS color). */
  color: string
  role: string
  presence: Presence
  /** Optional custom status line, e.g. "In a meeting". */
  statusMessage?: string
}

export interface Team {
  id: string
  name: string
  /** Short slug used to build task keys, e.g. "ENG". */
  key: string
  description: string
  /** Brand color (any CSS color). */
  color: string
  icon: string
  memberIds: string[]
  leadId: string
  createdAt: string
}

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Comment {
  id: string
  authorId: string
  body: string
  createdAt: string
}

export interface Task {
  id: string
  /** Human-friendly identifier, e.g. "ENG-128". */
  key: string
  title: string
  description: string
  status: StatusId
  priority: PriorityId
  /** Jira-style issue type. Optional — inferred from tags when unset. */
  type?: IssueTypeId
  assigneeIds: string[]
  teamId: string
  tags: string[]
  dueDate: string | null
  subtasks: Subtask[]
  comments: Comment[]
  createdAt: string
  updatedAt: string
}

/* ------------------------------------------------------------------ *
 * Chat / collaboration (the Microsoft Teams surface)
 * ------------------------------------------------------------------ */

/** A channel belongs to a team and hosts a message thread. */
export interface Channel {
  id: string
  teamId: string
  name: string
  description: string
  private: boolean
}

/** An emoji reaction and the users who reacted with it. */
export interface Reaction {
  emoji: string
  userIds: string[]
}

export interface Attachment {
  id: string
  name: string
  kind: "doc" | "image" | "sheet" | "pdf" | "link"
  meta?: string
}

/**
 * A message in a channel or chat. `conversationId` is the channel id or chat id.
 * `parentId` set means it is a reply inside a thread.
 */
export interface Message {
  id: string
  conversationId: string
  authorId: string
  body: string
  createdAt: string
  reactions: Reaction[]
  attachments: Attachment[]
  /** Reply ids, in order, for thread roots. */
  replyIds: string[]
  parentId: string | null
  edited: boolean
  /** System events render differently (e.g. "X added Y"). */
  system: boolean
}

/** A direct message conversation: 1:1 or a named group. */
export interface Chat {
  id: string
  memberIds: string[]
  group: boolean
  name: string | null
}

export type ActivityKind = "mention" | "reply" | "reaction" | "added" | "message"

/** An entry in the Activity feed. */
export interface ActivityItem {
  id: string
  kind: ActivityKind
  actorId: string
  /** Where it points: a channel ("teamId/channelId") or a chat id. */
  teamId: string | null
  channelId: string | null
  chatId: string | null
  preview: string
  createdAt: string
  read: boolean
  emoji?: string
}

export interface Meeting {
  id: string
  title: string
  start: string
  end: string
  organizerId: string
  attendeeIds: string[]
  online: boolean
  channelId: string | null
  color: string
}
