import { useState } from 'react'
import { addMinutes, format, parseISO, setHours, setMinutes, startOfHour } from 'date-fns'
import { Phone, Video, X } from 'lucide-react'
import { useMe, useStore } from '../../store/useStore'
import type { CallKind, Meeting } from '../../store/types'
import { Avatar, Modal } from '../components/ui'
import { cn } from '../../lib/utils'

/** Create or edit a scheduled meeting. */
export default function MeetingDialog({ meeting, onClose, defaults }: { meeting?: Meeting; onClose: () => void; defaults?: Partial<Meeting> }) {
  const { users, channels, tasks, addMeeting, updateMeeting, deleteMeeting } = useStore()
  const me = useMe()
  const initialStart = meeting?.start ?? defaults?.start ?? addMinutes(startOfHour(new Date()), 60).toISOString()
  const [title, setTitle] = useState(meeting?.title ?? defaults?.title ?? '')
  const [date, setDate] = useState(format(parseISO(initialStart), 'yyyy-MM-dd'))
  const [time, setTime] = useState(format(parseISO(initialStart), 'HH:mm'))
  const [duration, setDuration] = useState(meeting?.durationMin ?? 30)
  const [kind, setKind] = useState<CallKind>(meeting?.kind ?? defaults?.kind ?? 'video')
  const [attendees, setAttendees] = useState<string[]>(meeting?.attendees ?? defaults?.attendees ?? [me.id])
  const [channelId, setChannelId] = useState<string>(meeting?.channelId ?? defaults?.channelId ?? '')
  const [taskId, setTaskId] = useState<string>(meeting?.taskId ?? defaults?.taskId ?? '')
  const [agenda, setAgenda] = useState(meeting?.agenda ?? '')

  const save = () => {
    if (!title.trim()) return
    const [h, m] = time.split(':').map(Number)
    const start = setMinutes(setHours(parseISO(date), h), m).toISOString()
    const data = { title: title.trim(), start, durationMin: duration, kind, attendees, channelId: channelId || null, taskId: taskId || null, agenda }
    if (meeting) updateMeeting(meeting.id, data)
    else addMeeting(data)
    onClose()
  }
  const input = 'border-app surface w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:border-brand-500'

  return (
    <Modal open onClose={onClose} className="mt-[6vh] max-w-lg">
      <div className="border-app flex items-center border-b px-5 py-3">
        <h2 className="font-semibold">{meeting ? 'Edit meeting' : 'Schedule a meeting'}</h2>
        <button onClick={onClose} className="hover-surface text-muted ml-auto rounded p-1" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <form
        className="max-h-[70vh] space-y-3 overflow-y-auto p-5"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting title" className={cn(input, 'text-base font-medium')} />
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} aria-label="Date" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} aria-label="Start time" />
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={input} aria-label="Duration">
            {[15, 30, 45, 60, 90, 120].map((d) => (
              <option key={d} value={d}>
                {d < 60 ? `${d} min` : `${d / 60} h`}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          {(['video', 'audio'] as CallKind[]).map((k) => (
            <button type="button" key={k} onClick={() => setKind(k)} className={cn('flex flex-1 items-center justify-center gap-2 rounded-lg border py-1.5 text-sm', kind === k ? 'border-brand-500 text-brand-600 bg-brand-50 dark:bg-brand-600/15' : 'border-app')}>
              {k === 'video' ? <Video size={15} /> : <Phone size={15} />} {k === 'video' ? 'Video' : 'Audio only'}
            </button>
          ))}
        </div>
        <div>
          <div className="text-muted mb-1 text-xs font-medium">Attendees</div>
          <div className="flex flex-wrap gap-1.5">
            {users.map((u) => {
              const on = attendees.includes(u.id)
              return (
                <button type="button" key={u.id} onClick={() => setAttendees(on ? attendees.filter((a) => a !== u.id) : [...attendees, u.id])} className={cn('flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs', on ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/15' : 'border-app opacity-60')}>
                  <Avatar userId={u.id} size={20} /> {u.name.split(' ')[0]}
                </button>
              )
            })}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-muted text-xs font-medium">
            Post in channel
            <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className={cn(input, 'mt-1')}>
              <option value="">None</option>
              {channels
                .filter((c) => c.kind === 'channel')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-muted text-xs font-medium">
            Related task
            <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className={cn(input, 'mt-1')}>
              <option value="">None</option>
              {tasks
                .filter((t) => !t.parentId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    MS-{t.key} {t.title}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label className="text-muted block text-xs font-medium">
          Agenda (one item per line)
          <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={3} className={cn(input, 'mt-1 resize-none')} />
        </label>
        <div className="text-muted text-xs">Ends {format(addMinutes(setMinutes(setHours(parseISO(date), Number(time.split(':')[0])), Number(time.split(':')[1])), duration), 'h:mm a')}</div>
        <div className="flex items-center gap-2 pt-2">
          {meeting && (
            <button type="button" onClick={() => confirm('Cancel this meeting?') && (deleteMeeting(meeting.id), onClose())} className="text-sm text-red-500 hover:underline">
              Cancel meeting
            </button>
          )}
          <button type="button" onClick={onClose} className="hover-surface ml-auto rounded-lg px-3 py-1.5 text-sm">
            Close
          </button>
          <button disabled={!title.trim()} className="bg-brand-600 rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
            {meeting ? 'Save' : 'Schedule'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
