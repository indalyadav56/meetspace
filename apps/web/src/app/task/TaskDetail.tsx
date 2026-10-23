import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, Ban, Sparkles, Eye, BellRing, Phone, Film, Circle as RecordIcon, Gauge, CalendarDays, Check, ChevronRight, CircleDot, Clock, Copy, Flag, Hourglass, Link2, ListChecks, MoreHorizontal, Plus, Repeat, Tag as TagIcon, Timer, Trash2, Users, X, Zap } from 'lucide-react'
import { BOT, useMe, useStore } from '../../store/useStore'
import { useAssistant } from '../ai/useAssistant'
import { useCall } from '../calls/useCall'
import { useRecorder } from '../clips/Recorder'
import ClipPlayer from '../clips/ClipPlayer'
import { CustomFieldsSection, DependenciesSection, RecurrenceSelect, TimeSection, TimerButton } from './TaskExtras'
import { GitHubSection } from './GitHubSection'
import { useTaskResolver } from '../hooks'
import { AssigneeMenu, Avatar, DateButton, MenuItem, Modal, Popover, PriorityMenu, StatusDot, StatusMenu, Tag, usePopover } from '../components/ui'
import { RichText } from '../components/RichText'
import { cn, timeAgo, uid } from '../../lib/utils'

export default function TaskDetail() {
  const { openTaskId, openTask } = useStore()
  return (
    <Modal open={!!openTaskId} onClose={() => openTask(null)} className="flex h-[min(860px,94vh)] max-w-6xl flex-col">
      {openTaskId && <TaskBody key={openTaskId} id={openTaskId} />}
    </Modal>
  )
}

function Field({ icon: Icon, label, children }: { icon: typeof Users; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-2">
      <div className="text-muted flex w-32 shrink-0 items-center gap-2 text-[13px]">
        <Icon size={15} /> {label}
      </div>
      <div className="min-w-0 flex-1 text-[13px]">{children}</div>
    </div>
  )
}

