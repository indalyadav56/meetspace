import { create } from 'zustand'
import { integrations, type IntegrationStatus } from '../../../api/integrations'

export type Category = 'development' | 'communication' | 'meetings' | 'ai'

export interface AppInfo {
  key: keyof IntegrationStatus
  name: string
  tagline: string
  category: Category
  /** Workspace admins connect it here; otherwise it's configured on the server. */
  connectable: boolean
}

export const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'development', label: 'Development' },
  { key: 'communication', label: 'Communication' },
  { key: 'meetings', label: 'Meetings' },
  { key: 'ai', label: 'AI' },
]

/** Only integrations that actually work in Meetspace are listed. */
export const APPS: AppInfo[] = [
  { key: 'github', name: 'GitHub', tagline: 'Link pull requests, issues and commits to tasks — automatically when they mention MS-123.', category: 'development', connectable: true },
  { key: 'email', name: 'Email (Resend)', tagline: 'Password resets and workspace invites by email.', category: 'communication', connectable: false },
  { key: 'meetings', name: 'Video meetings (LiveKit)', tagline: 'Self-hosted audio and video calls in chat and the Planner.', category: 'meetings', connectable: false },
  { key: 'ai', name: 'AI assistant (Gemini)', tagline: 'Free-form answers and agents that act on your workspace.', category: 'ai', connectable: false },
]

/** Integration status for the current workspace, shared by the page and sidebar. */
interface StatusState {
  status: IntegrationStatus | null
  workspaceId: string | null
  load: (workspaceId: string) => Promise<void>
  setStatus: (s: IntegrationStatus) => void
}

export const useIntegrations = create<StatusState>()((set) => ({
  status: null,
  workspaceId: null,
  load: async (workspaceId) => {
    const status = await integrations.status()
    set({ status, workspaceId })
  },
  setStatus: (status) => set({ status }),
}))
