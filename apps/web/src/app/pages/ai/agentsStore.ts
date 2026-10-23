import { create } from 'zustand'
import { agents as api } from '../../../api/integrations'
import { ApiError } from '../../../api/client'
import type { SavedAgent } from '../../ai/useAssistant'

/** The workspace's saved agents, shared by the AI page and its sidebar. */
interface AgentsState {
  list: SavedAgent[]
  workspaceId: string | null
  loading: boolean
  load: (workspaceId: string) => Promise<void>
  save: (a: Omit<SavedAgent, 'id'> & { id?: string }) => Promise<SavedAgent>
  remove: (id: string) => Promise<void>
}

export const useAgents = create<AgentsState>()((set, get) => ({
  list: [],
  workspaceId: null,
  loading: false,
  load: async (workspaceId) => {
    if (get().loading) return
    set({ loading: true })
    try {
      set({ list: await api.list(), workspaceId })
    } finally {
      set({ loading: false })
    }
  },
  save: async (a) => {
    const saved = a.id ? await api.update(a.id, a) : await api.create(a)
    set((s) => ({ list: s.list.some((x) => x.id === saved.id) ? s.list.map((x) => (x.id === saved.id ? saved : x)) : [...s.list, saved] }))
    return saved
  },
  remove: async (id) => {
    await api.remove(id)
    set((s) => ({ list: s.list.filter((x) => x.id !== id) }))
  },
}))

export const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong')

/** Starting points for new agents. */
export const AGENT_TEMPLATES: Omit<SavedAgent, 'id'>[] = [
  { icon: '📝', name: 'Standup writer', description: 'Turns yesterday’s activity into a crisp standup.', instructions: 'Write standups grouped by person: Done, Doing, Blocked. Keep each bullet under 12 words and mention task keys like MS-12.' },
  { icon: '🐞', name: 'Bug triager', description: 'Sorts new bugs by severity and suggests owners.', instructions: 'When asked about bugs, list open tasks tagged bug, rank them by priority and due date, flag anything overdue, and suggest who should own each based on current workload.' },
  { icon: '🚀', name: 'Release notes', description: 'Drafts user-facing notes from finished work.', instructions: 'Summarize recently completed tasks as user-facing release notes. Group by New, Improved and Fixed. Use plain language, no internal jargon, and offer to save the result as a doc.' },
  { icon: '📅', name: 'Meeting prep', description: 'Builds an agenda from open work and blockers.', instructions: 'Prepare a short meeting agenda: decisions needed, blocked tasks, overdue items and wins. End with three questions the team should answer.' },
]
