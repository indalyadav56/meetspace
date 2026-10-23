import { create } from 'zustand'
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  type LocalTrackPublication,
  type Participant,
  type RemoteParticipant,
  type RemoteTrackPublication,
} from 'livekit-client'
import { useStore } from '../../store/useStore'
import type { CallKind, CallLog, ID } from '../../store/types'
import { initials, uid } from '../../lib/utils'
import { pickMime, uploadClip } from '../clips/clipStore'
import { api, ApiError } from '../../api/client'
import { onRealtime } from '../../api/realtime'

/*
 * Calls run through the self-hosted LiveKit SFU. The Meetspace API creates the
 * call, issues a room token and rings invitees over the realtime socket; media
 * flows browser ⇄ LiveKit. Hand raises, reactions, in-call chat and captions
 * travel as LiveKit data messages.
 */

export interface PeerView {
  peerId: string
  userId: ID
  stream: MediaStream | null
  micOn: boolean
  camOn: boolean
  sharing: boolean
  hand: boolean
  connection: RTCPeerConnectionState | 'new'
}

export interface CallInfo {
  /** LiveKit room name; chat call messages and call logs refer to it as callId. */
  callId: string
  title: string
  kind: CallKind
  channelId: ID | null
  meetingId: ID | null
  isNew: boolean
  invitees: ID[]
}

export interface IncomingCall {
  callId: string
  title: string
  kind: CallKind
  channelId: ID | null
  from: ID
}

export interface OngoingCall {
  callId: string
  title: string
  kind: CallKind
  channelId: ID | null
  peers: Record<string, ID>
  seen: number
}

export interface Caption {
  userId: ID
  text: string
  at: number
  final: boolean
}

type PeerState = { hand: boolean }

type DataMsg =
  | { t: 'state'; state: PeerState }
  | { t: 'react'; emoji: string }
  | { t: 'chat'; text: string; at: number }
  | { t: 'caption'; text: string; final: boolean }

interface JoinInfo {
  call: CallLog & { liveParticipants?: ID[] }
  token: string
  url: string
}

interface CallState {
  /** The signed-in user, who appears in calls. */
  tabUserId: ID
  phase: 'idle' | 'lobby' | 'connecting' | 'in-call'
  call: CallInfo | null
  startedAt: number
  local: MediaStream | null
  synthetic: boolean
  micOn: boolean
  camOn: boolean
  sharing: boolean
  hand: boolean
  peers: Record<string, PeerView>
  speaking: Record<string, boolean>
  reactions: { id: string; emoji: string; userId: ID }[]
  chat: { userId: ID; text: string; at: number }[]
  captionsOn: boolean
  captions: Record<ID, Caption>
  transcript: Caption[]
  recording: boolean
  recordStart: number
  minimized: boolean
  panel: null | 'people' | 'chat'
  layout: 'grid' | 'speaker'
  incoming: IncomingCall | null
  ongoing: Record<string, OngoingCall>
  devices: { mics: MediaDeviceInfo[]; cams: MediaDeviceInfo[]; mic: string; cam: string }
  error: string | null
  /** Summary of the call this tab just left, for the “save notes” prompt. */
  lastCall: LastCall | null

  /** Open the lobby. Without callId a new call starts. */
  prepare: (opts: Omit<CallInfo, 'callId' | 'isNew'> & { callId?: string; isNew?: boolean }) => Promise<void>
  join: () => Promise<void>
  cancelLobby: () => void
  leave: () => void
  /** Host only: end the call for everyone. */
  endForAll: () => void
  ring: (userIds: ID[]) => void
  toggleMic: () => void
  toggleCam: () => Promise<void>
  toggleShare: () => Promise<void>
  toggleHand: () => void
  react: (emoji: string) => void
  sendChat: (text: string) => void
  toggleCaptions: () => void
  toggleRecording: () => void
  selectDevice: (kind: 'mic' | 'cam', id: string) => Promise<void>
  acceptIncoming: () => void
  declineIncoming: () => void
  set: (p: Partial<CallState>) => void
}

/* ---------------- module-level engine state (not serialisable) ---------------- */

