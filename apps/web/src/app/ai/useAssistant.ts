import { create } from 'zustand'
import { format } from 'date-fns'
import { useStore } from '../../store/useStore'
import { localAssistant } from './local'
import type { ToolEffect } from './tools'
import { uid } from '../../lib/utils'
import { api, API_BASE, ensureFreshToken } from '../../api/client'

export interface ChatItem {
  id: string
  role: 'user' | 'assistant'
  text: string
  effects: ToolEffect[]
  engine?: 'local' | 'server'
  error?: boolean
  pending?: boolean
}

/** The workspace's server-side agent (Google ADK + Gemini), when the backend has a key. */
export interface ServerAgent {
  enabled: boolean
  model: string
}

interface AssistantState {
  open: boolean
  items: ChatItem[]
  /** ADK session id, so follow-up questions keep the conversation. */
  sessionId: string | null
  busy: boolean
  status: string | null
  workspaceId: string | null
  agent: ServerAgent | null
  abort: AbortController | null
  setOpen: (open: boolean) => void
  loadAgent: () => Promise<void>
  ask: (prompt: string) => void
  stop: () => void
  reset: () => void
}

/** What the user is looking at right now, given to the model with every message. */
function describeContext() {
  const s = useStore.getState()
  const me = s.users.find((u) => u.id === s.currentUserId)
  const ws = s.workspaces.find((w) => w.id === s.currentWorkspaceId)
  const lines = [`Today: ${format(new Date(), 'EEEE yyyy-MM-dd')}`, `User: ${me?.name}`, `Workspace: ${ws?.name}`]
  const task = s.openTaskId ? s.tasks.find((t) => t.id === s.openTaskId) : undefined
  if (task) lines.push(`Viewing task: MS-${task.key} ${task.title}`)
  const path = location.pathname
  const list = path.match(/\/app\/list\/([^/]+)/)
  if (list) lines.push(`Viewing List: ${s.lists.find((l) => l.id === list[1])?.name}`)
  const doc = path.match(/\/app\/docs\/([^/]+)/)
  if (doc) lines.push(`Viewing Doc: ${s.docs.find((d) => d.id === doc[1])?.title || 'Untitled'}`)
  const space = path.match(/\/app\/space\/([^/]+)/)
  if (space) lines.push(`Viewing project: ${s.spaces.find((p) => p.id === space[1])?.name}`)
  if (!task && !list && !doc && !space) lines.push(`Page: ${path.replace('/app/', '')}`)
  return lines.join('\n')
}

interface ServerEvent {
  type: 'text' | 'status' | 'effect' | 'done' | 'error'
  text?: string
  label?: string
  taskId?: string
  docId?: string
  sessionId?: string
}

/** POSTs a turn to /assistant/chat and yields its server-sent events. */
async function* streamTurn(workspaceId: string, body: object, signal: AbortSignal): AsyncGenerator<ServerEvent> {
  const token = await ensureFreshToken()
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `The assistant is unavailable (${res.status}).`)
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += value
    let i
    while ((i = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, i)
      buf = buf.slice(i + 2)
      const data = frame
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n')
      if (data) yield JSON.parse(data) as ServerEvent
    }
  }
}

export const useAssistant = create<AssistantState>()((set, get) => {
  const patchLast = (fn: (it: ChatItem) => ChatItem) => set((st) => ({ items: st.items.map((it, i) => (i === st.items.length - 1 ? fn(it) : it)) }))

  return {
    open: false,
    items: [],
    sessionId: null,
    busy: false,
    status: null,
    workspaceId: null,
    agent: null,
    abort: null,
    setOpen: (open) => {
      set({ open })
      if (open) void get().loadAgent()
    },
    loadAgent: async () => {
      const ws = useStore.getState().currentWorkspaceId
      if (!ws) return
      try {
        set({ agent: await api.get<ServerAgent>(`/workspaces/${ws}/assistant`) })
      } catch {
        set({ agent: { enabled: false, model: '' } })
      }
    },
    reset: () => {
      get().abort?.abort()
      set({ items: [], sessionId: null, busy: false, status: null, abort: null })
    },
    stop: () => get().abort?.abort(),
    ask: async (prompt) => {
      const text = prompt.trim()
      if (!text || get().busy) return
      const s = useStore.getState()
      // A conversation belongs to one workspace.
      if (get().workspaceId !== s.currentWorkspaceId) {
        set({ items: [], sessionId: null, workspaceId: s.currentWorkspaceId })
        await get().loadAgent()
      }
      const engine = get().agent?.enabled ? 'server' : 'local'
      set((st) => ({
        open: true,
        busy: true,
        items: [...st.items, { id: uid('q'), role: 'user', text, effects: [] }, { id: uid('a'), role: 'assistant', text: '', effects: [], engine, pending: true }],
      }))

      if (engine === 'local') {
        set({ status: 'Thinking' })
        await new Promise((r) => setTimeout(r, 350))
        try {
          const reply = localAssistant(text)
          patchLast((it) => ({ ...it, text: reply.text, effects: reply.effects, pending: false }))
        } catch (e) {
          patchLast((it) => ({ ...it, text: `Something went wrong: ${(e as Error).message}`, error: true, pending: false }))
        }
        set({ busy: false, status: null })
        return
      }

      const abort = new AbortController()
      set({ abort, status: 'Thinking' })
      try {
        for await (const ev of streamTurn(s.currentWorkspaceId, { message: text, sessionId: get().sessionId ?? '', context: describeContext() }, abort.signal)) {
          if (ev.sessionId) set({ sessionId: ev.sessionId })
          switch (ev.type) {
            case 'text':
              set({ status: null })
              patchLast((it) => ({ ...it, text: it.text + (ev.text ?? '') }))
              break
            case 'status':
              set({ status: ev.label ?? ev.text ?? null })
              break
            case 'effect':
              patchLast((it) => ({ ...it, effects: [...it.effects, { label: ev.label ?? 'Done', taskId: ev.taskId, docId: ev.docId }] }))
              break
            case 'error':
              throw new Error(ev.text || 'The assistant ran into a problem.')
          }
        }
        patchLast((it) => ({ ...it, text: it.text.trim() || 'Done.', pending: false }))
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? 'Stopped.' : (e as Error).message
        patchLast((it) => ({ ...it, text: (it.text ? it.text.trim() + '\n\n' : '') + msg, error: (e as Error).name !== 'AbortError', pending: false }))
      }
      set({ busy: false, status: null, abort: null })
    },
  }
})
