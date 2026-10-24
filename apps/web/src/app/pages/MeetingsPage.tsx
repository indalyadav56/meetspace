import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, format, isToday, parseISO } from 'date-fns'
import { ArrowUp, CalendarPlus, FileText, Phone, Search, Sparkles, Video } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { Meeting } from '../../store/types'
import { useAssistant } from '../ai/useAssistant'
import { useCall } from '../calls/useCall'
import MeetingDialog from '../calls/MeetingDialog'
import { AvatarStack } from '../components/ui'
import { cn } from '../../lib/utils'

const PROMPTS = [
  'Extract action items from my recent meeting notes',
  'Summarize the key points from my recent meeting notes',
  'List decisions and open questions from my recent meetings',
  'Draft a follow-up message based on my recent meeting notes',
]

const minutes = (a: string, b: string | null) => (b ? Math.max(1, Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 60000)) : null)

/** Meetings hub: ask about past meetings, see what's coming up, find notes. */
export default function MeetingsPage() {
  const s = useStore()
  const [text, setText] = useState('')
  const [edit, setEdit] = useState<Meeting | 'new' | null>(null)
  const [q, setQ] = useState('')

  const upcoming = useMemo(() => {
    const now = new Date()
    const end = addDays(now, 14).toISOString()
    return s.meetings.filter((m) => parseISO(m.start).getTime() + m.durationMin * 60000 >= now.getTime() && m.start <= end).sort((a, b) => a.start.localeCompare(b.start))
  }, [s.meetings])

  // Past calls, newest first, with their notes doc when one was saved.
  const past = useMemo(() => {
    const needle = q.toLowerCase()
    return s.callLogs
      .filter((c) => c.endedAt)
      .map((c) => ({ ...c, doc: c.notesDocId ? s.docs.find((d) => d.id === c.notesDocId) : undefined }))
      .filter((c) => !needle || c.title.toLowerCase().includes(needle) || (c.doc?.content ?? '').toLowerCase().includes(needle))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }, [s.callLogs, s.docs, q])

  const join = (m: Meeting) => void useCall.getState().prepare({ title: m.title, kind: m.kind, channelId: m.channelId, meetingId: m.id, invitees: m.attendees })
  const ask = (p: string) => {
    if (!p.trim()) return
    // Give the assistant the notes so it can answer from them.
    const notes = past
      .filter((c) => c.doc)
      .slice(0, 5)
      .map((c) => `## ${c.title} (${format(parseISO(c.startedAt), 'MMM d')})\n${(c.doc!.content ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500)}`)
      .join('\n\n')
    useAssistant.getState().ask(notes ? `${p}\n\nRecent meeting notes:\n${notes}` : `${p}\n\n(There are no saved meeting notes yet — say so and suggest saving notes after a call.)`)
    setText('')
  }

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <h1 className="font-display mb-1 text-2xl font-semibold">Ready to dive into your meetings?</h1>
        <p className="text-muted mb-4 text-sm">Find decisions made in previous meetings, prepare for the next one, or pull out action items.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            ask(text)
          }}
          className="surface mb-3 flex items-center gap-2 rounded-2xl border border-[var(--border)] px-3 py-2 shadow-[var(--shadow-pop)]"
        >
          <Sparkles size={16} className="text-brand-600 shrink-0" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about your meetings…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Ask about your meetings" />
          <button disabled={!text.trim()} className="bg-brand-600 hover:bg-brand-700 rounded-full p-1.5 text-white disabled:opacity-40" aria-label="Ask">
            <ArrowUp size={15} />
          </button>
        </form>
        <div className="mb-8 flex flex-wrap gap-2">
          {PROMPTS.map((p) => (
            <button key={p} onClick={() => ask(p)} className="border-app hover-surface text-muted hover:text-app rounded-full border px-3 py-1 text-xs">
              {p}
            </button>
          ))}
        </div>

        <section className="mb-8">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold">Upcoming meetings</h2>
            <span className="text-faint text-xs">next 14 days</span>
            <button onClick={() => setEdit('new')} className="bg-brand-600 hover:bg-brand-700 ml-auto inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white">
              <CalendarPlus size={13} /> Schedule
            </button>
            <Link to="/app/planner" className="border-app hover-surface rounded-md border px-2.5 py-1 text-xs font-medium">
              Open calendar
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="border-app text-muted rounded-xl border border-dashed px-4 py-8 text-center text-sm">No meetings scheduled. Schedule one, or drag time in the Planner.</p>
          ) : (
            <div className="border-app overflow-hidden rounded-xl border">
              {upcoming.map((m) => {
                const start = parseISO(m.start)
                const live = start.getTime() <= Date.now()
                return (
                  <div key={m.id} className="border-app hover-surface flex items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
                    <span className={cn('w-16 shrink-0 rounded-md px-2 py-1 text-center text-[11px] font-semibold', isToday(start) ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'surface-muted')}>
                      {isToday(start) ? 'Today' : format(start, 'EEE d')}
                    </span>
                    <button onClick={() => setEdit(m)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-medium">{m.title}</span>
                      <span className="text-muted text-xs">
                        {format(start, 'h:mm a')} · {m.durationMin} min{m.agenda ? ` · ${m.agenda.split('\n')[0]}` : ''}
                      </span>
                    </button>
                    <AvatarStack ids={m.attendees} size={22} max={4} />
                    <button onClick={() => join(m)} className={cn('inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold', live ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'border-app hover-surface border')}>
                      {m.kind === 'video' ? <Video size={13} /> : <Phone size={13} />} {live ? 'Join now' : 'Join'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold">Past meetings &amp; notes</h2>
            <div className="border-app ml-auto flex h-7 items-center gap-1.5 rounded-md border px-2">
              <Search size={13} className="text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles and notes" className="w-44 bg-transparent text-xs outline-none" />
            </div>
          </div>
          {past.length === 0 ? (
            <p className="border-app text-muted rounded-xl border border-dashed px-4 py-8 text-center text-sm">No past calls yet. After a call, choose “Save meeting notes” to keep a summary here.</p>
          ) : (
            <div className="border-app overflow-hidden rounded-xl border">
              {past.slice(0, 50).map((c) => (
                <div key={c.id} className="border-app flex items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
                  {c.kind === 'video' ? <Video size={15} className="text-muted shrink-0" /> : <Phone size={15} className="text-muted shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.title}</span>
                    <span className="text-muted text-xs">
                      {format(parseISO(c.startedAt), 'MMM d, h:mm a')}
                      {minutes(c.startedAt, c.endedAt) ? ` · ${minutes(c.startedAt, c.endedAt)} min` : ''} · {c.participants.length} people
                    </span>
                  </span>
                  <AvatarStack ids={c.participants} size={20} max={4} />
                  {c.doc ? (
                    <Link to={`/app/docs/${c.doc.id}`} className="text-brand-700 dark:text-brand-300 inline-flex items-center gap-1 text-xs font-medium hover:underline">
                      <FileText size={13} /> Notes
                    </Link>
                  ) : (
                    <span className="text-faint text-xs">No notes</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {edit && <MeetingDialog meeting={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </div>
  )
}
