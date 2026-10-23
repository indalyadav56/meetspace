import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Planner view settings, shared by the page and its sidebar (kept per browser). */
interface PlannerState {
  /** Any day inside the week being shown (yyyy-MM-dd). */
  anchor: string
  showTasks: boolean
  showMeetings: boolean
  mineOnly: boolean
  set: (p: Partial<Omit<PlannerState, 'set'>>) => void
}

const today = () => new Date().toISOString().slice(0, 10)

export const usePlanner = create<PlannerState>()(
  persist(
    (set) => ({
      anchor: today(),
      showTasks: true,
      showMeetings: true,
      mineOnly: true,
      set: (p) => set(p),
    }),
    { name: 'meetspace-planner', partialize: (s) => ({ showTasks: s.showTasks, showMeetings: s.showMeetings, mineOnly: s.mineOnly }) },
  ),
)

/** Drag payload for scheduling a task by dropping it on a day. */
export const TASK_MIME = 'application/x-meetspace-task'
