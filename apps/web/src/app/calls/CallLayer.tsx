import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Captions,
  ChevronDown,
  Circle,
  FileText,
  Hand,
  LayoutGrid,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  Phone,
  PhoneOff,
  Smile,
  Users,
  Video,
  VideoOff,
  X,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { ID } from '../../store/types'
import { Avatar, Popover, usePopover } from '../components/ui'
import { cn } from '../../lib/utils'
import { localPreview, useCall, type PeerView } from './useCall'

const REACTIONS = ['👍', '❤️', '😂', '👏', '🎉', '😮']

export function clockFrom(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`
}

function useTick(active: boolean) {
  const [, setT] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setT((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [active])
}

export function VideoTile({
  stream,
  userId,
  muted,
  micOn,
  showVideo,
  speaking,
  hand,
  label,
  mirror,
  big,
  contain,
}: {
  stream: MediaStream | null
  userId: ID
  muted?: boolean
  micOn: boolean
  showVideo: boolean
  speaking?: boolean
  hand?: boolean
  label?: string
  mirror?: boolean
  big?: boolean
  contain?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const user = useStore((s) => s.users.find((u) => u.id === userId))
  const hasVideo = showVideo && !!stream?.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream
    // Remote audio plays through a separate element so it keeps playing when the video is hidden.
    if (audioRef.current && !muted && audioRef.current.srcObject !== stream) audioRef.current.srcObject = stream
  }, [stream, muted, hasVideo])

  return (
    <div className={cn('relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-xl bg-[#26272d] ring-2 transition-shadow', speaking ? 'ring-emerald-400' : 'ring-transparent')}>
      <video ref={ref} autoPlay playsInline muted className={cn('h-full w-full', contain ? 'object-contain' : 'object-cover', mirror && 'scale-x-[-1]', !hasVideo && 'hidden')} />
      {!muted && <audio ref={audioRef} autoPlay />}
      {!hasVideo && (
        <span className={cn('flex items-center justify-center rounded-full font-bold text-white', speaking && 'animate-pulse')} style={{ background: user?.color ?? '#4f46e5', width: big ? 120 : 72, height: big ? 120 : 72, fontSize: big ? 44 : 26 }}>
          {(user?.name ?? '?')
            .split(' ')
            .map((p) => p[0])
            .join('')
            .slice(0, 2)}
        </span>
      )}
      <span className="absolute bottom-2 left-2 flex max-w-[80%] items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-xs font-medium text-white">
        {!micOn && <MicOff size={12} className="text-red-400" />}
        <span className="truncate">{label ?? user?.name ?? 'Guest'}</span>
      </span>
      {hand && (
        <span className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-amber-400 px-2 py-1 text-xs font-semibold text-slate-900">
          <Hand size={12} /> Hand raised
        </span>
      )}
    </div>
  )
}

/* ---------------- lobby ---------------- */

function MicMeter() {
  const speaking = useCall((s) => s.speaking.local)
  const micOn = useCall((s) => s.micOn)
  return (
    <span className="flex h-4 items-end gap-0.5" aria-label={speaking ? 'Microphone picking up sound' : 'Microphone quiet'}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={cn('w-1 rounded-sm transition-all', micOn && speaking ? 'bg-emerald-400' : 'bg-white/25')} style={{ height: micOn && speaking ? `${40 + ((i * 37) % 60)}%` : '30%' }} />
      ))}
    </span>
  )
}

function Lobby() {
  const c = useCall()
  const users = useStore((s) => s.users)
  const [preview, setPreview] = useState<MediaStream | null>(null)
  useEffect(() => setPreview(localPreview()), [c.local, c.camOn])
  if (!c.call) return null
  const joiningExisting = !c.call.isNew
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-[#18181d] text-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
          {c.call.kind === 'video' ? <Video size={18} /> : <Phone size={18} />}
          <div className="min-w-0">
            <div className="truncate font-semibold">{c.call.title}</div>
            <div className="text-xs text-white/60">{joiningExisting ? 'Join the call' : `Start a ${c.call.kind} call`}</div>
          </div>
          <button onClick={c.cancelLobby} className="ml-auto rounded-md p-1.5 hover:bg-white/10" aria-label="Cancel">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-5 p-5 md:grid-cols-[1.4fr_1fr]">
          <div className="aspect-video">
            <VideoTile stream={preview} userId={c.tabUserId} muted micOn={c.micOn} showVideo={c.camOn} mirror={!c.synthetic} big label="You" speaking={c.speaking.local} />
          </div>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Avatar userId={c.tabUserId} size={22} />
              <span className="text-xs text-white/60">Joining as {users.find((u) => u.id === c.tabUserId)?.name}</span>
            </div>
            {c.error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-200">{c.error}</p>}
            <label className="block">
              <span className="flex items-center justify-between text-xs text-white/60">
                Microphone <MicMeter />
              </span>
              <select value={c.devices.mic} onChange={(e) => void c.selectDevice('mic', e.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5">
                <option value="" className="text-black">
                  Default microphone
                </option>
                {c.devices.mics.map((d) => (
                  <option key={d.deviceId} value={d.deviceId} className="text-black">
                    {d.label || 'Microphone'}
                  </option>
                ))}
              </select>
            </label>
            {c.call.kind === 'video' && (
              <label className="block">
                <span className="text-xs text-white/60">Camera</span>
                <select value={c.devices.cam} onChange={(e) => void c.selectDevice('cam', e.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5">
                  <option value="" className="text-black">
                    Default camera
                  </option>
                  {c.devices.cams.map((d) => (
                    <option key={d.deviceId} value={d.deviceId} className="text-black">
                      {d.label || 'Camera'}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {c.synthetic && <p className="rounded-lg bg-amber-400/15 px-3 py-2 text-xs text-amber-200">No camera or microphone access — you’ll join with an avatar and silent audio. Check your browser’s site permissions to use real devices.</p>}
            <div className="mt-auto flex items-center gap-2">
              <button onClick={c.toggleMic} className={cn('rounded-full p-3', c.micOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500')} aria-label={c.micOn ? 'Mute' : 'Unmute'}>
                {c.micOn ? <Mic size={18} /> : <MicOff size={18} />}
              </button>
              {c.call.kind === 'video' && (
                <button onClick={() => void c.toggleCam()} className={cn('rounded-full p-3', c.camOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500')} aria-label={c.camOn ? 'Turn camera off' : 'Turn camera on'}>
                  {c.camOn ? <Video size={18} /> : <VideoOff size={18} />}
                </button>
              )}
              <button onClick={() => void c.join()} disabled={!c.local || c.phase === 'connecting'} className="ml-auto rounded-full bg-emerald-500 px-6 py-3 font-semibold hover:bg-emerald-600 disabled:opacity-50">
                {c.phase === 'connecting' ? 'Connecting…' : joiningExisting ? 'Join now' : 'Start call'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ---------------- in-call stage ---------------- */

function ControlButton({ on, danger, onClick, label, children, active }: { on?: boolean; danger?: boolean; onClick: (e: React.MouseEvent<HTMLElement>) => void; label: string; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn('flex flex-col items-center gap-1 rounded-xl px-2.5 py-1.5 text-[10px] font-medium sm:px-3', danger ? 'bg-red-500 hover:bg-red-600' : active ? 'bg-indigo-500 hover:bg-indigo-600' : on === false ? 'bg-red-500/90 hover:bg-red-500' : 'hover:bg-white/10')}
    >
      {children}
      <span className="hidden sm:block">{label}</span>
    </button>
  )
}

function Stage() {
  const c = useCall()
  const users = useStore((s) => s.users)
  const isHost = useStore((s) => s.callLogs.find((l) => l.callId === c.call?.callId)?.startedBy === s.currentUserId)
  const reactPop = usePopover()
  const [chatText, setChatText] = useState('')
  const [preview, setPreview] = useState<MediaStream | null>(null)
  useEffect(() => setPreview(localPreview()), [c.local, c.camOn, c.sharing])
  useTick(true)
  const chatEnd = useRef<HTMLDivElement>(null)
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: 'end' })
  }, [c.chat.length, c.panel])

  const peers = Object.values(c.peers)
  const tiles = useMemo(
    () => [
      { key: 'local', userId: c.tabUserId, stream: preview, micOn: c.micOn, camOn: c.camOn || c.sharing, sharing: c.sharing, hand: c.hand, local: true },
      ...peers.map((p: PeerView) => ({ key: p.peerId, userId: p.userId, stream: p.stream, micOn: p.micOn, camOn: p.camOn || p.sharing, sharing: p.sharing, hand: p.hand, local: false })),
    ],
    [c.tabUserId, preview, c.micOn, c.camOn, c.sharing, c.hand, peers],
  )
  const presenter = tiles.find((t) => t.sharing)
  const speakerKey = Object.entries(c.speaking).find(([, v]) => v)?.[0]
  const focus = presenter ?? (c.layout === 'speaker' ? tiles.find((t) => t.key === speakerKey && !t.local) ?? tiles.find((t) => !t.local) ?? tiles[0] : null)
  const elapsed = Date.now() - c.startedAt
  const captionsShown = Object.values(c.captions).filter((x) => Date.now() - x.at < 6000)
  const channelName = useStore((s) => s.channels.find((ch) => ch.id === c.call?.channelId)?.name)
  const raised = tiles.filter((t) => t.hand)

  if (!c.call) return null

  if (c.minimized)
    return createPortal(
      <div className="fixed right-4 bottom-4 z-[60] w-72 overflow-hidden rounded-xl bg-[#18181d] text-white shadow-2xl ring-1 ring-white/10">
        <div className="aspect-video">
          {(() => {
            const t = focus ?? tiles.find((x) => !x.local) ?? tiles[0]
            return <VideoTile stream={t.stream} userId={t.userId} muted={t.local} micOn={t.micOn} showVideo={t.camOn} speaking={c.speaking[t.key]} contain={t.sharing} />
          })()}
          {/* Keep remote audio playing while minimised */}
          {tiles
            .filter((t) => !t.local && t.key !== (focus ?? tiles.find((x) => !x.local))?.key)
            .map((t) => (
              <HiddenAudio key={t.key} stream={t.stream} />
            ))}
        </div>
        <div className="flex items-center gap-1 p-2">
          <span className="min-w-0 flex-1 truncate text-xs">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />
            {c.call.title} · {clockFrom(elapsed)}
          </span>
          <button onClick={c.toggleMic} className={cn('rounded-md p-1.5', !c.micOn && 'bg-red-500')} aria-label="Toggle mic">
            {c.micOn ? <Mic size={14} /> : <MicOff size={14} />}
          </button>
          <button onClick={() => c.set({ minimized: false })} className="rounded-md p-1.5 hover:bg-white/10" aria-label="Expand call">
            <Maximize2 size={14} />
          </button>
          <button onClick={c.leave} className="rounded-md bg-red-500 p-1.5" aria-label="Leave call">
            <PhoneOff size={14} />
          </button>
        </div>
      </div>,
      document.body,
    )

  const cols = tiles.length <= 1 ? 1 : tiles.length <= 4 ? 2 : 3

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#111114] text-white">
      <header className="flex h-12 shrink-0 items-center gap-3 px-4">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="truncate font-semibold">{c.call.title}</span>
        <span className="text-sm text-white/60 tabular-nums">{clockFrom(elapsed)}</span>
        {c.recording && (
          <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">
            <Circle size={8} fill="currentColor" className="animate-pulse" /> REC {clockFrom(Date.now() - c.recordStart)}
          </span>
        )}
        {raised.length > 0 && (
          <span className="hidden items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs text-amber-200 sm:flex">
            <Hand size={12} /> {raised.map((r) => users.find((u) => u.id === r.userId)?.name.split(' ')[0]).join(', ')}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => c.set({ layout: c.layout === 'grid' ? 'speaker' : 'grid' })} className="rounded-md p-1.5 hover:bg-white/10" title={c.layout === 'grid' ? 'Speaker view' : 'Grid view'}>
            {c.layout === 'grid' ? <Maximize2 size={16} /> : <LayoutGrid size={16} />}
          </button>
          <button onClick={() => c.set({ minimized: true })} className="rounded-md p-1.5 hover:bg-white/10" title="Minimise — keep working while you talk">
            <Minimize2 size={16} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col gap-2 p-2 sm:p-4">
          {focus ? (
            <>
              <div className="min-h-0 flex-1">
                <VideoTile stream={focus.stream} userId={focus.userId} muted={focus.local} micOn={focus.micOn} showVideo={focus.camOn} speaking={c.speaking[focus.key]} hand={focus.hand} big contain={focus.sharing} mirror={focus.local && !focus.sharing && !c.synthetic} label={focus.sharing ? `${users.find((u) => u.id === focus.userId)?.name ?? ''} is presenting` : undefined} />
              </div>
              <div className="flex h-28 shrink-0 gap-2 overflow-x-auto">
                {tiles
                  .filter((t) => t.key !== focus.key)
                  .map((t) => (
                    <div key={t.key} className="aspect-video h-full shrink-0">
                      <VideoTile stream={t.stream} userId={t.userId} muted={t.local} micOn={t.micOn} showVideo={t.camOn} speaking={c.speaking[t.key]} hand={t.hand} mirror={t.local && !t.sharing && !c.synthetic} label={t.local ? 'You' : undefined} />
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <div className="grid min-h-0 flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: '1fr' }}>
              {tiles.map((t) => (
                <VideoTile key={t.key} stream={t.stream} userId={t.userId} muted={t.local} micOn={t.micOn} showVideo={t.camOn} speaking={c.speaking[t.key]} hand={t.hand} mirror={t.local && !t.sharing && !c.synthetic} label={t.local ? 'You' : undefined} big={tiles.length <= 2} />
              ))}
            </div>
          )}
          {peers.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
              <span className="rounded-full bg-black/60 px-4 py-1.5 text-sm text-white/80">Waiting for others to join{channelName ? ` from #${channelName}` : ''}…</span>
            </div>
          )}
          {/* floating reactions */}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center gap-6">
            {c.reactions.map((r) => (
              <span key={r.id} className="animate-[float-up_3s_ease-out_forwards] text-4xl" title={users.find((u) => u.id === r.userId)?.name}>
                {r.emoji}
              </span>
            ))}
          </div>
          {c.captionsOn && captionsShown.length > 0 && (
            <div className="pointer-events-none absolute inset-x-4 bottom-6 flex flex-col items-center gap-1">
              {captionsShown.map((cap) => (
                <span key={cap.userId} className="max-w-3xl rounded-lg bg-black/75 px-3 py-1.5 text-center text-sm">
                  <b className="text-white/70">{users.find((u) => u.id === cap.userId)?.name.split(' ')[0]}:</b> {cap.text}
                </span>
              ))}
            </div>
          )}
        </div>

        {c.panel && (
          <aside className="fixed inset-0 z-10 flex flex-col bg-[#18181d] sm:static sm:w-80 sm:border-l sm:border-white/10">
            <div className="flex h-11 items-center border-b border-white/10 px-3 text-sm font-semibold">
              {c.panel === 'people' ? `People (${tiles.length})` : 'Meeting chat'}
              <button onClick={() => c.set({ panel: null })} className="ml-auto rounded p-1 hover:bg-white/10" aria-label="Close panel">
                <X size={16} />
              </button>
            </div>
            {c.panel === 'people' ? (
              <PeoplePanel />
            ) : (
              <>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm">
                  {c.chat.length === 0 && <p className="text-white/50">Messages here are visible to everyone in the call and saved to the meeting notes.</p>}
                  {c.chat.map((m, i) => (
                    <div key={i}>
                      <div className="text-xs text-white/50">
                        {users.find((u) => u.id === m.userId)?.name} · {format(m.at, 'h:mm a')}
                      </div>
                      <div className="break-words">{m.text}</div>
                    </div>
                  ))}
                  <div ref={chatEnd} />
                </div>
                <form
                  className="border-t border-white/10 p-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    c.sendChat(chatText)
                    setChatText('')
                  }}
                >
                  <input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Message everyone" className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none" />
                </form>
              </>
            )}
          </aside>
        )}
      </div>

      {c.error && (
        <div className="mx-auto mb-2 flex items-center gap-2 rounded-lg bg-amber-400/15 px-3 py-1.5 text-xs text-amber-200">
          {c.error}
          <button onClick={() => c.set({ error: null })} aria-label="Dismiss">
            <X size={12} />
          </button>
        </div>
      )}

      <footer className="flex shrink-0 items-center justify-center gap-0.5 overflow-x-auto px-2 pb-3 sm:gap-1">
        <ControlButton on={c.micOn} onClick={c.toggleMic} label={c.micOn ? 'Mute' : 'Unmute'}>
          {c.micOn ? <Mic size={19} /> : <MicOff size={19} />}
        </ControlButton>
        <ControlButton on={c.camOn} onClick={() => void c.toggleCam()} label={c.camOn ? 'Camera' : 'Camera off'}>
          {c.camOn ? <Video size={19} /> : <VideoOff size={19} />}
        </ControlButton>
        <ControlButton active={c.sharing} onClick={() => void c.toggleShare()} label={c.sharing ? 'Stop sharing' : 'Share'}>
          <MonitorUp size={19} />
        </ControlButton>
        <ControlButton active={c.hand} onClick={c.toggleHand} label={c.hand ? 'Lower hand' : 'Raise'}>
          <Hand size={19} />
        </ControlButton>
        <ControlButton onClick={reactPop.toggle} label="React">
          <Smile size={19} />
        </ControlButton>
        <Popover open={reactPop.open} anchor={reactPop.anchor} onClose={reactPop.close} width={250}>
          <div className="flex justify-between p-1">
            {REACTIONS.map((e) => (
              <button key={e} onClick={() => (c.react(e), reactPop.close())} className="hover-surface rounded-lg p-1.5 text-2xl">
                {e}
              </button>
            ))}
          </div>
        </Popover>
        <ControlButton active={c.captionsOn} onClick={c.toggleCaptions} label="Captions">
          <Captions size={19} />
        </ControlButton>
        <ControlButton active={c.recording} onClick={c.toggleRecording} label={c.recording ? 'Stop rec' : 'Record'}>
          <Circle size={19} className={c.recording ? 'fill-red-400 text-red-400' : ''} />
        </ControlButton>
        <ControlButton active={c.panel === 'people'} onClick={() => c.set({ panel: c.panel === 'people' ? null : 'people' })} label="People">
          <Users size={19} />
        </ControlButton>
        <ControlButton active={c.panel === 'chat'} onClick={() => c.set({ panel: c.panel === 'chat' ? null : 'chat' })} label="Chat">
          <MessageSquare size={19} />
        </ControlButton>
        <span className="mx-1 h-8 border-l border-white/15" />
        <ControlButton danger onClick={c.leave} label="Leave">
          <PhoneOff size={19} />
        </ControlButton>
        {isHost && (
          <ControlButton danger onClick={() => confirm('End this call for everyone?') && c.endForAll()} label="End for all">
            <PhoneOff size={19} />
          </ControlButton>
        )}
      </footer>
    </div>,
    document.body,
  )
}

function HiddenAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream
  }, [stream])
  return <audio ref={ref} autoPlay />
}

function PeoplePanel() {
  const c = useCall()
  const { users, channels } = useStore()
  const inCall = new Set([c.tabUserId, ...Object.values(c.peers).map((p) => p.userId)])
  const channel = channels.find((ch) => ch.id === c.call?.channelId)
  const invitable = users.filter((u) => !inCall.has(u.id) && (!channel || channel.members.includes(u.id)))
  const [rung, setRung] = useState<Record<string, boolean>>({})
  const row = (userId: ID, micOn: boolean, camOn: boolean, hand: boolean, you = false) => (
    <div key={userId + String(you)} className="flex items-center gap-2 px-3 py-2 text-sm">
      <Avatar userId={userId} size={28} />
      <span className="min-w-0 flex-1 truncate">
        {users.find((u) => u.id === userId)?.name}
        {you && <span className="text-white/50"> (you)</span>}
      </span>
      {hand && <Hand size={14} className="text-amber-300" />}
      {camOn ? <Video size={14} className="text-white/60" /> : <VideoOff size={14} className="text-white/40" />}
      {micOn ? <Mic size={14} className="text-white/60" /> : <MicOff size={14} className="text-red-400" />}
    </div>
  )
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-white/50 uppercase">In this call</div>
      {row(c.tabUserId, c.micOn, c.camOn, c.hand, true)}
      {Object.values(c.peers).map((p) => row(p.userId, p.micOn, p.camOn, p.hand))}
      {invitable.length > 0 && (
        <>
          <div className="px-3 pt-4 pb-1 text-[11px] font-semibold text-white/50 uppercase">Invite</div>
          {invitable.map((u) => (
            <div key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <Avatar userId={u.id} size={28} />
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              <button
                disabled={rung[u.id]}
                onClick={() => {
                  ringUser(u.id)
                  setRung((r) => ({ ...r, [u.id]: true }))
                }}
                className="rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20 disabled:opacity-50"
              >
                {rung[u.id] ? 'Ringing…' : 'Ring'}
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function ringUser(userId: ID) {
  useCall.getState().ring([userId])
}

/* ---------------- incoming call + post-call ---------------- */

function Incoming() {
  const inc = useCall((s) => s.incoming)
  const { acceptIncoming, declineIncoming } = useCall()
  const user = useStore((s) => s.users.find((u) => u.id === inc?.from))
  if (!inc) return null
  return createPortal(
    <div className="fixed top-4 right-4 z-[80] w-80 rounded-2xl bg-[#18181d] p-4 text-white shadow-2xl ring-1 ring-white/10" role="alertdialog" aria-label="Incoming call">
      <div className="flex items-center gap-3">
        <span className="relative">
          <Avatar userId={inc.from} size={44} />
          <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-emerald-400" />
        </span>
        <div className="min-w-0">
          <div className="truncate font-semibold">{user?.name ?? 'Someone'}</div>
          <div className="truncate text-sm text-white/60">
            Incoming {inc.kind} call · {inc.title}
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={declineIncoming} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2 text-sm font-semibold hover:bg-red-600">
          <PhoneOff size={16} /> Decline
        </button>
        <button onClick={acceptIncoming} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2 text-sm font-semibold hover:bg-emerald-600">
          {inc.kind === 'video' ? <Video size={16} /> : <Phone size={16} />} Accept
        </button>
      </div>
    </div>,
    document.body,
  )
}

function PostCall() {
  const last = useCall((s) => s.lastCall)
  const setCall = useCall((s) => s.set)
  const nav = useNavigate()
  const [open, setOpen] = useState(true)
  useEffect(() => setOpen(true), [last])
  if (!last || !open || last.endedAt - last.startedAt < 1000) return null
  const saveNotes = () => {
    const s = useStore.getState()
    const name = (id: ID) => s.users.find((u) => u.id === id)?.name ?? id
    const meeting = last.call.meetingId ? s.meetings.find((m) => m.id === last.call.meetingId) : undefined
    const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    const html = [
      `<h1>${esc(last.call.title)}</h1>`,
      `<p><strong>Date:</strong> ${format(last.startedAt, 'PPpp')} · <strong>Duration:</strong> ${clockFrom(last.endedAt - last.startedAt)}</p>`,
      `<p><strong>Attendees:</strong> ${last.participants.map((p) => esc(name(p))).join(', ')}</p>`,
      meeting?.agenda ? `<h2>Agenda</h2><ul>${meeting.agenda.split('\n').filter(Boolean).map((a) => `<li><p>${esc(a)}</p></li>`).join('')}</ul>` : '',
      '<h2>Notes</h2><p></p>',
      '<h2>Action items</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>',
      last.chat.length ? `<h2>Meeting chat</h2><ul>${last.chat.map((m) => `<li><p><strong>${esc(name(m.userId))}:</strong> ${esc(m.text)}</p></li>`).join('')}</ul>` : '',
      last.transcript.length ? `<h2>Transcript</h2>${last.transcript.map((t) => `<p><strong>${esc(name(t.userId))}:</strong> ${esc(t.text)}</p>`).join('')}` : '',
    ].join('')
    const docId = s.addDoc(null)
    s.updateDoc(docId, { title: `Notes — ${last.call.title}`, content: html, emoji: '🎙️' })
    const log = s.callLogs.find((c) => c.callId === last.call.callId)
    if (log) s.updateCallLog(log.id, { notesDocId: docId })
    if (meeting) s.updateMeeting(meeting.id, { notesDocId: docId })
    setCall({ lastCall: null })
    nav(`/app/docs/${docId}`)
  }
  return createPortal(
    <div className="surface text-app shadow-pop fixed bottom-4 left-1/2 z-[55] flex w-[min(520px,92vw)] -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-3 text-sm">
      <PhoneOff size={18} className="text-red-500" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">Call ended · {clockFrom(last.endedAt - last.startedAt)}</div>
        <div className="text-muted truncate text-xs">{last.call.title}</div>
      </div>
      <button onClick={saveNotes} className="bg-brand-600 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white">
        <FileText size={14} /> Save meeting notes
      </button>
      <button onClick={() => (setOpen(false), setCall({ lastCall: null }))} className="hover-surface text-muted rounded p-1" aria-label="Dismiss">
        <X size={15} />
      </button>
    </div>,
    document.body,
  )
}

/** Mounted once in the app shell: everything call-related that floats above the page. */
export default function CallLayer() {
  const phase = useCall((s) => s.phase)
  return (
    <>
      {(phase === 'lobby' || phase === 'connecting') && <Lobby />}
      {phase === 'in-call' && <Stage />}
      <Incoming />
      {phase === 'idle' && <PostCall />}
    </>
  )
}

/** Small control for the top bar while a call is minimised. */
export function CallPill() {
  const c = useCall()
  useTick(c.phase === 'in-call')
  if (c.phase !== 'in-call' || !c.minimized) return null
  return (
    <button onClick={() => c.set({ minimized: false })} className="flex h-8 shrink-0 items-center gap-2 rounded-lg bg-emerald-500 px-2.5 text-sm font-medium text-white">
      <Phone size={14} /> <span className="font-mono tabular-nums">{clockFrom(Date.now() - c.startedAt)}</span>
      <ChevronDown size={14} />
    </button>
  )
}
