import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addDays, parseISO } from 'date-fns'
import type {
  Activity,
  Automation,
  BoardItem,
  Channel,
  Comment,
  CustomField,
  CustomValue,
  Doc,
  Folder,
  Goal,
  ID,
  List,
  Message,
  Notification,
  RunningTimer,
  Space,
  Target,
  Task,
  TimeEntry,
  User,
  ViewKind,
  Whiteboard,
  Team,
  Workspace,
  Meeting,
  CallLog,
  Clip,
  Form,
  FormField,
  Sprint,
  Reminder,
  Timesheet,
  MemberRole,
  Member,
} from './types'
import { api, ApiError, newId, onWriteError, session, type Tokens } from '../api/client'
import { RealtimeConnection, emitRealtime, type RealtimeEvent } from '../api/realtime'
import { SPACE_COLORS, toISODate } from '../lib/utils'
import { LIST_TEMPLATES } from './templates'
import { brainstormItems, kickoffStart, welcomeDoc, type StarterTool } from './onboarding'

export interface Filters {
  search: string
  assignees: ID[]
  priorities: string[]
  showClosed: boolean
  sort: SortKey
  sortDir: 'asc' | 'desc'
  tags: string[]
  due: DueFilter
}

export type SortKey = 'manual' | 'due' | 'priority' | 'title' | 'start' | 'created' | 'updated' | 'estimate' | 'points'
export type DueFilter = '' | 'overdue' | 'today' | 'week' | 'none'

export const emptyFilters: Filters = { search: '', assignees: [], priorities: [], showClosed: true, sort: 'manual', sortDir: 'asc', tags: [], due: '' }

/** Comments and activity written by automations use this pseudo-user id. */
export const BOT = 'bot'

/** Collections that belong to the active workspace and come from the server snapshot. */
const DATA_KEYS = [
  'spaces', 'folders', 'lists', 'tasks', 'comments', 'activity', 'docs', 'notifications', 'fields', 'timeEntries',
  'channels', 'messages', 'whiteboards', 'goals', 'automations', 'meetings', 'callLogs', 'clips', 'forms', 'sprints', 'reminders',
  'timesheets', 'teams',
] as const
type DataKey = (typeof DATA_KEYS)[number]

/** Per-workspace browser preferences (not stored on the server). */
interface Prefs {
  favorites: ID[]
  recents: ID[]
  listViews: Record<ID, ViewKind>
}

export interface Toast {
  id: string
  text: string
  tone: 'error' | 'info'
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

interface State {
  /** True while a session token exists (the app may still be loading). */
  signedIn: boolean
  status: LoadStatus
  loadError: string | null
  users: User[]
  currentUserId: ID | null
  workspaces: Workspace[]
  currentWorkspaceId: ID
  /** Users with an open connection to this workspace. */
  presence: ID[]
  /** Whether the server has LiveKit configured for calls. */
  meetEnabled: boolean
  toasts: Toast[]

  meetings: Meeting[]
  callLogs: CallLog[]
  clips: Clip[]
  forms: Form[]
  sprints: Sprint[]
  reminders: Reminder[]
  timesheets: Timesheet[]
  teams: Team[]
  spaces: Space[]
  folders: Folder[]
  lists: List[]
  tasks: Task[]
  comments: Comment[]
  activity: Activity[]
  docs: Doc[]
  notifications: Notification[]
  fields: CustomField[]
  timeEntries: TimeEntry[]
  timer: RunningTimer | null
  channels: Channel[]
  messages: Message[]
  lastRead: Record<ID, string>
  whiteboards: Whiteboard[]
  goals: Goal[]
  automations: Automation[]
  favorites: ID[]
  recents: ID[]
  listViews: Record<ID, ViewKind>
  prefsByWorkspace: Record<ID, Prefs>
  filters: Filters
  theme: 'light' | 'dark'
  sidebarCollapsed: boolean
  openTaskId: ID | null

  signIn: (email: string, password: string) => Promise<void>
  /** Creates the account and signs in, without loading a workspace (onboarding creates it next). */
  signUp: (name: string, email: string, password: string) => Promise<void>
  /** Final onboarding step: creates the user's first workspace, invites teammates and adds starter Lists. */
  setupWorkspace: (opts: { name: string; color: string; invites: string[]; templates: string[]; tools: StarterTool[] }) => Promise<void>
  bootstrap: () => Promise<void>
  reload: () => Promise<void>
  toast: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: string) => void

  switchWorkspace: (id: ID) => void
  addWorkspace: (name: string) => ID
  renameWorkspace: (id: ID, name: string) => void
  deleteWorkspace: (id: ID) => void

  updateWorkspace: (id: ID, patch: Partial<Workspace>) => void
  inviteMember: (name: string, email: string, role: MemberRole) => void
  setMemberRole: (userId: ID, role: MemberRole) => void
  removeMember: (userId: ID) => void

  addMeeting: (m: Omit<Meeting, 'id' | 'createdBy' | 'notesDocId'>) => ID
  updateMeeting: (id: ID, patch: Partial<Meeting>) => void
  deleteMeeting: (id: ID) => void
  updateCallLog: (id: ID, patch: Partial<Pick<CallLog, 'recordingClipId' | 'notesDocId'>>) => void
  postMessage: (m: Partial<Message> & { channelId: ID; text: string }) => ID

  addClip: (c: Clip) => void
  updateClip: (id: ID, patch: Partial<Clip>) => void
  deleteClip: (id: ID) => void
  shareClip: (id: ID, channelId: ID) => void

  addForm: (listId: ID) => ID
  updateForm: (id: ID, patch: Partial<Form>) => void
  deleteForm: (id: ID) => void

  addSprint: (spaceId: ID) => ID
  updateSprint: (id: ID, patch: Partial<Sprint>) => void
  deleteSprint: (id: ID) => void
  startSprint: (id: ID) => void
  completeSprint: (id: ID, moveTo: ID | null) => void

  addReminder: (r: Omit<Reminder, 'id' | 'done' | 'notified' | 'createdAt'>) => ID
  updateReminder: (id: ID, patch: Partial<Reminder>) => void
  deleteReminder: (id: ID) => void

  submitTimesheet: (weekStart: string) => void
  decideTimesheet: (userId: ID, weekStart: string, approve: boolean, note?: string) => void
  reopenTimesheet: (userId: ID, weekStart: string) => void

  toggleWatcher: (taskId: ID, userId: ID) => void
  updateComment: (id: ID, patch: Partial<Comment>) => void
  importTasks: (listId: ID, rows: Partial<Task>[]) => number

  logout: () => void
  setTheme: (t: 'light' | 'dark') => void
  toggleSidebar: () => void
  setFilters: (f: Partial<Filters>) => void
  setListView: (listId: ID, v: ViewKind) => void
  openTask: (id: ID | null) => void
  touchRecent: (id: ID) => void
  toggleFavorite: (id: ID) => void

  addSpace: (name: string) => ID
  updateSpace: (id: ID, patch: Partial<Space>) => void
  deleteSpace: (id: ID) => void
  addFolder: (spaceId: ID, name: string) => ID
  renameFolder: (id: ID, name: string) => void
  deleteFolder: (id: ID) => void
  addList: (spaceId: ID, folderId: ID | null, name: string) => ID
  renameList: (id: ID, name: string) => void
  deleteList: (id: ID) => void
  applyTemplate: (spaceId: ID, templateKey: string, name: string) => ID

  addTask: (input: Partial<Task> & { listId: ID; title: string }) => ID
  updateTask: (id: ID, patch: Partial<Task>) => void
  deleteTask: (id: ID) => void
  duplicateTask: (id: ID) => ID
  moveTask: (id: ID, statusId: ID, beforeId: ID | null) => void
  bulkUpdate: (ids: ID[], patch: Partial<Task>) => void
  bulkDelete: (ids: ID[]) => void
  addDependency: (taskId: ID, blockerId: ID) => void
  removeDependency: (taskId: ID, blockerId: ID) => void

