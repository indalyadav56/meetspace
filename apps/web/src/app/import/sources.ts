import { parseCSV, records } from './csv'

/*
 * Turn exports from other tools into one shape. People stay as the raw names
 * or emails from the file; the wizard matches them to workspace members.
 */

export type Source = 'clickup' | 'jira' | 'trello' | 'asana' | 'csv'
export type StatusType = 'open' | 'active' | 'done' | 'closed'
export type Priority = 'urgent' | 'high' | 'normal' | 'low' | null

export interface RawTask {
  ref: string
  parentRef: string
  title: string
  description: string
  status: string
  statusType: StatusType
  priority: Priority
  people: string[]
  tags: string[]
  startDate: string | null
  dueDate: string | null
  points: number | null
  estimate: number | null
  checklist: { text: string; done: boolean }[]
  issueType: 'task' | 'story' | 'bug' | 'epic'
  /** ref of the epic this task belongs to */
  epicRef: string
}

export interface RawList {
  name: string
  tasks: RawTask[]
}

export interface Parsed {
  /** Suggested name for a new Space. */
  name: string
  lists: RawList[]
  warnings: string[]
}

export const SOURCES: { id: Source; name: string; file: string; how: string }[] = [
  { id: 'clickup', name: 'ClickUp', file: '.csv', how: 'In ClickUp open a Space, List or Everything view → ⋯ → Export → CSV, all columns.' },
  { id: 'jira', name: 'Jira', file: '.csv', how: 'In Jira open Filters → Search work items, pick your project, then Export → Export CSV (all fields).' },
  { id: 'trello', name: 'Trello', file: '.json', how: 'In Trello open the board → Menu → Print, export and share → Export as JSON.' },
  { id: 'asana', name: 'Asana', file: '.csv', how: 'In Asana open the project → the arrow next to its name → Export → CSV.' },
  { id: 'csv', name: 'Any CSV', file: '.csv', how: 'Any spreadsheet with a header row. You choose which column is which.' },
]

export function guessStatusType(name: string): StatusType {
  const n = name.toLowerCase()
  if (/cancel|won.?t|wont|abandon|rejected|duplicate|archiv/.test(n)) return 'closed'
  if (/done|complete|closed|resolved|shipped|released|finished|deployed|live/.test(n)) return 'done'
  if (/progress|doing|review|qa|test|active|started|develop|blocked|wip|verif|staging/.test(n)) return 'active'
  return 'open'
}

