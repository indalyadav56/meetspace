import { useEffect, useState } from 'react'
import { CalendarDays, Check, Copy, RefreshCw } from 'lucide-react'
import { api } from '../../../api/client'
import { useStore } from '../../../store/useStore'
import { cn } from '../../../lib/utils'

interface Feed {
  url: string
  webcal: string
}

/** A private subscription URL with your due tasks and meetings, for Google, Outlook or Apple Calendar. */
export default function CalendarSync() {
  const s = useStore()
  const ws = s.currentWorkspaceId
  const [feed, setFeed] = useState<Feed | null | undefined>(undefined)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    api.raw<Feed>('GET', `/workspaces/${ws}/calendar-feed`).then(setFeed, () => setFeed(null))
  }, [ws])

  const enable = async (rotate = false) => {
    try {
      setFeed(await api.raw<Feed>('POST', `/workspaces/${ws}/calendar-feed${rotate ? '?rotate=1' : ''}`, { body: {} }))
      if (rotate) s.toast('New link created — the old one stopped working')
    } catch (e) {
      s.toast(e instanceof Error ? e.message : 'Could not create the feed', 'error')
    }
  }
  const disable = async () => {
    await api.raw('DELETE', `/workspaces/${ws}/calendar-feed`).catch(() => {})
    setFeed(null)
  }
  const copy = () => {
    void navigator.clipboard?.writeText(feed!.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const name = `Meetspace · ${s.workspaces.find((w) => w.id === ws)?.name ?? ''}`
  const btn = 'border-app hover-surface inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium'

  return (
    <div className="max-w-2xl space-y-4">
      <section className="border-app rounded-xl border p-4">
        <div className="flex items-start gap-3">
          <span className="bg-brand-50 text-brand-600 dark:bg-brand-500/15 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <CalendarDays size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Calendar sync</h2>
            <p className="text-muted text-sm">Your open tasks with due dates and the meetings you’re in, in Google Calendar, Outlook or Apple Calendar. It updates about every hour; changes are made in Meetspace.</p>
          </div>
          {feed === null && (
            <button onClick={() => void enable()} className="bg-brand-600 hover:bg-brand-700 shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white">
              Turn on
            </button>
          )}
        </div>
        {feed && (
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <input readOnly value={feed.url} onFocus={(e) => e.target.select()} className="border-app surface-muted min-w-0 flex-1 rounded-md border px-2 py-1.5 font-mono text-xs" aria-label="Calendar feed URL" />
              <button onClick={copy} className="bg-brand-600 hover:bg-brand-700 inline-flex items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-white">
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <a className={btn} href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feed.url)}`} target="_blank" rel="noreferrer">
                Add to Google Calendar
              </a>
              <a className={btn} href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feed.url)}&name=${encodeURIComponent(name)}`} target="_blank" rel="noreferrer">
                Add to Outlook
              </a>
              <a className={btn} href={feed.webcal}>
                Open in Apple Calendar
              </a>
            </div>
            <p className="text-faint text-xs">Anyone with this link can see your schedule. If it leaks, get a new one — the old link stops working.</p>
            <div className="flex gap-2">
              <button onClick={() => void enable(true)} className={cn(btn, 'text-xs')}>
                <RefreshCw size={13} /> New link
              </button>
              <button onClick={() => void disable()} className={cn(btn, 'text-xs text-red-600')}>
                Turn off
              </button>
            </div>
          </div>
        )}
      </section>
      <p className="text-faint text-xs">Calendar apps need to reach this server, so a feed from a computer that isn’t on the internet (like localhost) will only work in calendar apps on that same computer.</p>
    </div>
  )
}
