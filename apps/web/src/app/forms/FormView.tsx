import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { Form, FormField } from '../../store/types'
import { PRIORITIES, cn } from '../../lib/utils'

/** Renders a form for filling in; used by the builder preview and the shareable page. */
export default function FormView({ form, onSubmit, preview }: { form: Form; onSubmit?: (values: Record<string, string>) => Promise<string | null>; preview?: boolean }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const validate = () => {
    const e: Record<string, string> = {}
    for (const f of form.fields) {
      const v = (values[f.id] ?? '').trim()
      if (f.required && !v) e[f.id] = 'This field is required'
      else if (v && f.kind === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) e[f.id] = 'Enter a valid email address'
      else if (v && f.kind === 'number' && Number.isNaN(Number(v))) e[f.id] = 'Enter a number'
    }
    setErrors(e)
    return !Object.keys(e).length
  }

  const input = (f: FormField) => {
    const cls = cn('mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:ring-2', errors[f.id] ? 'border-red-400 focus:ring-red-100' : 'border-stone-300 focus:border-brand-500 focus:ring-brand-100')
    const v = values[f.id] ?? ''
    const set = (x: string) => setValues((s) => ({ ...s, [f.id]: x }))
    switch (f.kind) {
      case 'long':
        return <textarea rows={4} value={v} onChange={(e) => set(e.target.value)} className={cls} />
      case 'select':
        return (
          <select value={v} onChange={(e) => set(e.target.value)} className={cls}>
            <option value="">Choose…</option>
            {f.options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        )
      case 'priority':
        return (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {PRIORITIES.map((p) => (
              <button type="button" key={p.value} onClick={() => set(v === p.value ? '' : p.value)} className={cn('rounded-lg border px-3 py-1.5 text-sm', v === p.value ? 'border-transparent text-white' : 'border-stone-300 text-stone-700')} style={v === p.value ? { background: p.color } : undefined}>
                {p.label}
              </button>
            ))}
          </div>
        )
      default:
        return <input type={f.kind === 'short' ? 'text' : f.kind} value={v} onChange={(e) => set(e.target.value)} className={cls} />
    }
  }

  if (done)
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-10 text-center text-stone-900 shadow-xl">
        <CheckCircle2 size={44} style={{ color: form.color }} />
        <p className="text-lg font-semibold">{form.thanksText}</p>
        <button onClick={() => (setDone(false), setValues({}))} className="text-sm font-medium hover:underline" style={{ color: form.color }}>
          Submit another response
        </button>
      </div>
    )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (preview || !onSubmit || sending || !validate()) return
        setSending(true)
        setFailure(null)
        // onSubmit resolves to an error message, or null when the response was recorded.
        void onSubmit(values).then((err) => {
          setSending(false)
          if (err) setFailure(err)
          else setDone(true)
        })
      }}
      className="overflow-hidden rounded-2xl bg-white text-stone-900 shadow-xl"
    >
      <div className="h-2" style={{ background: form.color }} />
      <div className="space-y-5 p-6 sm:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{form.title || 'Untitled form'}</h1>
          {form.description && <p className="mt-2 text-sm whitespace-pre-wrap text-stone-600">{form.description}</p>}
        </div>
        {form.fields.map((f) => (
          <label key={f.id} className="block">
            <span className="text-sm font-semibold">
              {f.label || 'Untitled question'}
              {f.required && <span className="text-red-500"> *</span>}
            </span>
            {f.help && <span className="block text-xs text-stone-500">{f.help}</span>}
            {input(f)}
            {errors[f.id] && <span className="mt-1 block text-xs text-red-500">{errors[f.id]}</span>}
          </label>
        ))}
        {!form.active && !preview && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">This form isn’t accepting responses right now.</p>}
        {failure && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{failure}</p>}
        <button disabled={(!form.active && !preview) || sending} className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: form.color }}>
          {sending ? 'Sending…' : form.submitText || 'Submit'}
        </button>
      </div>
    </form>
  )
}
