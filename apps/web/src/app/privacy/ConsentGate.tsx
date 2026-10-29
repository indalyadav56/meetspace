import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { api } from '../../api/client'
import { useStore } from '../../store/useStore'
import { Modal } from '../components/ui'

interface Consent {
  version: string
  acceptedAt: string | null
  current: string
  required: boolean
}

/**
 * Asks anyone who hasn't accepted the current Privacy Policy and Terms (people
 * who signed in with Google, were invited, or joined before a policy change) to
 * accept them. The app stays usable underneath; the record is what matters.
 */
export function ConsentGate() {
  const me = useStore((s) => s.currentUserId)
  const logout = useStore((s) => s.logout)
  const [consent, setConsent] = useState<Consent | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!me) return
    api.raw<Consent>('GET', '/users/me/consent').then(setConsent, () => setConsent(null))
  }, [me])
  if (!consent?.required) return null

  const accept = async () => {
    setBusy(true)
    try {
      setConsent(await api.raw<Consent>('POST', '/users/me/consent', { body: { version: consent.current } }))
    } catch (e) {
      useStore.getState().toast(e instanceof Error ? e.message : 'Couldn’t save that — try again', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={() => {}} className="mt-[12vh] max-w-md">
      <div className="p-6">
        <span className="bg-brand-50 text-brand-600 dark:bg-brand-500/15 flex h-10 w-10 items-center justify-center rounded-xl">
          <ShieldCheck size={20} />
        </span>
        <h2 className="mt-4 text-lg font-semibold">{consent.version ? 'We’ve updated our policies' : 'Before you continue'}</h2>
        <p className="text-muted mt-1.5 text-sm">
          Please read and accept our{' '}
          <Link to="/terms" target="_blank" className="text-brand-600 underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy" target="_blank" className="text-brand-600 underline">
            Privacy Policy
          </Link>
          . They explain what data we keep, why, and how you can download or delete it.
        </p>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="accent-brand-600 mt-0.5" />
          <span>I’m 18 or older and I agree to the Terms of Service and Privacy Policy.</span>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={logout} className="text-muted hover:text-app rounded-lg px-3 py-1.5 text-sm">
            Sign out
          </button>
          <button disabled={!agreed || busy} onClick={() => void accept()} className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            Accept and continue
          </button>
        </div>
      </div>
    </Modal>
  )
}