  addField: (listId: ID, name: string, type: CustomField['type']) => ID
  updateField: (id: ID, patch: Partial<CustomField>) => void
  deleteField: (id: ID) => void
  setCustomValue: (taskId: ID, fieldId: ID, value: CustomValue) => void

  addComment: (taskId: ID, text: string, assignee?: ID | null) => void

  startTimer: (taskId: ID) => void
  stopTimer: () => void
  addTimeEntry: (e: Omit<TimeEntry, 'id' | 'userId'>) => void
  updateTimeEntry: (id: ID, patch: Partial<TimeEntry>) => void
  deleteTimeEntry: (id: ID) => void

  addDoc: (spaceId: ID | null) => ID
  updateDoc: (id: ID, patch: Partial<Doc>) => void
  deleteDoc: (id: ID) => void

  addChannel: (name: string, topic: string) => ID
  openDM: (userId: ID) => ID
  sendMessage: (channelId: ID, text: string, parentId?: ID | null) => void
  editMessage: (id: ID, text: string) => void
  deleteMessage: (id: ID) => void
  toggleReaction: (id: ID, emoji: string) => void
  markChannelRead: (channelId: ID) => void
  messageToTask: (messageId: ID, listId: ID) => ID

  addWhiteboard: () => ID
  addTeam: (input: Partial<Team> & { name: string }) => ID
  updateTeam: (id: ID, patch: Partial<Team>) => void
  deleteTeam: (id: ID) => void
  /** Title and manager for the org chart; resolves false (and toasts) when the server refuses. */
  setMemberProfile: (userId: ID, patch: { title?: string; managerId?: ID | null }) => Promise<boolean>
  updateWhiteboard: (id: ID, patch: Partial<Whiteboard>) => void
  setBoardItems: (id: ID, items: BoardItem[]) => void
  deleteWhiteboard: (id: ID) => void

  addGoal: () => ID
  updateGoal: (id: ID, patch: Partial<Goal>) => void
  deleteGoal: (id: ID) => void
  addTarget: (goalId: ID, t: Omit<Target, 'id'>) => void
  updateTarget: (goalId: ID, targetId: ID, patch: Partial<Target>) => void
  deleteTarget: (goalId: ID, targetId: ID) => void

  addAutomation: (a: Omit<Automation, 'id' | 'runs' | 'lastRun'>) => ID
  updateAutomation: (id: ID, patch: Partial<Automation>) => void
  deleteAutomation: (id: ID) => void

  markRead: (id: ID, read?: boolean) => void
  markAllRead: () => void
  clearNotification: (id: ID, cleared?: boolean) => void
}

const now = () => new Date().toISOString()

function emptyData(): Pick<State, DataKey | 'timer' | 'lastRead' | 'presence'> {
  return {
    spaces: [], folders: [], lists: [], tasks: [], comments: [], activity: [], docs: [], notifications: [], fields: [], timeEntries: [],
    channels: [], messages: [], whiteboards: [], goals: [], automations: [], meetings: [], callLogs: [], clips: [], forms: [], sprints: [],
    reminders: [], timesheets: [], teams: [], timer: null, lastRead: {}, presence: [],
  }
}

const emptyPrefs = (): Prefs => ({ favorites: [], recents: [], listViews: {} })

// ---- API shape mapping: the server calls Spaces "projects".

const COLLECTIONS: Record<string, DataKey> = { projects: 'spaces' }
const collectionKey = (c: string) => (COLLECTIONS[c] ?? c) as DataKey

function fromApi<T>(x: any): T {
  if (x && typeof x === 'object' && 'projectId' in x) {
    const { projectId, ...rest } = x
    return { ...rest, spaceId: projectId } as T
  }
  return x as T
}

function toApi<T extends object>(x: T): Record<string, unknown> {
  if ('spaceId' in x) {
    const { spaceId, ...rest } = x as T & { spaceId: unknown }
    return { ...rest, projectId: spaceId }
  }
  return x as Record<string, unknown>
}

const TASK_PATCH_KEYS = [
  'listId', 'title', 'description', 'statusId', 'priority', 'assignees', 'tags', 'startDate', 'dueDate', 'estimate', 'checklist',
  'recurrence', 'custom', 'sprintId', 'points', 'watchers',
] as const

function pick<T extends object>(obj: T, keys: readonly string[]) {
  return Object.fromEntries(Object.entries(obj).filter(([k, v]) => keys.includes(k) && v !== undefined))
}

// ---- Optimistic edits.
//
// Every local change is applied at once and sent to the server. While a field
// has unconfirmed edits, server echoes of older versions must not overwrite
// what the user is typing, so those fields are re-applied on top of incoming data.

const overrides = new Map<string, { fields: Record<string, unknown>; version: number }>()
const okey = (collection: DataKey, id: ID) => `${collection}:${id}`

function remember(collection: DataKey, id: ID, fields: Record<string, unknown>) {
  const k = okey(collection, id)
  const prev = overrides.get(k)
  const version = (prev?.version ?? 0) + 1
  overrides.set(k, { fields: { ...prev?.fields, ...fields }, version })
  return version
}

function settle(collection: DataKey, id: ID, version: number) {
  const k = okey(collection, id)
  if (overrides.get(k)?.version === version) overrides.delete(k)
}

function withOverrides<T extends { id: ID }>(collection: DataKey, item: T): T {
  const o = overrides.get(okey(collection, item.id))
  return o ? { ...item, ...o.fields } : item
}

/** Debounced PATCHes for text typed keystroke by keystroke. */
const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; body: Record<string, unknown>; send: (b: Record<string, unknown>) => void }>()

function patchSoon(key: string, body: Record<string, unknown>, send: (b: Record<string, unknown>) => void, ms = 400) {
  const prev = pending.get(key)
  if (prev) clearTimeout(prev.timer)
  const merged = { ...prev?.body, ...body }
  const timer = setTimeout(() => {
    pending.delete(key)
    send(merged)
  }, ms)
  pending.set(key, { timer, body: merged, send })
}

function cancelPending(key: string) {
  const p = pending.get(key)
  if (p) clearTimeout(p.timer)
  pending.delete(key)
}

function flushPending() {
  for (const [key, p] of pending) {
    clearTimeout(p.timer)
    pending.delete(key)
    p.send(p.body)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPending)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushPending())
}

