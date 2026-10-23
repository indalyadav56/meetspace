import { api, ensureFreshToken } from '../../api/client'
import { useStore } from '../../store/useStore'
import type { Clip, ClipKind, ID } from '../../store/types'

/** Clip media lives on the Meetspace server; the store keeps metadata only. */

export interface ClipUpload {
  id?: ID
  title: string
  kind: ClipKind
  durationSec: number
  mime: string
  taskId: ID | null
  transcript?: string
  thumb?: string
}

/** Uploads a recording and adds it to the library (and to its task, if any). */
export async function uploadClip(meta: ClipUpload, blob: Blob): Promise<Clip> {
  const s = useStore.getState()
  const form = new FormData()
  form.append('file', blob, `${meta.title}.${meta.mime.includes('mp4') ? 'mp4' : 'webm'}`)
  form.append('title', meta.title)
  form.append('kind', meta.kind)
  form.append('durationSec', String(meta.durationSec))
  form.append('mime', meta.mime)
  if (meta.taskId) form.append('taskId', meta.taskId)
  if (meta.transcript) form.append('transcript', meta.transcript)
  if (meta.thumb) form.append('thumb', meta.thumb)
  const clip = await api.upload<Clip>(`/workspaces/${s.currentWorkspaceId}/clips`, form)
  s.addClip(clip)
  if (clip.taskId) {
    const t = useStore.getState().tasks.find((x) => x.id === clip.taskId)
    if (t && !t.clipIds.includes(clip.id)) useStore.setState((st) => ({ tasks: st.tasks.map((x) => (x.id === t.id ? { ...x, clipIds: [...x.clipIds, clip.id] } : x)) }))
  }
  return clip
}

/** A URL a <video>/<audio> element can stream from (supports range requests). */
export async function clipSrc(clipId: ID) {
  const token = await ensureFreshToken()
  const ws = useStore.getState().currentWorkspaceId
  return `/api/v1/workspaces/${ws}/clips/${clipId}/media?access_token=${encodeURIComponent(token ?? '')}`
}

export async function downloadClip(clip: Clip) {
  const res = await fetch(await clipSrc(clip.id))
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${clip.title.replace(/[^\w\- ]+/g, '').trim() || 'clip'}.${clip.mime.includes('mp4') ? 'mp4' : 'webm'}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** Picks a recording format this browser supports. */
export function pickMime(withVideo: boolean) {
  const candidates = withVideo ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'] : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? ''
}
