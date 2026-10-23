export type ID = string

export type Priority = 'urgent' | 'high' | 'normal' | 'low' | null

export type StatusType = 'open' | 'active' | 'done' | 'closed'

export interface User {
  id: ID
  name: string
  email: string
  color: string
}

export interface Status {
  id: ID
  name: string
  color: string
  type: StatusType
}

export interface Space {
  id: ID
  name: string
  color: string
  statuses: Status[]
}

export interface Folder {
  id: ID
  spaceId: ID
  name: string
}

export interface List {
  id: ID
  spaceId: ID
  folderId: ID | null
  name: string
}

export interface ChecklistItem {
  id: ID
  text: string
  done: boolean
}

export type Recurrence = 'daily' | 'weekly' | 'monthly' | null

export type CustomFieldType = 'text' | 'number' | 'dropdown' | 'checkbox' | 'date' | 'money'

export interface FieldOption {
  id: ID
  name: string
  color: string
}

export interface CustomField {
  id: ID
  listId: ID
  name: string
  type: CustomFieldType
  options: FieldOption[]
}

export type CustomValue = string | number | boolean | null

export interface Task {
  id: ID
  key: number
  listId: ID
  parentId: ID | null
  title: string
  description: string
  statusId: ID
  priority: Priority
  assignees: ID[]
  tags: string[]
  startDate: string | null
  dueDate: string | null
  estimate: number | null
  checklist: ChecklistItem[]
  /** ids of tasks that must finish before this one can start */
  blockedBy: ID[]
  recurrence: Recurrence
  custom: Record<ID, CustomValue>
  sprintId: ID | null
  /** story points */
  points: number | null
  watchers: ID[]
  /** recorded Clips attached to the task */
  clipIds: ID[]
  order: number
  createdAt: string
  updatedAt: string
}

export interface TimeEntry {
  id: ID
  taskId: ID
  userId: ID
  start: string
  /** minutes */
  duration: number
  note: string
}

export interface RunningTimer {
  taskId: ID
  start: string
}

export interface Channel {
  id: ID
  name: string
  kind: 'channel' | 'dm'
  members: ID[]
  topic: string
}

export interface Message {
  id: ID
  channelId: ID
  userId: ID
  text: string
  createdAt: string
  parentId: ID | null
  taskId: ID | null
  reactions: Record<string, ID[]>
  edited?: boolean
  clipId?: ID | null
  /** call summary messages link to their call log */
  callId?: ID | null
}

export type BoardItemKind = 'note' | 'rect' | 'ellipse' | 'text' | 'path'

export interface BoardItem {
  id: ID
  kind: BoardItemKind
  x: number
  y: number
  w: number
  h: number
  color: string
  text: string
  points?: [number, number][]
  taskId?: ID | null
}

export interface Whiteboard {
  id: ID
  title: string
  items: BoardItem[]
  createdBy: ID
  updatedAt: string
}

export type TargetKind = 'number' | 'boolean' | 'tasks' | 'currency'

export interface Target {
  id: ID
  name: string
  kind: TargetKind
  start: number
  current: number
  target: number
  unit: string
  listId: ID | null
}

export interface Goal {
  id: ID
  name: string
  description: string
  color: string
  ownerId: ID
  dueDate: string | null
  folder: string
  targets: Target[]
}

export type TriggerType = 'status_changed' | 'task_created' | 'priority_changed' | 'assignee_added'
export type ActionType = 'set_status' | 'set_priority' | 'add_assignee' | 'add_tag' | 'add_comment' | 'set_due_in' | 'notify'

export interface AutomationAction {
  type: ActionType
  value: string
}

export interface Automation {
  id: ID
  spaceId: ID
  name: string
  enabled: boolean
  trigger: { type: TriggerType; value: string }
  actions: AutomationAction[]
  runs: number
  lastRun: string | null
}

export interface Comment {
  id: ID
  taskId: ID
  userId: ID
  text: string
  createdAt: string
  /** assigned comments become action items for this person */
  assignee?: ID | null
  resolved?: boolean
}

export interface Activity {
  id: ID
  taskId: ID
  userId: ID
  text: string
  createdAt: string
}

export interface Doc {
  id: ID
  spaceId: ID | null
  title: string
  content: string
  emoji: string
  createdBy: ID
  updatedAt: string
}

export type NotificationKind = 'assigned' | 'comment' | 'status' | 'mention' | 'due' | 'reminder'

export interface Notification {
  id: ID
  kind: NotificationKind
  taskId: ID
  actorId: ID
  text: string
  createdAt: string
  read: boolean
  cleared: boolean
  important: boolean
}

export type ViewKind = 'list' | 'board' | 'calendar' | 'table' | 'gantt' | 'workload'

export type MemberRole = 'owner' | 'admin' | 'member' | 'guest'

export interface Member {
  userId: ID
  role: MemberRole
  invited?: boolean
}

export interface Workspace {
  id: ID
  name: string
  color: string
  createdAt: string
  members: Member[]
}

export type CallKind = 'video' | 'audio'

export interface Meeting {
  id: ID
  title: string
  start: string
  durationMin: number
  attendees: ID[]
  kind: CallKind
  agenda: string
  channelId: ID | null
  taskId: ID | null
  notesDocId: ID | null
  createdBy: ID
}

export interface CallLog {
  id: ID
  /** shared id every tab uses to join the same call */
  callId: ID
  title: string
  kind: CallKind
  channelId: ID | null
  meetingId: ID | null
  startedBy: ID
  startedAt: string
  endedAt: string | null
  participants: ID[]
  /** People connected to the LiveKit room right now (from server webhooks). */
  liveParticipants?: ID[]
  recordingClipId: ID | null
  notesDocId: ID | null
}

export type ClipKind = 'screen' | 'camera' | 'screen+camera' | 'call' | 'audio'

/** Metadata only; the media is stored on the server and streamed from /clips/:id/media. */
export interface Clip {
  id: ID
  title: string
  kind: ClipKind
  createdBy: ID
  createdAt: string
  durationSec: number
  size: number
  mime: string
  taskId: ID | null
  transcript: string
  /** small JPEG data URL for the library grid */
  thumb?: string
}

export type FormFieldKind = 'short' | 'long' | 'email' | 'select' | 'date' | 'priority' | 'number'
export type FormFieldTarget = 'title' | 'description' | 'dueDate' | 'priority' | 'none' | `custom:${string}`

export interface FormField {
  id: ID
  label: string
  kind: FormFieldKind
  required: boolean
  options: string[]
  target: FormFieldTarget
  help: string
}

export interface Form {
  id: ID
  listId: ID
  title: string
  description: string
  color: string
  fields: FormField[]
  assignTo: ID[]
  submitText: string
  thanksText: string
  active: boolean
  submissions: number
  createdAt: string
}

export interface Sprint {
  id: ID
  spaceId: ID
  name: string
  goal: string
  startDate: string
  endDate: string
  status: 'planned' | 'active' | 'done'
  /** points completed per day, captured when the sprint is closed */
  completedPoints?: number
}

export interface Reminder {
  id: ID
  text: string
  due: string
  taskId: ID | null
  done: boolean
  notified: boolean
  createdAt: string
}
