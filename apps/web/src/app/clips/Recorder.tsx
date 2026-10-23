import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { Camera, Circle, Mic, Monitor, Pause, Play, Square, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { ClipKind, ID } from '../../store/types'
import { pickMime, uploadClip } from './clipStore'
import { formatDuration } from './ClipPlayer'
import { cn } from '../../lib/utils'

type Mode = 'screen' | 'camera' | 'screen+camera' | 'audio'

interface RecorderState {
  phase: 'idle' | 'setup' | 'countdown' | 'recording' | 'paused' | 'saving'
  mode: Mode
  mic: boolean
  taskId: ID | null
  count: number
  elapsed: number
  error: string | null
  lastClipId: string | null
  open: (opts?: { taskId?: ID | null; mode?: Mode }) => void
  set: (p: Partial<RecorderState>) => void
}

export const useRecorder = create<RecorderState>()((set) => ({
  phase: 'idle',
  mode: 'screen+camera',
  mic: true,
  taskId: null,
  count: 3,
  elapsed: 0,
  error: null,
  lastClipId: null,
  open: (opts) => set({ phase: 'setup', taskId: opts?.taskId ?? null, mode: opts?.mode ?? 'screen+camera', error: null }),
  set: (p) => set(p),
}))

/* ---------------- capture session (module-level, not serialisable) ---------------- */

let recorder: MediaRecorder | null = null
let sources: MediaStream[] = []
let cleanup: (() => void) | null = null
let tick: number | undefined
let accumulated = 0
let segmentStart = 0
let thumb = ''

function stopSources() {
  sources.forEach((s) => s.getTracks().forEach((t) => t.stop()))
  sources = []
  cleanup?.()
  cleanup = null
}

/** Builds the stream to record for a mode; composites a camera bubble onto the screen when both are used. */
async function buildStream(mode: Mode, mic: boolean): Promise<MediaStream> {
  const tracks: MediaStreamTrack[] = []
  let screen: MediaStream | null = null
  let camera: MediaStream | null = null
  if (mode === 'screen' || mode === 'screen+camera') {
    screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true })
    sources.push(screen)
    // Stopping the share from the browser's own bar ends the recording.
    screen.getVideoTracks()[0].onended = () => finish()
  }
  if (mode === 'camera' || mode === 'screen+camera') {
    camera = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })
    sources.push(camera)
  }
  if (mic) {
    try {
      const m = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      sources.push(m)
    } catch {
      if (mode === 'audio') throw new Error('Microphone access is needed for a voice clip.')
    }
  }

  // Mix every audio source (mic + shared tab/system audio) into one track.
  const audioSources = sources.flatMap((s) => s.getAudioTracks())
  if (audioSources.length) {
    const ac = new AudioContext()
    const dest = ac.createMediaStreamDestination()
    audioSources.forEach((t) => ac.createMediaStreamSource(new MediaStream([t])).connect(dest))
    tracks.push(dest.stream.getAudioTracks()[0])
    const prev = cleanup
    cleanup = () => {
      prev?.()
      void ac.close()
    }
  }

  if (screen && camera) {
    const sv = document.createElement('video')
    const cv = document.createElement('video')
    sv.muted = cv.muted = true
    sv.srcObject = screen
    cv.srcObject = camera
    await Promise.all([sv.play(), cv.play()])
    const settings = screen.getVideoTracks()[0].getSettings()
    const canvas = document.createElement('canvas')
    canvas.width = settings.width ?? 1920
    canvas.height = settings.height ?? 1080
    const g = canvas.getContext('2d')!
    const r = Math.round(Math.min(canvas.width, canvas.height) * 0.13)
    const id = window.setInterval(() => {
      g.drawImage(sv, 0, 0, canvas.width, canvas.height)
      const cx = r + 32
      const cy = canvas.height - r - 32
      g.save()
      g.beginPath()
      g.arc(cx, cy, r, 0, Math.PI * 2)
      g.closePath()
      g.clip()
      const s = Math.max((2 * r) / cv.videoWidth, (2 * r) / cv.videoHeight)
      g.drawImage(cv, cx - (cv.videoWidth * s) / 2, cy - (cv.videoHeight * s) / 2, cv.videoWidth * s, cv.videoHeight * s)
      g.restore()
      g.lineWidth = 6
      g.strokeStyle = '#fff'
      g.beginPath()
      g.arc(cx, cy, r, 0, Math.PI * 2)
      g.stroke()
    }, 1000 / 30)
    tracks.push(canvas.captureStream(30).getVideoTracks()[0])
    const prev = cleanup
    cleanup = () => {
      prev?.()
      window.clearInterval(id)
    }
  } else {
    const v = (screen ?? camera)?.getVideoTracks()[0]
    if (v) tracks.push(v)
  }
  return new MediaStream(tracks)
}

