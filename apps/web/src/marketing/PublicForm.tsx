import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import FormView from '../app/forms/FormView'
import { Logo } from '../app/components/ui'
import { api, ApiError } from '../api/client'
import type { Form } from '../store/types'

/** Shareable form page (no sign-in): loads the form from the public API and submits responses to it. */
export default function PublicForm() {
  const { formId = '' } = useParams()
  const [form, setForm] = useState<Form | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    let live = true
    api
      .raw<Form>('GET', `/public/forms/${formId}`, { anonymous: true })
      .then((f) => live && (setForm(f), setState('ready')))
      .catch(() => live && setState('missing'))
    return () => {
      live = false
    }
  }, [formId])

  const submit = async (values: Record<string, string>) => {
    try {
      await api.raw('POST', `/public/forms/${formId}/submit`, { body: { values }, anonymous: true })
      return null
    } catch (e) {
      return e instanceof ApiError ? e.message : 'Your response could not be sent. Try again.'
    }
  }

  return (
    <div className="min-h-full bg-stone-100 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-xl">
        {state === 'loading' && <div className="rounded-2xl bg-white p-10 text-center text-stone-500 shadow-xl">Loading form…</div>}
        {state === 'ready' && form && <FormView form={form} onSubmit={submit} />}
        {state === 'missing' && <div className="rounded-2xl bg-white p-10 text-center text-stone-700 shadow-xl">This form doesn’t exist or was deleted.</div>}
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-stone-500">
          Powered by <Logo size={16} />
        </p>
      </div>
    </div>
  )
}