let room: Room | null = null
let cameraTrack: MediaStreamTrack | null = null
let screenStream: MediaStream | null = null
let audioCtx: AudioContext | null = null
const analysers = new Map<string, { an: AnalyserNode; src: MediaStreamAudioSourceNode }>()
let levelTimer: number | undefined
let recorder: MediaRecorder | null = null
let recordCleanup: (() => void) | null = null
let recognition: { stop: () => void; start: () => void; onresult: unknown; onend: unknown; continuous: boolean; interimResults: boolean; lang: string } | null = null
let ringTimer: number | undefined
let syntheticCleanup: (() => void) | null = null
const pubs: { audio?: LocalTrackPublication; camera?: LocalTrackPublication; screen?: LocalTrackPublication } = {}
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const me = () => useStore.getState().currentUserId ?? ''
const wsPath = (p: string) => `/workspaces/${useStore.getState().currentWorkspaceId}${p}`
const logFor = (roomName: string | undefined) => useStore.getState().callLogs.find((c) => c.callId === roomName)

function ctx() {
  audioCtx ??= new AudioContext()
  if (audioCtx.state === 'suspended') void audioCtx.resume()
  return audioCtx
}

function userName(id: ID) {
  return useStore.getState().users.find((u) => u.id === id)?.name ?? 'Guest'
}

function sendData(msg: DataMsg, to?: string[]) {
  if (room?.state !== ConnectionState.Connected) return
  void room.localParticipant.publishData(encoder.encode(JSON.stringify(msg)), { reliable: true, topic: 'meetspace', destinationIdentities: to }).catch(() => {})
}

/** Avatar-style stand-in video used when the camera is unavailable. */
function syntheticVideo(userId: ID): MediaStreamTrack {
  const c = document.createElement('canvas')
  c.width = 640
  c.height = 360
  const g = c.getContext('2d')!
  const user = useStore.getState().users.find((u) => u.id === userId)
  let t = 0
  const id = window.setInterval(() => {
    t += 1
    g.fillStyle = '#1f2128'
    g.fillRect(0, 0, 640, 360)
    const r = 70 + Math.sin(t / 8) * 4
    g.fillStyle = user?.color ?? '#0b7f71'
    g.beginPath()
    g.arc(320, 180, r, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#fff'
    g.font = 'bold 56px Inter, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(initials(user?.name ?? '?'), 320, 184)
  }, 100)
  const track = c.captureStream(10).getVideoTracks()[0]
  syntheticCleanup = () => window.clearInterval(id)
  return track
}

function silentAudio(): MediaStreamTrack {
  return ctx().createMediaStreamDestination().stream.getAudioTracks()[0]
}

async function acquire(kind: CallKind, mic?: string, cam?: string): Promise<{ stream: MediaStream; synthetic: boolean }> {
  const stream = new MediaStream()
  let synthetic = false
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: mic ? { deviceId: { exact: mic }, echoCancellation: true, noiseSuppression: true } : { echoCancellation: true, noiseSuppression: true } })
    s.getAudioTracks().forEach((t) => stream.addTrack(t))
  } catch {
    stream.addTrack(silentAudio())
    synthetic = true
  }
  if (kind === 'video') {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: cam ? { deviceId: { exact: cam }, width: 1280, height: 720 } : { width: 1280, height: 720 } })
      cameraTrack = s.getVideoTracks()[0]
      stream.addTrack(cameraTrack)
    } catch {
      synthetic = true
    }
  }
  return { stream, synthetic }
}

/** Outgoing video: screen share > camera > nothing. */
function currentVideoTrack(): MediaStreamTrack | null {
  const s = useCall.getState()
  if (s.sharing && screenStream) return screenStream.getVideoTracks()[0] ?? null
  if (s.camOn && cameraTrack && cameraTrack.readyState === 'live') return cameraTrack
  return null
}

function watchLevel(key: string, stream: MediaStream | null) {
  const old = analysers.get(key)
  if (old) {
    old.src.disconnect()
    analysers.delete(key)
  }
  if (!stream || !stream.getAudioTracks().length) return
  try {
    const src = ctx().createMediaStreamSource(new MediaStream(stream.getAudioTracks()))
    const an = ctx().createAnalyser()
    an.fftSize = 512
    src.connect(an)
    analysers.set(key, { an, src })
  } catch {
    /* stream without live audio */
  }
}

