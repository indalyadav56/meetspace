import { differenceInCalendarDays, parseISO } from 'date-fns'
import { useStore } from '../../store/useStore'
import { executeTool, findTask, findUser, parseNaturalDate, taskSummary, userName, type ToolEffect } from './tools'
import { PRIORITIES } from '../../lib/utils'

/**
 * Offline assistant: recognises common requests with simple patterns and runs the same tools as the server agent.
 * It does not understand free-form language — that's what the server's Gemini agent is for.
 */

export interface AssistantReply {
  text: string
  effects: ToolEffect[]
}

type Summary = ReturnType<typeof taskSummary>

function line(t: Summary) {
  const bits = [t.status, t.assignees.length ? t.assignees.join(', ') : 'unassigned']
  if (t.due_date) bits.push(`due ${t.due_date}`)
  if (t.priority) bits.push(t.priority)
  return `- ${t.key} **${t.title}** — ${bits.join(' · ')}`
}

function run(name: string, input: Record<string, unknown>, effects: ToolEffect[]) {
  const r = executeTool(name, input)
  if (r.effect) effects.push(r.effect)
  return r
}

function contextTask() {
  const s = useStore.getState()
  return s.openTaskId ? s.tasks.find((t) => t.id === s.openTaskId) : undefined
}

/** Pulls "MS-12", a quoted title, or the open task out of a request. */
function taskRef(text: string) {
  const key = text.match(/\bMS-(\d+)\b/i)
  if (key) return findTask(key[1])
  const quoted = text.match(/["“](.+?)["”]/)
  if (quoted) return findTask(quoted[1])
  return contextTask()
}

const HELP = `I'm running in **offline mode**, so I understand these kinds of requests:
- "What's overdue?" · "What's due this week?"
- "What should I work on?" · "Show Priya's tasks"
- "Write my standup" · "Give me a status report"
- "Create task Update pricing page for Sofia due Friday high priority"
- "Mark MS-104 as done" · "Move MS-110 to In review" · "Assign MS-112 to Marcus"
- "Summarize this task" · "Break this task into subtasks"
- "Find rate limiter"

Ask an admin to set a Gemini API key on the server to ask anything in your own words.`

