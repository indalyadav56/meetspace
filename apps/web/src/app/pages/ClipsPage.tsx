import { useState } from 'react'
import { useQueryState } from '../../lib/useQueryState'
import { format, parseISO } from 'date-fns'
import { Camera, CheckSquare, Circle, Sparkles, Download, Film, Hash, LayoutGrid, List as ListIcon, Mic, Monitor, Search, Share2, Trash2, Video, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { api } from '../../api/client'
import type { Clip, ClipKind } from '../../store/types'
import { Avatar, MenuItem, Modal, Popover, usePopover } from '../components/ui'
import ClipPlayer, { formatDuration } from '../clips/ClipPlayer'
import { downloadClip } from '../clips/clipStore'
import { useRecorder } from '../clips/Recorder'
import { cn } from '../../lib/utils'

const KIND_ICON: Record<ClipKind, typeof Film> = { screen: Monitor, camera: Camera, 'screen+camera': Monitor, call: Video, audio: Mic }

function size(bytes: number) {
  return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`
}

type ClipSort = 'newest' | 'oldest' | 'longest' | 'name'
const SORTS: Record<ClipSort, (a: Clip, b: Clip) => number> = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
  longest: (a, b) => b.durationSec - a.durationSec,
  name: (a, b) => a.title.localeCompare(b.title),
}
/** "video" covers every recording with a picture; the rest match a single kind. */
const inKind = (c: Clip, k: string) => k === 'all' || c.kind === k || (k === 'video' && ['screen', 'camera', 'screen+camera'].includes(c.kind))

export default function ClipsPage() {
  const clips = useStore((s) => s.clips)
  const me = useStore((s) => s.currentUserId)
  const openRecorder = useRecorder((s) => s.open)
  const [q, setQ] = useState('')
  const [kind, setKind] = useQueryState<'all' | 'video' | ClipKind>('kind', 'all')
  const [owner, setOwner] = useQueryState<'all' | 'mine' | 'others'>('owner', 'all')
  const [sort, setSort] = useQueryState<ClipSort>('sort', 'newest')
  const [layout, setLayout] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem('ms.clips.layout') === 'list' ? 'list' : 'grid'
    } catch {
      return 'grid'
    }
  })
  const pickLayout = (l: 'grid' | 'list') => {
    setLayout(l)
    try {
      localStorage.setItem('ms.clips.layout', l)
    } catch {
      /* storage blocked */
    }
  }
  const [active, setActive] = useState<Clip | null>(null)
  const owned = clips.filter((c) => (owner === 'mine' ? c.createdBy === me : owner === 'others' ? c.createdBy !== me : true))
  const shown = owned.filter((c) => inKind(c, kind) && c.title.toLowerCase().includes(q.toLowerCase())).sort(SORTS[sort])

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Film size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">Clips</h1>
          <div className="border-app ml-auto flex h-8 items-center gap-2 rounded-md border px-2">
            <Search size={14} className="text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clips" className="w-32 bg-transparent text-sm outline-none sm:w-44" />
          </div>
          <button onClick={() => openRecorder()} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-red-500 px-3 text-sm font-semibold text-white hover:bg-red-600">
            <Circle size={12} fill="currentColor" /> Record
          </button>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {(['all', 'video', 'audio', 'call', 'screen+camera', 'screen', 'camera'] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={cn('rounded-full border px-3 py-1 text-xs font-medium', kind === k ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-100' : 'border-app text-muted')}>
              {({ all: 'All', video: 'Video clips', audio: 'Voice clips', call: 'Call recordings', 'screen+camera': 'Screen + camera', screen: 'Screen', camera: 'Camera' } as const)[k]}
              <span className="ml-1 opacity-60">{owned.filter((c) => inKind(c, k)).length}</span>
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <select value={owner} onChange={(e) => setOwner(e.target.value as typeof owner)} className="border-app surface h-7 rounded-md border px-1.5 text-xs" aria-label="Created by">
              <option value="all">Anyone</option>
              <option value="mine">Created by me</option>
              <option value="others">Shared with me</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as ClipSort)} className="border-app surface h-7 rounded-md border px-1.5 text-xs" aria-label="Sort">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="longest">Longest</option>
              <option value="name">Name</option>
            </select>
            <div className="border-app flex rounded-md border">
              {(['grid', 'list'] as const).map((l) => (
                <button key={l} onClick={() => pickLayout(l)} className={cn('p-1', layout === l ? 'text-brand-600 bg-brand-50 dark:bg-brand-600/20' : 'text-muted')} aria-label={`${l} layout`} aria-pressed={layout === l}>
                  {l === 'grid' ? <LayoutGrid size={14} /> : <ListIcon size={14} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="border-app flex flex-col items-center gap-3 rounded-2xl border border-dashed p-14 text-center">
            <Film size={36} className="text-brand-500" />
            <div className="font-semibold">{clips.length ? 'No clips match.' : 'Explain it with a clip'}</div>
            <p className="text-muted max-w-sm text-sm">Record your screen, camera or voice and share it on a task or in chat — faster than a meeting. Call recordings show up here too.</p>
            {!clips.length && (
              <button onClick={() => openRecorder()} className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white">
                <Circle size={12} fill="currentColor" /> Record your first clip
              </button>
            )}
          </div>
        ) : layout === 'list' ? (
          <div className="border-app overflow-hidden rounded-xl border">
            {shown.map((c) => {
              const Icon = KIND_ICON[c.kind]
              return (
                <button key={c.id} onClick={() => setActive(c)} className="border-app hover-surface flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0">
                  <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded bg-stone-900">
                    {c.thumb ? <img src={c.thumb} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-white/40"><Icon size={16} /></span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.title}</span>
                    <span className="text-faint flex items-center gap-1.5 text-xs">
                      <Icon size={11} /> {c.kind === 'call' ? 'Call recording' : c.kind === 'audio' ? 'Voice' : c.kind.replace('+', ' + ')}
                      {c.taskId && (
                        <>
                          {' '}
                          · <CheckSquare size={11} className="text-brand-600" /> on a task
                        </>
                      )}
                    </span>
                  </span>
                  <Avatar userId={c.createdBy} size={20} />
                  <span className="text-muted w-28 shrink-0 text-xs">{format(parseISO(c.createdAt), 'MMM d, h:mm a')}</span>
                  <span className="text-muted w-14 shrink-0 text-right font-mono text-xs">{formatDuration(c.durationSec)}</span>
                  <span className="text-faint hidden w-16 shrink-0 text-right text-xs sm:block">{size(c.size)}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((c) => {
              const Icon = KIND_ICON[c.kind]
              return (
                <button key={c.id} onClick={() => setActive(c)} className="border-app group hover:border-brand-500 overflow-hidden rounded-xl border text-left transition-colors">
                  <div className="relative aspect-video bg-stone-900">
                    {c.thumb ? <img src={c.thumb} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-white/40">{c.kind === 'audio' ? <Mic size={36} /> : <Film size={36} />}</div>}
                    <span className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white">{formatDuration(c.durationSec)}</span>
                    <span className="absolute top-2 left-2 rounded bg-black/60 p-1 text-white">
                      <Icon size={13} />
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="truncate text-sm font-semibold">{c.title}</div>
                    <div className="text-faint mt-1 flex items-center gap-1.5 text-xs">
                      <Avatar userId={c.createdBy} size={16} /> {format(parseISO(c.createdAt), 'MMM d, h:mm a')} · {size(c.size)}
                      {c.taskId && <CheckSquare size={12} className="text-brand-600 ml-auto" />}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
      {active && <ClipDetail clip={active} onClose={() => setActive(null)} />}
    </div>
  )
}

export function ClipDetail({ clip, onClose }: { clip: Clip; onClose: () => void }) {
  const { updateClip, deleteClip, tasks, channels, shareClip, openTask, toast } = useStore()
  const live = useStore((s) => s.clips.find((c) => c.id === clip.id)) ?? clip
  const taskPop = usePopover()
  const sharePop = usePopover()
  const [shared, setShared] = useState<string | null>(null)
  const task = tasks.find((t) => t.id === live.taskId)

  const download = () => downloadClip(live).catch(() => toast('Couldn’t download the clip', 'error'))

  return (
    <Modal open onClose={onClose} className="mt-[5vh] max-w-3xl">
      <div className="border-app flex items-center gap-2 border-b px-4 py-2.5">
        <input value={live.title} onChange={(e) => updateClip(live.id, { title: e.target.value })} className="min-w-0 flex-1 bg-transparent font-semibold outline-none" aria-label="Clip title" />
        <button onClick={onClose} className="hover-surface text-muted rounded p-1" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="p-4">
        <ClipPlayer clipId={live.id} />
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted flex items-center gap-1.5 text-xs">
            <Avatar userId={live.createdBy} size={18} /> {format(parseISO(live.createdAt), 'PPp')} · {formatDuration(live.durationSec)} · {size(live.size)}
          </span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {task ? (
              <button onClick={() => (onClose(), openTask(task.id))} className="border-app hover-surface flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs">
                <CheckSquare size={13} /> MS-{task.key}
              </button>
            ) : (
              <>
                <button onClick={taskPop.toggle} className="border-app hover-surface flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs">
                  <CheckSquare size={13} /> Attach to task
                </button>
                <Popover open={taskPop.open} anchor={taskPop.anchor} onClose={taskPop.close} width={280} align="end">
                  <div className="max-h-72 overflow-y-auto">
                    {tasks
                      .filter((t) => !t.parentId)
                      .map((t) => (
                        <MenuItem
                          key={t.id}
                          onClick={() => {
                            updateClip(live.id, { taskId: t.id })
                            taskPop.close()
                          }}
                        >
                          <span className="text-faint text-xs">MS-{t.key}</span> <span className="truncate">{t.title}</span>
                        </MenuItem>
                      ))}
                  </div>
                </Popover>
              </>
            )}
            <button onClick={sharePop.toggle} className="border-app hover-surface flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs">
              <Share2 size={13} /> {shared ? `Shared to ${shared}` : 'Share to chat'}
            </button>
            <Popover open={sharePop.open} anchor={sharePop.anchor} onClose={sharePop.close} width={220} align="end">
              {channels
                .filter((c) => c.kind === 'channel')
                .map((c) => (
                  <MenuItem
                    key={c.id}
                    onClick={() => {
                      shareClip(live.id, c.id)
                      setShared(`#${c.name}`)
                      sharePop.close()
                    }}
                  >
                    <Hash size={13} /> {c.name}
                  </MenuItem>
                ))}
            </Popover>
            <button onClick={() => void download()} className="border-app hover-surface flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs">
              <Download size={13} /> Download
            </button>
            <button
              onClick={() => {
                if (!confirm('Delete this clip?')) return
                deleteClip(live.id)
                onClose()
              }}
              className="flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-500 dark:border-red-500/30"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
        {live.transcript && (
          <div className="mt-4">
            <h3 className="mb-1 text-sm font-semibold">Transcript</h3>
            <pre className="surface-subtle max-h-48 overflow-y-auto rounded-lg p-3 font-sans text-xs whitespace-pre-wrap">{live.transcript}</pre>
            <TranscriptSummary title={live.title} transcript={live.transcript} />
          </div>
        )}
      </div>
    </Modal>
  )
}