function startLevelLoop() {
  window.clearInterval(levelTimer)
  const buf = new Uint8Array(512)
  levelTimer = window.setInterval(() => {
    const speaking: Record<string, boolean> = {}
    for (const [k, { an }] of analysers) {
      an.getByteTimeDomainData(buf)
      let sum = 0
      for (const v of buf) sum += (v - 128) ** 2
      speaking[k] = Math.sqrt(sum / buf.length) > 6
    }
    const s = useCall.getState()
    if (!s.micOn) speaking.local = false
    for (const p of Object.values(s.peers)) if (!p.micOn) speaking[p.peerId] = false
    useCall.setState({ speaking })
  }, 200)
}

/* ---------------- remote participants ---------------- */

const hands = new Map<string, boolean>()

function viewOf(p: RemoteParticipant): PeerView {
  const tracks: MediaStreamTrack[] = []
  const pub = (src: Track.Source) => p.getTrackPublication(src) as RemoteTrackPublication | undefined
  const mic = pub(Track.Source.Microphone)
  const cam = pub(Track.Source.Camera)
  const screen = pub(Track.Source.ScreenShare)
  if (mic?.track && !mic.isMuted) tracks.push(mic.track.mediaStreamTrack)
  const video = screen?.track ?? (cam && !cam.isMuted ? cam.track : undefined)
  if (video) tracks.push(video.mediaStreamTrack)
  return {
    peerId: p.identity,
    userId: p.identity,
    stream: tracks.length ? new MediaStream(tracks) : null,
    micOn: !!mic && !mic.isMuted,
    camOn: !!cam && !cam.isMuted,
    sharing: !!screen,
    hand: hands.get(p.identity) ?? false,
    connection: 'connected',
  }
}

function refreshPeer(p: Participant) {
  if (!room || p.identity === room.localParticipant.identity) return
  const rp = room.remoteParticipants.get(p.identity)
  if (!rp) return
  const view = viewOf(rp)
  useCall.setState((s) => ({ peers: { ...s.peers, [view.peerId]: view } }))
  watchLevel(view.peerId, view.stream)
}

function dropPeer(identity: string) {
  hands.delete(identity)
  watchLevel(identity, null)
  useCall.setState((s) => {
    const { [identity]: _gone, ...rest } = s.peers
    return { peers: rest }
  })
}

function onData(payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) {
  if (topic !== 'meetspace' || !participant) return
  let msg: DataMsg
  try {
    msg = JSON.parse(decoder.decode(payload))
  } catch {
    return
  }
  const from = participant.identity
  switch (msg.t) {
    case 'state':
      hands.set(from, msg.state.hand)
      refreshPeer(participant)
      break
    case 'react':
      pushReaction(msg.emoji, from)
      break
    case 'chat':
      useCall.setState((st) => ({ chat: [...st.chat, { userId: from, text: msg.text, at: msg.at }] }))
      break
    case 'caption':
      addCaption({ userId: from, text: msg.text, final: msg.final, at: Date.now() })
      break
  }
}

function pushReaction(emoji: string, userId: ID) {
  const id = uid('r')
  useCall.setState((s) => ({ reactions: [...s.reactions, { id, emoji, userId }] }))
  window.setTimeout(() => useCall.setState((s) => ({ reactions: s.reactions.filter((r) => r.id !== id) })), 3200)
}

function addCaption(c: Caption) {
  useCall.setState((s) => ({ captions: { ...s.captions, [c.userId]: c }, transcript: c.final && c.text.trim() ? [...s.transcript, c] : s.transcript }))
}

function startRingtone() {
  stopRingtone()
  const beep = () => {
    try {
      const a = ctx()
      for (const [f, delay] of [
        [660, 0],
        [880, 0.18],
      ] as const) {
        const o = a.createOscillator()
        const g = a.createGain()
        o.frequency.value = f
        g.gain.setValueAtTime(0.0001, a.currentTime + delay)
        g.gain.exponentialRampToValueAtTime(0.08, a.currentTime + delay + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + delay + 0.16)
        o.connect(g).connect(a.destination)
        o.start(a.currentTime + delay)
        o.stop(a.currentTime + delay + 0.18)
      }
    } catch {
      /* audio blocked until the user interacts */
    }
  }
  beep()
  ringTimer = window.setInterval(beep, 1600)
}
function stopRingtone() {
  window.clearInterval(ringTimer)
}

