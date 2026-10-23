import { addDays, differenceInCalendarDays, isValid, parseISO } from 'date-fns'
import { BOT, formatMinutes, useStore } from '../../store/useStore'
import type { Priority, Status, Task } from '../../store/types'
import { toISODate } from '../../lib/utils'

/** What a tool did, shown as a chip under the assistant's answer. */
export interface ToolEffect {
  label: string
  taskId?: string
  docId?: string
}

export interface ToolOutcome {
  /** JSON-ish text handed back to the model (or formatted by the local engine). */
  content: string
  data?: unknown
  effect?: ToolEffect
  isError?: boolean
}

const S = () => useStore.getState()

/* ---------------- lookups ---------------- */

function spaceOf(t: Task) {
  const s = S()
  const list = s.lists.find((l) => l.id === t.listId)
  return s.spaces.find((sp) => sp.id === list?.spaceId)
}
function statusOf(t: Task): Status | undefined {
  return spaceOf(t)?.statuses.find((st) => st.id === t.statusId)
}
function isDone(t: Task) {
  const ty = statusOf(t)?.type
  return ty === 'done' || ty === 'closed'
}
export function userName(id: string) {
  return S().users.find((u) => u.id === id)?.name ?? id
}

export function findUser(ref: string) {
  const q = ref.trim().toLowerCase().replace(/^@/, '')
  if (!q) return undefined
  const s = S()
  if (['me', 'myself', 'i'].includes(q)) return s.users.find((u) => u.id === (s.currentUserId ?? 'u1'))
  return s.users.find((u) => u.name.toLowerCase() === q) ?? s.users.find((u) => u.name.toLowerCase().split(' ').some((p) => p === q)) ?? s.users.find((u) => u.name.toLowerCase().includes(q))
}

export function findTask(ref: string) {
  const s = S()
  const r = ref.trim()
  const key = r.match(/^(?:MS-)?(\d+)$/i)
  if (key) return s.tasks.find((t) => t.key === Number(key[1]))
  const q = r.toLowerCase().replace(/^["“]|["”]$/g, '')
  return s.tasks.find((t) => t.title.toLowerCase() === q) ?? s.tasks.find((t) => t.title.toLowerCase().includes(q))
}

export function findList(ref: string | undefined) {
  const s = S()
  if (!ref) return undefined
  const q = ref.trim().toLowerCase()
  return s.lists.find((l) => l.id === ref) ?? s.lists.find((l) => l.name.toLowerCase() === q) ?? s.lists.find((l) => l.name.toLowerCase().includes(q))
}

function findProject(ref: string) {
  const q = ref.trim().toLowerCase()
  return S().spaces.find((sp) => sp.name.toLowerCase() === q) ?? S().spaces.find((sp) => sp.name.toLowerCase().includes(q))
}

function resolveStatus(t: Task, ref: string) {
  const sts = spaceOf(t)?.statuses ?? []
  const q = ref.trim().toLowerCase()
  const byType: Record<string, Status['type']> = { done: 'done', complete: 'done', completed: 'done', closed: 'done', finished: 'done', open: 'open', todo: 'open', 'to do': 'open', started: 'active', active: 'active' }
  return sts.find((st) => st.name.toLowerCase() === q) ?? sts.find((st) => st.name.toLowerCase().includes(q)) ?? (byType[q] ? sts.find((st) => st.type === byType[q]) : undefined)
}

function validDate(v: unknown): string | null | undefined {
  if (v === null) return null
  if (typeof v !== 'string') return undefined
  const d = parseISO(v)
  return isValid(d) ? toISODate(d) : undefined
}

export function taskSummary(t: Task) {
  const s = S()
  return {
    key: `MS-${t.key}`,
    title: t.title,
    status: statusOf(t)?.name,
    done: isDone(t),
    priority: t.priority,
    assignees: t.assignees.map(userName),
    due_date: t.dueDate,
    start_date: t.startDate,
    list: s.lists.find((l) => l.id === t.listId)?.name,
    project: spaceOf(t)?.name,
    tags: t.tags,
    blocked_by: t.blockedBy.map((b) => s.tasks.find((x) => x.id === b)).filter(Boolean).map((b) => `MS-${b!.key}`),
  }
}

type Input = Record<string, unknown>

