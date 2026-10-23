import { useState } from 'react'
import { Link } from 'react-router-dom'
import { addMinutes, differenceInMinutes, format, isToday, isTomorrow, parseISO } from 'date-fns'
import { CalendarPlus, FileText, Film, Hash, Phone, PhoneCall, Users, Video } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { CallLog, Meeting } from '../../store/types'
import { AvatarStack } from '../components/ui'
import { useCall } from '../calls/useCall'
import MeetingDialog from '../calls/MeetingDialog'
import ClipPlayer from '../clips/ClipPlayer'
import { clockFrom } from '../calls/CallLayer'
import { cn, timeAgo } from '../../lib/utils'

function whenLabel(iso: string) {
  const d = parseISO(iso)
  return `${isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEE, MMM d')} · ${format(d, 'h:mm a')}`
}

export default function CallsPage() {
  const { meetings, callLogs, users, channels, docs, meetEnabled } = useStore()
  const call = useCall()
  const [dialog, setDialog] = useState<Meeting | 'new' | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const me = users.find((u) => u.id === call.tabUserId)

  const now = Date.now()
  const upcoming = [...meetings].filter((m) => addMinutes(parseISO(m.start), m.durationMin).getTime() > now).sort((a, b) => a.start.localeCompare(b.start))
  const history = [...callLogs].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const ongoing = Object.values(call.ongoing).filter((o) => Object.keys(o.peers).length && o.callId !== call.call?.callId)

  const startMeeting = (m: Meeting) => {
    // Everyone joining a scheduled meeting shares its running call; the server starts one if none is open.
    const open = callLogs.find((c) => c.meetingId === m.id && !c.endedAt)
    void call.prepare({ callId: open?.callId, isNew: !open, title: m.title, kind: m.kind, channelId: m.channelId, meetingId: m.id, invitees: m.attendees })
  }

  return (
    <div className="@container h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <PhoneCall size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">Calls & meetings</h1>
          <span className="text-muted text-sm">You’re calling as {me?.name}</span>
        </div>

        <div className="grid gap-3 @2xl:grid-cols-3">
          <button
            onClick={() => void call.prepare({ title: `${me?.name.split(' ')[0]}’s meeting`, kind: 'video', channelId: null, meetingId: null, invitees: [] })}
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 p-5 text-left text-white shadow-sm transition hover:shadow-md"
          >
            <span className="rounded-xl bg-white/20 p-2.5">
              <Video size={22} />
            </span>
            <span>
              <span className="block font-semibold">Meet now</span>
              <span className="text-sm text-white/75">Start an instant video call</span>
            </span>
          </button>
          <button
            onClick={() => void call.prepare({ title: 'Quick huddle', kind: 'audio', channelId: null, meetingId: null, invitees: [] })}
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-accent-600 to-accent-500 p-5 text-left text-white shadow-sm transition hover:shadow-md"
          >
            <span className="rounded-xl bg-white/20 p-2.5">
              <Phone size={22} />
            </span>
            <span>
              <span className="block font-semibold">Audio huddle</span>
              <span className="text-sm text-white/75">Voice only, low bandwidth</span>
            </span>
          </button>
          <button onClick={() => setDialog('new')} className="border-app hover-surface flex items-center gap-3 rounded-2xl border p-5 text-left">
            <span className="bg-brand-50 text-brand-600 dark:bg-brand-600/20 rounded-xl p-2.5">
              <CalendarPlus size={22} />
            </span>
            <span>
              <span className="block font-semibold">Schedule</span>
              <span className="text-muted text-sm">Plan a meeting with agenda</span>
            </span>
          </button>
        </div>

        {ongoing.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Happening now
            </h2>
            <div className="space-y-2">
              {ongoing.map((o) => (
                <div key={o.callId} className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-50 p-3 dark:bg-emerald-500/10">
                  {o.kind === 'video' ? <Video size={18} className="text-emerald-600" /> : <Phone size={18} className="text-emerald-600" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{o.title}</div>
                    <div className="text-muted text-xs">{Object.keys(o.peers).length} in call</div>
                  </div>
                  <AvatarStack ids={[...new Set(Object.values(o.peers))]} size={24} />
                  <button onClick={() => void call.prepare({ callId: o.callId, title: o.title, kind: o.kind, channelId: o.channelId, meetingId: null, invitees: [] })} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600">
                    Join
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold">Upcoming meetings</h2>
          {upcoming.length === 0 && <p className="text-muted border-app rounded-xl border border-dashed p-6 text-center text-sm">Nothing scheduled.</p>}
          <div className="border-app divide-y divide-[var(--border)] overflow-hidden rounded-xl border">
            {upcoming.map((m) => {
              const start = parseISO(m.start)
              const live = now >= start.getTime() - 5 * 60000
              const mins = differenceInMinutes(start, now)
              return (
                <div key={m.id} className="hover-surface flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-100 flex w-14 shrink-0 flex-col items-center rounded-lg py-1 text-center">
                    <span className="text-[10px] font-semibold uppercase">{format(start, 'MMM')}</span>
                    <span className="text-lg leading-none font-bold">{format(start, 'd')}</span>
                  </div>
                  <button onClick={() => setDialog(m)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2 truncate font-medium">
                      {m.kind === 'video' ? <Video size={14} className="text-muted" /> : <Phone size={14} className="text-muted" />}
                      {m.title}
                    </div>
                    <div className="text-muted text-xs">
                      {whenLabel(m.start)} · {m.durationMin} min
                      {m.channelId && ` · #${channels.find((c) => c.id === m.channelId)?.name ?? ''}`}
                      {m.notesDocId && ' · has notes'}
                    </div>
                  </button>
                  <AvatarStack ids={m.attendees} size={24} max={4} />
                  {live ? (
                    <button onClick={() => startMeeting(m)} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600">
                      Join
                    </button>
                  ) : (
                    <span className="text-muted w-20 text-right text-xs">{mins < 60 ? `in ${mins} min` : mins < 1440 ? `in ${Math.round(mins / 60)} h` : ''}</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold">Recent calls</h2>
          {history.length === 0 && <p className="text-muted text-sm">No calls yet.</p>}
          <div className="border-app divide-y divide-[var(--border)] overflow-hidden rounded-xl border">
            {history.map((c: CallLog) => {
              const notes = c.notesDocId ? docs.find((d) => d.id === c.notesDocId) : undefined
              const channel = channels.find((ch) => ch.id === c.channelId)
              return (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={cn('rounded-lg p-2', c.endedAt ? 'surface-muted text-muted' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20')}>{c.kind === 'video' ? <Video size={16} /> : <Phone size={16} />}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.title}</div>
                      <div className="text-muted flex flex-wrap items-center gap-1 text-xs">
                        {timeAgo(c.startedAt)} · {c.endedAt ? clockFrom(parseISO(c.endedAt).getTime() - parseISO(c.startedAt).getTime()) : 'in progress'}
                        {channel && (
                          <>
                            {' · '}
                            <Hash size={11} />
                            {channel.name}
                          </>
                        )}
                        {' · '}
                        <Users size={11} /> {c.participants.length}
                      </div>
                    </div>
                    <AvatarStack ids={c.participants} size={22} max={4} />
                    {c.recordingClipId && (
                      <button onClick={() => setPlaying(playing === c.recordingClipId ? null : c.recordingClipId)} className="border-app hover-surface flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                        <Film size={13} /> Recording
                      </button>
                    )}
                    {notes && (
                      <Link to={`/app/docs/${notes.id}`} className="border-app hover-surface flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                        <FileText size={13} /> Notes
                      </Link>
                    )}
                  </div>
                  {playing && playing === c.recordingClipId && <ClipPlayer clipId={playing} className="mt-3 max-w-xl" />}
                </div>
              )
            })}
          </div>
        </section>

        <section className="surface-subtle mt-8 rounded-xl p-4 text-sm">
          <h2 className="mb-1 font-semibold">How calls work</h2>
          <p className="text-muted">
            {meetEnabled
              ? 'Calls run on your team’s own LiveKit media server. Invite people when you start a call and they’ll ring wherever they’re signed in; anyone in the workspace can join a running call from here or from chat.'
              : 'Calls are turned off because this server has no LiveKit media server configured. An admin can enable them in the backend settings.'}
          </p>
        </section>
      </div>
      {dialog && <MeetingDialog meeting={dialog === 'new' ? undefined : dialog} onClose={() => setDialog(null)} />}
    </div>
  )
}
