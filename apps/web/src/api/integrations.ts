import { api } from './client'
import { useStore } from '../store/useStore'
import type { SavedAgent } from '../app/ai/useAssistant'

/** Calls for the App Center, GitHub links and saved AI agents. They report errors to the caller (no global toast). */

const ws = () => `/workspaces/${useStore.getState().currentWorkspaceId}`

export interface GitHubStatus {
  connected: boolean
  account?: string
  avatar?: string
  repos?: string[]
  lastSyncedAt?: string | null
  connectedAt?: string
}

export interface ServerIntegration {
  connected: boolean
  provider: string
  model?: string
}

export interface IntegrationStatus {
  github: GitHubStatus
  email: ServerIntegration
  meetings: ServerIntegration
  ai: ServerIntegration
}

export interface GitHubRepo {
  fullName: string
  private: boolean
  url: string
}

export interface GitHubLink {
  id: string
  taskId: string
  kind: 'pull_request' | 'issue' | 'commit'
  repo: string
  number: number
  ref: string
  title: string
  url: string
  state: string
  author: string
  updatedAt: string
}

export const integrations = {
  status: () => api.get<IntegrationStatus>(`${ws()}/integrations`),
  connectGitHub: (token: string) => api.raw<IntegrationStatus>('POST', `${ws()}/integrations/github`, { body: { token } }),
  disconnectGitHub: () => api.raw('DELETE', `${ws()}/integrations/github`),
  repos: () => api.get<GitHubRepo[]>(`${ws()}/integrations/github/repos`),
  setRepos: (repos: string[]) => api.raw<IntegrationStatus>('PUT', `${ws()}/integrations/github/repos`, { body: { repos } }),
  webhook: () => api.get<{ path: string; secret: string; contentType: string; events: string[] }>(`${ws()}/integrations/github/webhook`),
  sync: () => api.raw<{ linked: number }>('POST', `${ws()}/integrations/github/sync`, { body: {} }),
  links: (taskId: string) => api.get<GitHubLink[]>(`${ws()}/tasks/${taskId}/github`),
  link: (taskId: string, url: string) => api.raw<GitHubLink>('POST', `${ws()}/tasks/${taskId}/github`, { body: { url } }),
  unlink: (id: string) => api.raw('DELETE', `${ws()}/github-links/${id}`),
}

export const agents = {
  list: () => api.get<SavedAgent[]>(`${ws()}/assistant/agents`),
  create: (a: Omit<SavedAgent, 'id'> & { id?: string }) => api.raw<SavedAgent>('POST', `${ws()}/assistant/agents`, { body: a }),
  update: (id: string, a: Omit<SavedAgent, 'id'>) => api.raw<SavedAgent>('PUT', `${ws()}/assistant/agents/${id}`, { body: a }),
  remove: (id: string) => api.raw('DELETE', `${ws()}/assistant/agents/${id}`),
}