/* ---------------- markdown → doc HTML ---------------- */

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function inline(s: string) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>')
}
export function markdownToHtml(md: string) {
  const out: string[] = []
  let list: 'ul' | 'ol' | 'task' | null = null
  const close = () => {
    if (list) out.push(list === 'ol' ? '</ol>' : '</ul>')
    list = null
  }
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()
    let m: RegExpMatchArray | null
    if ((m = line.match(/^(#{1,3})\s+(.*)/))) {
      close()
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`)
    } else if ((m = line.match(/^\s*[-*]\s+\[( |x)\]\s+(.*)/i))) {
      if (list !== 'task') (close(), out.push('<ul data-type="taskList">'), (list = 'task'))
      out.push(`<li data-type="taskItem" data-checked="${m[1].toLowerCase() === 'x'}"><p>${inline(m[2])}</p></li>`)
    } else if ((m = line.match(/^\s*[-*]\s+(.*)/))) {
      if (list !== 'ul') (close(), out.push('<ul>'), (list = 'ul'))
      out.push(`<li><p>${inline(m[1])}</p></li>`)
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
      if (list !== 'ol') (close(), out.push('<ol>'), (list = 'ol'))
      out.push(`<li><p>${inline(m[1])}</p></li>`)
    } else if ((m = line.match(/^>\s?(.*)/))) {
      close()
      out.push(`<blockquote><p>${inline(m[1])}</p></blockquote>`)
    } else if (line.trim()) {
      close()
      out.push(`<p>${inline(line)}</p>`)
    } else close()
  }
  close()
  return out.join('')
}

export function htmlToText(html: string) {
  return html
    .replace(/<\/(p|h\d|li|blockquote)>/g, '\n')
    .replace(/<li[^>]*data-checked="true"[^>]*>/g, '[x] ')
    .replace(/<li[^>]*data-checked="false"[^>]*>/g, '[ ] ')
    .replace(/<li[^>]*>/g, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/* ---------------- execution ---------------- */

const ok = (data: unknown, effect?: ToolEffect): ToolOutcome => ({ content: JSON.stringify(data), data, effect })
const fail = (msg: string): ToolOutcome => ({ content: msg, isError: true })

/** The List the user is currently looking at, if any (used as the default for new tasks). */
export function contextListId() {
  const m = location.pathname.match(/\/app\/list\/([^/?]+)/)
  if (m) return m[1]
  const open = S().openTaskId && S().tasks.find((t) => t.id === S().openTaskId)
  return open ? open.listId : undefined
}

export function executeTool(name: string, input: Input): ToolOutcome {
  const s = S()
  const me = s.currentUserId ?? 'u1'
  switch (name) {
    case 'workspace_overview': {
      const top = s.tasks.filter((t) => !t.parentId)
      const open = top.filter((t) => !isDone(t))
      const today = new Date()
      const overdue = open.filter((t) => t.dueDate && differenceInCalendarDays(parseISO(t.dueDate), today) < 0)
      return ok({
        workspace: s.workspaces.find((w) => w.id === s.currentWorkspaceId)?.name,
        today: toISODate(today),
        current_user: userName(me),
        projects: s.spaces.map((sp) => {
          const ids = new Set(s.lists.filter((l) => l.spaceId === sp.id).map((l) => l.id))
          const ts = top.filter((t) => ids.has(t.listId))
          return { name: sp.name, total: ts.length, done: ts.filter(isDone).length }
        }),
        counts: { total: top.length, not_started: top.filter((t) => statusOf(t)?.type === 'open').length, in_progress: top.filter((t) => statusOf(t)?.type === 'active').length, done: top.filter(isDone).length },
        overdue: overdue.map(taskSummary),
        due_this_week: open.filter((t) => t.dueDate && (() => { const d = differenceInCalendarDays(parseISO(t.dueDate!), today); return d >= 0 && d <= 7 })()).map(taskSummary),
        workload: s.users.map((u) => ({ person: u.name, open_tasks: open.filter((t) => t.assignees.includes(u.id)).length })),
        recent_activity: [...s.activity]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 12)
          .map((a) => ({ who: a.userId === BOT ? 'Automation' : userName(a.userId), what: a.text, task: s.tasks.find((t) => t.id === a.taskId)?.title, when: a.createdAt })),
      })
    }
    case 'list_projects':
      return ok({
        members: s.users.map((u) => u.name),
        projects: s.spaces.map((sp) => ({
          name: sp.name,
          statuses: sp.statuses.map((st) => st.name),
          lists: s.lists.filter((l) => l.spaceId === sp.id).map((l) => ({ name: l.name, folder: s.folders.find((f) => f.id === l.folderId)?.name ?? null, tasks: s.tasks.filter((t) => t.listId === l.id && !t.parentId).length })),
        })),
      })
    case 'search_tasks': {
      let ts = s.tasks.filter((t) => !t.parentId)
      const q = input.query as string | undefined
      if (q) {
        const words = q.toLowerCase().split(/\s+/).filter(Boolean)
        ts = ts.filter((t) => words.every((w) => t.title.toLowerCase().includes(w)))
      }
      const a = input.assignee as string | undefined
      if (a) {
        if (a.toLowerCase() === 'unassigned') ts = ts.filter((t) => !t.assignees.length)
        else {
          const u = findUser(a)
          if (!u) return fail(`No member matches "${a}". Members: ${s.users.map((x) => x.name).join(', ')}`)
          ts = ts.filter((t) => t.assignees.includes(u.id))
        }
      }
      const state = input.state as string | undefined
      if (state === 'open') ts = ts.filter((t) => statusOf(t)?.type === 'open')
      if (state === 'in_progress') ts = ts.filter((t) => statusOf(t)?.type === 'active')
      if (state === 'done') ts = ts.filter(isDone)
      if (state === 'not_done') ts = ts.filter((t) => !isDone(t))
      const due = input.due as string | undefined
      const diff = (t: Task) => (t.dueDate ? differenceInCalendarDays(parseISO(t.dueDate), new Date()) : null)
      if (due === 'overdue') ts = ts.filter((t) => !isDone(t) && (diff(t) ?? 0) < 0)
      if (due === 'today') ts = ts.filter((t) => diff(t) === 0)
      if (due === 'this_week') ts = ts.filter((t) => diff(t) !== null && diff(t)! >= 0 && diff(t)! <= 7)
      if (due === 'no_date') ts = ts.filter((t) => !t.dueDate)
      if (input.project) {
        const p = findProject(input.project as string)
        if (!p) return fail(`No project matches "${input.project}".`)
        ts = ts.filter((t) => spaceOf(t)?.id === p.id)
      }
      if (input.list) {
        const l = findList(input.list as string)
        if (!l) return fail(`No List matches "${input.list}".`)
        ts = ts.filter((t) => t.listId === l.id)
      }
      if (input.priority) ts = ts.filter((t) => t.priority === input.priority)
      const rank: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
      ts.sort((x, y) => (x.dueDate ?? '9999').localeCompare(y.dueDate ?? '9999') || (rank[x.priority ?? ''] ?? 4) - (rank[y.priority ?? ''] ?? 4))
      const limit = (input.limit as number) ?? 20
      return ok({ total_matches: ts.length, tasks: ts.slice(0, limit).map(taskSummary) })
    }
    case 'get_task': {
      const t = findTask(input.task as string)
      if (!t) return fail(`No task matches "${input.task}".`)
      const tracked = s.timeEntries.filter((e) => e.taskId === t.id).reduce((a, e) => a + e.duration, 0)
      return ok(
        {
          ...taskSummary(t),
          description: htmlToText(t.description),
          estimate_hours: t.estimate,
          time_tracked: formatMinutes(tracked),
          recurrence: t.recurrence,
          checklist: t.checklist.map((c) => `${c.done ? '[x]' : '[ ]'} ${c.text}`),
          subtasks: s.tasks.filter((x) => x.parentId === t.id).map(taskSummary),
          blocking: s.tasks.filter((x) => x.blockedBy.includes(t.id)).map((x) => `MS-${x.key}`),
          comments: s.comments.filter((c) => c.taskId === t.id).map((c) => ({ by: c.userId === BOT ? 'Automation' : userName(c.userId), text: c.text, at: c.createdAt })),
          custom_fields: Object.fromEntries(
            s.fields.filter((f) => f.listId === t.listId).map((f) => {
              const v = t.custom[f.id]
              return [f.name, f.type === 'dropdown' ? f.options.find((o) => o.id === v)?.name ?? null : v ?? null]
            }),
          ),
        },
        { label: `Read MS-${t.key}`, taskId: t.id },
      )
    }
    case 'create_task': {
      const parent = input.parent_task ? findTask(input.parent_task as string) : undefined
      if (input.parent_task && !parent) return fail(`No parent task matches "${input.parent_task}".`)
      const list = parent ? s.lists.find((l) => l.id === parent.listId) : input.list ? findList(input.list as string) : s.lists.find((l) => l.id === contextListId()) ?? s.lists[0]
      if (!list) return fail(input.list ? `No List matches "${input.list}". Call list_projects for valid names.` : 'This workspace has no Lists yet.')
      const assignees: string[] = []
      for (const n of (input.assignees as string[] | undefined) ?? []) {
        const u = findUser(n)
        if (!u) return fail(`No member matches "${n}". Members: ${s.users.map((x) => x.name).join(', ')}`)
        assignees.push(u.id)
      }
      const due = validDate(input.due_date)
      const start = validDate(input.start_date)
      if (input.due_date && !due) return fail('due_date must be YYYY-MM-DD')
      const id = s.addTask({
        listId: list.id,
        parentId: parent?.id ?? null,
        title: (input.title as string).trim(),
        description: input.description ? markdownToHtml(input.description as string) : '',
        assignees,
        dueDate: due ?? null,
        startDate: start ?? null,
        priority: (input.priority as Priority) ?? null,
        tags: ((input.tags as string[]) ?? []).map((x) => x.toLowerCase()),
      })
      const t = S().tasks.find((x) => x.id === id)!
      return ok({ created: taskSummary(t) }, { label: `Created MS-${t.key}`, taskId: id })
    }
    case 'update_task': {
      const t = findTask(input.task as string)
      if (!t) return fail(`No task matches "${input.task}".`)
      const patch: Partial<Task> = {}
      if (typeof input.title === 'string' && input.title.trim()) patch.title = input.title.trim()
      if (typeof input.status === 'string') {
        const st = resolveStatus(t, input.status)
        if (!st) return fail(`Status "${input.status}" doesn't exist in this project. Options: ${(spaceOf(t)?.statuses ?? []).map((x) => x.name).join(', ')}`)
        patch.statusId = st.id
      }
      if (typeof input.priority === 'string') patch.priority = input.priority === 'none' ? null : (input.priority as Priority)
      if ('due_date' in input) {
        const d = validDate(input.due_date)
        if (d === undefined) return fail('due_date must be YYYY-MM-DD or null')
        patch.dueDate = d
      }
      if ('start_date' in input) {
        const d = validDate(input.start_date)
        if (d === undefined) return fail('start_date must be YYYY-MM-DD or null')
        patch.startDate = d
      }
      if (input.add_assignees || input.remove_assignees) {
        let next = [...t.assignees]
        for (const n of (input.add_assignees as string[]) ?? []) {
          const u = findUser(n)
          if (!u) return fail(`No member matches "${n}".`)
          if (!next.includes(u.id)) next.push(u.id)
        }
        for (const n of (input.remove_assignees as string[]) ?? []) {
          const u = findUser(n)
          if (u) next = next.filter((x) => x !== u.id)
        }
        patch.assignees = next
      }
      if (input.add_tags) patch.tags = [...new Set([...t.tags, ...(input.add_tags as string[]).map((x) => x.toLowerCase())])]
      if (!Object.keys(patch).length) return fail('Nothing to change — pass at least one field.')
      s.updateTask(t.id, patch)
      const after = S().tasks.find((x) => x.id === t.id)!
      return ok({ updated: taskSummary(after) }, { label: `Updated MS-${t.key}`, taskId: t.id })
    }
    case 'add_comment': {
      const t = findTask(input.task as string)
      if (!t) return fail(`No task matches "${input.task}".`)
      s.addComment(t.id, input.text as string)
      return ok({ ok: true, task: `MS-${t.key}` }, { label: `Commented on MS-${t.key}`, taskId: t.id })
    }
    case 'get_doc': {
      const q = (input.doc as string).toLowerCase()
      const d = s.docs.find((x) => x.title.toLowerCase() === q) ?? s.docs.find((x) => x.title.toLowerCase().includes(q))
      if (!d) return fail(`No doc matches "${input.doc}". Docs: ${s.docs.map((x) => x.title || 'Untitled').join(', ')}`)
      return ok({ title: d.title, text: htmlToText(d.content), updated: d.updatedAt }, { label: `Read “${d.title}”`, docId: d.id })
    }
    case 'create_doc': {
      const project = input.project ? findProject(input.project as string) : undefined
      const id = s.addDoc(project?.id ?? null)
      s.updateDoc(id, { title: input.title as string, content: markdownToHtml(input.markdown as string), emoji: '✨' })
      return ok({ created: input.title }, { label: `Created doc “${input.title}”`, docId: id })
    }
  }
  return fail(`Unknown tool ${name}`)
}

/* ---------------- natural-language dates (local engine) ---------------- */

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export function parseNaturalDate(text: string): string | null {
  const t = text.toLowerCase()
  const now = new Date()
  let m: RegExpMatchArray | null
  if ((m = t.match(/\b(\d{4}-\d{2}-\d{2})\b/))) return m[1]
  if (/\btoday\b/.test(t)) return toISODate(now)
  if (/\btomorrow\b/.test(t)) return toISODate(addDays(now, 1))
  if ((m = t.match(/\bin (\d+) (day|days|week|weeks)\b/))) return toISODate(addDays(now, Number(m[1]) * (m[2].startsWith('week') ? 7 : 1)))
  if (/\bnext week\b/.test(t)) return toISODate(addDays(now, 7))
  if (/\bend of (the )?week\b/.test(t)) return toISODate(addDays(now, (5 - now.getDay() + 7) % 7))
  for (let i = 0; i < 7; i++) {
    if (new RegExp(`\\b(next )?${DAYS[i]}\\b`).test(t)) {
      let diff = (i - now.getDay() + 7) % 7 || 7
      if (new RegExp(`\\bnext ${DAYS[i]}\\b`).test(t) && diff < 7) diff += 7
      return toISODate(addDays(now, diff))
    }
  }
  return null
}
