import type { ID } from '../../store/types'

const KEY = 'ms.board.viewed'

/** When this browser last opened each whiteboard (ISO time). */
export function viewedTimes(): Record<ID, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function markViewed(id: ID) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...viewedTimes(), [id]: new Date().toISOString() }))
  } catch {
    /* storage blocked */
  }
}
