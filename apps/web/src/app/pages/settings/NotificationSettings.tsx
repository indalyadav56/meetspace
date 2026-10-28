import { useEffect, useState } from 'react'
import { Bell, BellRing, Mail, Moon, Send, Smartphone } from 'lucide-react'
import { api } from '../../../api/client'
import { useStore } from '../../../store/useStore'
import { cn } from '../../../lib/utils'
import { currentSubscription, disablePush, enablePush, pushSupported } from '../../notifications/push'

export interface Prefs {
  emailMode: 'instant' | 'digest' | 'off'
  emailKinds: string[]
  pushEnabled: boolean
  pushKinds: string[]
  digestHour: number
  timezone: string
  quietStart: number
  quietEnd: number
  pausedUntil: string | null
}

const KINDS: { key: string; label: string; hint: string }[] = [
  { key: 'mention', label: 'Mentions', hint: 'Someone @mentions you' },
  { key: 'assigned', label: 'Assignments', hint: 'A task is assigned to you' },
  { key: 'comment', label: 'Comments', hint: 'Replies on tasks you follow' },
  { key: 'status', label: 'Status changes', hint: 'Tasks you follow move' },
  { key: 'due', label: 'Due dates', hint: 'Your tasks are due soon or overdue' },
  { key: 'reminder', label: 'Reminders', hint: 'Reminders you set' },
  { key: 'timesheet', label: 'Timesheets', hint: 'Approvals and decisions' },
]