async function captureThumb(stream: MediaStream) {
  const v = stream.getVideoTracks()[0]
  if (!v) return ''
  const el = document.createElement('video')
  el.muted = true
  el.srcObject = new MediaStream([v])
  await el.play().catch(() => {})
  await new Promise((r) => setTimeout(r, 400))
  const c = document.createElement('canvas')
  c.width = 320
  c.height = Math.round((320 * (el.videoHeight || 180)) / (el.videoWidth || 320))
  c.getContext('2d')!.drawImage(el, 0, 0, c.width, c.height)
  el.srcObject = null
  return c.toDataURL('image/jpeg', 0.6)
}

async function begin() {
  const { mode, mic } = useRecorder.getState()
  const withVideo = mode !== 'audio'
  const mime = pickMime(withVideo)
  if (!mime) return useRecorder.setState({ error: 'Recording isn’t supported in this browser.', phase: 'setup' })
  let stream: MediaStream
  try {
    stream = await buildStream(mode, mic)
  } catch (e) {
    stopSources()
    const msg = (e as Error).name === 'NotAllowedError' ? 'Permission was denied or the picker was cancelled.' : (e as Error).message || 'Couldn’t start recording.'
    return useRecorder.setState({ error: msg, phase: 'setup' })
  }
  // 3-2-1 countdown so the user can get ready.
  for (const n of [3, 2, 1]) {
    useRecorder.setState({ phase: 'countdown', count: n })
    await new Promise((r) => setTimeout(r, 800))
  }
  thumb = withVideo ? await captureThumb(stream) : ''
  const chunks: Blob[] = []
  recorder = new MediaRecorder(stream, { mimeType: mime })
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  recorder.onstop = async () => {
    window.clearInterval(tick)
    const duration = Math.round(accumulated / 1000)
    stopSources()
    const blob = new Blob(chunks, { type: mime })
    const st = useRecorder.getState()
    const kind: ClipKind = st.mode
    const label = { screen: 'Screen recording', camera: 'Camera recording', 'screen+camera': 'Screen + camera', audio: 'Voice clip', call: 'Call' }[kind]
    const title = `${label} — ${new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
    useRecorder.setState({ phase: 'saving' })
    try {
      const clip = await uploadClip({ title, kind, durationSec: duration, mime, taskId: st.taskId, thumb }, blob)
      useRecorder.setState({ phase: 'idle', lastClipId: clip.id, elapsed: 0 })
    } catch (e) {
      useRecorder.setState({ phase: 'idle', elapsed: 0, error: `Couldn’t upload the recording: ${(e as Error).message}` })
    }
  }
  accumulated = 0
  segmentStart = Date.now()
  recorder.start(1000)
  useRecorder.setState({ phase: 'recording', elapsed: 0 })
  tick = window.setInterval(() => {
    const s = useRecorder.getState()
    if (s.phase === 'recording') useRecorder.setState({ elapsed: accumulated + (Date.now() - segmentStart) })
  }, 250)
}

function pause() {
  if (recorder?.state !== 'recording') return
  recorder.pause()
  accumulated += Date.now() - segmentStart
  useRecorder.setState({ phase: 'paused' })
}
function resume() {
  if (recorder?.state !== 'paused') return
  recorder.resume()
  segmentStart = Date.now()
  useRecorder.setState({ phase: 'recording' })
}
function finish() {
  if (!recorder || recorder.state === 'inactive') return
  if (recorder.state === 'recording') accumulated += Date.now() - segmentStart
  recorder.stop()
}
function discard() {
  if (recorder && recorder.state !== 'inactive') {
    recorder.ondataavailable = null
    recorder.onstop = null
    recorder.stop()
  }
  window.clearInterval(tick)
  stopSources()
  useRecorder.setState({ phase: 'idle', elapsed: 0 })
}

/* ---------------- UI ---------------- */

const MODES: { mode: Mode; label: string; desc: string; icon: typeof Monitor }[] = [
  { mode: 'screen+camera', label: 'Screen + camera', desc: 'Your screen with a camera bubble', icon: Monitor },
  { mode: 'screen', label: 'Screen only', desc: 'A tab, window or whole screen', icon: Monitor },
  { mode: 'camera', label: 'Camera only', desc: 'Record a quick video message', icon: Camera },
  { mode: 'audio', label: 'Voice clip', desc: 'Audio only', icon: Mic },
]

export default function Recorder() {
  const r = useRecorder()
  const task = useStore((s) => s.tasks.find((t) => t.id === r.taskId))
  const [, force] = useState(0)

  useEffect(() => {
    // Keep the floating timer fresh while recording.
    if (r.phase !== 'recording') return
    const id = setInterval(() => force((x) => x + 1), 500)
    return () => clearInterval(id)
  }, [r.phase])

  if (r.phase === 'idle') return null

  if (r.phase === 'setup')
    return createPortal(
      <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50 p-3" onMouseDown={(e) => e.target === e.currentTarget && r.set({ phase: 'idle' })}>
        <div className="surface text-app shadow-pop w-full max-w-md rounded-2xl">
          <div className="border-app flex items-center border-b px-5 py-3">
            <Circle size={16} className="mr-2 fill-red-500 text-red-500" />
            <h2 className="font-semibold">Record a clip</h2>
            <button onClick={() => r.set({ phase: 'idle' })} className="hover-surface text-muted ml-auto rounded p-1" aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2 p-5">
            {task && <p className="text-muted mb-1 text-xs">Will be attached to MS-{task.key} {task.title}</p>}
            {MODES.map((m) => (
              <button key={m.mode} onClick={() => r.set({ mode: m.mode })} className={cn('flex w-full items-center gap-3 rounded-xl border p-3 text-left', r.mode === m.mode ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/15' : 'border-app hover-surface')}>
                <span className="surface-muted rounded-lg p-2">
                  <m.icon size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{m.label}</span>
                  <span className="text-muted block text-xs">{m.desc}</span>
                </span>
              </button>
            ))}
            {r.mode !== 'audio' && (
              <label className="flex items-center gap-2 pt-1 text-sm">
                <input type="checkbox" checked={r.mic} onChange={(e) => r.set({ mic: e.target.checked })} className="accent-brand-600 h-4 w-4" /> Record microphone
              </label>
            )}
            {r.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">{r.error}</p>}
            <button onClick={() => (r.set({ error: null }), void begin())} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 font-semibold text-white hover:bg-red-600">
              <Circle size={14} fill="currentColor" /> Start recording
            </button>
            <p className="text-faint text-center text-[11px]">Recordings are saved in this browser’s storage.</p>
          </div>
        </div>
      </div>,
      document.body,
    )

  if (r.phase === 'countdown')
    return createPortal(
      <div className="pointer-events-none fixed inset-0 z-[65] flex items-center justify-center bg-black/40">
        <span className="flex h-32 w-32 items-center justify-center rounded-full bg-black/70 text-6xl font-bold text-white">{r.count}</span>
      </div>,
      document.body,
    )

  if (r.phase === 'saving')
    return createPortal(
      <div role="status" className="fixed bottom-5 left-1/2 z-[65] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2.5 text-sm text-white shadow-2xl">
        Uploading recording…
      </div>,
      document.body,
    )

  return createPortal(
    <div className="fixed bottom-5 left-1/2 z-[65] flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 py-2 pr-2 pl-4 text-white shadow-2xl">
      <span className={cn('h-2.5 w-2.5 rounded-full bg-red-500', r.phase === 'recording' && 'animate-pulse')} />
      <span className="font-mono text-sm tabular-nums">{formatDuration(r.elapsed / 1000)}</span>
      <span className="hidden text-xs text-white/60 sm:inline">{MODES.find((m) => m.mode === r.mode)?.label}</span>
      {r.phase === 'recording' ? (
        <button onClick={pause} className="rounded-full p-2 hover:bg-white/10" aria-label="Pause">
          <Pause size={16} />
        </button>
      ) : (
        <button onClick={resume} className="rounded-full p-2 hover:bg-white/10" aria-label="Resume">
          <Play size={16} />
        </button>
      )}
      <button onClick={discard} className="rounded-full p-2 hover:bg-white/10" aria-label="Discard recording" title="Discard">
        <X size={16} />
      </button>
      <button onClick={finish} className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-sm font-semibold hover:bg-red-600">
        <Square size={12} fill="currentColor" /> Stop
      </button>
    </div>,
    document.body,
  )
}