let realtime: RealtimeConnection | null = null
let loadSeq = 0

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const me = () => get().currentUserId ?? ''
      const wid = () => get().currentWorkspaceId
      const w = (path: string) => `/workspaces/${wid()}${path}`

      const upsert = <K extends DataKey>(key: K, item: State[K][number]) =>
        set((s) => {
          const list = s[key] as { id: ID }[]
          const merged = withOverrides(key, item as { id: ID })
          const i = list.findIndex((x) => x.id === merged.id)
          const next = i === -1 ? [...list, merged] : list.map((x, j) => (j === i ? merged : x))
          return { [key]: next } as Partial<State>
        })
      const patchLocal = <K extends DataKey>(key: K, id: ID, patch: Partial<State[K][number]>) =>
        set((s) => ({ [key]: (s[key] as { id: ID }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) }) as Partial<State>)
      const removeLocal = (key: DataKey, ids: ID | ID[]) => {
        const gone = new Set(Array.isArray(ids) ? ids : [ids])
        set((s) => ({ [key]: (s[key] as { id: ID }[]).filter((x) => !gone.has(x.id)) }) as Partial<State>)
      }

      /** Sends a write and folds the server's version of the item back in. */
      const save = <T extends { id: ID }>(key: DataKey, req: Promise<T>, version?: number, id?: ID) => {
        req.then(
          (item) => {
            if (version !== undefined && id) settle(key, id, version)
            if (item && typeof item === 'object' && 'id' in item) upsert(key, fromApi(item))
          },
          () => version !== undefined && id && settle(key, id, version),
        )
      }

      /** Local cascade when tasks disappear (mirrors what the server does). */
      const dropTasks = (ids: ID[]) =>
        set((s) => {
          const gone = new Set(ids)
          let grew = true
          while (grew) {
            grew = false
            for (const t of s.tasks) if (t.parentId && gone.has(t.parentId) && !gone.has(t.id)) (gone.add(t.id), (grew = true))
          }
          return {
            tasks: s.tasks.filter((t) => !gone.has(t.id)).map((t) => (t.blockedBy.some((b) => gone.has(b)) ? { ...t, blockedBy: t.blockedBy.filter((b) => !gone.has(b)) } : t)),
            openTaskId: s.openTaskId && gone.has(s.openTaskId) ? null : s.openTaskId,
            notifications: s.notifications.filter((n) => !gone.has(n.taskId)),
            comments: s.comments.filter((c) => !gone.has(c.taskId)),
            activity: s.activity.filter((a) => !gone.has(a.taskId)),
            timeEntries: s.timeEntries.filter((e) => !gone.has(e.taskId)),
            messages: s.messages.map((m) => (m.taskId && gone.has(m.taskId) ? { ...m, taskId: null } : m)),
            timer: s.timer && gone.has(s.timer.taskId) ? null : s.timer,
          }
        })
      const dropLists = (ids: ID[]) => {
        const gone = new Set(ids)
        dropTasks(get().tasks.filter((t) => gone.has(t.listId)).map((t) => t.id))
        set((s) => ({ lists: s.lists.filter((l) => !gone.has(l.id)), fields: s.fields.filter((f) => !gone.has(f.listId)) }))
      }

      // ---- realtime

      const applyEvent = (e: RealtimeEvent) => {
        const p = e.payload
        switch (e.collection) {
          case 'presence':
            set((s) => ({ presence: e.op === 'online' ? [...new Set([...s.presence, p.userId])] : s.presence.filter((u) => u !== p.userId) }))
            return
          case 'lastRead':
            set((s) => ({ lastRead: { ...s.lastRead, [p.channelId]: p.at } }))
            return
          case 'timer':
            set({ timer: e.op === 'set' ? { taskId: p.taskId, start: p.start } : null })
            return
          case 'users':
            set((s) => ({ users: s.users.some((u) => u.id === p.id) ? s.users.map((u) => (u.id === p.id ? p : u)) : [...s.users, p] }))
            return
          case 'members':
            set((s) => ({
              workspaces: s.workspaces.map((x) =>
                x.id !== e.workspaceId
                  ? x
                  : {
                      ...x,
                      members:
                        e.op === 'delete'
                          ? x.members.filter((m) => m.userId !== p.userId)
                          : [...x.members.filter((m) => m.userId !== p.userId), { userId: p.userId, role: p.role, invited: p.invited, title: p.title, managerId: p.managerId } as Member],
                    },
              ),
            }))
            if (e.op === 'delete' && p.userId === me()) void get().bootstrap()
            return
          case 'workspaces':
            if (e.op === 'delete') {
              set((s) => ({ workspaces: s.workspaces.filter((x) => x.id !== p.id) }))
              if (p.id === wid()) void get().bootstrap()
            } else set((s) => ({ workspaces: s.workspaces.map((x) => (x.id === p.id ? { ...x, ...p, members: p.members ?? x.members } : x)) }))
            return
          case 'notifications':
            if (e.op === 'allRead') set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }))
            else {
              const isNew = !get().notifications.some((n) => n.id === p.id)
              set((s) => ({ notifications: [p, ...s.notifications.filter((n) => n.id !== p.id)] }))
              if (isNew && p.kind === 'reminder' && 'Notification' in window && Notification.permission === 'granted')
                new Notification('Meetspace reminder', { body: p.text })
            }
            return
          case 'calls':
            emitRealtime(e)
            return
        }
        const key = collectionKey(e.collection)
        if (!(DATA_KEYS as readonly string[]).includes(key)) return
        if (e.op === 'delete') {
          if (key === 'tasks') dropTasks([p.id])
          else if (key === 'lists') dropLists([p.id])
          else removeLocal(key, p.id)
        } else upsert(key, fromApi(p))
        if (key === 'callLogs') emitRealtime(e)
      }

      const loadWorkspace = async (id: ID) => {
        const seq = ++loadSeq
        const snap = await api.get<Record<string, any>>(`/workspaces/${id}/snapshot`)
        if (seq !== loadSeq) return
        const data = emptyData()
        for (const [k, v] of Object.entries(snap)) {
          const key = collectionKey(k)
          if ((DATA_KEYS as readonly string[]).includes(key) && Array.isArray(v)) (data as any)[key] = v.map(fromApi)
        }
        data.timer = snap.timer ?? null
        data.lastRead = snap.lastRead ?? {}
        set((s) => ({
          ...data,
          users: snap.users ?? s.users,
          meetEnabled: !!snap.meetEnabled,
          workspaces: s.workspaces.map((x) => (x.id === id ? { ...x, ...snap.workspace, members: snap.members ?? x.members } : x)),
        }))
      }

      const connect = (id: ID) => {
        realtime?.close()
        realtime = new RealtimeConnection(id, applyEvent, () => void loadWorkspace(id).catch(() => {}))
      }

      const enterWorkspace = async (id: ID) => {
        const s = get()
        // Re-entering the same workspace (a reload) keeps the persisted favorites/recents; the
        // per-workspace copy is only written when switching away, so it may be stale.
        const prefs = id === s.currentWorkspaceId ? { favorites: s.favorites, recents: s.recents, listViews: s.listViews } : (s.prefsByWorkspace[id] ?? emptyPrefs())
        set({ ...emptyData(), currentWorkspaceId: id, openTaskId: null, filters: emptyFilters, ...prefs })
        await loadWorkspace(id)
        connect(id)
      }

      const startSession = async (t: Tokens, user: User, load = true) => {
        session.set({ accessToken: t.accessToken, refreshToken: t.refreshToken })
        set({ signedIn: true, currentUserId: user.id, users: [user] })
        if (load) await get().bootstrap()
      }

      return {
        ...emptyData(),
        signedIn: session.signedIn,
        status: 'idle',
        loadError: null,
        users: [],
        currentUserId: null,
        workspaces: [],
        currentWorkspaceId: '',
        meetEnabled: false,
        toasts: [],
        favorites: [],
        recents: [],
        listViews: {},
        prefsByWorkspace: {},
        filters: emptyFilters,
        theme: 'light',
        sidebarCollapsed: false,
        openTaskId: null,

        signIn: async (email, password) => {
          const r = await api.raw<{ user: User; tokens: Tokens }>('POST', '/auth/login', { body: { email, password }, anonymous: true })
          await startSession(r.tokens, r.user)
        },
        signUp: async (name, email, password) => {
          const r = await api.raw<{ user: User; tokens: Tokens }>('POST', '/auth/register', { body: { fullName: name, email, password }, anonymous: true })
          await startSession(r.tokens, r.user, false)
        },
        setupWorkspace: async ({ name, color, invites, templates, tools }) => {
          const ws = await api.post<Workspace>('/workspaces', { id: newId(), name, color })
          set({ currentWorkspaceId: ws.id })
          // Invites that fail (e.g. a typo'd address) shouldn't block getting into the app.
          await Promise.allSettled(invites.map((email) => api.post(`/workspaces/${ws.id}/members`, { email, role: 'member' })))
          await get().bootstrap()
          const s = get()
          const space = s.spaces[0]
          if (!space) return
          const listIds = templates.map((key) => s.applyTemplate(space.id, key, LIST_TEMPLATES.find((t) => t.key === key)?.name ?? key))
          const listId = listIds[0] ?? s.lists.find((l) => l.spaceId === space.id)?.id
          const has = (t: StarterTool) => tools.includes(t)

          // Starter content for each tool picked during onboarding.
          if (has('docs')) {
            const doc = s.addDoc(space.id)
            s.updateDoc(doc, { title: `Welcome to ${name}`, emoji: '👋', content: welcomeDoc(name) })
          }
          if (has('chat')) s.addChannel('announcements', 'Important updates for everyone')
          if (has('calls')) {
            const members = get().workspaces.find((w) => w.id === ws.id)?.members.map((m) => m.userId) ?? [me()]
            const general = get().channels.find((c) => c.kind === 'channel' && c.name === 'general')
            s.addMeeting({ title: 'Team kickoff', start: kickoffStart(), durationMin: 30, attendees: members, kind: 'video', agenda: 'Introductions\nHow we’ll work together\nFirst priorities', channelId: general?.id ?? null, taskId: null })
          }
          if (has('whiteboards')) {
            const board = s.addWhiteboard()
            s.updateWhiteboard(board, { title: 'Brainstorm', items: brainstormItems() })
          }
          if (has('goals')) {
            const goal = s.addGoal()
            s.updateGoal(goal, {
              name: 'Get our first project done',
              description: 'Tracks how many tasks in our first List are complete.',
              targets: listId ? [{ id: newId(), name: 'Tasks completed', kind: 'tasks', start: 0, current: 0, target: 0, unit: '', listId }] : [],
            })
          }
          if (has('forms') && listId) {
            const form = s.addForm(listId)
            s.updateForm(form, { title: 'Request intake', description: 'Tell us what you need and we’ll turn it into a task.' })
          }
          if (has('sprints')) s.startSprint(s.addSprint(space.id))
          if (has('automations'))
            s.addAutomation({ spaceId: space.id, name: 'Assign new tasks to me', enabled: true, trigger: { type: 'task_created', value: '' }, actions: [{ type: 'add_assignee', value: me() }] })
        },
        bootstrap: async () => {
          if (!session.signedIn) return
          set({ status: 'loading', loadError: null })
          try {
            const meUser = await api.get<User>('/users/me')
            let list = await api.get<Workspace[]>('/workspaces')
            if (!list.length) {
              // A brand-new account gets its first workspace (with a starter project and #general).
              const first = await api.post<Workspace>('/workspaces', { id: newId(), name: `${meUser.name.split(' ')[0]}’s workspace`, color: SPACE_COLORS[0] })
              list = [first]
            }
            set((s) => ({ currentUserId: meUser.id, users: [meUser, ...s.users.filter((u) => u.id !== meUser.id)], workspaces: list }))
            const keep = list.some((x) => x.id === get().currentWorkspaceId) ? get().currentWorkspaceId : list[0].id
            await enterWorkspace(keep)
            set({ status: 'ready' })
          } catch (e) {
            if (!session.signedIn) return
            set({ status: 'error', loadError: e instanceof Error ? e.message : 'Something went wrong' })
          }
        },
        reload: async () => {
          if (get().currentWorkspaceId) await loadWorkspace(get().currentWorkspaceId).catch(() => {})
        },
        toast: (text, tone = 'info') => {
          const id = newId()
          set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }))
          setTimeout(() => get().dismissToast(id), 5000)
        },
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

        switchWorkspace: (id) => {
          const s = get()
          if (id === s.currentWorkspaceId || !s.workspaces.some((x) => x.id === id)) return
          flushPending()
          set({ prefsByWorkspace: { ...s.prefsByWorkspace, [s.currentWorkspaceId]: { favorites: s.favorites, recents: s.recents, listViews: s.listViews } } })
          void enterWorkspace(id).catch((e) => get().toast(e.message, 'error'))
        },
        addWorkspace: (name) => {
          const id = newId()
          const color = SPACE_COLORS[get().workspaces.length % SPACE_COLORS.length]
          set((s) => ({ workspaces: [...s.workspaces, { id, name, color, createdAt: now(), members: [{ userId: me(), role: 'owner' }] }] }))
          api.post<Workspace>('/workspaces', { id, name, color }).then(
            (ws) => {
              set((s) => ({ workspaces: s.workspaces.map((x) => (x.id === id ? ws : x)) }))
              get().switchWorkspace(id)
            },
            () => set((s) => ({ workspaces: s.workspaces.filter((x) => x.id !== id) })),
          )
          return id
        },
        renameWorkspace: (id, name) => get().updateWorkspace(id, { name }),
        deleteWorkspace: (id) => {
          const s = get()
          if (s.workspaces.length < 2) return
          if (id === s.currentWorkspaceId) get().switchWorkspace(s.workspaces.find((x) => x.id !== id)!.id)
          set((st) => ({ workspaces: st.workspaces.filter((x) => x.id !== id) }))
          void api.del(`/workspaces/${id}`)
        },

        updateWorkspace: (id, patch) => {
          set((s) => ({ workspaces: s.workspaces.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
          const body = pick(patch, ['name', 'color'])
          if (Object.keys(body).length) patchSoon(`ws:${id}`, body, (b) => void api.patch(`/workspaces/${id}`, b))
        },
        inviteMember: (name, email, role) => {
          void api.post(w('/members'), { name, email, role }).then(() => get().reload())
        },
        setMemberRole: (userId, role) => {
          set((s) => ({ workspaces: s.workspaces.map((x) => (x.id === s.currentWorkspaceId ? { ...x, members: x.members.map((m) => (m.userId === userId ? { ...m, role } : m)) } : x)) }))
          void api.patch(w(`/members/${userId}`), { role })
        },
        removeMember: (userId) => {
          set((s) => ({
            workspaces: s.workspaces.map((x) => (x.id === s.currentWorkspaceId ? { ...x, members: x.members.filter((m) => m.userId !== userId) } : x)),
            tasks: s.tasks.map((t) => (t.assignees.includes(userId) ? { ...t, assignees: t.assignees.filter((a) => a !== userId) } : t)),
          }))
          void api.del(w(`/members/${userId}`))
        },

        addMeeting: (m) => {
          const id = newId()
          upsert('meetings', { ...m, id, createdBy: me(), notesDocId: null })
          save('meetings', api.post<Meeting>(w('/meetings'), { ...m, id }))
          return id
        },
        updateMeeting: (id, patch) => {
          const cur = get().meetings.find((m) => m.id === id)
          if (!cur) return
          const next = { ...cur, ...patch }
          upsert('meetings', next)
          save('meetings', api.put<Meeting>(w(`/meetings/${id}`), next))
        },
        deleteMeeting: (id) => {
          removeLocal('meetings', id)
          void api.del(w(`/meetings/${id}`))
        },
        updateCallLog: (id, patch) => {
          patchLocal('callLogs', id, patch)
          save('callLogs', api.patch<CallLog>(w(`/calls/${id}`), patch))
        },
        postMessage: (m) => {
          const id = newId()
          upsert('messages', { userId: me(), createdAt: now(), parentId: null, taskId: null, reactions: {}, ...m, id })
          save('messages', api.post<Message>(w(`/channels/${m.channelId}/messages`), { id, text: m.text, parentId: m.parentId ?? null, clipId: m.clipId ?? null, callId: m.callId ?? null }))
          return id
        },

        addClip: (c) => upsert('clips', c),
        updateClip: (id, patch) => {
          patchLocal('clips', id, patch)
          const body = pick(patch, ['title', 'taskId'])
          if ('taskId' in patch && patch.taskId) {
            const t = get().tasks.find((x) => x.id === patch.taskId)
            if (t && !t.clipIds.includes(id)) patchLocal('tasks', t.id, { clipIds: [...t.clipIds, id] })
          }
          patchSoon(`clips:${id}`, body, (b) => save('clips', api.patch<Clip>(w(`/clips/${id}`), b)), 'title' in body ? 400 : 0)
        },
        deleteClip: (id) => {
          set((s) => ({
            clips: s.clips.filter((c) => c.id !== id),
            tasks: s.tasks.map((t) => (t.clipIds.includes(id) ? { ...t, clipIds: t.clipIds.filter((x) => x !== id) } : t)),
            messages: s.messages.map((m) => (m.clipId === id ? { ...m, clipId: null } : m)),
            callLogs: s.callLogs.map((c) => (c.recordingClipId === id ? { ...c, recordingClipId: null } : c)),
          }))
          void api.del(w(`/clips/${id}`))
        },
        shareClip: (id, channelId) => void api.post(w(`/clips/${id}/share`), { channelId }),

        addForm: (listId) => {
          const id = newId()
          const fields: FormField[] = [
            { id: 'q1', label: 'Title', kind: 'short', required: true, options: [], target: 'title', help: '' },
            { id: 'q2', label: 'Details', kind: 'long', required: false, options: [], target: 'description', help: '' },
          ]
          upsert('forms', { id, listId, title: 'Untitled form', description: '', color: '#0b7f71', fields, assignTo: [], submitText: 'Submit', thanksText: 'Thanks — your response was recorded.', active: true, submissions: 0, createdAt: now() })
          save('forms', api.post<Form>(w('/forms'), { id, listId }))
          return id
        },
        updateForm: (id, patch) => {
          patchLocal('forms', id, patch)
          const body = pick(patch, ['listId', 'title', 'description', 'color', 'fields', 'assignTo', 'submitText', 'thanksText', 'active'])
          const v = remember('forms', id, body)
          patchSoon(`forms:${id}`, body, (b) => save('forms', api.patch<Form>(w(`/forms/${id}`), b), v, id))
        },
        deleteForm: (id) => {
          cancelPending(`forms:${id}`)
          removeLocal('forms', id)
          void api.del(w(`/forms/${id}`))
        },

        addSprint: (spaceId) => {
          const id = newId()
          const existing = get().sprints.filter((x) => x.spaceId === spaceId).sort((a, b) => a.endDate.localeCompare(b.endDate))
          const last = existing[existing.length - 1]
          const start = last ? addDays(parseISO(last.endDate), 1) : new Date()
          const nums = existing.map((x) => Number(x.name.match(/(\d+)/)?.[1] ?? 0))
          upsert('sprints', { id, spaceId, name: `Sprint ${Math.max(0, ...nums) + 1}`, goal: '', startDate: toISODate(start), endDate: toISODate(addDays(start, 13)), status: 'planned' })
          save('sprints', api.post<Sprint>(w('/sprints'), { id, projectId: spaceId }))
          return id
        },
        updateSprint: (id, patch) => {
          patchLocal('sprints', id, patch)
          const body = pick(patch, ['name', 'goal', 'startDate', 'endDate'])
          const v = remember('sprints', id, body)
          patchSoon(`sprints:${id}`, body, (b) => save('sprints', api.patch<Sprint>(w(`/sprints/${id}`), b), v, id))
        },
        deleteSprint: (id) => {
          cancelPending(`sprints:${id}`)
          set((s) => ({ sprints: s.sprints.filter((x) => x.id !== id), tasks: s.tasks.map((t) => (t.sprintId === id ? { ...t, sprintId: null } : t)) }))
          void api.del(w(`/sprints/${id}`))
        },
        startSprint: (id) => {
          set((s) => {
            const sp = s.sprints.find((x) => x.id === id)
            if (!sp) return {}
            return { sprints: s.sprints.map((x) => (x.id === id ? { ...x, status: 'active' } : x.spaceId === sp.spaceId && x.status === 'active' ? { ...x, status: 'done' } : x)) }
          })
          save('sprints', api.post<Sprint>(w(`/sprints/${id}/start`)))
        },
        completeSprint: (id, moveTo) => {
          const s = get()
          const sp = s.sprints.find((x) => x.id === id)
          if (!sp) return
          const space = s.spaces.find((x) => x.id === sp.spaceId)
          const isDone = (t: Task) => ['done', 'closed'].includes(space?.statuses.find((st) => st.id === t.statusId)?.type ?? '')
          set((st) => ({
            sprints: st.sprints.map((x) => (x.id === id ? { ...x, status: 'done' } : moveTo && x.id === moveTo ? { ...x, status: 'active' } : x)),
            tasks: st.tasks.map((t) => (t.sprintId === id && !isDone(t) ? { ...t, sprintId: moveTo } : t)),
          }))
          save('sprints', api.post<Sprint>(w(`/sprints/${id}/complete`), { moveTo }))
        },

        addReminder: (r) => {
          const id = newId()
          upsert('reminders', { ...r, id, done: false, notified: false, createdAt: now() })
          save('reminders', api.post<Reminder>(w('/reminders'), { id, text: r.text, due: r.due, taskId: r.taskId }))
          return id
        },
        updateReminder: (id, patch) => {
          patchLocal('reminders', id, patch)
          save('reminders', api.patch<Reminder>(w(`/reminders/${id}`), pick(patch, ['text', 'due', 'done'])))
        },
        deleteReminder: (id) => {
          removeLocal('reminders', id)
          void api.del(w(`/reminders/${id}`))
        },

        submitTimesheet: (weekStart) => {
          const id = `${me()}:${weekStart}`
          const cur = get().timesheets.find((t) => t.id === id)
          upsert('timesheets', { id, userId: me(), weekStart, note: '', decidedBy: null, decidedAt: null, ...cur, status: 'submitted', submittedAt: now() })
          save('timesheets', api.post<Timesheet>(w('/timesheets/submit'), { weekStart }))
        },
        decideTimesheet: (userId, weekStart, approve, note = '') => {
          patchLocal('timesheets', `${userId}:${weekStart}`, { status: approve ? 'approved' : 'rejected', note, decidedBy: me(), decidedAt: now() })
          save('timesheets', api.post<Timesheet>(w('/timesheets/decide'), { userId, weekStart, approve, note }))
        },
        reopenTimesheet: (userId, weekStart) => {
          patchLocal('timesheets', `${userId}:${weekStart}`, { status: 'open', submittedAt: null, decidedBy: null, decidedAt: null })
          save('timesheets', api.post<Timesheet>(w('/timesheets/reopen'), { userId, weekStart }))
        },

        toggleWatcher: (taskId, userId) => {
          const t = get().tasks.find((x) => x.id === taskId)
          if (t) get().updateTask(taskId, { watchers: t.watchers.includes(userId) ? t.watchers.filter((x) => x !== userId) : [...t.watchers, userId] })
        },
        updateComment: (id, patch) => {
          patchLocal('comments', id, patch)
          if (patch.resolved !== undefined) save('comments', api.patch<Comment>(w(`/comments/${id}`), { resolved: patch.resolved }))
        },
        importTasks: (listId, rows) => {
          const valid = rows.filter((r) => r.title?.trim()).map((r) => ({ ...pick(r, TASK_PATCH_KEYS), id: newId(), listId, title: r.title!.trim() }))
          if (valid.length) void api.post(w('/tasks/import'), { listId, rows: valid })
          return valid.length
        },

        logout: () => {
          flushPending()
          // Revokes this session's refresh tokens (the server reads the session from the access token).
          if (session.signedIn) void api.raw('POST', '/auth/logout').catch(() => {})
          realtime?.close()
          realtime = null
          // Clear our state before the session listeners run, so they don't call logout again.
          set({ ...emptyData(), signedIn: false, status: 'idle', currentUserId: null, users: [], workspaces: [], openTaskId: null })
          session.set(null)
        },
        setTheme: (theme) => set({ theme }),
        toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
        setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
        setListView: (listId, v) => set((s) => ({ listViews: { ...s.listViews, [listId]: v } })),
        openTask: (id) => {
          set({ openTaskId: id })
          if (id) get().touchRecent(id)
        },
        touchRecent: (id) => set((s) => ({ recents: [id, ...s.recents.filter((r) => r !== id)].slice(0, 12) })),
        toggleFavorite: (id) => set((s) => ({ favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id] })),

        addSpace: (name) => {
          const id = newId()
          const color = SPACE_COLORS[get().spaces.length % SPACE_COLORS.length]
          save('spaces', api.post<Space>(w('/projects'), { id, name, color }))
          // Statuses come from the server; show the space as soon as it answers.
          return id
        },
        updateSpace: (id, patch) => {
          patchLocal('spaces', id, patch)
          const body = pick(patch, ['name', 'color', 'statuses'])
          const v = remember('spaces', id, body)
          patchSoon(`spaces:${id}`, body, (b) => save('spaces', api.patch<Space>(w(`/projects/${id}`), b), v, id))
        },
        deleteSpace: (id) => {
          cancelPending(`spaces:${id}`)
          const s = get()
          dropLists(s.lists.filter((l) => l.spaceId === id).map((l) => l.id))
          set((st) => ({
            spaces: st.spaces.filter((sp) => sp.id !== id),
            folders: st.folders.filter((f) => f.spaceId !== id),
            automations: st.automations.filter((a) => a.spaceId !== id),
            sprints: st.sprints.filter((x) => x.spaceId !== id),
            docs: st.docs.map((d) => (d.spaceId === id ? { ...d, spaceId: null } : d)),
          }))
          void api.del(w(`/projects/${id}`))
        },
        addFolder: (spaceId, name) => {
          const id = newId()
          upsert('folders', { id, spaceId, name })
          save('folders', api.post<Folder>(w('/folders'), { id, projectId: spaceId, name }))
          return id
        },
        renameFolder: (id, name) => {
          patchLocal('folders', id, { name })
          save('folders', api.patch<Folder>(w(`/folders/${id}`), { name }))
        },
        deleteFolder: (id) => {
          dropLists(get().lists.filter((l) => l.folderId === id).map((l) => l.id))
          removeLocal('folders', id)
          void api.del(w(`/folders/${id}`))
        },
        addList: (spaceId, folderId, name) => {
          const id = newId()
          upsert('lists', { id, spaceId, folderId, name })
          save('lists', api.post<List>(w('/lists'), { id, projectId: spaceId, folderId, name }))
          return id
        },
        renameList: (id, name) => {
          patchLocal('lists', id, { name })
          save('lists', api.patch<List>(w(`/lists/${id}`), { name }))
        },
        deleteList: (id) => {
          dropLists([id])
          void api.del(w(`/lists/${id}`))
        },
        applyTemplate: (spaceId, key, name) => {
          const id = newId()
          upsert('lists', { id, spaceId, folderId: null, name })
          // The template's tasks arrive over the realtime connection.
          save('lists', api.post<List>(w('/lists/from-template'), { id, projectId: spaceId, template: key, name }))
          return id
        },

        addTask: (input) => {
          const s = get()
          const list = s.lists.find((l) => l.id === input.listId)
          const space = s.spaces.find((sp) => sp.id === list?.spaceId)
          const id = input.id ?? newId()
          const task: Task = {
            parentId: null, description: '', priority: null, assignees: [], tags: [], startDate: null, dueDate: null, estimate: null, checklist: [],
            blockedBy: [], recurrence: null, custom: {}, sprintId: null, points: null, watchers: [], clipIds: [],
            key: Math.max(99, ...s.tasks.map((t) => t.key)) + 1,
            statusId: space?.statuses[0]?.id ?? '',
            order: Math.max(0, ...s.tasks.map((t) => t.order)) + 1,
            createdAt: now(),
            updatedAt: now(),
            ...input,
            id,
          }
          upsert('tasks', task)
          save('tasks', api.post<Task>(w('/tasks'), { ...pick(task, [...TASK_PATCH_KEYS, 'parentId']), id }))
          return id
        },
        updateTask: (id, patch) => {
          if (!get().tasks.some((t) => t.id === id)) return
          patchLocal('tasks', id, { ...patch, updatedAt: now() })
          const body = pick(patch, TASK_PATCH_KEYS)
          if (!Object.keys(body).length) return
          const v = remember('tasks', id, body)
          patchSoon(`tasks:${id}`, body, (b) => save('tasks', api.patch<Task>(w(`/tasks/${id}`), b), v, id), 'title' in body || 'description' in body ? 400 : 0)
        },
        deleteTask: (id) => {
          cancelPending(`tasks:${id}`)
          dropTasks([id])
          void api.del(w(`/tasks/${id}`))
        },
        duplicateTask: (id) => {
          const t = get().tasks.find((x) => x.id === id)!
          const copy = newId()
          upsert('tasks', { ...t, id: copy, title: `${t.title} (copy)`, key: Math.max(...get().tasks.map((x) => x.key)) + 1, createdAt: now(), updatedAt: now() })
          save('tasks', api.post<Task>(w(`/tasks/${id}/duplicate`), { id: copy }))
          return copy
        },
        moveTask: (id, statusId, beforeId) => {
          const s = get()
          const task = s.tasks.find((t) => t.id === id)
          if (!task) return
          let order: number
          if (beforeId) {
            const before = s.tasks.find((t) => t.id === beforeId)!
            const prev = s.tasks
              .filter((t) => t.listId === task.listId && t.statusId === statusId && t.id !== id && t.order < before.order)
              .sort((a, b) => b.order - a.order)[0]
            order = prev ? (prev.order + before.order) / 2 : before.order - 1
          } else order = Math.max(0, ...s.tasks.map((t) => t.order)) + 1
          patchLocal('tasks', id, { statusId, order })
          const v = remember('tasks', id, { statusId, order })
          save('tasks', api.post<Task>(w(`/tasks/${id}/move`), { statusId, beforeId }), v, id)
        },
        bulkUpdate: (ids, patch) => {
          set((s) => ({ tasks: s.tasks.map((t) => (ids.includes(t.id) ? { ...t, ...patch, updatedAt: now() } : t)) }))
          void api.post(w('/tasks/bulk'), { ids, patch: pick(patch, TASK_PATCH_KEYS) })
        },
        bulkDelete: (ids) => {
          ids.forEach((id) => cancelPending(`tasks:${id}`))
          dropTasks(ids)
          void api.post(w('/tasks/bulk-delete'), { ids })
        },
        addDependency: (taskId, blockerId) => {
          const t = get().tasks.find((x) => x.id === taskId)
          if (!t || taskId === blockerId || t.blockedBy.includes(blockerId)) return
          if (get().tasks.find((x) => x.id === blockerId)?.blockedBy.includes(taskId)) return
          patchLocal('tasks', taskId, { blockedBy: [...t.blockedBy, blockerId] })
          save('tasks', api.post<Task>(w(`/tasks/${taskId}/dependencies`), { blockerId }))
        },
        removeDependency: (taskId, blockerId) => {
          const t = get().tasks.find((x) => x.id === taskId)
          if (t) patchLocal('tasks', taskId, { blockedBy: t.blockedBy.filter((b) => b !== blockerId) })
          void api.del(w(`/tasks/${taskId}/dependencies/${blockerId}`))
        },

        addField: (listId, name, type) => {
          const id = newId()
          upsert('fields', { id, listId, name, type, options: [] })
          save('fields', api.post<CustomField>(w('/fields'), { id, listId, name, type }))
          return id
        },
        updateField: (id, patch) => {
          patchLocal('fields', id, patch)
          save('fields', api.patch<CustomField>(w(`/fields/${id}`), pick(patch, ['name', 'options'])))
        },
        deleteField: (id) => {
          set((s) => ({
            fields: s.fields.filter((f) => f.id !== id),
            tasks: s.tasks.map((t) => {
              if (!(id in t.custom)) return t
              const { [id]: _drop, ...custom } = t.custom
              return { ...t, custom }
            }),
          }))
          void api.del(w(`/fields/${id}`))
        },
        setCustomValue: (taskId, fieldId, value) => {
          const t = get().tasks.find((x) => x.id === taskId)
          if (!t) return
          patchLocal('tasks', taskId, { custom: { ...t.custom, [fieldId]: value } })
          save('tasks', api.patch<Task>(w(`/tasks/${taskId}`), { custom: { [fieldId]: value } }))
        },

        addComment: (taskId, text, assignee = null) => {
          save('comments', api.post<Comment>(w(`/tasks/${taskId}/comments`), { text, assignee }))
        },

        startTimer: (taskId) => {
          set({ timer: { taskId, start: now() } })
          void api.post(w('/timer/start'), { taskId })
        },
        stopTimer: () => {
          if (!get().timer) return
          set({ timer: null })
          save('timeEntries', api.post<TimeEntry>(w('/timer/stop')))
        },
        addTimeEntry: (e) => save('timeEntries', api.post<TimeEntry>(w('/time-entries'), e)),
        updateTimeEntry: (id, patch) => {
          patchLocal('timeEntries', id, patch)
          save('timeEntries', api.patch<TimeEntry>(w(`/time-entries/${id}`), pick(patch, ['duration', 'note'])))
        },
        deleteTimeEntry: (id) => {
          removeLocal('timeEntries', id)
          void api.del(w(`/time-entries/${id}`))
        },

        addDoc: (spaceId) => {
          const id = newId()
          set((s) => ({ docs: [{ id, spaceId, title: '', content: '', emoji: '📄', createdBy: me(), updatedAt: now() }, ...s.docs] }))
          save('docs', api.post<Doc>(w('/docs'), { id, projectId: spaceId, title: '', content: '', emoji: '📄' }))
          return id
        },
        updateDoc: (id, patch) => {
          patchLocal('docs', id, { ...patch, updatedAt: now() })
          const body: Record<string, unknown> = pick(patch, ['title', 'content', 'emoji'])
          if ('spaceId' in patch) {
            if (patch.spaceId) body.projectId = patch.spaceId
            else body.clearProject = true
          }
          const v = remember('docs', id, pick(patch, ['title', 'content', 'emoji', 'spaceId']))
          patchSoon(`docs:${id}`, body, (b) => save('docs', api.patch<Doc>(w(`/docs/${id}`), b), v, id), 'content' in body || 'title' in body ? 500 : 0)
        },
        deleteDoc: (id) => {
          cancelPending(`docs:${id}`)
          set((s) => ({ docs: s.docs.filter((d) => d.id !== id), favorites: s.favorites.filter((f) => f !== id) }))
          void api.del(w(`/docs/${id}`))
        },

        addChannel: (name, topic) => {
          const id = newId()
          upsert('channels', { id, name: name.toLowerCase().replace(/\s+/g, '-'), kind: 'channel', members: [], topic })
          save('channels', api.post<Channel>(w('/channels'), { id, name, topic }))
          return id
        },
        openDM: (userId) => {
          const existing = get().channels.find((c) => c.kind === 'dm' && c.members.includes(userId) && c.members.includes(me()))
          if (existing) return existing.id
          const id = newId()
          upsert('channels', { id, name: '', kind: 'dm', members: [me(), userId], topic: '' })
          save('channels', api.post<Channel>(w('/channels/dm'), { id, userId }))
          return id
        },
        sendMessage: (channelId, text, parentId = null) => {
          const id = newId()
          set((s) => ({
            messages: [...s.messages, { id, channelId, userId: me(), text, createdAt: now(), parentId, taskId: null, reactions: {} }],
            lastRead: { ...s.lastRead, [channelId]: now() },
          }))
          save('messages', api.post<Message>(w(`/channels/${channelId}/messages`), { id, text, parentId }))
        },
        editMessage: (id, text) => {
          patchLocal('messages', id, { text, edited: true })
          save('messages', api.patch<Message>(w(`/messages/${id}`), { text }))
        },
        deleteMessage: (id) => {
          set((s) => ({ messages: s.messages.filter((m) => m.id !== id && m.parentId !== id) }))
          void api.del(w(`/messages/${id}`))
        },
        toggleReaction: (id, emoji) => {
          set((s) => ({
            messages: s.messages.map((m) => {
              if (m.id !== id) return m
              const users = m.reactions[emoji] ?? []
              const next = users.includes(me()) ? users.filter((u) => u !== me()) : [...users, me()]
              const reactions = { ...m.reactions, [emoji]: next }
              if (!next.length) delete reactions[emoji]
              return { ...m, reactions }
            }),
          }))
          save('messages', api.post<Message>(w(`/messages/${id}/reactions`), { emoji }))
        },
        markChannelRead: (channelId) => {
          const last = get().lastRead[channelId]
          set((s) => ({ lastRead: { ...s.lastRead, [channelId]: now() } }))
          // Opening a channel marks it read; skip repeats within a few seconds.
          if (!last || Date.now() - new Date(last).getTime() > 3000) patchSoon(`read:${channelId}`, {}, () => void api.post(w(`/channels/${channelId}/read`)), 300)
        },
        messageToTask: (messageId, listId) => {
          const m = get().messages.find((x) => x.id === messageId)!
          const taskId = newId()
          const s = get()
          const list = s.lists.find((l) => l.id === listId)
          const space = s.spaces.find((sp) => sp.id === list?.spaceId)
          upsert('tasks', {
            id: taskId, key: Math.max(99, ...s.tasks.map((t) => t.key)) + 1, listId, parentId: null, title: m.text.replace(/\s+/g, ' ').slice(0, 80),
            description: `<p>${m.text.replace(/</g, '&lt;')}</p>`, statusId: space?.statuses[0]?.id ?? '', priority: null, assignees: [me()], tags: [],
            startDate: null, dueDate: null, estimate: null, checklist: [], blockedBy: [], recurrence: null, custom: {}, sprintId: null, points: null,
            watchers: [], clipIds: [], order: Math.max(0, ...s.tasks.map((t) => t.order)) + 1, createdAt: now(), updatedAt: now(),
          })
          patchLocal('messages', messageId, { taskId })
          save('messages', api.post<Message>(w(`/messages/${messageId}/task`), { listId, taskId }))
          return taskId
        },

        addWhiteboard: () => {
          const id = newId()
          set((s) => ({ whiteboards: [{ id, title: 'Untitled whiteboard', items: [], createdBy: me(), updatedAt: now() }, ...s.whiteboards] }))
          save('whiteboards', api.post<Whiteboard>(w('/whiteboards'), { id, title: 'Untitled whiteboard' }))
          return id
        },
        updateWhiteboard: (id, patch) => {
          patchLocal('whiteboards', id, { ...patch, updatedAt: now() })
          const body = pick(patch, ['title', 'items'])
          const v = remember('whiteboards', id, body)
          patchSoon(`whiteboards:${id}`, body, (b) => save('whiteboards', api.patch<Whiteboard>(w(`/whiteboards/${id}`), b), v, id))
        },
        setBoardItems: (id, items) => get().updateWhiteboard(id, { items }),
        deleteWhiteboard: (id) => {
          cancelPending(`whiteboards:${id}`)
          removeLocal('whiteboards', id)
          void api.del(w(`/whiteboards/${id}`))
        },

        addTeam: (input) => {
          const id = newId()
          const team: Team = { id, color: '#0b7f71', description: '', leadId: null, members: [], createdBy: me(), createdAt: now(), updatedAt: now(), ...input }
          upsert('teams', team)
          save('teams', api.post<Team>(w('/teams'), pick(team, ['id', 'name', 'color', 'description', 'leadId', 'members'])))
          return id
        },
        updateTeam: (id, patch) => {
          const cur = get().teams.find((t) => t.id === id)
          if (!cur) return
          const next = { ...cur, ...patch, updatedAt: now() }
          patchLocal('teams', id, next)
          save('teams', api.patch<Team>(w(`/teams/${id}`), pick(next, ['name', 'color', 'description', 'leadId', 'members'])), undefined, id)
        },
        deleteTeam: (id) => {
          removeLocal('teams', id)
          void api.del(w(`/teams/${id}`))
        },
        setMemberProfile: async (userId, patch) => {
          try {
            const m = await api.patch<Member>(w(`/members/${userId}/profile`), patch)
            set((s) => ({ workspaces: s.workspaces.map((x) => (x.id !== wid() ? x : { ...x, members: x.members.map((y) => (y.userId === userId ? { ...y, ...m } : y)) })) }))
            return true
          } catch (e) {
            get().toast(e instanceof Error ? e.message : 'Could not update that person', 'error')
            return false
          }
        },

        addGoal: () => {
          const id = newId()
          upsert('goals', { id, name: 'New goal', description: '', color: SPACE_COLORS[get().goals.length % SPACE_COLORS.length], ownerId: me(), dueDate: null, folder: 'Goals', targets: [] })
          save('goals', api.post<Goal>(w('/goals'), { id }))
          return id
        },
        updateGoal: (id, patch) => {
          patchLocal('goals', id, patch)
          const body: Record<string, unknown> = pick(patch, ['name', 'description', 'color', 'ownerId', 'folder', 'targets'])
          if ('dueDate' in patch) {
            if (patch.dueDate) body.dueDate = patch.dueDate
            else body.clearDue = true
          }
          const v = remember('goals', id, pick(patch, ['name', 'description', 'color', 'ownerId', 'folder', 'targets', 'dueDate']))
          patchSoon(`goals:${id}`, body, (b) => save('goals', api.patch<Goal>(w(`/goals/${id}`), b), v, id))
        },
        deleteGoal: (id) => {
          cancelPending(`goals:${id}`)
          removeLocal('goals', id)
          void api.del(w(`/goals/${id}`))
        },
        addTarget: (goalId, t) => {
          const g = get().goals.find((x) => x.id === goalId)
          if (g) get().updateGoal(goalId, { targets: [...g.targets, { ...t, id: newId() }] })
        },
        updateTarget: (goalId, targetId, patch) => {
          const g = get().goals.find((x) => x.id === goalId)
          if (g) get().updateGoal(goalId, { targets: g.targets.map((t) => (t.id === targetId ? { ...t, ...patch } : t)) })
        },
        deleteTarget: (goalId, targetId) => {
          const g = get().goals.find((x) => x.id === goalId)
          if (g) get().updateGoal(goalId, { targets: g.targets.filter((t) => t.id !== targetId) })
        },

        addAutomation: (a) => {
          const id = newId()
          upsert('automations', { ...a, id, runs: 0, lastRun: null })
          save('automations', api.post<Automation>(w('/automations'), toApi({ ...a, id })))
          return id
        },
        updateAutomation: (id, patch) => {
          patchLocal('automations', id, patch)
          save('automations', api.patch<Automation>(w(`/automations/${id}`), pick(patch, ['name', 'enabled', 'trigger', 'actions'])))
        },
        deleteAutomation: (id) => {
          removeLocal('automations', id)
          void api.del(w(`/automations/${id}`))
        },

        markRead: (id, read = true) => {
          patchLocal('notifications', id, { read })
          void api.patch(w(`/notifications/${id}`), { read })
        },
        markAllRead: () => {
          set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }))
          void api.post(w('/notifications/read-all'))
        },
        clearNotification: (id, cleared = true) => {
          patchLocal('notifications', id, { cleared, read: true })
          void api.patch(w(`/notifications/${id}`), { cleared, read: true })
        },
      }
    },
    {
      name: 'meetspace-ui',
      version: 1,
      // Only browser preferences persist; workspace data always comes from the server.
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        currentWorkspaceId: s.currentWorkspaceId,
        favorites: s.favorites,
        recents: s.recents,
        listViews: s.listViews,
        prefsByWorkspace: s.prefsByWorkspace,
      }),
    },
  ),
)

