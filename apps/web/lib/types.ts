export type StatusId = "backlog" | "todo" | "in_progress" | "in_review" | "done"

export type PriorityId = "urgent" | "high" | "medium" | "low" | "none"

export type ViewMode = "board" | "list"

export interface User {
  id: string
  name: string
  email: string
  initials: string
  /** Avatar background color (any CSS color). */
  color: string
  role: string
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
  assigneeIds: string[]
  teamId: string
  tags: string[]
  dueDate: string | null
  subtasks: Subtask[]
  comments: Comment[]
  createdAt: string
  updatedAt: string
}
