import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, FileUp, Loader2, Upload } from 'lucide-react'
import { api } from '../../api/client'
import { useStore } from '../../store/useStore'
import type { User } from '../../store/types'
import { Avatar } from '../components/ui'
import { cn } from '../../lib/utils'
import { parseCSV } from './csv'
import { CSV_FIELDS, SOURCES, genericCSV, guessMapping, parseSource, type CsvField, type Parsed, type Source } from './sources'

interface Result {
  spaceId: string
  lists: number
  tasks: number
  subtasks: number
  skipped: string[]
}

const NONE = ''

/** Match a name, email or username from another tool to a workspace member. */
function matchPerson(raw: string, users: User[]): string {
  const r = raw.trim().toLowerCase()
  const byEmail = users.find((u) => u.email.toLowerCase() === r)
  if (byEmail) return byEmail.id
  const byName = users.find((u) => u.name.toLowerCase() === r)
  if (byName) return byName.id
  const first = users.filter((u) => u.name.split(' ')[0].toLowerCase() === r.split(/[ @.]/)[0])
  return first.length === 1 ? first[0].id : NONE
}

/** Bring a project over from ClickUp, Jira, Trello, Asana or any CSV. */
export default function Importer() {
  const s = useStore()
  const nav = useNavigate()
  const [source, setSource] = useState<Source | null>(null)
  const [fileName, setFileName] = useState('')
  const [csvRows, setCsvRows] = useState<string[][] | null>(null)
  const [mapping, setMapping] = useState<Partial<Record<CsvField, number>>>({})
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [target, setTarget] = useState<'new' | string>('new')
  const [spaceName, setSpaceName] = useState('')
  const [people, setPeople] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const meta = SOURCES.find((x) => x.id === source)
  const members = useMemo(() => {
    const ws = s.workspaces.find((w) => w.id === s.currentWorkspaceId)
    const ids = new Set(ws?.members.filter((m) => !m.invited).map((m) => m.userId))
    return s.users.filter((u) => ids.has(u.id))
  }, [s.workspaces, s.currentWorkspaceId, s.users])

  // For "Any CSV" the parse waits for the column mapping.
  const view: Parsed | null = source === 'csv' && csvRows ? genericCSV(csvRows, mapping) : parsed
  const all = view?.lists.flatMap((l) => l.tasks) ?? []
  const rawPeople = [...new Set(all.flatMap((t) => t.people))].sort()
  const order = { open: 0, active: 1, done: 2, closed: 3 }
  const statuses = [...new Map(all.filter((t) => t.status).map((t) => [t.status.toLowerCase(), t])).values()].sort((a, b) => order[a.statusType] - order[b.statusType])

  const reset = () => {
    setSource(null)
    setParsed(null)
    setCsvRows(null)
    setError(null)
    setResult(null)
    setFileName('')
  }

  const load = async (file: File) => {
    setError(null)
    setParsed(null)
    setCsvRows(null)
    setFileName(file.name)
    if (file.size > 25 * 1024 * 1024) return setError('That file is over 25 MB. Export a smaller project or split it.')
    const text = await file.text()
    try {
      let p: Parsed
      if (source === 'csv') {
        const rows = parseCSV(text)
        if (rows.length < 2) throw new Error('The file needs a header row and at least one task.')
        setCsvRows(rows)
        const m = guessMapping(rows[0])
        setMapping(m)
        p = genericCSV(rows, m)
      } else {
        p = parseSource(source!, text)
        setParsed(p)
      }
      if (!p.lists.length && source !== 'csv') throw new Error('No tasks found in that file.')
      setSpaceName(p.name)
      const names = [...new Set(p.lists.flatMap((l) => l.tasks.flatMap((t) => t.people)))]
      setPeople(Object.fromEntries(names.map((n) => [n, matchPerson(n, members)])))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t read that file.')
    }
  }

  const run = async () => {
    if (!view) return
    setBusy(true)
    setError(null)
    try {
      const body = {
        source,
        spaceId: target === 'new' ? '' : target,
        spaceName: spaceName.trim(),
        lists: view.lists.map((l) => ({
          name: l.name,
          tasks: l.tasks
            .filter((t) => t.title.trim())
            .map((t) => ({
              ref: t.ref,
              parentRef: t.parentRef,
              title: t.title.trim().slice(0, 500),
              description: t.description,
              status: t.status,
              statusType: t.statusType,
              priority: t.priority,
              assignees: [...new Set(t.people.map((p) => people[p]).filter(Boolean))],
              tags: t.tags.map((g) => g.toLowerCase().replace(/\s+/g, '-')).slice(0, 20),
              startDate: t.startDate,
              dueDate: t.dueDate,
              points: t.points,
              estimate: t.estimate,
              checklist: t.checklist.map((c) => ({ text: c.text.slice(0, 500), done: c.done })),
              issueType: t.issueType,
              epicRef: t.epicRef,
            })),
        })),
      }
      const r = await api.raw<Result>('POST', `/workspaces/${s.currentWorkspaceId}/import`, { body })
      // The new Space, Lists and tasks arrive over the realtime connection.
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The import failed.')
    } finally {
      setBusy(false)
    }
  }

  const sel = 'border-app surface h-8 rounded-md border px-2 text-sm'

  if (result)
    return (
      <section className="border-app rounded-xl border p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15">
            <Check size={18} />
          </span>
          <div className="flex-1">
            <h2 className="font-semibold">Import complete</h2>
            <p className="text-muted text-sm">
              {result.tasks} task{result.tasks === 1 ? '' : 's'}
              {result.subtasks > 0 && ` and ${result.subtasks} subtask${result.subtasks === 1 ? '' : 's'}`} in {result.lists} list{result.lists === 1 ? '' : 's'} from {meta?.name}.
            </p>
            {result.skipped.length > 0 && <p className="text-faint mt-1 text-xs">Skipped {result.skipped.length}: {[...new Set(result.skipped)].join(', ')}.</p>}
            <div className="mt-3 flex gap-2">
              <button onClick={() => nav(`/app/space/${result.spaceId}`)} className="bg-brand-600 hover:bg-brand-700 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white">
                Open the Space
              </button>
              <button onClick={reset} className="border-app hover-surface rounded-lg border px-3 py-1.5 text-sm font-medium">
                Import something else
              </button>
            </div>
          </div>
        </div>
      </section>
    )

  return (
    <section className="border-app rounded-xl border p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <FileUp size={16} /> Import
      </h2>
      {!source ? (
        <>
          <p className="text-muted mb-3 text-sm">Move a project over with its lists, statuses, assignees, dates, tags, subtasks and checklists.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {SOURCES.map((x) => (
              <button key={x.id} onClick={() => setSource(x.id)} className="border-app hover:border-brand-500 rounded-lg border p-3 text-left">
                <span className="block font-semibold">{x.name}</span>
                <span className="text-faint text-xs">{x.file} export</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <button onClick={reset} className="text-muted hover:text-app flex items-center gap-1 text-xs font-medium">
            <ArrowLeft size={13} /> Choose another tool
          </button>
          <div className="surface-muted rounded-lg px-3 py-2 text-sm">
            <b>{meta!.name}:</b> {meta!.how}
          </div>
          <label className="border-app hover:border-brand-500 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-4">
            <Upload size={18} className="text-brand-600" />
            <span className="flex-1 text-sm">{fileName ? <b>{fileName}</b> : `Choose your ${meta!.file} file`}</span>
            <input type="file" accept={meta!.file === '.json' ? '.json,application/json' : '.csv,text/csv'} className="sr-only" onChange={(e) => e.target.files?.[0] && void load(e.target.files[0])} />
            <span className="text-brand-600 text-sm font-medium">Browse</span>
          </label>

          {source === 'csv' && csvRows && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Which column is which?</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {CSV_FIELDS.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-sm">
                    <span className="w-28 shrink-0">{f.label}</span>
                    <select value={mapping[f.key] ?? -1} onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) < 0 ? undefined : Number(e.target.value) })} className={cn(sel, 'min-w-0 flex-1')}>
                      <option value={-1}>— not in file —</option>
                      {csvRows[0].map((h, i) => (
                        <option key={i} value={i}>
                          {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}

          {view && all.length > 0 && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Tasks" value={all.filter((t) => !t.parentRef).length} />
                <Stat label="Subtasks" value={all.filter((t) => t.parentRef).length} />
                <Stat label="Lists" value={view.lists.length} />
              </div>
              {view.warnings.map((w) => (
                <p key={w} className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle size={13} /> {w}
                </p>
              ))}

              <div>
                <h3 className="mb-2 text-sm font-semibold">Where should it go?</h3>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <select value={target} onChange={(e) => setTarget(e.target.value)} className={sel}>
                    <option value="new">A new Space</option>
                    {s.spaces.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        Existing: {sp.name}
                      </option>
                    ))}
                  </select>
                  {target === 'new' && <input value={spaceName} onChange={(e) => setSpaceName(e.target.value)} placeholder="Space name" className={cn(sel, 'min-w-48 flex-1')} aria-label="New Space name" />}
                </div>
                <p className="text-faint mt-1 text-xs">
                  {target === 'new' ? `The new Space gets ${meta!.name}’s own statuses: ${statuses.map((t) => t.status).join(', ') || 'To do, Complete'}.` : 'Statuses are matched by name, or else by kind (to do, in progress, done).'}
                </p>
              </div>

              {rawPeople.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Match people</h3>
                  <div className="border-app divide-y divide-[var(--border)] rounded-lg border">
                    {rawPeople.map((p) => (
                      <div key={p} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                        <span className="min-w-0 flex-1 truncate">{p}</span>
                        <span className="text-faint">→</span>
                        {people[p] && <Avatar userId={people[p]} size={20} />}
                        <select value={people[p] ?? NONE} onChange={(e) => setPeople({ ...people, [p]: e.target.value })} className={cn(sel, 'w-48')} aria-label={`Match ${p}`}>
                          <option value={NONE}>Leave unassigned</option>
                          {members.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <p className="text-faint mt-1 text-xs">Invite missing people first if you want their tasks assigned to them.</p>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold">Preview</h3>
                <div className="border-app overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[560px] text-xs">
                    <thead className="text-faint text-left">
                      <tr>
                        {['Task', 'List', 'Status', 'Priority', 'Due', 'People'].map((h) => (
                          <th key={h} className="px-2 py-1.5 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {view.lists
                        .flatMap((l) => l.tasks.map((t) => ({ l, t })))
                        .slice(0, 8)
                        .map(({ l, t }) => (
                          <tr key={l.name + t.ref} className="border-app border-t">
                            <td className="max-w-56 truncate px-2 py-1.5 font-medium">
                              {t.parentRef && <span className="text-faint">↳ </span>}
                              {t.title || <em className="text-faint">no name — skipped</em>}
                            </td>
                            <td className="text-muted max-w-32 truncate px-2 py-1.5">{l.name}</td>
                            <td className="px-2 py-1.5">{t.status || '—'}</td>
                            <td className="px-2 py-1.5 capitalize">{t.priority ?? '—'}</td>
                            <td className="px-2 py-1.5">{t.dueDate ?? '—'}</td>
                            <td className="text-muted max-w-32 truncate px-2 py-1.5">{t.people.join(', ') || '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button disabled={busy || (target === 'new' && !spaceName.trim()) || (source === 'csv' && mapping.title === undefined)} onClick={() => void run()} className="bg-brand-600 hover:bg-brand-700 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {busy && <Loader2 size={14} className="animate-spin" />}
                {busy ? 'Importing…' : `Import ${all.length} item${all.length === 1 ? '' : 's'}`}
              </button>
              {source === 'csv' && mapping.title === undefined && <p className="text-xs text-amber-700">Choose the column with the task name.</p>}
            </>
          )}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        </div>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-muted rounded-lg px-3 py-2">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-muted text-xs">{label}</div>
    </div>
  )
}