async function enumerate() {
  try {
    const all = await navigator.mediaDevices.enumerateDevices()
    useCall.setState((s) => ({ devices: { ...s.devices, mics: all.filter((d) => d.kind === 'audioinput' && d.deviceId), cams: all.filter((d) => d.kind === 'videoinput' && d.deviceId) } }))
  } catch {
    /* no device access */
  }
}

function stopLocalMedia() {
  const s = useCall.getState()
  s.local?.getTracks().forEach((t) => t.stop())
  cameraTrack?.stop()
  cameraTrack = null
  screenStream?.getTracks().forEach((t) => t.stop())
  screenStream = null
  syntheticCleanup?.()
  syntheticCleanup = null
}

/** The stream shown on your own tile: screen share, camera, or a generated avatar. */
export function localPreview(): MediaStream | null {
  const s = useCall.getState()
  const v = currentVideoTrack()
  if (!s.local) return null
  return v ? new MediaStream([v]) : null
}

/** Publishes or unpublishes our video so LiveKit matches the camera/share toggles. */
async function syncVideo() {
  if (!room || room.state !== ConnectionState.Connected) return
  const s = useCall.getState()
  const lp = room.localParticipant
  const wantCam = s.camOn && cameraTrack && cameraTrack.readyState === 'live' ? cameraTrack : null
  if (pubs.camera && pubs.camera.track?.mediaStreamTrack !== wantCam) {
    await lp.unpublishTrack(pubs.camera.track!, false)
    pubs.camera = undefined
  }
  if (wantCam && !pubs.camera) pubs.camera = await lp.publishTrack(wantCam, { source: Track.Source.Camera, simulcast: true })
  const wantScreen = s.sharing && screenStream ? screenStream.getVideoTracks()[0] : null
  if (pubs.screen && pubs.screen.track?.mediaStreamTrack !== wantScreen) {
    await lp.unpublishTrack(pubs.screen.track!, false)
    pubs.screen = undefined
  }
  if (wantScreen && !pubs.screen) pubs.screen = await lp.publishTrack(wantScreen, { source: Track.Source.ScreenShare })
}

function bindRoom(r: Room) {
  r.on(RoomEvent.ParticipantConnected, (p) => {
    refreshPeer(p)
    // Tell the newcomer our hand state.
    sendData({ t: 'state', state: { hand: useCall.getState().hand } }, [p.identity])
  })
    .on(RoomEvent.ParticipantDisconnected, (p) => dropPeer(p.identity))
    .on(RoomEvent.TrackSubscribed, (_t, _pub, p) => refreshPeer(p))
    .on(RoomEvent.TrackUnsubscribed, (_t, _pub, p) => refreshPeer(p))
    .on(RoomEvent.TrackMuted, (_pub, p) => refreshPeer(p))
    .on(RoomEvent.TrackUnmuted, (_pub, p) => refreshPeer(p))
    .on(RoomEvent.TrackPublished, (_pub, p) => refreshPeer(p))
    .on(RoomEvent.TrackUnpublished, (_pub, p) => refreshPeer(p))
    .on(RoomEvent.DataReceived, onData)
    .on(RoomEvent.Reconnecting, () => useCall.setState({ error: 'Connection lost — reconnecting…' }))
    .on(RoomEvent.Reconnected, () => useCall.setState({ error: null }))
    .on(RoomEvent.Disconnected, () => {
      if (room === r && useCall.getState().phase === 'in-call') useCall.getState().leave()
    })
}

/* ---------------- ringing over the Meetspace realtime socket ---------------- */

onRealtime((e) => {
  if (e.collection !== 'calls') return
  const s = useCall.getState()
  if (e.op === 'ring') {
    const c = e.payload.call as CallLog
    if (s.phase !== 'idle' || e.payload.from === me()) return
    useCall.setState({ incoming: { callId: c.callId, title: c.title, kind: c.kind, channelId: c.channelId, from: e.payload.from } })
    startRingtone()
    window.setTimeout(() => {
      if (useCall.getState().incoming?.callId === c.callId) useCall.getState().declineIncoming()
    }, 30000)
  } else if (e.op === 'decline') {
    const log = useStore.getState().callLogs.find((c) => c.id === e.payload.callId)
    if (log && log.callId === s.call?.callId) useCall.setState((st) => ({ chat: [...st.chat, { userId: e.payload.userId, text: '— declined the call', at: Date.now() }] }))
  }
})

