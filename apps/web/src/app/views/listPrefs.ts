import { useCallback, useState } from 'react'
import type { ID } from '../../store/types'
import type { SortKey } from '../../store/useStore'

export type GroupBy = 'status' | 'assignee' | 'priority' | 'due' | 'tag' | 'none'
export type ColKey = 'assignee' | 'due' | 'start' | 'priority' | 'tags' | 'status' | 'estimate' | 'points' | 'progress' | 'time' | 'created' | 'updated' | `cf:${ID}`

export const GROUP_LABELS: Record<GroupBy, string> = { status: 'Status', assignee: 'Assignee', priority: 'Priority', due: 'Due date', tag: 'Tag', none: 'None' }

export const COLUMNS: Record<Exclude<ColKey, `cf:${ID}`>, { label: string; w: number; sort?: SortKey }> = {
  status: { label: 'Status', w: 130 },
  assignee: { label: 'Assignee', w: 110 },
  due: { label: 'Due date', w: 110, sort: 'due' },
  start: { label: 'Start date', w: 110, sort: 'start' },
  priority: { label: 'Priority', w: 90, sort: 'priority' },
  tags: { label: 'Tags', w: 160 },
  estimate: { label: 'Estimate', w: 90, sort: 'estimate' },
  points: { label: 'Points', w: 70, sort: 'points' },
  progress: { label: 'Progress', w: 110 },
  time: { label: 'Time tracked', w: 100 },
  created: { label: 'Created', w: 100, sort: 'created' },
  updated: { label: 'Updated', w: 100, sort: 'updated' },
}

export interface ListPrefs {
  groupBy: GroupBy
  cols: ColKey[]
  expandSubtasks: boolean
  showEmpty: boolean
  collapsed: string[]
}

const DEFAULTS: ListPrefs = { groupBy: 'status', cols: ['assignee', 'due', 'priority', 'tags'], expandSubtasks: false, showEmpty: true, collapsed: [] }

/** Per-view layout choices (grouping, columns, collapsed groups), kept in this browser. */
export function useListPrefs(viewKey: string) {
  const key = `ms.list.${viewKey}`
  const [prefs, setState] = useState<ListPrefs>(() => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(key) ?? '{}') }
    } catch {
      return DEFAULTS
    }
  })
  const set = useCallback(
    (patch: Partial<ListPrefs>) =>
      setState((p) => {
        const next = { ...p, ...patch }
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          /* storage blocked */
        }
        return next
      }),
    [key],
  )
  return [prefs, set] as const
}