export function priorityFrom(v: string): Priority {
  const n = v.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  if (['urgent', 'highest', 'critical', 'blocker', 'p0', '1'].includes(n)) return 'urgent'
  if (['high', 'major', 'p1', '2'].includes(n)) return 'high'
  if (['normal', 'medium', 'p2', '3'].includes(n)) return 'normal'
  if (['low', 'lowest', 'minor', 'trivial', 'p3', 'p4', '4'].includes(n)) return 'low'
  return null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Dates as the tools write them: epoch ms (ClickUp), ISO, "27/Oct/26 10:00 AM" (Jira), "10/27/2026". */
export function dateFrom(v: string): string | null {
  const s = v.trim()
  if (!s) return null
  if (/^\d{11,14}$/.test(s)) return iso(new Date(Number(s)))
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})\/([A-Za-z]{3})\/(\d{2,4})/)
  if (m) {
    const month = MONTHS.indexOf(m[2].toLowerCase())
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    if (month >= 0) return `${year}-${pad(month + 1)}-${pad(Number(m[1]))}`
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${pad(Number(m[1]))}-${pad(Number(m[2]))}`
  const t = Date.parse(s)
  return isNaN(t) ? null : iso(new Date(t))
}

/** "[a, b]", "a, b" or "a; b" → ["a", "b"]. */
export function splitList(v: string): string[] {
  return v
    .replace(/^\[|\]$/g, '')
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** Plain text or light markdown → paragraphs of safe HTML. */
export function toHTML(text: string): string {
  const t = text.trim()
  if (!t) return ''
  return t
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

const num = (v: string) => (v.trim() && !isNaN(Number(v)) ? Number(v) : null)

function blank(ref: string): RawTask {
  return { ref, parentRef: '', title: '', description: '', status: '', statusType: 'open', priority: null, people: [], tags: [], startDate: null, dueDate: null, points: null, estimate: null, checklist: [], issueType: 'task', epicRef: '' }
}

function group(tasks: { list: string; task: RawTask }[], fallback: string): RawList[] {
  const lists = new Map<string, RawTask[]>()
  for (const { list, task } of tasks) {
    const k = list || fallback
    lists.set(k, [...(lists.get(k) ?? []), task])
  }
  return [...lists].map(([name, ts]) => ({ name, tasks: ts }))
}

function clickup(text: string): Parsed {
  const r = records(parseCSV(text))
  if (!r.headers.some((h) => /task name/i.test(h))) throw new Error('This doesn’t look like a ClickUp CSV export (no “Task Name” column).')
  const out = r.rows.map((row) => {
    const t = blank(r.get(row, 'Task ID'))
    t.parentRef = r.get(row, 'Parent ID')
    t.title = r.get(row, 'Task Name')
    t.description = toHTML(r.get(row, 'Task Content', 'Task Description', 'Description'))
    t.status = r.get(row, 'Status')
    t.statusType = guessStatusType(t.status)
    t.priority = priorityFrom(r.get(row, 'Priority'))
    t.people = splitList(r.get(row, 'Assignees'))
    t.tags = splitList(r.get(row, 'Tags'))
    t.startDate = dateFrom(r.get(row, 'Start Date', 'Start Date Text'))
    t.dueDate = dateFrom(r.get(row, 'Due Date', 'Due Date Text'))
    const est = num(r.get(row, 'Time Estimated'))
    t.estimate = est ? Math.round((est / 3_600_000) * 100) / 100 : null
    t.points = num(r.get(row, 'Sprint Points', 'Points'))
    return { list: [r.get(row, 'Folder Name'), r.get(row, 'List Name')].filter(Boolean).join(' / '), task: t }
  })
  const space = out.length ? r.get(r.rows[0], 'Space Name') : ''
  return { name: space || 'ClickUp import', lists: group(out, 'ClickUp tasks'), warnings: [] }
}

function jira(text: string): Parsed {
  const r = records(parseCSV(text))
  if (!r.headers.some((h) => /^summary$/i.test(h)) || !r.headers.some((h) => /issue key/i.test(h))) throw new Error('This doesn’t look like a Jira CSV export (needs “Summary” and “Issue key”).')
  const keyById = new Map(r.rows.map((row) => [r.get(row, 'Issue id'), r.get(row, 'Issue key')]))
  const typeByKey = new Map(r.rows.map((row) => [r.get(row, 'Issue key'), r.get(row, 'Issue Type').toLowerCase()]))
  const out = r.rows.map((row) => {
    const t = blank(r.get(row, 'Issue key'))
    const type = r.get(row, 'Issue Type')
    const lower = type.toLowerCase()
    t.issueType = lower === 'epic' ? 'epic' : lower === 'story' ? 'story' : lower === 'bug' ? 'bug' : 'task'
    const parentRaw = r.get(row, 'Parent', 'Parent id')
    const parent = keyById.get(parentRaw) ?? parentRaw
    // A parent that is an epic means "belongs to this epic", not "is a subtask of".
    if (parent && typeByKey.get(parent) === 'epic') t.epicRef = parent
    else t.parentRef = parent
    t.epicRef ||= r.get(row, 'Custom field (Epic Link)', 'Epic Link')
    t.title = r.get(row, 'Summary')
    t.description = toHTML(r.get(row, 'Description'))
    t.status = r.get(row, 'Status')
    const cat = r.get(row, 'Status Category').toLowerCase()
    t.statusType = cat === 'done' ? 'done' : cat === 'in progress' ? 'active' : cat === 'to do' ? 'open' : guessStatusType(t.status)
    t.priority = priorityFrom(r.get(row, 'Priority'))
    t.people = [r.get(row, 'Assignee')].filter(Boolean)
    t.tags = [...r.all(row, 'Labels'), ...(type && !/^(task|sub-?task|story|bug|epic)$/i.test(type) ? [lower] : [])]
    t.dueDate = dateFrom(r.get(row, 'Due date', 'Due Date'))
    t.startDate = dateFrom(r.get(row, 'Start date', 'Custom field (Start date)'))
    t.points = num(r.get(row, 'Custom field (Story point estimate)', 'Custom field (Story Points)', 'Story Points', 'Story point estimate'))
    const secs = num(r.get(row, 'Original estimate', 'Original Estimate'))
    t.estimate = secs ? Math.round((secs / 3600) * 100) / 100 : null
    return { list: r.get(row, 'Project name', 'Project'), task: t }
  })
  const project = out[0]?.list
  return { name: project || 'Jira import', lists: group(out, 'Jira issues'), warnings: [] }
}

interface TrelloBoard {
  name: string
  lists: { id: string; name: string; closed: boolean; pos: number }[]
  cards: { id: string; name: string; desc: string; idList: string; closed: boolean; due: string | null; start?: string | null; dueComplete?: boolean; labels: { name: string; color: string }[]; idMembers: string[] }[]
  members: { id: string; fullName: string; username: string }[]
  checklists?: { idCard: string; checkItems: { name: string; state: string }[] }[]
}

/** Trello lists are workflow columns, so they become statuses of one List. */
function trello(text: string): Parsed {
  let b: TrelloBoard
  try {
    b = JSON.parse(text)
  } catch {
    throw new Error('This isn’t a Trello JSON export.')
  }
  if (!Array.isArray(b.cards) || !Array.isArray(b.lists)) throw new Error('This isn’t a Trello board export.')
  const lists = new Map(b.lists.map((l) => [l.id, l]))
  const people = new Map((b.members ?? []).map((m) => [m.id, m.fullName || m.username]))
  const checks = new Map<string, { text: string; done: boolean }[]>()
  for (const cl of b.checklists ?? []) checks.set(cl.idCard, [...(checks.get(cl.idCard) ?? []), ...cl.checkItems.map((i) => ({ text: i.name, done: i.state === 'complete' }))])
  const ordered = [...b.lists].filter((l) => !l.closed).sort((a, z) => a.pos - z.pos)
  const last = ordered[ordered.length - 1]?.id
  const tasks = b.cards
    .filter((c) => !c.closed && lists.has(c.idList) && !lists.get(c.idList)!.closed)
    .map((c) => {
      const t = blank(c.id)
      const col = lists.get(c.idList)!
      t.title = c.name
      t.description = toHTML(c.desc ?? '')
      t.status = col.name
      // A card ticked complete, or sitting in the board's last column with a "done"-like name, is done.
      t.statusType = c.dueComplete ? 'done' : guessStatusType(col.name) === 'open' && col.id === last && /done|complete/i.test(col.name) ? 'done' : guessStatusType(col.name)
      t.people = c.idMembers.map((id) => people.get(id) ?? '').filter(Boolean)
      t.tags = c.labels.map((l) => l.name || l.color).filter(Boolean)
      t.dueDate = c.due ? dateFrom(c.due) : null
      t.startDate = c.start ? dateFrom(c.start) : null
      t.checklist = checks.get(c.id) ?? []
      return t
    })
  const archived = b.cards.filter((c) => c.closed).length
  return { name: b.name || 'Trello import', lists: [{ name: b.name || 'Board', tasks }], warnings: archived ? [`${archived} archived card${archived === 1 ? '' : 's'} left out.`] : [] }
}

function asana(text: string): Parsed {
  const r = records(parseCSV(text))
  if (!r.headers.some((h) => /^name$/i.test(h)) || !r.headers.some((h) => /section\/column|completed at/i.test(h))) throw new Error('This doesn’t look like an Asana CSV export.')
  const idByName = new Map(r.rows.map((row) => [r.get(row, 'Name'), r.get(row, 'Task ID')]))
  const out = r.rows.map((row) => {
    const t = blank(r.get(row, 'Task ID'))
    const parent = r.get(row, 'Parent task', 'Parent Task')
    t.parentRef = parent ? (idByName.get(parent) ?? '') : ''
    t.title = r.get(row, 'Name')
    t.description = toHTML(r.get(row, 'Notes'))
    const done = !!r.get(row, 'Completed At')
    t.status = done ? 'Done' : 'To do'
    t.statusType = done ? 'done' : 'open'
    t.people = [r.get(row, 'Assignee Email') || r.get(row, 'Assignee')].filter(Boolean)
    t.tags = splitList(r.get(row, 'Tags'))
    t.startDate = dateFrom(r.get(row, 'Start Date'))
    t.dueDate = dateFrom(r.get(row, 'Due Date'))
    return { list: r.get(row, 'Section/Column'), task: t }
  })
  const project = out.length ? r.get(r.rows[0], 'Projects') : ''
  return { name: project || 'Asana import', lists: group(out, 'Asana tasks'), warnings: [] }
}

/** Generic CSV fields the person maps to columns. */
export const CSV_FIELDS = [
  { key: 'title', label: 'Task name', guess: ['title', 'name', 'task', 'task name', 'summary'] },
  { key: 'description', label: 'Description', guess: ['description', 'details', 'notes', 'content'] },
  { key: 'list', label: 'List', guess: ['list', 'list name', 'section', 'project', 'group'] },
  { key: 'status', label: 'Status', guess: ['status', 'state', 'stage'] },
  { key: 'priority', label: 'Priority', guess: ['priority'] },
  { key: 'people', label: 'Assignees', guess: ['assignee', 'assignees', 'owner', 'assigned to'] },
  { key: 'tags', label: 'Tags', guess: ['tags', 'labels', 'label'] },
  { key: 'startDate', label: 'Start date', guess: ['start date', 'start'] },
  { key: 'dueDate', label: 'Due date', guess: ['due date', 'due', 'deadline'] },
  { key: 'points', label: 'Story points', guess: ['story points', 'points', 'estimate points'] },
] as const
export type CsvField = (typeof CSV_FIELDS)[number]['key']

export function guessMapping(headers: string[]): Partial<Record<CsvField, number>> {
  const lower = headers.map((h) => h.trim().toLowerCase())
  const map: Partial<Record<CsvField, number>> = {}
  for (const f of CSV_FIELDS) {
    const i = lower.findIndex((h) => (f.guess as readonly string[]).includes(h))
    if (i >= 0) map[f.key] = i
  }
  return map
}

export function genericCSV(rows: string[][], map: Partial<Record<CsvField, number>>): Parsed {
  const cell = (row: string[], f: CsvField) => (map[f] !== undefined ? (row[map[f]!] ?? '').trim() : '')
  const out = rows.slice(1).map((row, i) => {
    const t = blank(`row-${i}`)
    t.title = cell(row, 'title')
    t.description = toHTML(cell(row, 'description'))
    t.status = cell(row, 'status')
    t.statusType = guessStatusType(t.status)
    t.priority = priorityFrom(cell(row, 'priority'))
    t.people = splitList(cell(row, 'people'))
    t.tags = splitList(cell(row, 'tags'))
    t.startDate = dateFrom(cell(row, 'startDate'))
    t.dueDate = dateFrom(cell(row, 'dueDate'))
    t.points = num(cell(row, 'points'))
    return { list: cell(row, 'list'), task: t }
  })
  return { name: 'Imported', lists: group(out, 'Imported tasks'), warnings: [] }
}

export function parseSource(source: Exclude<Source, 'csv'>, text: string): Parsed {
  const p = { clickup, jira, trello, asana }[source](text)
  for (const l of p.lists) {
    const before = l.tasks.length
    l.tasks = l.tasks.filter((t) => t.title.trim())
    if (l.tasks.length < before) p.warnings.push(`${before - l.tasks.length} row${before - l.tasks.length === 1 ? '' : 's'} without a name skipped in “${l.name}”.`)
  }
  p.lists = p.lists.filter((l) => l.tasks.length)
  return p
}
