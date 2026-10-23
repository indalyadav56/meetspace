import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Camera, CheckSquare, Circle, Download, Film, Hash, Mic, Monitor, Search, Share2, Trash2, Video, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
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

export default function ClipsPage() {
  const clips = useStore((s) => s.clips)
  const openRecorder = useRecorder((s) => s.open)
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'all' | ClipKind>('all')
  const [active, setActive] = useState<Clip | null>(null)
  const shown = clips.filter((c) => (kind === 'all' || c.kind === kind) && c.title.toLowerCase().includes(q.toLowerCase()))

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
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(['all', 'screen+camera', 'screen', 'camera', 'audio', 'call'] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={cn('rounded-full border px-3 py-1 text-xs font-medium capitalize', kind === k ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-100' : 'border-app text-muted')}>
              {k === 'all' ? 'All' : k === 'call' ? 'Call recordings' : k === 'audio' ? 'Voice' : k.replace('+', ' + ')}
            </button>
          ))}
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
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((c) => {
              const Icon = KIND_ICON[c.kind]
              return (
                <button key={c.id} onClick={() => setActive(c)} className="border-app group hover:border-brand-500 overflow-hidden rounded-xl border text-left transition-colors">
                  <div className="relative aspect-video bg-slate-900">
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
          </div>
        )}
      </div>
    </Modal>
  )
}
