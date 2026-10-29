import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Loader2, Mail, Trash2 } from 'lucide-react'
import { api, API_BASE, ensureFreshToken } from '../../../api/client'
import { useStore } from '../../../store/useStore'
import { Modal } from '../../components/ui'

interface Contact {
  name: string
  email: string
  address?: string
}
interface TwoFactor {
  hasPassword: boolean
}

/** Your rights over your data (India's DPDP Act): a copy of it, deleting your account, and who to complain to. */
export default function PrivacyData() {
  const [contact, setContact] = useState<Contact | null>(null)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    api.raw<Contact>('GET', '/public/privacy/contact', { anonymous: true }).then(setContact, () => {})
  }, [])

  const download = async () => {
    setExporting(true)
    try {
      const token = await ensureFreshToken()
      const res = await fetch(`${API_BASE}/users/me/data/export`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error?.message ?? 'Export failed')
      const name = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'meetspace-data.json'
      const url = URL.createObjectURL(await res.blob())
      const a = Object.assign(document.createElement('a'), { href: url, download: name })
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      useStore.getState().toast(e instanceof Error ? e.message : 'Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <section className="border-app rounded-xl border p-4">
        <h2 className="font-semibold">Download your data</h2>
        <p className="text-muted mt-1 text-sm">A JSON file with your account, sessions, workspaces, the tasks, comments, messages and docs you wrote, your time entries, settings and security activity.</p>
        <button onClick={() => void download()} disabled={exporting} className="border-app hover-surface mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium disabled:opacity-60">
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {exporting ? 'Preparing…' : 'Download my data'}
        </button>
      </section>

      <section className="border-app rounded-xl border p-4">
        <h2 className="font-semibold">Questions or complaints</h2>
        <p className="text-muted mt-1 text-sm">
          Our Grievance Officer handles requests about your personal data, including correcting it or naming someone to act for you. Read the{' '}
          <Link to="/privacy" target="_blank" className="text-brand-600 underline">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link to="/terms" target="_blank" className="text-brand-600 underline">
            Terms
          </Link>
          .
        </p>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <Mail size={14} className="text-muted" />
          <span className="font-medium">{contact?.name || 'Grievance Officer'}</span>
          {contact?.email ? (
            <a href={`mailto:${contact.email}`} className="text-brand-600 underline">
              {contact.email}
            </a>
          ) : (
            <span className="text-faint">contact not set up yet</span>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-red-200 p-4 dark:border-red-500/30">
        <h2 className="font-semibold text-red-700 dark:text-red-400">Delete your account</h2>
        <ul className="text-muted mt-1 list-disc space-y-0.5 pl-5 text-sm">
          <li>Your name, email, password, sign-in methods, devices and personal settings are erased right away.</li>
          <li>Workspaces only you use are deleted. You leave the others; what you wrote there stays as “Deleted user”.</li>
          <li>If you’re the only owner of a shared workspace, make someone else an owner first.</li>
        </ul>
        <button onClick={() => setDeleting(true)} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700">
          <Trash2 size={14} /> Delete my account
        </button>
      </section>
      <DeleteAccount open={deleting} onClose={() => setDeleting(false)} />
    </div>
  )
}

function DeleteAccount({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useStore((s) => s.users.find((u) => u.id === s.currentUserId))
  const [hasPassword, setHasPassword] = useState(true)
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setPassword('')
    setEmail('')
    setError(null)
    api.raw<TwoFactor>('GET', '/users/me/2fa').then((t) => setHasPassword(t.hasPassword), () => {})
  }, [open])

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.raw('POST', '/users/me/delete', { body: hasPassword ? { password } : { email } })
      useStore.getState().logout()
      location.assign('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t delete your account')
      setBusy(false)
    }
  }
  const ready = hasPassword ? password.length > 0 : email.trim().toLowerCase() === me?.email?.toLowerCase()

  return (
    <Modal open={open} onClose={onClose} className="mt-[12vh] max-w-md">
      <form onSubmit={(e) => (e.preventDefault(), ready && void confirm())} className="p-5">
        <h2 className="text-lg font-semibold">Delete your account?</h2>
        <p className="text-muted mt-1 text-sm">This can’t be undone. You may want to download your data first.</p>
        {hasPassword ? (
          <label className="mt-4 block text-sm">
            <span className="text-muted text-xs">Enter your password to confirm</span>
            <input autoFocus type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="border-app surface mt-1 w-full rounded-lg border px-3 py-2 outline-none" />
          </label>
        ) : (
          <label className="mt-4 block text-sm">
            <span className="text-muted text-xs">
              Type <b className="text-app">{me?.email}</b> to confirm
            </span>
            <input autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="border-app surface mt-1 w-full rounded-lg border px-3 py-2 outline-none" />
          </label>
        )}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-muted hover:text-app rounded-lg px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button disabled={!ready || busy} className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {busy ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
