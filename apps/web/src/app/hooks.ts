import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/useStore'
import type { ID, Space, Status, Task } from '../store/types'

/** Resolve list → space → statuses for any task. */
export function useTaskResolver() {
  const { spaces, lists } = useStore(useShallow((s) => ({ spaces: s.spaces, lists: s.lists })))
  return useMemo(() => {
    const listById = new Map(lists.map((l) => [l.id, l]))
    const spaceById = new Map(spaces.map((s) => [s.id, s]))
    const spaceOf = (t: Task): Space | undefined => spaceById.get(listById.get(t.listId)?.spaceId ?? '')
    const statusOf = (t: Task): Status | undefined => spaceOf(t)?.statuses.find((st) => st.id === t.statusId)
    const isDone = (t: Task) => {
      const st = statusOf(t)
      return st?.type === 'done' || st?.type === 'closed'
    }
    const listName = (id: ID) => listById.get(id)?.name ?? ''
    return { spaceOf, statusOf, isDone, listName, listById, spaceById }
  }, [spaces, lists])
}

export function useSubtaskCounts() {
  const tasks = useStore((s) => s.tasks)
  return useMemo(() => {
    const m = new Map<ID, number>()
    tasks.forEach((t) => t.parentId && m.set(t.parentId, (m.get(t.parentId) ?? 0) + 1))
    return m
  }, [tasks])
}