function TaskBody({ id }: { id: string }) {
  const s = useStore()
  const me = useMe()
  const r = useTaskResolver()
  const task = s.tasks.find((t) => t.id === id)
  const [tagInput, setTagInput] = useState('')
  const [comment, setComment] = useState('')
  const [assignComment, setAssignComment] = useState('')
  const mentionQuery = comment.match(/@(\w*)$/)?.[1]
  const mentionMatches = mentionQuery !== undefined ? s.users.filter((u) => u.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5) : []
  const [newSub, setNewSub] = useState('')
  const [newCheck, setNewCheck] = useState('')
  const [copied, setCopied] = useState(false)
  const more = usePopover()
  const aiPop = usePopover()

  const feed = useMemo(() => {
    const c = s.comments.filter((x) => x.taskId === id).map((x) => ({ ...x, type: 'comment' as const }))
    const a = s.activity.filter((x) => x.taskId === id).map((x) => ({ ...x, type: 'activity' as const }))
    return [...c, ...a].sort((x, y) => x.createdAt.localeCompare(y.createdAt))
  }, [s.comments, s.activity, id])

  if (!task) return <div className="p-8">This task no longer exists.</div>
  const space = r.spaceOf(task)
  const status = r.statusOf(task)
  const list = r.listById.get(task.listId)
  const parent = task.parentId ? s.tasks.find((t) => t.id === task.parentId) : null
  const subtasks = s.tasks.filter((t) => t.parentId === id)
  const up = (patch: Parameters<typeof s.updateTask>[1]) => s.updateTask(id, patch)
  const doneStatus = space?.statuses.find((st) => st.type === 'done')
  const isDone = r.isDone(task)
  const openBlockers = task.blockedBy.map((b) => s.tasks.find((t) => t.id === b)).filter((b): b is NonNullable<typeof b> => !!b && !r.isDone(b))

  const nextStatus = () => {
    if (!space) return
    const idx = space.statuses.findIndex((st) => st.id === task.statusId)
    const nxt = space.statuses[Math.min(idx + 1, space.statuses.length - 1)]
    up({ statusId: nxt.id })
  }

  return (
    <>
      {/* Header */}
      <div className="border-app flex h-12 shrink-0 items-center gap-2 border-b px-4 text-[13px]">
        {space && (
          <span className="text-muted flex min-w-0 items-center gap-1 truncate">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: space.color }} />
            {space.name}
            <ChevronRight size={13} />
            <Link to={`/app/list/${task.listId}`} onClick={() => s.openTask(null)} className="truncate hover:underline">
              {list?.name}
            </Link>
            {parent && (
              <>
                <ChevronRight size={13} />
                <button onClick={() => s.openTask(parent.id)} className="truncate hover:underline">
                  {parent.title}
                </button>
              </>
            )}
          </span>
        )}
        <span className="text-faint ml-2 hidden sm:inline">MS-{task.key}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(`${location.origin}/app/list/${task.listId}?task=${task.id}`)
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            }}
            className="hover-surface text-muted rounded-md p-1.5"
            title="Copy link"
          >
            {copied ? <Check size={16} className="text-emerald-500" /> : <Link2 size={16} />}
          </button>
          <button
            onClick={() => void useCall.getState().prepare({ title: `MS-${task.key} ${task.title}`, kind: 'video', channelId: null, meetingId: null, invitees: [...new Set([...task.assignees, ...task.watchers])] })}
            className="hover-surface text-muted rounded-md p-1.5"
            title="Start a huddle with assignees and watchers"
          >
            <Phone size={16} />
          </button>
          <button onClick={aiPop.toggle} className="hover-surface text-brand-600 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold" title="AI actions">
            <Sparkles size={14} /> AI
          </button>
          <Popover open={aiPop.open} anchor={aiPop.anchor} onClose={aiPop.close} align="end" width={230}>
            {['Summarize this task', 'Break this task into subtasks', 'Suggest next steps for this task', 'Draft a clear description for this task'].map((p) => (
              <MenuItem key={p} onClick={() => (useAssistant.getState().ask(p), aiPop.close())}>
                <Sparkles size={14} className="text-brand-600" /> {p.replace(' for this task', '').replace(' this task', '')}
              </MenuItem>
            ))}
          </Popover>
          <button onClick={more.toggle} className="hover-surface text-muted rounded-md p-1.5" aria-label="More">
            <MoreHorizontal size={16} />
          </button>
          <Popover open={more.open} anchor={more.anchor} onClose={more.close} align="end" width={190}>
            <MenuItem onClick={() => (s.openTask(s.duplicateTask(id)), more.close())}>
              <Copy size={14} /> Duplicate
            </MenuItem>
            <MenuItem danger onClick={() => (more.close(), s.deleteTask(id))}>
              <Trash2 size={14} /> Delete task
            </MenuItem>
          </Popover>
          <button onClick={() => s.openTask(null)} className="hover-surface text-muted rounded-md p-1.5" aria-label="Close">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Main column */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 scroll-thin sm:px-10">
          <div className="text-muted mb-2 flex items-center gap-2 text-xs">
            <CircleDot size={13} /> Task
          </div>
          <textarea
            value={task.title}
            onChange={(e) => up({ title: e.target.value.replace(/\n/g, '') })}
            rows={1}
            className="w-full resize-none bg-transparent text-2xl font-bold tracking-tight outline-none [field-sizing:content]"
          />

          {openBlockers.length > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600 dark:bg-red-500/10 dark:text-red-300">
              <Ban size={13} /> Blocked by {openBlockers.map((b) => b.title).join(', ')}
            </div>
          )}
          <div className="mt-4 grid grid-cols-1 gap-x-8 md:grid-cols-2">
            <Field icon={CircleDot} label="Status">
              <div className="flex items-center gap-1">
                {space && (
                  <StatusMenu statuses={space.statuses} value={task.statusId} onChange={(v) => up({ statusId: v })} className="rounded text-xs font-semibold uppercase text-white">
                    <span className="inline-flex items-center gap-1.5 rounded px-2 py-1 whitespace-nowrap" style={{ background: status?.color }}>
                      {status?.name}
                    </span>
                  </StatusMenu>
                )}
                <button onClick={nextStatus} title="Next status" className="border-app hover-surface rounded border p-1">
                  <ChevronRight size={13} />
                </button>
                {doneStatus && !isDone && (
                  <button onClick={() => up({ statusId: doneStatus.id })} title="Mark complete" className="border-app hover-surface rounded border p-1">
                    <Check size={13} />
                  </button>
                )}
              </div>
            </Field>
            <Field icon={Users} label="Assignees">
              <AssigneeMenu value={task.assignees} onChange={(v) => up({ assignees: v })} size={26} />
            </Field>
            <Field icon={CalendarDays} label="Dates">
              <span className="inline-flex items-center gap-1">
                <DateButton value={task.startDate} onChange={(v) => up({ startDate: v })} placeholder="Start" />
                <span className="text-faint">→</span>
                <DateButton value={task.dueDate} onChange={(v) => up({ dueDate: v })} done={isDone} placeholder="Due" />
              </span>
            </Field>
            <Field icon={Flag} label="Priority">
              <PriorityMenu value={task.priority} onChange={(v) => up({ priority: v })} showLabel />
            </Field>
            <Field icon={Hourglass} label="Time estimate">
              <span className="inline-flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={task.estimate ?? ''}
                  placeholder="Empty"
                  onChange={(e) => up({ estimate: e.target.value === '' ? null : Number(e.target.value) })}
                  className="hover-surface w-16 rounded bg-transparent px-1 py-0.5 outline-none"
                />
                {task.estimate != null && <span className="text-muted">h</span>}
              </span>
            </Field>
            <Field icon={Eye} label="Watchers">
              <span className="flex items-center gap-2">
                <AssigneeMenu value={task.watchers} onChange={(v) => up({ watchers: v })} size={24} />
                <button onClick={() => s.toggleWatcher(task.id, me.id)} className="hover-surface text-muted rounded px-1.5 py-0.5 text-xs">
                  {task.watchers.includes(me.id) ? 'Unwatch' : 'Watch'}
                </button>
              </span>
            </Field>
            <Field icon={BellRing} label="Reminder">
              <ReminderButton taskId={task.id} title={task.title} />
            </Field>
            <Field icon={Zap} label="Sprint">
              <select
                value={task.sprintId ?? ''}
                onChange={(e) => up({ sprintId: e.target.value || null })}
                className="hover-surface max-w-full rounded bg-transparent px-1 py-0.5 outline-none"
                aria-label="Sprint"
              >
                <option value="">No sprint</option>
                {s.sprints
                  .filter((sp) => sp.spaceId === space?.id && (sp.status !== 'done' || sp.id === task.sprintId))
                  .map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                      {sp.status === 'active' ? ' (active)' : ''}
                    </option>
                  ))}
              </select>
            </Field>
            <Field icon={Gauge} label="Story points">
              <input
                type="number"
                min={0}
                value={task.points ?? ''}
                placeholder="Empty"
                onChange={(e) => up({ points: e.target.value === '' ? null : Number(e.target.value) })}
                className="hover-surface w-16 rounded bg-transparent px-1 py-0.5 outline-none"
              />
            </Field>
            <Field icon={Repeat} label="Repeat">
              <RecurrenceSelect task={task} />
            </Field>
            <Field icon={Timer} label="Track time">
              <TimerButton taskId={task.id} size="sm" />
            </Field>
            <Field icon={TagIcon} label="Tags">
              <div className="flex flex-wrap items-center gap-1">
                {task.tags.map((t) => (
                  <Tag key={t} name={t} onRemove={() => up({ tags: task.tags.filter((x) => x !== t) })} />
                ))}
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      const t = tagInput.trim().toLowerCase()
                      if (!task.tags.includes(t)) up({ tags: [...task.tags, t] })
                      setTagInput('')
                    }
                  }}
                  placeholder="Add tag"
                  className="w-20 bg-transparent px-1 py-0.5 outline-none"
                />
              </div>
            </Field>
          </div>

          <div className="mt-6">
            <RichText sourceId={task.id} value={task.description} onChange={(html) => up({ description: html })} />
          </div>

          {/* Subtasks */}
          {!task.parentId && (
            <section className="mt-8">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                Subtasks <span className="text-faint font-normal">{subtasks.filter((t) => r.isDone(t)).length}/{subtasks.length}</span>
              </h3>
              <div className="border-app divide-y divide-[var(--border)] rounded-lg border">
                {subtasks.map((st) => (
                  <div key={st.id} className="hover-surface flex items-center gap-2 px-3 py-2 text-sm">
                    {space && (
                      <StatusMenu statuses={space.statuses} value={st.statusId} onChange={(v) => s.updateTask(st.id, { statusId: v })}>
                        <StatusDot status={r.statusOf(st)} />
                      </StatusMenu>
                    )}
                    <button onClick={() => s.openTask(st.id)} className={cn('min-w-0 flex-1 truncate text-left', r.isDone(st) && 'text-faint line-through')}>
                      {st.title}
                    </button>
                    <AssigneeMenu value={st.assignees} onChange={(v) => s.updateTask(st.id, { assignees: v })} size={22} />
                    <DateButton value={st.dueDate} onChange={(v) => s.updateTask(st.id, { dueDate: v })} done={r.isDone(st)} />
                  </div>
                ))}
                <form
                  className="flex items-center gap-2 px-3 py-2 text-sm"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!newSub.trim()) return
                    s.addTask({ listId: task.listId, parentId: task.id, title: newSub.trim() })
                    setNewSub('')
                  }}
                >
                  <Plus size={15} className="text-faint" />
                  <input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Add subtask" className="flex-1 bg-transparent outline-none" />
                </form>
              </div>
            </section>
          )}

          {/* Checklist */}
          <section className="mt-8">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <ListChecks size={16} /> Checklist <span className="text-faint font-normal">{task.checklist.filter((c) => c.done).length}/{task.checklist.length}</span>
            </h3>
            {task.checklist.length > 0 && (
              <div className="surface-muted mb-2 h-1.5 overflow-hidden rounded-full">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(task.checklist.filter((c) => c.done).length / task.checklist.length) * 100}%` }} />
              </div>
            )}
            {task.checklist.map((c) => (
              <label key={c.id} className="group hover-surface flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={c.done}
                  onChange={() => up({ checklist: task.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })}
                  className="accent-brand-600 h-4 w-4"
                />
                <span className={cn('flex-1', c.done && 'text-faint line-through')}>{c.text}</span>
                <button
                  type="button"
                  onClick={(e) => (e.preventDefault(), up({ checklist: task.checklist.filter((x) => x.id !== c.id) }))}
                  className="text-faint hidden group-hover:block"
                  aria-label="Remove item"
                >
                  <X size={14} />
                </button>
              </label>
            ))}
            <form
              className="flex items-center gap-2 px-2 py-1.5 text-sm"
              onSubmit={(e) => {
                e.preventDefault()
                if (!newCheck.trim()) return
                up({ checklist: [...task.checklist, { id: uid('c'), text: newCheck.trim(), done: false }] })
                setNewCheck('')
              }}
            >
              <Plus size={15} className="text-faint" />
              <input value={newCheck} onChange={(e) => setNewCheck(e.target.value)} placeholder="Add checklist item" className="flex-1 bg-transparent outline-none" />
            </form>
          </section>

          <section className="mt-8">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Film size={16} /> Clips <span className="text-faint font-normal">{task.clipIds.length}</span>
              </h3>
              <button onClick={() => useRecorder.getState().open({ taskId: task.id })} className="text-muted hover-surface ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs">
                <RecordIcon size={11} className="fill-red-500 text-red-500" /> Record clip
              </button>
            </div>
            {task.clipIds.length === 0 ? (
              <p className="text-faint text-xs">Record your screen or camera to explain this task.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {task.clipIds.map((cid) => (
                  <ClipPlayer key={cid} clipId={cid} />
                ))}
              </div>
            )}
          </section>

          <CustomFieldsSection task={task} />
          {!task.parentId && <DependenciesSection task={task} />}
          {!task.parentId && <GitHubSection task={task} />}
          <TimeSection task={task} />
        </div>

        {/* Activity column */}
        <aside className="surface-subtle border-app flex min-h-[300px] flex-col border-t lg:w-[380px] lg:border-t-0 lg:border-l">
          <div className="border-app flex h-11 items-center border-b px-4 text-sm font-semibold">Activity</div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 scroll-thin">
            {feed.map((f) =>
              f.type === 'comment' ? (
                <div key={f.id} className="surface border-app rounded-lg border p-3 text-sm">
                  <div className="mb-1 flex items-center gap-2">
                    {f.userId === BOT ? (
                      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-amber-400 text-white">
                        <Zap size={12} />
                      </span>
                    ) : (
                      <Avatar userId={f.userId} size={22} />
                    )}
                    <span className="font-semibold">{f.userId === BOT ? 'Automation' : s.users.find((u) => u.id === f.userId)?.name}</span>
                    <span className="text-faint ml-auto text-xs">{timeAgo(f.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap">
                    <MentionText text={f.text} />
                  </p>
                  {f.assignee && (
                    <div className={cn('mt-2 flex items-center gap-2 rounded-md px-2 py-1 text-xs', f.resolved ? 'surface-muted text-muted' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300')}>
                      <Avatar userId={f.assignee} size={16} />
                      {f.resolved ? 'Resolved' : `Assigned to ${s.users.find((u) => u.id === f.assignee)?.name.split(' ')[0]}`}
                      <button onClick={() => s.updateComment(f.id, { resolved: !f.resolved })} className="ml-auto font-semibold hover:underline">
                        {f.resolved ? 'Reopen' : 'Resolve'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div key={f.id} className="text-muted flex items-start gap-2 text-xs">
                  <Clock size={12} className="mt-0.5 shrink-0" />
                  <span>
                    <b className="text-app font-medium">{f.userId === me.id ? 'You' : f.userId === BOT ? 'Automation' : s.users.find((u) => u.id === f.userId)?.name}</b> {f.text}
                    <span className="text-faint"> · {timeAgo(f.createdAt)}</span>
                  </span>
                </div>
              ),
            )}
          </div>
          <form
            className="border-app relative border-t p-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!comment.trim()) return
              s.addComment(id, comment.trim(), assignComment || null)
              setComment('')
              setAssignComment('')
            }}
          >
            {mentionMatches.length > 0 && (
              <div className="surface shadow-pop absolute bottom-full left-3 mb-1 w-60 rounded-lg p-1 text-sm">
                {mentionMatches.map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setComment(comment.replace(/@([\w]*)$/, `@${u.name} `))
                    }}
                    className="hover-surface flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left"
                  >
                    <Avatar userId={u.id} size={20} /> {u.name}
                  </button>
                ))}
              </div>
            )}
            <div className="surface border-app focus-within:border-brand-500 rounded-lg border p-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit()
                }}
                rows={2}
                placeholder="Write a comment… type @ to mention"
                className="w-full resize-none bg-transparent text-sm outline-none"
              />
              <div className="flex items-center gap-2">
                <select value={assignComment} onChange={(e) => setAssignComment(e.target.value)} className="text-muted surface rounded border border-[var(--border)] px-1 py-0.5 text-xs" aria-label="Assign comment">
                  <option value="">Don’t assign</option>
                  {s.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      Assign to {u.name.split(' ')[0]}
                    </option>
                  ))}
                </select>
                <button disabled={!comment.trim()} className="bg-brand-600 ml-auto rounded-md p-1.5 text-white disabled:opacity-40" aria-label="Send comment">
                  <ArrowUp size={15} />
                </button>
              </div>
            </div>
          </form>
        </aside>
      </div>
    </>
  )
}

/** Comment text with @Full Name mentions highlighted. */
function MentionText({ text }: { text: string }) {
  const users = useStore((st) => st.users)
  const names = users.map((u) => u.name).sort((a, b) => b.length - a.length)
  if (!names.length) return <>{text}</>
  const re = new RegExp(`@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  const out: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    out.push(text.slice(last, m.index))
    out.push(
      <span key={m.index} className="bg-brand-50 text-brand-700 dark:bg-brand-600/25 dark:text-brand-100 rounded px-0.5 font-medium">
        @{m[1]}
      </span>,
    )
    last = (m.index ?? 0) + m[0].length
  }
  out.push(text.slice(last))
  return <>{out}</>
}