/** Running calls (from the server's call log) so the UI can offer “Join”. */
function ongoingFromLogs(logs: CallLog[]): Record<string, OngoingCall> {
  const out: Record<string, OngoingCall> = {}
  for (const c of logs) {
    const live = (c as CallLog & { liveParticipants?: ID[] }).liveParticipants ?? []
    if (c.endedAt || !live.length) continue
    out[c.callId] = { callId: c.callId, title: c.title, kind: c.kind, channelId: c.channelId, peers: Object.fromEntries(live.map((u) => [u, u])), seen: Date.now() }
  }
  return out
}

/* ---------------- recording (composited grid + mixed audio → Clip) ---------------- */

function startRecorder(): boolean {
  const mime = pickMime(true)
  if (!mime) return false
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  const g = canvas.getContext('2d')!
  const a = ctx()
  const dest = a.createMediaStreamDestination()
  const sources: MediaStreamAudioSourceNode[] = []
  const videos = new Map<string, HTMLVideoElement>()

  const mixAll = () => {
    sources.forEach((src) => src.disconnect())
    sources.length = 0
    const s = useCall.getState()
    for (const st of [s.local, ...Object.values(s.peers).map((p) => p.stream)]) {
      if (st?.getAudioTracks().length) {
        const src = a.createMediaStreamSource(new MediaStream(st.getAudioTracks()))
        src.connect(dest)
        sources.push(src)
      }
    }
  }
  mixAll()
  const unsub = useCall.subscribe((s, prev) => {
    if (s.peers !== prev.peers || s.local !== prev.local) mixAll()
  })

  const videoFor = (key: string, stream: MediaStream | null) => {
    if (!stream || !stream.getVideoTracks().length) return null
    let v = videos.get(key)
    if (!v) {
      v = document.createElement('video')
      v.muted = true
      v.playsInline = true
      videos.set(key, v)
    }
    if (v.srcObject !== stream) {
      v.srcObject = stream
      void v.play().catch(() => {})
    }
    return v
  }

  const draw = () => {
    const s = useCall.getState()
    const tiles = [{ key: 'local', userId: s.tabUserId, stream: localPreview() }, ...Object.values(s.peers).map((p) => ({ key: p.peerId, userId: p.userId, stream: p.stream }))]
    const presenter = s.sharing ? tiles[0] : tiles.find((t) => s.peers[t.key]?.sharing)
    g.fillStyle = '#111114'
    g.fillRect(0, 0, 1280, 720)
    const layout = presenter ? [presenter] : tiles
    const cols = Math.ceil(Math.sqrt(layout.length))
    const rows = Math.ceil(layout.length / cols)
    const w = 1280 / cols
    const h = 720 / rows
    layout.forEach((t, i) => {
      const x = (i % cols) * w
      const y = Math.floor(i / cols) * h
      const v = videoFor(t.key, t.stream)
      if (v && v.readyState >= 2) {
        const scale = Math.min((w - 8) / v.videoWidth, (h - 8) / v.videoHeight)
        const dw = v.videoWidth * scale
        const dh = v.videoHeight * scale
        g.drawImage(v, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
      } else {
        const user = useStore.getState().users.find((u) => u.id === t.userId)
        g.fillStyle = user?.color ?? '#0b7f71'
        g.beginPath()
        g.arc(x + w / 2, y + h / 2, Math.min(w, h) / 6, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#fff'
        g.font = `bold ${Math.min(w, h) / 8}px Inter, sans-serif`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(initials(user?.name ?? '?'), x + w / 2, y + h / 2)
      }
      g.fillStyle = 'rgba(0,0,0,.55)'
      g.fillRect(x + 8, y + h - 34, 180, 26)
      g.fillStyle = '#fff'
      g.font = '14px Inter, sans-serif'
      g.textAlign = 'left'
      g.fillText(userName(t.userId), x + 16, y + h - 21)
    })
  }
  const timer = window.setInterval(draw, 1000 / 24)

  const stream = new MediaStream([...canvas.captureStream(24).getVideoTracks(), ...dest.stream.getAudioTracks()])
  const chunks: Blob[] = []
  recorder = new MediaRecorder(stream, { mimeType: mime })
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const started = Date.now()
  const call = useCall.getState().call
  recorder.onstop = async () => {
    const blob = new Blob(chunks, { type: mime })
    const transcript = useCall.getState().transcript.map((c) => `${userName(c.userId)}: ${c.text}`).join('\n')
    try {
      const clip = await uploadClip({ title: `Recording — ${call?.title ?? 'Call'}`, kind: 'call', durationSec: Math.round((Date.now() - started) / 1000), mime, taskId: null, transcript }, blob)
      const store = useStore.getState()
      const log = logFor(call?.callId)
      if (log) store.updateCallLog(log.id, { recordingClipId: clip.id })
      if (call?.channelId) store.postMessage({ channelId: call.channelId, text: `Recorded “${call.title}”`, clipId: clip.id })
    } catch (e) {
      useStore.getState().toast(`Couldn’t upload the call recording: ${(e as Error).message}`, 'error')
    }
  }
  recorder.start(1000)
  recordCleanup = () => {
    window.clearInterval(timer)
    unsub()
    sources.forEach((src) => src.disconnect())
    videos.forEach((v) => (v.srcObject = null))
  }
  return true
}

function stopRecorder() {
  if (recorder && recorder.state !== 'inactive') recorder.stop()
  recorder = null
  recordCleanup?.()
  recordCleanup = null
}

/* ---------------- live captions (browser speech recognition, where available) ---------------- */

type SpeechCtor = new () => NonNullable<typeof recognition>
export function captionsSupported() {
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor }
  return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition)
}

