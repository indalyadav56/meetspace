import { API_BASE, ensureFreshToken } from './client'

/** One change pushed by the server: {collection, op, payload}. */
export interface RealtimeEvent {
  workspaceId: string
  collection: string
  op: string
  payload: any
}

type Handler = (e: RealtimeEvent) => void
type StatusHandler = (s: 'connecting' | 'open' | 'closed') => void

/**
 * WebSocket to /api/v1/ws for one workspace. Reconnects with backoff; after a
 * reconnect `onResync` fires so the caller can reload the snapshot it missed.
 */
export class RealtimeConnection {
  private ws: WebSocket | null = null
  private stopped = false
  private attempt = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private everOpened = false

  constructor(
    private workspaceId: string,
    private onEvent: Handler,
    private onResync: () => void,
    private onStatus: StatusHandler = () => {},
  ) {
    void this.open()
  }

  private async open() {
    if (this.stopped) return
    this.onStatus('connecting')
    const token = await ensureFreshToken()
    if (!token || this.stopped) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${location.host}${API_BASE}/ws?workspace=${encodeURIComponent(this.workspaceId)}&access_token=${encodeURIComponent(token)}`
    const ws = new WebSocket(url)
    this.ws = ws
    ws.onopen = () => {
      this.attempt = 0
      this.onStatus('open')
      if (this.everOpened) this.onResync()
      this.everOpened = true
    }
    ws.onmessage = (m) => {
      try {
        this.onEvent(JSON.parse(m.data))
      } catch {
        /* ignore malformed frames */
      }
    }
    ws.onclose = () => {
      this.ws = null
      if (this.stopped) return
      this.onStatus('closed')
      const delay = Math.min(15000, 500 * 2 ** this.attempt++) + Math.random() * 300
      this.timer = setTimeout(() => void this.open(), delay)
    }
  }

  close() {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.ws?.close()
  }
}

/** Other modules (calls) listen for their own collections here. */
const listeners = new Set<Handler>()
export function onRealtime(fn: Handler) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export function emitRealtime(e: RealtimeEvent) {
  listeners.forEach((l) => l(e))
}