// A failed write means the optimistic state is wrong: say so and reload the truth.
onWriteError((e: ApiError) => {
  const s = useStore.getState()
  if (e.status === 401) return
  s.toast(e.message || 'That change could not be saved', 'error')
  void s.reload()
})

session.subscribe((signedIn) => {
  if (!signedIn && useStore.getState().signedIn) useStore.getState().logout()
})

export const useMe = () => useStore((s) => s.users.find((u) => u.id === s.currentUserId) ?? { id: s.currentUserId ?? '', name: 'You', email: '', color: '#64748b' })

export function useSpaceOfList(listId: ID | undefined) {
  return useStore((s) => {
    const list = s.lists.find((l) => l.id === listId)
    return s.spaces.find((sp) => sp.id === list?.spaceId)
  })
}

export function statusOf(task: Task, spaces: Space[], lists: List[]) {
  const list = lists.find((l) => l.id === task.listId)
  const space = spaces.find((s) => s.id === list?.spaceId)
  return space?.statuses.find((st) => st.id === task.statusId)
}

export function applyFilters(tasks: Task[], f: Filters, isClosed: (t: Task) => boolean) {
  const today = new Date().toISOString().slice(0, 10)
  const week = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  let out = tasks.filter((t) => {
    if (f.search && !t.title.toLowerCase().includes(f.search.toLowerCase()) && !`ms-${t.key}`.includes(f.search.toLowerCase())) return false
    if (f.assignees.length && !t.assignees.some((a) => f.assignees.includes(a))) return false
    if (f.priorities.length && !f.priorities.includes(t.priority ?? 'none')) return false
    if (f.tags?.length && !t.tags.some((g) => f.tags.includes(g))) return false
    if (f.due) {
      const d = t.dueDate?.slice(0, 10) ?? null
      if (f.due === 'none' ? d !== null : !d) return false
      if (f.due === 'overdue' && !(d! < today && !isClosed(t))) return false
      if (f.due === 'today' && d !== today) return false
      if (f.due === 'week' && !(d! >= today && d! <= week)) return false
    }
    if (!f.showClosed && isClosed(t)) return false
    return true
  })
  const rank: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3, none: 4 }
  const last = (v: string | null) => v ?? '9999'
  const num = (v: number | null) => v ?? Number.MAX_SAFE_INTEGER
  const dir = f.sortDir === 'desc' ? -1 : 1
  out = [...out].sort((a, b) => {
    switch (f.sort) {
      case 'due':
        return dir * last(a.dueDate).localeCompare(last(b.dueDate))
      case 'start':
        return dir * last(a.startDate).localeCompare(last(b.startDate))
      case 'priority':
        return dir * (rank[a.priority ?? 'none'] - rank[b.priority ?? 'none'])
      case 'title':
        return dir * a.title.localeCompare(b.title)
      case 'created':
        return dir * a.createdAt.localeCompare(b.createdAt)
      case 'updated':
        return dir * a.updatedAt.localeCompare(b.updatedAt)
      case 'estimate':
        return dir * (num(a.estimate) - num(b.estimate))
      case 'points':
        return dir * (num(a.points) - num(b.points))
      default:
        return a.order - b.order
    }
  })
  return out
}

/** Minutes → "1h 25m" */
export function formatMinutes(min: number) {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

/** Progress (0–1) for a goal target; task targets are computed live from their List. */
export function targetProgress(t: Target, tasks: Task[], isDone: (t: Task) => boolean) {
  if (t.kind === 'tasks') {
    const list = tasks.filter((x) => x.listId === t.listId && !x.parentId)
    return { current: list.filter(isDone).length, target: list.length, pct: list.length ? list.filter(isDone).length / list.length : 0 }
  }
  if (t.kind === 'boolean') return { current: t.current, target: 1, pct: t.current ? 1 : 0 }
  const span = t.target - t.start
  const pct = span === 0 ? 1 : (t.current - t.start) / span
  return { current: t.current, target: t.target, pct: Math.max(0, Math.min(1, pct)) }
}

/** URL of a clip's media (the token rides in the query because <video> can't send headers). */
export function clipMediaUrl(clipId: ID) {
  const s = useStore.getState()
  return `/api/v1/workspaces/${s.currentWorkspaceId}/clips/${clipId}/media?access_token=${encodeURIComponent(session.accessToken ?? '')}`
}