function ReminderButton({ taskId, title }: { taskId: string; title: string }) {
  const { reminders, addReminder, deleteReminder } = useStore()
  const pop = usePopover()
  const [custom, setCustom] = useState('')
  const existing = reminders.filter((r) => r.taskId === taskId && !r.done)
  const at = (h: number, dayOffset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + dayOffset)
    d.setHours(h, 0, 0, 0)
    return d.toISOString()
  }
  const presets = [
    { label: 'In 1 hour', due: new Date(Date.now() + 3600e3).toISOString() },
    { label: 'Tomorrow 9:00', due: at(9, 1) },
    { label: 'Next Monday 9:00', due: at(9, ((8 - new Date().getDay()) % 7) || 7) },
  ]
  return (
    <>
      <button onClick={pop.toggle} className={cn('hover-surface rounded px-1 py-0.5', !existing.length && 'text-faint')}>
        {existing.length ? `${new Date(existing[0].due).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}${existing.length > 1 ? ` +${existing.length - 1}` : ''}` : 'Remind me'}
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={240}>
        {presets.map((p) => (
          <MenuItem key={p.label} onClick={() => (addReminder({ text: title, due: p.due, taskId }), pop.close())}>
            {p.label}
          </MenuItem>
        ))}
        <form
          className="flex gap-1 p-1"
          onSubmit={(e) => {
            e.preventDefault()
            if (!custom) return
            addReminder({ text: title, due: new Date(custom).toISOString(), taskId })
            setCustom('')
            pop.close()
          }}
        >
          <input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} className="border-app min-w-0 flex-1 rounded border bg-transparent px-1 text-xs" aria-label="Custom reminder time" />
          <button className="bg-brand-600 rounded px-2 text-xs text-white">Set</button>
        </form>
        {existing.length > 0 && <div className="border-app my-1 border-t" />}
        {existing.map((r) => (
          <MenuItem key={r.id} onClick={() => deleteReminder(r.id)}>
            <X size={13} /> Remove {new Date(r.due).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </MenuItem>
        ))}
      </Popover>
    </>
  )
}
