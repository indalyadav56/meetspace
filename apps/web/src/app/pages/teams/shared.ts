import { useMemo } from 'react'
import { format } from 'date-fns'
import { useStore } from '../../../store/useStore'
import type { ID, Member, Task, User } from '../../../store/types'
import { useTaskResolver } from '../../hooks'

export const TEAM_COLORS = ['#0b7f71', '#2563eb', '#7c3aed', '#db2777', '#f45f2f', '#d97706', '#16a34a', '#475569']

export interface Person {
  user: User
  member: Member
  online: boolean
  open: Task[]
  overdue: Task[]
}

/** Workspace members joined with their profile, presence and task load. */
export function usePeople() {
  const { users, workspaces, currentWorkspaceId, currentUserId, presence, tasks, teams } = useStore()
  const r = useTaskResolver()
  const members = workspaces.find((w) => w.id === currentWorkspaceId)?.members ?? []
  const me = members.find((m) => m.userId === currentUserId)
  const canManage = me?.role === 'owner' || me?.role === 'admin'
  const people = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const live = new Set([...presence, currentUserId ?? ''])
    return members
      .map((m): Person | null => {
        const user = users.find((u) => u.id === m.userId)
        if (!user) return null
        const open = tasks.filter((t) => !t.parentId && t.assignees.includes(m.userId) && !r.isDone(t))
        return { user, member: m, online: live.has(m.userId), open, overdue: open.filter((t) => !!t.dueDate && t.dueDate.slice(0, 10) < today) }
      })
      .filter((p) => !!p)
      .sort((a, b) => a.user.name.localeCompare(b.user.name))
  }, [members, users, presence, currentUserId, tasks, r])
  const byId = useMemo(() => new Map(people.map((p) => [p.user.id, p])), [people])
  const teamsOf = (id: ID) => teams.filter((t) => t.members.includes(id))
  return { people, byId, canManage, me: currentUserId, teamsOf }
}