interface Summary {
  summary: string
  decisions: string[]
  actionItems: { title: string; owner: string; due: string }[]
}

/** AI notes from a transcript: summary, decisions, and action items that become tasks. */
function TranscriptSummary({ title, transcript }: { title: string; transcript: string }) {
  const s = useStore()
  const [sum, setSum] = useState<Summary | null>(null)
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<boolean[]>([])
  const [listId, setListId] = useState(s.lists[0]?.id ?? '')
  const run = async () => {
    setBusy(true)
    try {
      const r = await api.raw<Summary>('POST', `/workspaces/${s.currentWorkspaceId}/assistant/summarize`, { body: { title, transcript } })
      setSum(r)
      setPicked(r.actionItems.map(() => true))
    } catch (e) {
      s.toast(e instanceof Error ? e.message : 'Could not summarize', 'error')
    } finally {
      setBusy(false)
    }
  }
  const ownerId = (name: string) => s.users.find((u) => name && (u.name.toLowerCase() === name.toLowerCase() || u.name.split(' ')[0].toLowerCase() === name.toLowerCase().split(' ')[0]))?.id
  const create = () => {
    if (!sum || !listId) return
    let n = 0
    sum.actionItems.forEach((a, i) => {
      if (!picked[i]) return
      const owner = ownerId(a.owner)
      s.addTask({ listId, title: a.title, assignees: owner ? [owner] : [], dueDate: /^\d{4}-\d{2}-\d{2}$/.test(a.due) ? a.due : null, tags: ['meeting'] })
      n++
    })
    s.toast(`Created ${n} task${n === 1 ? '' : 's'} from the meeting`)
    setPicked((p) => p.map(() => false))
  }
  if (!sum)
    return (
      <button onClick={() => void run()} disabled={busy} className="border-app hover-surface mt-2 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50">
        <Sparkles size={13} className="text-accent-500" /> {busy ? 'Summarizing…' : 'Summarize with AI'}
      </button>
    )
  return (
    <div className="border-app mt-3 space-y-3 rounded-lg border p-3 text-sm">
      <p>{sum.summary}</p>
      {sum.decisions.length > 0 && (
        <div>
          <div className="text-faint mb-1 text-[11px] font-semibold uppercase">Decisions</div>
          <ul className="list-disc space-y-0.5 pl-5">
            {sum.decisions.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}
      {sum.actionItems.length > 0 && (
        <div>
          <div className="text-faint mb-1 text-[11px] font-semibold uppercase">Action items</div>
          {sum.actionItems.map((a, i) => (
            <label key={i} className="flex items-center gap-2 py-0.5">
              <input type="checkbox" checked={!!picked[i]} onChange={() => setPicked((p) => p.map((v, j) => (j === i ? !v : v)))} className="accent-brand-600" />
              <span className="flex-1">{a.title}</span>
              {a.owner && <span className="text-faint text-xs">{ownerId(a.owner) ? '' : '?'}{a.owner}</span>}
              {a.due && <span className="text-faint text-xs">{a.due}</span>}
            </label>
          ))}
          <div className="mt-2 flex items-center gap-2">
            <select value={listId} onChange={(e) => setListId(e.target.value)} className="border-app surface h-7 rounded-md border px-1.5 text-xs" aria-label="List for tasks">
              {s.lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button onClick={create} disabled={!picked.some(Boolean)} className="bg-brand-600 hover:bg-brand-700 rounded-md px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40">
              Create {picked.filter(Boolean).length} task{picked.filter(Boolean).length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
