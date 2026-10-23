import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, MailCheck } from 'lucide-react'
import { AuthBackdrop } from './Signup'
import { api, ApiError } from '../api/client'

const card = 'w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-[0_20px_60px_-20px_rgba(15,23,42,.35)] ring-1 ring-stone-900/5'
const input = 'h-11 w-full rounded-xl border border-stone-300 px-3 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100'
const primary = 'mt-5 h-11 w-full rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-50'

/** Asks for an email and sends a reset link. The answer is the same whether or not the account exists. */
export function ForgotPasswordPage() {
  const loc = useLocation() as { state?: { email?: string } }
  const [email, setEmail] = useState(loc.state?.email ?? '')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('sending')
    setError(null)
    try {
      await api.raw('POST', '/auth/forgot-password', { body: { email: email.trim() }, anonymous: true })
      setState('sent')
    } catch (err) {
      setState('idle')
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    }
  }

  return (
    <AuthBackdrop>
      <div className={card}>
        {state === 'sent' ? (
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <MailCheck size={22} />
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Check your email</h1>
            <p className="mt-2 text-sm text-stone-600">
              If an account exists for <span className="font-medium text-stone-900">{email}</span>, we’ve sent a link to reset its password. It works for one hour.
            </p>
            <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-brand-600 hover:underline">
              Back to log in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h1 className="text-[26px] font-bold tracking-tight">Forgot your password?</h1>
            <p className="mt-1.5 text-sm text-stone-500">Enter your email and we’ll send you a link to choose a new one.</p>
            <label className="mt-6 block text-sm font-medium">Work email</label>
            <input autoFocus required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" className={`${input} mt-1.5`} />
            {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button disabled={state === 'sending'} className={primary}>
              {state === 'sending' ? 'Sending…' : 'Send reset link'}
            </button>
            <p className="mt-4 text-center text-sm text-stone-500">
              Remembered it?{' '}
              <Link to="/login" className="font-semibold text-brand-600 hover:underline">
                Log in
              </Link>
            </p>
          </form>
        )}
      </div>
    </AuthBackdrop>
  )
}

/** Opened from a reset or invite email: choose a password, then log in. */
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const invite = params.get('invite') === '1'
  const nav = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mismatch = confirm.length > 0 && confirm !== password

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mismatch) return
    setBusy(true)
    setError(null)
    try {
      await api.raw('POST', '/auth/reset-password', { body: { token, password }, anonymous: true })
      nav('/login', { replace: true, state: { notice: invite ? 'Your password is set. Log in to join your team.' : 'Your password was changed. Log in with your new password.' } })
    } catch (err) {
      const code = err instanceof ApiError ? err.code : ''
      setError(
        code === 'token_expired' || code === 'invalid_token' || code === 'token_revoked'
          ? 'This link has expired or was already used. Request a new one below.'
          : err instanceof Error
            ? err.message
            : 'Something went wrong',
      )
      setBusy(false)
    }
  }

  return (
    <AuthBackdrop>
      <div className={card}>
        {!token ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">This link is incomplete</h1>
            <p className="mt-2 text-sm text-stone-600">Open the link from your email again, or request a new one.</p>
            <Link to="/forgot-password" className="mt-6 inline-block text-sm font-semibold text-brand-600 hover:underline">
              Request a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h1 className="text-[26px] font-bold tracking-tight">{invite ? 'Set your password' : 'Choose a new password'}</h1>
            <p className="mt-1.5 text-sm text-stone-500">{invite ? 'You’ve been invited to Meetspace. Pick a password to finish setting up your account.' : 'Pick something you haven’t used here before.'}</p>
            <label className="mt-6 block text-sm font-medium">New password</label>
            <div className="mt-1.5 flex items-center rounded-xl border border-stone-300 pr-1 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
              <input autoFocus required minLength={8} type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" className="h-11 flex-1 bg-transparent px-3 outline-none" />
              <button type="button" onClick={() => setShow((x) => !x)} className="rounded-lg p-2 text-stone-400 hover:text-stone-700" aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <label className="mt-4 block text-sm font-medium">Confirm password</label>
            <input required type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={`${input} mt-1.5`} />
            {mismatch && <p className="mt-1.5 text-xs text-red-600">Passwords don’t match.</p>}
            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}{' '}
                {error.includes('expired') && (
                  <Link to="/forgot-password" className="font-semibold underline">
                    Get a new link
                  </Link>
                )}
              </p>
            )}
            <button disabled={busy || password.length < 8 || mismatch || !confirm} className={primary}>
              {busy ? 'Saving…' : invite ? 'Set password' : 'Change password'}
            </button>
          </form>
        )}
      </div>
    </AuthBackdrop>
  )
}
