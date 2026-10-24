import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, Check, ClipboardList, Copy, ExternalLink, Plus, Search, Star, Trash2 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { Form, FormField, FormFieldKind, FormFieldTarget } from '../../store/types'
import { Avatar } from '../components/ui'
import FormView from '../forms/FormView'
import { SPACE_COLORS, cn, timeAgo, uid } from '../../lib/utils'
import { useQueryState } from '../../lib/useQueryState'

const KINDS: { kind: FormFieldKind; label: string }[] = [
  { kind: 'short', label: 'Short text' },
  { kind: 'long', label: 'Paragraph' },
  { kind: 'email', label: 'Email' },
  { kind: 'number', label: 'Number' },
  { kind: 'date', label: 'Date' },
  { kind: 'select', label: 'Dropdown' },
  { kind: 'priority', label: 'Priority' },
]

export function formLink(id: string) {
  return `${location.origin}/form/${id}`
}

export default function FormsPage() {
  const { formId } = useParams()
  const form = useStore((s) => s.forms.find((f) => f.id === formId))
  if (formId && !form) return <Navigate to="/app/forms" replace />
  return form ? <FormBuilder key={form.id} form={form} /> : <FormsIndex />
}

const viewed = {
  all: (): Record<string, string> => {
    try {
      return JSON.parse(localStorage.getItem('ms.forms.viewed') ?? '{}')
    } catch {
      return {}
    }
  },
  mark: (id: string) => {
    try {
      localStorage.setItem('ms.forms.viewed', JSON.stringify({ ...viewed.all(), [id]: new Date().toISOString() }))
    } catch {
      /* storage blocked */
    }
  },
}

type FormSort = 'viewed' | 'name' | 'responses' | 'created'