export function localAssistant(prompt: string): AssistantReply {
  const effects: ToolEffect[] = []
  const p = prompt.trim()
  const lower = p.toLowerCase()
  const s = useStore.getState()
  const meId = s.currentUserId ?? 'u1'

  if (!p || /^(help|hi|hello|hey|what can you do)\b/.test(lower)) return { text: HELP, effects }

  // ---- create task ----
  let m = p.match(/^(?:please\s+)?(?:create|add|new|make)\s+(?:a\s+)?(?:new\s+)?(?:task|todo|to-do)\b[:\s-]*(.+)$/i)
  if (m) {
    let rest = m[1]
    const input: Record<string, unknown> = {}
    const due = parseNaturalDate(rest)
    if (due) {
      input.due_date = due
      rest = rest.replace(/\b(due|by|on)?\s*(today|tomorrow|next week|end of (the )?week|in \d+ (days?|weeks?)|(next )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\d{4}-\d{2}-\d{2})\b/gi, ' ')
    }
    const pr = rest.match(/\b(urgent|high|normal|low)(\s+priority)?\b/i)
    if (pr) {
      input.priority = pr[1].toLowerCase()
      rest = rest.replace(pr[0], ' ')
    }
    const who = rest.match(/\b(?:for|assign(?:ed)? to)\s+(@?[a-z]+(?:\s+[a-z]+)?)/i)
    if (who && findUser(who[1].split(' ')[0])) {
      input.assignees = [findUser(who[1].split(' ')[0])!.name]
      rest = rest.replace(who[0], ' ')
    }
    const list = rest.match(/\b(?:in|to|on)\s+(?:the\s+)?(?:list\s+)?["“]?([\w\s]+?)["”]?\s+list\b/i) ?? rest.match(/\bin list\s+["“]?([\w\s]+?)["”]?$/i)
    if (list) {
      input.list = list[1].trim()
      rest = rest.replace(list[0], ' ')
    }
    input.title = rest.replace(/\s+/g, ' ').replace(/^(called|named|to)\s+/i, '').replace(/[\s,.-]+$/, '').trim()
    if (!input.title) return { text: 'What should the task be called? Try “Create task Draft the Q4 newsletter due Friday”.', effects }
    const ctxTask = contextTask()
    if (/\bsubtask\b/i.test(m[0]) && ctxTask) input.parent_task = `MS-${ctxTask.key}`
    const r = run('create_task', input, effects)
    if (r.isError) return { text: r.content, effects }
    const t = (r.data as { created: Summary }).created
    return { text: `Done — created ${t.key} **${t.title}** in ${t.list}${t.assignees.length ? `, assigned to ${t.assignees.join(', ')}` : ''}${t.due_date ? `, due ${t.due_date}` : ''}${t.priority ? `, ${t.priority} priority` : ''}.`, effects }
  }

  // ---- status changes ----
  m = p.match(/^(?:mark|set)\s+(.+?)\s+(?:as\s+)?(done|complete|completed|finished)\b/i) ?? p.match(/^(?:complete|finish|close)\s+(.+)$/i)
  if (m) {
    const t = taskRef(m[1]) ?? findTask(m[1])
    if (!t) return { text: `I couldn't find a task matching “${m[1]}”. Use its key, like MS-104.`, effects }
    const r = run('update_task', { task: `MS-${t.key}`, status: 'done' }, effects)
    return { text: r.isError ? r.content : `Marked MS-${t.key} **${t.title}** as done. ✅`, effects }
  }
  m = p.match(/^(?:move|set|change)\s+(.+?)\s+(?:status\s+)?to\s+(.+)$/i)
  if (m && !/\bassign/i.test(lower)) {
    const t = taskRef(m[1]) ?? findTask(m[1])
    if (t) {
      const r = run('update_task', { task: `MS-${t.key}`, status: m[2].replace(/[."]/g, '') }, effects)
      return { text: r.isError ? r.content : `Moved MS-${t.key} **${t.title}** to ${(r.data as { updated: Summary }).updated.status}.`, effects }
    }
  }
  m = p.match(/^assign\s+(.+?)\s+to\s+(.+)$/i)
  if (m) {
    const t = taskRef(m[1]) ?? findTask(m[1])
    if (!t) return { text: `I couldn't find a task matching “${m[1]}”.`, effects }
    const r = run('update_task', { task: `MS-${t.key}`, add_assignees: [m[2].replace(/[.]/g, '')] }, effects)
    return { text: r.isError ? r.content : `Assigned MS-${t.key} **${t.title}** to ${(r.data as { updated: Summary }).updated.assignees.join(', ')}.`, effects }
  }
  m = p.match(/^(?:set\s+)?(?:the\s+)?priority\s+(?:of\s+)?(.+?)\s+(?:to\s+)?(urgent|high|normal|low)$/i)
  if (m) {
    const t = taskRef(m[1]) ?? findTask(m[1])
    if (t) {
      const r = run('update_task', { task: `MS-${t.key}`, priority: m[2].toLowerCase() }, effects)
      return { text: r.isError ? r.content : `Set MS-${t.key} to ${m[2].toLowerCase()} priority.`, effects }
    }
  }

  // ---- subtasks breakdown ----
  if (/\b(break( it| this)? (down|into)|subtasks?|split)\b/.test(lower)) {
    const t = taskRef(p)
    if (!t) return { text: 'Open a task first (or mention its key, like MS-102) and I’ll break it into subtasks.', effects }
    const existing = s.tasks.filter((x) => x.parentId === t.id).length
    if (existing >= 3) return { text: `MS-${t.key} already has ${existing} subtasks — I left it as is.`, effects }
    const title = t.title.toLowerCase()
    const steps = /\b(blog|newsletter|post|copy|messaging|case study|video|content)\b/.test(title)
      ? ['Outline key points', 'Write first draft', 'Review and edit', 'Publish and share']
      : /\b(hire|screen|candidate|role|interview)\b/.test(title)
        ? ['Define requirements', 'Shortlist candidates', 'Run interviews', 'Collect feedback and decide']
        : /\b(bug|fix|flicker|crash|error|resets)\b/.test(title)
          ? ['Reproduce the issue', 'Find the root cause', 'Implement the fix', 'Add a regression test']
          : ['Clarify scope and acceptance criteria', 'Implement', 'Test and review', 'Ship and announce']
    steps.forEach((st) => run('create_task', { title: st, parent_task: `MS-${t.key}` }, effects))
    return { text: `Added ${steps.length} subtasks to MS-${t.key} **${t.title}**:\n${steps.map((x) => `- ${x}`).join('\n')}\n\n_These come from a simple template. The full assistant can tailor them to the task._`, effects }
  }

  // ---- the doc being viewed ----
  const docMatch = location.pathname.match(/\/app\/docs\/([^/]+)/)
  if (docMatch && /\b(this doc|the doc|document)\b/.test(lower)) {
    const d = s.docs.find((x) => x.id === docMatch[1])
    if (d) {
      const r = run('get_doc', { doc: d.title || 'Untitled' }, effects)
      const text = (r.data as { text: string } | undefined)?.text ?? ''
      const lines = text.split('\n').filter(Boolean)
      const headings = (d.content.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/g) ?? []).map((h) => h.replace(/<[^>]+>/g, ''))
      const open = lines.filter((l) => l.startsWith('[ ]')).map((l) => l.slice(4))
      if (/\btasks?\b/.test(lower) && open.length) {
        open.forEach((title) => run('create_task', { title }, effects))
        return { text: `Created ${open.length} task${open.length > 1 ? 's' : ''} from the unchecked items in **${d.title}**:\n${open.map((x) => `- ${x}`).join('\n')}`, effects }
      }
      const words = text.split(/\s+/).filter(Boolean).length
      return {
        text: `**${d.title || 'Untitled'}** — ${words} words.\n${headings.length ? `\n**Sections**\n${headings.map((h) => `- ${h}`).join('\n')}` : ''}${open.length ? `\n\n**Open checklist items**\n${open.map((x) => `- ${x}`).join('\n')}` : ''}\n\n_Offline mode lists the structure; the full assistant writes a summary._`,
        effects,
      }
    }
  }

  // ---- summarize a task ----
  if (/\b(summari[sz]e|recap|tl;?dr|explain)\b/.test(lower) && taskRef(p)) {
    const t = taskRef(p)!
    const r = run('get_task', { task: `MS-${t.key}` }, effects)
    const d = r.data as Summary & { description: string; subtasks: Summary[]; comments: { by: string; text: string }[]; checklist: string[]; time_tracked: string }
    const doneSubs = d.subtasks.filter((x) => x.done).length
    const parts = [
      `**${d.key} · ${d.title}** is **${d.status}**${d.assignees.length ? `, owned by ${d.assignees.join(', ')}` : ', unassigned'}${d.due_date ? `, due ${d.due_date}` : ''}.`,
      d.description ? `\n${d.description.split('\n')[0]}` : '',
      d.subtasks.length ? `\n- Subtasks: ${doneSubs}/${d.subtasks.length} done` : '',
      d.checklist.length ? `\n- Checklist: ${d.checklist.filter((c) => c.startsWith('[x]')).length}/${d.checklist.length} done` : '',
      d.blocked_by.length ? `\n- ⚠️ Waiting on ${d.blocked_by.join(', ')}` : '',
      d.time_tracked !== '0m' ? `\n- Time tracked: ${d.time_tracked}` : '',
      d.comments.length ? `\n- Latest comment from ${d.comments[d.comments.length - 1].by}: “${d.comments[d.comments.length - 1].text}”` : '',
    ]
    return { text: parts.join(''), effects }
  }

  // ---- standup ----
  if (/\bstand-?up\b/.test(lower)) {
    const since = Date.now() - 36 * 3600 * 1000
    const recentlyDone = s.tasks.filter((t) => t.assignees.includes(meId) && new Date(t.updatedAt).getTime() > since && ['done', 'closed'].includes(statusType(t.id)))
    const doing = (run('search_tasks', { assignee: 'me', state: 'in_progress' }, effects).data as { tasks: Summary[] }).tasks
    const dueSoon = (run('search_tasks', { assignee: 'me', due: 'today' }, effects).data as { tasks: Summary[] }).tasks.filter((t) => !t.done)
    const blocked = s.tasks.filter((t) => t.assignees.includes(meId) && t.blockedBy.some((b) => !['done', 'closed'].includes(statusType(b))))
    return {
      text: [
        `**Standup — ${userName(meId)}**`,
        '\n**Yesterday**',
        recentlyDone.length ? recentlyDone.map((t) => `- Finished MS-${t.key} ${t.title}`).join('\n') : '- Nothing marked done since yesterday',
        '\n**Today**',
        [...doing, ...dueSoon.filter((d) => !doing.some((x) => x.key === d.key))].map((t) => `- ${t.key} ${t.title}`).join('\n') || '- No tasks in progress — pick something from your list',
        '\n**Blockers**',
        blocked.length ? blocked.map((t) => `- MS-${t.key} ${t.title} is waiting on another task`).join('\n') : '- None',
      ].join('\n'),
      effects,
    }
  }

  // ---- overview / report ----
  if (/\b(status report|report|overview|how are we doing|summary|summari[sz]e)\b/.test(lower)) {
    const o = run('workspace_overview', {}, effects).data as {
      workspace: string
      projects: { name: string; total: number; done: number }[]
      counts: { total: number; not_started: number; in_progress: number; done: number }
      overdue: Summary[]
      due_this_week: Summary[]
      workload: { person: string; open_tasks: number }[]
    }
    const busiest = [...o.workload].sort((a, b) => b.open_tasks - a.open_tasks)[0]
    return {
      text: [
        `**${o.workspace} — status report**`,
        `${o.counts.total} tasks: ${o.counts.done} done, ${o.counts.in_progress} in progress, ${o.counts.not_started} not started.`,
        '\n**Projects**',
        ...o.projects.map((p) => `- ${p.name}: ${p.done}/${p.total} done (${p.total ? Math.round((p.done / p.total) * 100) : 0}%)`),
        '\n**Needs attention**',
        o.overdue.length ? o.overdue.map(line).join('\n') : '- Nothing overdue 🎉',
        o.due_this_week.length ? `\n**Due this week** (${o.due_this_week.length})\n${o.due_this_week.slice(0, 6).map(line).join('\n')}` : '',
        busiest && busiest.open_tasks ? `\n${busiest.person} has the most open work (${busiest.open_tasks} tasks).` : '',
      ].join('\n'),
      effects,
    }
  }

  // ---- queries ----
  const who = lower.match(/\b(?:show|list|what are|what's on)\s+(\w+)'?s?\s+(?:tasks|work|plate)\b/)
  const assignee = /\b(my|me|i)\b/.test(lower) ? 'me' : who && findUser(who[1]) ? findUser(who[1])!.name : undefined
  const due = /overdue|late|behind/.test(lower) ? 'overdue' : /due today|today/.test(lower) ? 'today' : /this week|upcoming|due soon/.test(lower) ? 'this_week' : undefined
  if (due || assignee || /\b(what should i work on|next|priorit)/.test(lower)) {
    const input: Record<string, unknown> = { state: 'not_done', limit: 12 }
    if (due) input.due = due
    if (assignee) input.assignee = assignee
    const prio = PRIORITIES.find((x) => lower.includes(x.value))
    if (prio) input.priority = prio.value
    const r = run('search_tasks', input, effects)
    if (r.isError) return { text: r.content, effects }
    const res = r.data as { total_matches: number; tasks: Summary[] }
    let tasks = res.tasks
    if (/what should i work on|next|priorit/.test(lower)) {
      const rank: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
      const score = (t: Summary) => (t.due_date ? Math.min(differenceInCalendarDays(parseISO(t.due_date), new Date()), 14) : 15) * 2 + (rank[t.priority ?? ''] ?? 4) * 3 + (t.blocked_by.length ? 50 : 0)
      tasks = [...tasks].sort((a, b) => score(a) - score(b)).slice(0, 5)
      return { text: tasks.length ? `Here's what I'd tackle next, by urgency and priority:\n${tasks.map(line).join('\n')}` : 'You have no open tasks. 🎉', effects }
    }
    const label = [due === 'overdue' ? 'overdue' : due === 'today' ? 'due today' : due === 'this_week' ? 'due this week' : 'open', assignee ? (assignee === 'me' ? 'for you' : `for ${assignee}`) : '']
      .filter(Boolean)
      .join(' ')
    return { text: res.total_matches ? `${res.total_matches} task${res.total_matches === 1 ? '' : 's'} ${label}:\n${tasks.map(line).join('\n')}` : `No tasks ${label}. 🎉`, effects }
  }

  if (/\bworkload|who('s| is) (busy|overloaded)|capacity\b/.test(lower)) {
    const o = run('workspace_overview', {}, effects).data as { workload: { person: string; open_tasks: number }[] }
    return { text: `**Open tasks per person**\n${o.workload.sort((a, b) => b.open_tasks - a.open_tasks).map((w) => `- ${w.person}: ${w.open_tasks}`).join('\n')}`, effects }
  }

  // ---- search fallback ----
  const q = p.replace(/^(find|search( for)?|look up|where is|show me)\s+/i, '').replace(/[?.!]+$/, '')
  const r = run('search_tasks', { query: q, limit: 8 }, effects)
  const found = (r.data as { tasks: Summary[] } | undefined)?.tasks ?? []
  if (found.length) return { text: `I found ${found.length} matching task${found.length === 1 ? '' : 's'}:\n${found.map(line).join('\n')}`, effects }
  return { text: `I didn't understand that in offline mode.\n\n${HELP}`, effects }
}

function statusType(taskId: string) {
  const s = useStore.getState()
  const t = s.tasks.find((x) => x.id === taskId)
  const list = t && s.lists.find((l) => l.id === t.listId)
  const sp = list && s.spaces.find((x) => x.id === list.spaceId)
  return sp?.statuses.find((st) => st.id === t!.statusId)?.type ?? 'open'
}
