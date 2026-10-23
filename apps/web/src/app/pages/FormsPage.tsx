import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, Check, ClipboardList, Copy, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { Form, FormField, FormFieldKind, FormFieldTarget } from '../../store/types'
import { Avatar } from '../components/ui'
import FormView from '../forms/FormView'
import { SPACE_COLORS, cn, timeAgo, uid } from '../../lib/utils'

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

function FormsIndex() {
  const { forms, lists, addForm, updateForm } = useStore()
  const nav = useNavigate()
  const [listId, setListId] = useState(lists[0]?.id ?? '')
  const [copied, setCopied] = useState<string | null>(null)
  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <ClipboardList size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold">Forms</h1>
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
        {forms.length === 0 && <p className="text-muted border-app rounded-xl border border-dashed p-10 text-center text-sm">No forms yet. Create one to collect bug reports, requests or intake from anyone.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {forms.map((f) => (
            <div key={f.id} className="border-app overflow-hidden rounded-xl border">
              <div className="h-1.5" style={{ background: f.color }} />
              <div className="p-4">
                <Link to={`/app/forms/${f.id}`} className="block truncate font-semibold hover:underline">
                  {f.title}
                </Link>
                <div className="text-muted mt-0.5 text-xs">
                  Creates tasks in {lists.find((l) => l.id === f.listId)?.name ?? 'a deleted List'} · {f.fields.length} questions · created {timeAgo(f.createdAt)}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="surface-muted rounded-full px-2 py-0.5 font-semibold">{f.submissions} responses</span>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={f.active} onChange={(e) => updateForm(f.id, { active: e.target.checked })} className="accent-brand-600" /> Accepting responses
                  </label>
                  <button
                    onClick={() => {
                      void navigator.clipboard?.writeText(formLink(f.id))
                      setCopied(f.id)
                      setTimeout(() => setCopied(null), 1200)
                    }}
                    className="hover-surface text-muted ml-auto flex items-center gap-1 rounded px-1.5 py-0.5"
                  >
                    {copied === f.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />} Link
                  </button>
                  <a href={`/form/${f.id}`} target="_blank" rel="noreferrer" className="hover-surface text-muted flex items-center gap-1 rounded px-1.5 py-0.5">
                    <ExternalLink size={13} /> Open
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FormBuilder({ form }: { form: Form }) {
  const { updateForm, deleteForm, lists, fields: customFields, users } = useStore()
  const nav = useNavigate()
  const listFields = customFields.filter((cf) => cf.listId === form.listId)
  const up = (patch: Partial<Form>) => updateForm(form.id, patch)
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
            <p className="text-faint text-xs">Share link: {formLink(form.id)} — in this demo the link works in this browser, since data is stored locally.</p>
          </section>
        </div>
        <div className="min-h-0 overflow-y-auto bg-slate-100 p-4 scroll-thin sm:p-8 dark:bg-slate-900">
          <div className="text-faint mb-2 text-center text-xs font-semibold uppercase">Live preview</div>
          <div className="mx-auto max-w-xl">
            <FormView form={form} preview />
          </div>
        </div>
      </div>
    </div>
  )
}