const hourLabel = (h: number) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`)
const zones = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')
  } catch {
    return ['UTC']
  }
})()

const card = 'border-app rounded-xl border p-4'
const sel = 'border-app surface h-8 rounded-md border px-2 text-sm'

export default function NotificationSettings() {
  const toast = useStore((s) => s.toast)
  const [p, setP] = useState<Prefs | null>(null)
  const [push, setPush] = useState<'on' | 'off' | 'unsupported' | 'blocked'>('off')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get<Prefs>('/users/me/notifications/preferences').then((prefs) => {
      // First visit: adopt the browser's timezone so the digest arrives in the morning.
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (prefs.timezone === 'UTC' && tz && tz !== 'UTC') void save({ ...prefs, timezone: tz }, true)
      else setP(prefs)
    })
    if (!pushSupported()) setPush('unsupported')
    else if (Notification.permission === 'denied') setPush('blocked')
    else currentSubscription().then((s) => setPush(s ? 'on' : 'off'))
  }, []) // load once

  const save = async (next: Prefs, quietly = false) => {
    setP(next)
    try {
      setP(await api.raw<Prefs>('PUT', '/users/me/notifications/preferences', { body: next }))
      if (!quietly) toast('Notification settings saved')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error')
    }
  }
  const toggleKind = (field: 'emailKinds' | 'pushKinds', k: string) => p && void save({ ...p, [field]: p[field].includes(k) ? p[field].filter((x) => x !== k) : [...p[field], k] })

  const togglePush = async () => {
    setBusy(true)
    try {
      if (push === 'on') {
        await disablePush()
        setPush('off')
        toast('Push notifications are off in this browser')
      } else {
        await enablePush()
        setPush('on')
        toast('Push notifications are on in this browser')
      }
    } catch (e) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') setPush('blocked')
      toast(e instanceof Error ? e.message : 'Could not change push notifications', 'error')
    } finally {
      setBusy(false)
    }
  }
  const test = async () => {
    try {
      const r = await api.raw<{ sent: number }>('POST', '/users/me/notifications/test', { body: {} })
      toast(r.sent ? 'Test notification sent — check your screen' : 'No browser accepted the test')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send a test', 'error')
    }
  }

  if (!p) return <p className="text-muted text-sm">Loading…</p>
  const paused = p.pausedUntil && p.pausedUntil > new Date().toISOString()

  return (
    <div className="max-w-2xl space-y-4">
      {paused && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
          <Moon size={15} /> Notifications are muted until {new Date(p.pausedUntil!).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.
          <button onClick={() => void save({ ...p, pausedUntil: null })} className="ml-auto font-semibold hover:underline">
            Unmute
          </button>
        </div>
      )}

      <section className={card}>
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <Mail size={16} /> Email
        </h2>
        <p className="text-muted mb-3 text-sm">Only for things you haven’t already seen in Meetspace.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ['instant', 'Right away', 'A few minutes after, if still unread'],
              ['digest', 'Daily summary', 'One email a day, with what’s due'],
              ['off', 'Off', 'No notification emails'],
            ] as const
          ).map(([k, l, hint]) => (
            <button key={k} onClick={() => void save({ ...p, emailMode: k })} className={cn('rounded-lg border p-3 text-left', p.emailMode === k ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/15' : 'border-app hover-surface')} aria-pressed={p.emailMode === k}>
              <span className="block text-sm font-semibold">{l}</span>
              <span className="text-muted block text-xs">{hint}</span>
            </button>
          ))}
        </div>
        {p.emailMode === 'digest' && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            Send it at
            <select value={p.digestHour} onChange={(e) => void save({ ...p, digestHour: Number(e.target.value) })} className={sel} aria-label="Digest time">
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
            in
            <select value={p.timezone} onChange={(e) => void save({ ...p, timezone: e.target.value })} className={cn(sel, 'max-w-56')} aria-label="Timezone">
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      <section className={card}>
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 font-semibold">
              <Smartphone size={16} /> Push notifications
            </h2>
            <p className="text-muted text-sm">
              {push === 'unsupported'
                ? 'This browser doesn’t support push notifications.'
                : push === 'blocked'
                  ? 'Blocked for this site — allow notifications in your browser’s site settings, then try again.'
                  : push === 'on'
                    ? 'On in this browser. They arrive even when Meetspace is closed.'
                    : 'Get alerts on this computer even when Meetspace isn’t open.'}
            </p>
          </div>
          {push !== 'unsupported' && (
            <div className="flex shrink-0 gap-2">
              {push === 'on' && (
                <button onClick={() => void test()} className="border-app hover-surface inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium">
                  <Send size={13} /> Test
                </button>
              )}
              <button disabled={busy} onClick={() => void togglePush()} className={cn('rounded-lg px-3.5 py-1.5 text-sm font-semibold disabled:opacity-50', push === 'on' ? 'border-app hover-surface border' : 'bg-brand-600 hover:bg-brand-700 text-white')}>
                {push === 'on' ? 'Turn off here' : 'Turn on'}
              </button>
            </div>
          )}
        </div>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <input type="checkbox" checked={p.quietStart >= 0} onChange={(e) => void save({ ...p, quietStart: e.target.checked ? 22 : -1, quietEnd: e.target.checked ? 7 : -1 })} className="accent-brand-600" />
          Quiet hours
          {p.quietStart >= 0 && (
            <>
              from
              <select value={p.quietStart} onChange={(e) => void save({ ...p, quietStart: Number(e.target.value) })} className={sel} aria-label="Quiet from">
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
              to
              <select value={p.quietEnd} onChange={(e) => void save({ ...p, quietEnd: Number(e.target.value) })} className={sel} aria-label="Quiet until">
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </>
          )}
        </label>
      </section>

      <section className={card}>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <BellRing size={16} /> What to send
        </h2>
        <table className="w-full text-sm">
          <thead className="text-faint text-left text-xs">
            <tr>
              <th className="pb-2 font-medium">Notification</th>
              <th className="w-20 pb-2 text-center font-medium">Email</th>
              <th className="w-20 pb-2 text-center font-medium">Push</th>
            </tr>
          </thead>
          <tbody>
            {KINDS.map((k) => (
              <tr key={k.key} className="border-app border-t">
                <td className="py-2">
                  <span className="block font-medium">{k.label}</span>
                  <span className="text-faint text-xs">{k.hint}</span>
                </td>
                <td className="text-center">
                  <input type="checkbox" disabled={p.emailMode === 'off'} checked={p.emailKinds.includes(k.key)} onChange={() => toggleKind('emailKinds', k.key)} className="accent-brand-600" aria-label={`Email for ${k.label}`} />
                </td>
                <td className="text-center">
                  <input type="checkbox" checked={p.pushKinds.includes(k.key)} onChange={() => toggleKind('pushKinds', k.key)} className="accent-brand-600" aria-label={`Push for ${k.label}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-faint mt-3 flex items-center gap-1.5 text-xs">
          <Bell size={12} /> Everything still shows in your Notifications feed in the app.
        </p>
      </section>
    </div>
  )
}
