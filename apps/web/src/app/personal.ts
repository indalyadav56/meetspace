import { create } from 'zustand'

/*
 * Per-browser account preferences: which personal tools sit in the top bar,
 * whether notifications are muted, and which tool popup is open.
 */

export type ToolId = 'task' | 'myWork' | 'timer' | 'notepad' | 'clip' | 'voice' | 'reminder' | 'doc' | 'whiteboard' | 'people' | 'dashboard' | 'notetaker' | 'call'
export type PopupTool = 'task' | 'reminder' | 'timer' | 'notepad'

const DEFAULT_PINS: ToolId[] = ['task', 'reminder', 'timer', 'doc', 'whiteboard', 'clip', 'voice', 'call']
const PINS = 'ms.tools.pinned'
const MUTE = 'ms.notif.mutedUntil'

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const write = (key: string, value: unknown) => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage blocked */
  }
}

interface Personal {
  pinned: ToolId[]
  togglePin: (id: ToolId) => void
  /** ISO time notifications stay muted until, or null. */
  mutedUntil: string | null
  mute: (until: Date | null) => void
  popup: { tool: PopupTool; anchor: HTMLElement } | null
  openPopup: (tool: PopupTool, anchor: HTMLElement) => void
  closePopup: () => void
}

export const usePersonal = create<Personal>()((set) => ({
  pinned: read(PINS, DEFAULT_PINS),
  togglePin: (id) =>
    set((s) => {
      const pinned = s.pinned.includes(id) ? s.pinned.filter((x) => x !== id) : [...s.pinned, id]
      write(PINS, pinned)
      return { pinned }
    }),
  mutedUntil: read<string | null>(MUTE, null),
  mute: (until) => {
    const mutedUntil = until ? until.toISOString() : null
    write(MUTE, mutedUntil)
    set({ mutedUntil })
  },
  popup: null,
  openPopup: (tool, anchor) => set((s) => ({ popup: s.popup?.tool === tool && s.popup.anchor === anchor ? null : { tool, anchor } })),
  closePopup: () => set({ popup: null }),
}))

export const isMuted = (until: string | null = usePersonal.getState().mutedUntil) => !!until && until > new Date().toISOString()