function FormsIndex() {
  const { forms, lists, spaces, favorites, addForm, updateForm, toggleFavorite } = useStore()
  const nav = useNavigate()
  const [filter] = useQueryState<'all' | 'active' | 'closed' | 'favorites'>('in', 'all')
  const [listId, setListId] = useState(lists[0]?.id ?? '')
  const [copied, setCopied] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<FormSort>('viewed')
  const seen = useMemo(() => viewed.all(), [])
  const where = (f: Form) => {
    const l = lists.find((x) => x.id === f.listId)
    return l ? `${spaces.find((sp) => sp.id === l.spaceId)?.name ?? ''} / ${l.name}` : 'Deleted List'
  }
  const shown = forms
    .filter((f) => (filter === 'active' ? f.active : filter === 'closed' ? !f.active : filter === 'favorites' ? favorites.includes(f.id) : true))
    .filter((f) => f.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) =>
      sort === 'name' ? a.title.localeCompare(b.title) : sort === 'responses' ? b.submissions - a.submissions : sort === 'created' ? b.createdAt.localeCompare(a.createdAt) : (seen[b.id] ?? b.createdAt).localeCompare(seen[a.id] ?? a.createdAt),
    )
  const head = (key: FormSort | null, label: string) =>
    key ? (
      <button onClick={() => setSort(key)} className={cn('text-left hover:text-[var(--text)]', sort === key && 'text-brand-600')}>
        {label}
        {sort === key && ' ↓'}
      </button>
    ) : (
      <span>{label}</span>
    )
  const cols = 'grid-cols-[minmax(200px,1fr)_170px_90px_110px_90px_90px_96px]'
  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <ClipboardList size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">{filter === 'active' ? 'Active forms' : filter === 'closed' ? 'Closed forms' : filter === 'favorites' ? 'Favorite forms' : 'Forms'}</h1>
          <span className="text-muted text-sm">Every response becomes a task.</span>
          <div className="ml-auto flex items-center gap-2">
            <select value={listId} onChange={(e) => setListId(e.target.value)} className="border-app surface h-8 rounded-md border px-2 text-sm" aria-label="List for new form">
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button disabled={!listId} onClick={() => nav(`/app/forms/${addForm(listId)}`)} className="bg-brand-600 hover:bg-brand-700 inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-semibold text-white disabled:opacity-40">
              <Plus size={15} /> New form
            </button>
          </div>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-faint text-xs">
            {shown.length} form{shown.length === 1 ? '' : 's'} · {shown.reduce((n, f) => n + f.submissions, 0)} responses
          </span>
          <div className="border-app ml-auto flex h-8 items-center gap-2 rounded-md border px-2">
            <Search size={14} className="text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search forms" className="w-44 bg-transparent text-sm outline-none" />
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="text-muted border-app rounded-xl border border-dashed p-10 text-center text-sm">{forms.length ? 'No forms match.' : 'No forms yet. Create one to collect bug reports, requests or intake from anyone.'}</p>
        ) : (
          <div className="border-app overflow-x-auto rounded-xl border">
            <div className="min-w-[960px]">
              <div className={cn('text-faint border-app grid gap-2 border-b px-4 py-2 text-xs font-medium', cols)}>
                {head('name', 'Name')}
                {head(null, 'Location')}
                {head('responses', 'Responses')}
                {head(null, 'Status')}
                {head('created', 'Created')}
                {head('viewed', 'Viewed')}
                <span />
              </div>
              {shown.map((f) => (
                <div key={f.id} className={cn('border-app hover-surface group grid items-center gap-2 border-b px-4 py-2 text-sm last:border-b-0', cols)}>
                  <Link to={`/app/forms/${f.id}`} className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.color }} />
                    <span className="truncate font-medium hover:underline">{f.title}</span>
                    <span className="text-faint shrink-0 text-xs">{f.fields.length} questions</span>
                  </Link>
                  <span className="text-muted truncate text-xs" title={where(f)}>
                    {where(f)}
                  </span>
                  <span className="text-xs font-semibold tabular-nums">{f.submissions}</span>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={f.active} onChange={(e) => updateForm(f.id, { active: e.target.checked })} className="accent-brand-600" aria-label={`Accepting responses for ${f.title}`} />
                    <span className={f.active ? 'text-emerald-600' : 'text-faint'}>{f.active ? 'Active' : 'Closed'}</span>
                  </label>
                  <span className="text-muted text-xs">{timeAgo(f.createdAt)}</span>
                  <span className="text-muted text-xs">{seen[f.id] ? timeAgo(seen[f.id]) : '—'}</span>
                  <span className="flex items-center justify-end gap-1">
                    <button onClick={() => toggleFavorite(f.id)} aria-label="Toggle favorite" className="p-0.5">
                      <Star size={14} className={favorites.includes(f.id) ? 'fill-amber-400 text-amber-400' : 'text-faint opacity-0 group-hover:opacity-100'} />
                    </button>
                    <button
                      onClick={() => {
                        void navigator.clipboard?.writeText(formLink(f.id))
                        setCopied(f.id)
                        setTimeout(() => setCopied(null), 1200)
                      }}
                      className="text-faint hover:text-app rounded p-0.5"
                      title="Copy link"
                      aria-label={`Copy link to ${f.title}`}
                    >
                      {copied === f.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                    <a href={`/form/${f.id}`} target="_blank" rel="noreferrer" className="text-faint hover:text-app rounded p-0.5" title="Open form" aria-label={`Open ${f.title}`}>
                      <ExternalLink size={14} />
                    </a>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FormBuilder({ form }: { form: Form }) {
  const { updateForm, deleteForm, lists, fields: customFields, users } = useStore()
  const nav = useNavigate()
  const listFields = customFields.filter((cf) => cf.listId === form.listId)
  const up = (patch: Partial<Form>) => updateForm(form.id, patch)
  useEffect(() => viewed.mark(form.id), [form.id])
  const setField = (id: string, patch: Partial<FormField>) => up({ fields: form.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) })
  const move = (i: number, d: -1 | 1) => {
    const next = [...form.fields]
    const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    up({ fields: next })
  }
  const targets: { value: FormFieldTarget; label: string }[] = [
    { value: 'title', label: 'Task name' },
    { value: 'description', label: 'Description' },
    { value: 'dueDate', label: 'Due date' },
    { value: 'priority', label: 'Priority' },
    ...listFields.map((cf) => ({ value: `custom:${cf.id}` as FormFieldTarget, label: `Field: ${cf.name}` })),
    { value: 'none', label: 'Add to description' },
  ]
  const input = 'border-app surface w-full rounded-md border px-2 py-1.5 text-sm outline-none focus:border-brand-500'
  const hasTitle = form.fields.some((f) => f.target === 'title')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-app flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Link to="/app/forms" className="hover-surface text-muted rounded p-1.5" aria-label="All forms">
          <ArrowLeft size={16} />
        </Link>
        <span className="truncate font-semibold">{form.title}</span>
        <span className="text-faint text-xs">{form.submissions} responses</span>
        <a href={`/form/${form.id}`} target="_blank" rel="noreferrer" className="border-app hover-surface ml-auto flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs">
          <ExternalLink size={13} /> Open form
        </a>
        <button onClick={() => confirm('Delete this form?') && (deleteForm(form.id), nav('/app/forms'))} className="hover-surface rounded p-1.5 text-red-500" aria-label="Delete form">
          <Trash2 size={15} />
        </button>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        <div className="border-app min-h-0 space-y-5 overflow-y-auto border-r p-4 scroll-thin sm:p-6">
          <section className="space-y-2">
            <input value={form.title} onChange={(e) => up({ title: e.target.value })} className={cn(input, 'text-base font-semibold')} placeholder="Form title" />
            <textarea value={form.description} onChange={(e) => up({ description: e.target.value })} rows={2} className={cn(input, 'resize-none')} placeholder="Description shown at the top" />
            <div className="flex items-center gap-1.5">
              {SPACE_COLORS.map((c) => (
                <button key={c} onClick={() => up({ color: c })} className={cn('h-5 w-5 rounded-full', form.color === c && 'ring-2 ring-offset-2 ring-offset-[var(--bg)]')} style={{ background: c, ['--tw-ring-color' as string]: c }} aria-label={`Color ${c}`} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Questions</h2>
            {!hasTitle && <p className="mb-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">No question maps to “Task name” — tasks will be titled “{form.title} response”.</p>}
            <div className="space-y-2">
              {form.fields.map((f, i) => (
                <div key={f.id} className="border-app surface-subtle space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <input value={f.label} onChange={(e) => setField(f.id, { label: e.target.value })} className={cn(input, 'font-medium')} placeholder="Question" />
                    <button onClick={() => move(i, -1)} className="hover-surface text-muted rounded p-1" aria-label="Move up">
                      <ArrowUp size={14} />
                    </button>
                    <button onClick={() => move(i, 1)} className="hover-surface text-muted rounded p-1" aria-label="Move down">
                      <ArrowDown size={14} />
                    </button>
                    <button onClick={() => up({ fields: form.fields.filter((x) => x.id !== f.id) })} className="hover-surface rounded p-1 text-red-500" aria-label="Remove question">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={f.kind} onChange={(e) => setField(f.id, { kind: e.target.value as FormFieldKind, ...(e.target.value === 'priority' ? { target: 'priority' } : e.target.value === 'date' ? { target: 'dueDate' } : {}) })} className={input} aria-label="Answer type">
                      {KINDS.map((k) => (
                        <option key={k.kind} value={k.kind}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                    <select value={f.target} onChange={(e) => setField(f.id, { target: e.target.value as FormFieldTarget })} className={input} aria-label="Maps to">
                      {targets.map((t) => (
                        <option key={t.value} value={t.value}>
                          → {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input value={f.help} onChange={(e) => setField(f.id, { help: e.target.value })} className={input} placeholder="Help text (optional)" />
                  {f.kind === 'select' && (
                    <input value={f.options.join(', ')} onChange={(e) => setField(f.id, { options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} className={input} placeholder="Options, comma separated" />
                  )}
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={f.required} onChange={(e) => setField(f.id, { required: e.target.checked })} className="accent-brand-600" /> Required
                  </label>
                </div>
              ))}
            </div>
            <button onClick={() => up({ fields: [...form.fields, { id: uid('ff'), label: '', kind: 'short', required: false, options: [], target: 'none', help: '' }] })} className="text-muted hover:text-app mt-2 flex items-center gap-1.5 text-sm">
              <Plus size={14} /> Add question
            </button>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Settings</h2>
            <label className="text-muted block text-xs">
              Create tasks in
              <select value={form.listId} onChange={(e) => up({ listId: e.target.value })} className={cn(input, 'mt-1')}>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <div className="text-muted mb-1 text-xs">Assign new tasks to</div>
              <div className="flex flex-wrap gap-1.5">
                {users.map((u) => {
                  const on = form.assignTo.includes(u.id)
                  return (
                    <button key={u.id} onClick={() => up({ assignTo: on ? form.assignTo.filter((a) => a !== u.id) : [...form.assignTo, u.id] })} className={cn('flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs', on ? 'border-brand-500' : 'border-app opacity-60')}>
                      <Avatar userId={u.id} size={18} /> {u.name.split(' ')[0]}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-muted text-xs">
                Button text
                <input value={form.submitText} onChange={(e) => up({ submitText: e.target.value })} className={cn(input, 'mt-1')} />
              </label>
              <label className="text-muted text-xs">
                Thank-you message
                <input value={form.thanksText} onChange={(e) => up({ thanksText: e.target.value })} className={cn(input, 'mt-1')} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => up({ active: e.target.checked })} className="accent-brand-600 h-4 w-4" /> Accepting responses
            </label>
            <p className="text-faint text-xs">Share link: {formLink(form.id)} — anyone with the link can respond, no sign-in needed.</p>
          </section>
        </div>
        <div className="min-h-0 overflow-y-auto bg-stone-100 p-4 scroll-thin sm:p-8 dark:bg-stone-900">
          <div className="text-faint mb-2 text-center text-xs font-semibold uppercase">Live preview</div>
          <div className="mx-auto max-w-xl">
            <FormView form={form} preview />
          </div>
        </div>
      </div>
    </div>
  )
}
