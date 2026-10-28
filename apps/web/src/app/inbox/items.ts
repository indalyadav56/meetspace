import { useMemo } from 'react'
import { create } from 'zustand'
import { endOfDay } from 'date-fns'
import { useMe, useStore } from '../../store/useStore'
import type { ID, StatusType } from '../../store/types'
import { useTaskResolver } from '../hooks'
import { isSnoozed, useSnoozed } from './snooze'
import { toISODate } from '../../lib/utils'

/*
 * Inbox is the to-do side of notifications: things that need *you* to act.
 * Items are derived from tasks, comments, reminders and notifications; the
 * person's triage (done / snoozed) is kept in this browser.
 */

export type InboxKind = 'overdue' | 'today' | 'assigned' | 'mention' | 'comment' | 'reminder' | 'approval'

export interface InboxItem {
  key: string
  kind: InboxKind
  title: string
  detail: string
  at: string
  actorId?: ID
  taskId?: ID
  commentId?: ID
  reminderId?: ID
  notificationId?: ID
}

export const SECTIONS: { kind: InboxKind; label: string }[] = [
  { kind: 'overdue', label: 'Overdue' },
  { kind: 'today', label: 'Due today' },
  { kind: 'assigned', label: 'Assigned to you' },
  { kind: 'mention', label: 'Mentions' },
  { kind: 'comment', label: 'Comments assigned to you' },
  { kind: 'reminder', label: 'Reminders' },
  { kind: 'approval', label: 'Approvals' },
]

const KEY = 'ms.inbox.done'
const load = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

/** Inbox items the person marked done or dismissed. */
export const useInboxDone = create<{ done: string[]; setDone: (key: string, done: boolean) => void }>()((set) => ({
  done: load(),
  setDone: (key, done) =>
    set((s) => {
      // Keep the list bounded; old keys stop matching anyway once dates or ids move on.
      const next = (done ? [...s.done.filter((k) => k !== key), key] : s.done.filter((k) => k !== key)).slice(-500)
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* storage blocked */
      }
      return { done: next }
    }),
}))

/** Every inbox item that applies to the current person right now, before triage. */
export function useInboxItems(): InboxItem[] {
  const s = useStore()
  const me = useMe()
  const r = useTaskResolver()
  return useMemo(() => {
    const today = toISODate(new Date())
    const out: InboxItem[] = []
    const taskTitle = (id: ID) => s.tasks.find((t) => t.id === id)?.title
    const dueKeys = new Set<ID>()
    for (const t of s.tasks) {
      if (!t.assignees.includes(me.id) || !t.dueDate || r.isDone(t)) continue
      if (t.dueDate > today) continue
      dueKeys.add(t.id)
      out.push({
        key: `due:${t.id}:${t.dueDate}`,
        kind: t.dueDate < today ? 'overdue' : 'today',
        title: t.title,
        detail: `MS-${t.key} · ${r.listName(t.listId)}`,
        at: `${t.dueDate}T00:00:00`,
        taskId: t.id,
      })
    }
    for (const n of s.notifications) {
      const task = s.tasks.find((t) => t.id === n.taskId)
      if (n.kind === 'assigned') {
        // Already listed as overdue / due today, or finished since: nothing more to do.
        if (!task || dueKeys.has(task.id) || r.isDone(task)) continue
        out.push({ key: `n:${n.id}`, kind: 'assigned', title: task.title, detail: n.text, at: n.createdAt, actorId: n.actorId, taskId: task.id, notificationId: n.id })
      } else if (n.kind === 'mention') {
        out.push({ key: `n:${n.id}`, kind: 'mention', title: task?.title ?? 'Mention', detail: n.text, at: n.createdAt, actorId: n.actorId, taskId: task?.id, notificationId: n.id })
      } else if (n.kind === 'timesheet' && n.text.includes('submitted their')) {
        out.push({ key: `n:${n.id}`, kind: 'approval', title: 'Timesheet to review', detail: n.text, at: n.createdAt, actorId: n.actorId, notificationId: n.id })
      }
    }
    for (const c of s.comments) {
      if (c.assignee !== me.id || c.resolved) continue
      out.push({ key: `c:${c.id}`, kind: 'comment', title: taskTitle(c.taskId) ?? 'Comment', detail: c.text, at: c.createdAt, actorId: c.userId, taskId: c.taskId, commentId: c.id })
    }
    const eod = endOfDay(new Date()).toISOString()
    for (const rem of s.reminders) {
      if (rem.done || rem.due > eod) continue
      out.push({ key: `r:${rem.id}`, kind: 'reminder', title: rem.text, detail: rem.taskId ? (taskTitle(rem.taskId) ?? '') : '', at: rem.due, taskId: rem.taskId ?? undefined, reminderId: rem.id })
    }
    return out
  }, [s.tasks, s.notifications, s.comments, s.reminders, me.id, r])
}

/** Items split by triage state; `todo` is what the Inbox badge counts. */
export function useInbox() {
  const items = useInboxItems()
  const { done } = useInboxDone()
  const { until } = useSnoozed()
  return useMemo(() => {
    const doneSet = new Set(done)
    const todo: InboxItem[] = []
    const later: InboxItem[] = []
    const finished: InboxItem[] = []
    for (const it of items) {
      if (doneSet.has(it.key)) finished.push(it)
      else if (isSnoozed(until, it.key)) later.push(it)
      else todo.push(it)
    }
    finished.sort((a, b) => b.at.localeCompare(a.at))
    return { todo, later, done: finished.slice(0, 100), until }
  }, [items, done, until])
}

/** Doing the thing the item asks for: complete the task, resolve the comment, finish the reminder. */
export function completeItem(it: InboxItem) {
  const s = useStore.getState()
  if (it.reminderId) s.updateReminder(it.reminderId, { done: true })
  else if (it.commentId) s.updateComment(it.commentId, { resolved: true })
  else if (it.taskId && (it.kind === 'overdue' || it.kind === 'today' || it.kind === 'assigned')) {
    const t = s.tasks.find((x) => x.id === it.taskId)
    const space = s.spaces.find((sp) => sp.id === s.lists.find((l) => l.id === t?.listId)?.spaceId)
    const want: StatusType[] = ['done', 'closed']
    const target = want.map((w) => space?.statuses.find((st) => st.type === w)).find(Boolean)
    if (target) s.updateTask(it.taskId, { statusId: target.id })
  }
  if (it.notificationId) s.markRead(it.notificationId)
  useInboxDone.getState().setDone(it.key, true)
}
