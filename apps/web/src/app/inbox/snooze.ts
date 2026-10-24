import { create } from 'zustand'
import { addDays, addHours, nextMonday, setHours, startOfHour } from 'date-fns'
import type { ID } from '../../store/types'

const KEY = 'ms.inbox.snoozed'

const load = (): Record<ID, string> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

/** Notifications snoozed until a time, kept in this browser. They come back to Primary/Other when it passes. */
export const useSnoozed = create<{ until: Record<ID, string>; snooze: (id: ID, until: Date | null) => void }>()((set) => ({
  until: load(),
  snooze: (id, until) =>
    set((s) => {
      const next = { ...s.until }
      if (until) next[id] = until.toISOString()
      else delete next[id]
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* storage blocked */
      }
      return { until: next }
    }),
}))

export const isSnoozed = (until: Record<ID, string>, id: ID) => !!until[id] && until[id] > new Date().toISOString()

export const SNOOZE_OPTIONS: { label: string; at: () => Date }[] = [
  { label: 'Later today', at: () => startOfHour(addHours(new Date(), 3)) },
  { label: 'Tomorrow morning', at: () => setHours(startOfHour(addDays(new Date(), 1)), 9) },
  { label: 'Next week', at: () => setHours(startOfHour(nextMonday(new Date())), 9) },
]
