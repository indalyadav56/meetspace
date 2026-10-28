import * as Y from 'yjs'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import { API_BASE, ensureFreshToken } from '../../api/client'

/*
 * Live co-editing for one Doc over /docs/:id/collab. Frames (first byte):
 *   0 update     we send [0][update]; the server sends [0][seq:8][update]
 *   1 awareness  cursors and who's here, relayed as-is
 *   3 synced     [3][flags:1][stored:4] after the history; flags&1 asks us to load the doc's HTML
 *   4 compact    [4][upTo:8][snapshot] replaces stored history up to upTo
 *   5 ack        [5][seq:8] for our own update
 */
const UPDATE = 0
const AWARENESS = 1
const SYNCED = 3
const COMPACT = 4
const ACK = 5
const COMPACT_AFTER = 80 // stored updates before we fold them into one snapshot

export type CollabStatus = 'connecting' | 'live' | 'offline'

export class DocCollab {
  readonly doc = new Y.Doc()
  readonly awareness = new Awareness(this.doc)
  status: CollabStatus = 'connecting'
  private ws: WebSocket | null = null
  private maxSeq = 0
  private stored = 0
  private synced = false
  private dirty = false // edits made while offline still need to reach the server
  private retry = 0
  private closed = false
  private timer: number | undefined

  constructor(
    private workspaceId: string,
    private docId: string,
    private onStatus: (s: CollabStatus, peers: number) => void,
    private onInitialize: () => void,
  ) {
    this.doc.on('update', this.onDocUpdate)
    this.awareness.on('update', this.onAwarenessUpdate)
    this.awareness.on('change', () => this.report())
    void this.connect()
  }

  private report() {
    this.onStatus(this.status, Math.max(0, this.awareness.getStates().size - 1))
  }

  private async connect() {
    if (this.closed) return
    this.status = 'connecting'
    this.report()
    let token: string | null
    try {
      token = await ensureFreshToken()
    } catch {
      token = null
    }
    if (this.closed) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}${API_BASE}/workspaces/${this.workspaceId}/docs/${this.docId}/collab?access_token=${encodeURIComponent(token ?? '')}`)
    ws.binaryType = 'arraybuffer'
    this.ws = ws
    this.synced = false
    ws.onmessage = (e) => this.onMessage(new Uint8Array(e.data as ArrayBuffer))
    ws.onclose = () => {
      this.ws = null
      if (this.closed) return
      this.status = 'offline'
      this.report()
      // Back off up to ~15s; edits keep working locally meanwhile.
      const wait = Math.min(15000, 500 * 2 ** this.retry++)
      this.timer = window.setTimeout(() => void this.connect(), wait)
    }
  }

  private onMessage(m: Uint8Array) {
    switch (m[0]) {
      case UPDATE: {
        const seq = Number(new DataView(m.buffer, m.byteOffset + 1, 8).getBigUint64(0))
        this.maxSeq = Math.max(this.maxSeq, seq)
        Y.applyUpdate(this.doc, m.subarray(9), this)
        break
      }
      case AWARENESS: {
        const before = this.awareness.getStates().size
        applyAwarenessUpdate(this.awareness, m.subarray(1), this)
        // Someone new joined: say we're here too, or they won't see us until we move.
        if (this.awareness.getStates().size > before) this.send(AWARENESS, encodeAwarenessUpdate(this.awareness, [this.doc.clientID]))
        break
      }
      case ACK: {
        const seq = Number(new DataView(m.buffer, m.byteOffset + 1, 8).getBigUint64(0))
        this.maxSeq = Math.max(this.maxSeq, seq)
        this.stored++
        break
      }
      case SYNCED: {
        const initialize = (m[1] & 1) === 1
        this.stored = new DataView(m.buffer, m.byteOffset + 2, 4).getUint32(0)
        this.synced = true
        this.retry = 0
        this.status = 'live'
        this.report()
        // Tell others we're here (and where our cursor is).
        this.send(AWARENESS, encodeAwarenessUpdate(this.awareness, [this.doc.clientID]))
        if (this.dirty) {
          // Offline edits: send our whole state; merging it is harmless.
          this.send(UPDATE, Y.encodeStateAsUpdate(this.doc))
          this.dirty = false
        }
        if (initialize) this.onInitialize()
        if (this.stored > COMPACT_AFTER) this.compact()
        break
      }
    }
  }

  private send(kind: number, data: Uint8Array, prefix?: Uint8Array) {
    if (this.ws?.readyState !== WebSocket.OPEN) return false
    const out = new Uint8Array(1 + (prefix?.length ?? 0) + data.length)
    out[0] = kind
    if (prefix) out.set(prefix, 1)
    out.set(data, 1 + (prefix?.length ?? 0))
    this.ws.send(out)
    return true
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return
    if (!this.synced || !this.send(UPDATE, update)) this.dirty = true
  }

  private onAwarenessUpdate = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    if (origin === this) return
    this.send(AWARENESS, encodeAwarenessUpdate(this.awareness, [...added, ...updated, ...removed]))
  }

  /** Fold the stored history into one snapshot (the server only accepts it when we're alone). */
  private compact() {
    const upTo = new Uint8Array(8)
    new DataView(upTo.buffer).setBigUint64(0, BigInt(this.maxSeq))
    this.send(COMPACT, Y.encodeStateAsUpdate(this.doc), upTo)
  }

  setUser(name: string, color: string) {
    this.awareness.setLocalStateField('user', { name, color })
  }

  destroy() {
    if (this.closed) return
    this.closed = true
    window.clearTimeout(this.timer)
    removeAwarenessStates(this.awareness, [this.doc.clientID], 'local')
    this.ws?.close()
    this.doc.off('update', this.onDocUpdate)
    this.awareness.destroy()
    this.doc.destroy()
  }
}