function startCaptions() {
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  if (!Ctor) return false
  const r = new Ctor()
  r.continuous = true
  r.interimResults = true
  r.lang = navigator.language || 'en-US'
  r.onresult = (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => {
    const s = useCall.getState()
    if (!s.micOn || !s.call) return
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i]
      addCaption({ userId: s.tabUserId, text: res[0].transcript, final: res.isFinal, at: Date.now() })
      sendData({ t: 'caption', text: res[0].transcript, final: res.isFinal })
    }
  }
  r.onend = () => {
    if (useCall.getState().captionsOn && useCall.getState().phase === 'in-call') r.start()
  }
  recognition = r
  r.start()
  return true
}

/* ---------------- store ---------------- */

export const useCall = create<CallState>()((set, get) => ({
  tabUserId: me(),
  phase: 'idle',
  call: null,
  startedAt: 0,
  local: null,
  synthetic: false,
  micOn: true,
  camOn: true,
  sharing: false,
  hand: false,
  peers: {},
  speaking: {},
  reactions: [],
  chat: [],
  captionsOn: false,
  captions: {},
  transcript: [],
  recording: false,
  recordStart: 0,
  minimized: false,
  panel: null,
  layout: 'grid',
  incoming: null,
  ongoing: {},
  devices: { mics: [], cams: [], mic: '', cam: '' },
  error: null,
  lastCall: null,

  set: (p) => set(p),

  prepare: async (opts) => {
    if (get().phase === 'in-call' || get().phase === 'connecting') return
    if (!useStore.getState().meetEnabled) {
      useStore.getState().toast('Calls aren’t available: this server has no LiveKit configured.', 'error')
      return
    }
    stopLocalMedia()
    const existing = opts.callId ? logFor(opts.callId) : undefined
    const isNew = opts.isNew ?? !existing
    const call: CallInfo = { ...opts, callId: opts.callId ?? '', isNew: isNew || !existing }
    set({ tabUserId: me(), phase: 'lobby', call, micOn: true, camOn: opts.kind === 'video', sharing: false, hand: false, error: null, minimized: false })
    const { stream, synthetic } = await acquire(opts.kind, get().devices.mic, get().devices.cam)
    if (get().phase !== 'lobby') return stream.getTracks().forEach((t) => t.stop())
    if (opts.kind === 'video' && !cameraTrack) cameraTrack = syntheticVideo(me())
    set({ local: stream, synthetic })
    watchLevel('local', stream)
    startLevelLoop()
    void enumerate()
  },

  cancelLobby: () => {
    stopLocalMedia()
    watchLevel('local', null)
    window.clearInterval(levelTimer)
    set({ phase: 'idle', call: null, local: null })
  },

  join: async () => {
    const s = get()
    if (!s.call || !s.local) return
    set({ phase: 'connecting', error: null })
    let info: JoinInfo
    try {
      const existing = s.call.isNew ? undefined : logFor(s.call.callId)
      info = existing
        ? await api.post<JoinInfo>(wsPath(`/calls/${existing.id}/join`))
        : await api.post<JoinInfo>(wsPath('/calls'), { title: s.call.title, kind: s.call.kind, channelId: s.call.channelId, meetingId: s.call.meetingId, invitees: s.call.invitees })
    } catch (e) {
      return set({ phase: 'lobby', error: e instanceof ApiError ? e.message : 'Couldn’t start the call.' })
    }
    useStore.setState((st) => ({ callLogs: st.callLogs.some((c) => c.id === info.call.id) ? st.callLogs : [...st.callLogs, info.call] }))
    const r = new Room({ adaptiveStream: true, dynacast: true })
    bindRoom(r)
    room = r
    try {
      await r.connect(info.url, info.token)
    } catch {
      room = null
      return set({ phase: 'lobby', error: 'Couldn’t reach the meeting server. Check that LiveKit is running.' })
    }
    set({ phase: 'in-call', call: { ...s.call, callId: info.call.callId, isNew: false }, startedAt: Date.now(), peers: {}, chat: [], transcript: [], captions: {}, reactions: [] })
    const audio = get().local?.getAudioTracks()[0]
    if (audio) {
      pubs.audio = await r.localParticipant.publishTrack(audio, { source: Track.Source.Microphone })
      if (!get().micOn) await pubs.audio.mute()
    }
    await syncVideo()
    for (const p of r.remoteParticipants.values()) refreshPeer(p)
  },

  leave: () => {
    const s = get()
    if (!s.call) return
    if (s.recording) get().toggleRecording()
    recognition?.stop()
    recognition = null
    const r = room
    room = null
    pubs.audio = pubs.camera = pubs.screen = undefined
    void r?.disconnect()
    for (const id of Object.keys(s.peers)) dropPeer(id)
    stopLocalMedia()
    for (const k of [...analysers.keys()]) watchLevel(k, null)
    window.clearInterval(levelTimer)
    set({
      phase: 'idle',
      local: null,
      peers: {},
      speaking: {},
      sharing: false,
      hand: false,
      captionsOn: false,
      recording: false,
      panel: null,
      minimized: false,
      lastCall: { call: s.call, chat: s.chat, transcript: s.transcript, startedAt: s.startedAt, endedAt: Date.now(), participants: [...new Set([s.tabUserId, ...Object.values(s.peers).map((p) => p.userId)])] },
    })
  },

  endForAll: () => {
    const log = logFor(get().call?.callId)
    if (log) void api.post(wsPath(`/calls/${log.id}/end`))
    get().leave()
  },

  ring: (userIds) => {
    const log = logFor(get().call?.callId)
    if (log && userIds.length) void api.post(wsPath(`/calls/${log.id}/ring`), { userIds })
  },

  toggleMic: () => {
    const s = get()
    const micOn = !s.micOn
    s.local?.getAudioTracks().forEach((t) => (t.enabled = micOn))
    set({ micOn })
    if (pubs.audio) void (micOn ? pubs.audio.unmute() : pubs.audio.mute())
  },

  toggleCam: async () => {
    const s = get()
    if (s.camOn) {
      if (cameraTrack && !syntheticCleanup) cameraTrack.stop()
      cameraTrack = null
      set({ camOn: false })
    } else {
      try {
        const st = await navigator.mediaDevices.getUserMedia({ video: s.devices.cam ? { deviceId: { exact: s.devices.cam } } : true })
        cameraTrack = st.getVideoTracks()[0]
      } catch {
        cameraTrack = syntheticVideo(s.tabUserId)
        set({ synthetic: true })
      }
      set({ camOn: true })
    }
    await syncVideo()
    set({ local: s.local ? new MediaStream(s.local.getTracks()) : null })
  },

  toggleShare: async () => {
    const s = get()
    if (s.sharing) {
      screenStream?.getTracks().forEach((t) => t.stop())
      screenStream = null
      set({ sharing: false })
    } else {
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        screenStream.getVideoTracks()[0].onended = () => get().sharing && get().toggleShare()
        set({ sharing: true, layout: 'speaker' })
      } catch {
        return set({ error: 'Screen sharing was cancelled or isn’t available in this browser.' })
      }
    }
    await syncVideo()
    set({ local: s.local ? new MediaStream(s.local.getTracks()) : null })
  },

  toggleHand: () => {
    const hand = !get().hand
    set({ hand })
    sendData({ t: 'state', state: { hand } })
  },

  react: (emoji) => {
    const s = get()
    if (!s.call) return
    pushReaction(emoji, s.tabUserId)
    sendData({ t: 'react', emoji })
  },

  sendChat: (text) => {
    const s = get()
    if (!s.call || !text.trim()) return
    const msg = { userId: s.tabUserId, text: text.trim(), at: Date.now() }
    set({ chat: [...s.chat, msg] })
    sendData({ t: 'chat', text: msg.text, at: msg.at })
  },

  toggleCaptions: () => {
    const s = get()
    if (s.captionsOn) {
      recognition?.stop()
      recognition = null
      return set({ captionsOn: false })
    }
    // Remote captions still arrive when we can't transcribe locally.
    const ok = startCaptions()
    set({ captionsOn: true, error: ok ? null : 'Live captions need a browser with speech recognition (e.g. Chrome). You’ll still see captions from others.' })
  },

  toggleRecording: () => {
    const s = get()
    if (s.recording) {
      stopRecorder()
      return set({ recording: false })
    }
    if (!startRecorder()) return set({ error: 'Recording isn’t supported in this browser.' })
    set({ recording: true, recordStart: Date.now() })
  },

  selectDevice: async (kind, id) => {
    set((s) => ({ devices: { ...s.devices, [kind]: id } }))
    const s = get()
    if (kind === 'mic') {
      try {
        const st = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: id }, echoCancellation: true, noiseSuppression: true } })
        const track = st.getAudioTracks()[0]
        track.enabled = s.micOn
        s.local?.getAudioTracks().forEach((t) => (t.stop(), s.local!.removeTrack(t)))
        s.local?.addTrack(track)
        watchLevel('local', s.local)
        await pubs.audio?.audioTrack?.replaceTrack(track, true)
      } catch {
        return set({ error: 'Couldn’t switch microphone.' })
      }
    } else if (s.camOn) {
      try {
        const st = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: id } } })
        cameraTrack?.stop()
        cameraTrack = st.getVideoTracks()[0]
        await syncVideo()
      } catch {
        return set({ error: 'Couldn’t switch camera.' })
      }
    }
    set({ local: s.local ? new MediaStream(s.local.getTracks()) : null })
  },

  acceptIncoming: () => {
    const inc = get().incoming
    stopRingtone()
    if (!inc) return
    set({ incoming: null })
    void get().prepare({ callId: inc.callId, isNew: false, title: inc.title, kind: inc.kind, channelId: inc.channelId, meetingId: null, invitees: [] })
  },
  declineIncoming: () => {
    const inc = get().incoming
    stopRingtone()
    const log = logFor(inc?.callId)
    if (log) void api.post(wsPath(`/calls/${log.id}/decline`))
    set({ incoming: null })
  },
}))

// Keep “who's in which call” in sync with the server's call log.
useStore.subscribe((s, prev) => {
  if (s.callLogs !== prev.callLogs) useCall.setState({ ongoing: ongoingFromLogs(s.callLogs) })
  if (s.currentUserId !== prev.currentUserId) useCall.setState({ tabUserId: s.currentUserId ?? '' })
})

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => useCall.getState().phase === 'in-call' && useCall.getState().leave())
}

export interface LastCall {
  call: CallInfo
  chat: { userId: ID; text: string; at: number }[]
  transcript: Caption[]
  startedAt: number
  endedAt: number
  participants: ID[]
}
