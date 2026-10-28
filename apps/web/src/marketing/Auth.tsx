import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Check, KeyRound, ShieldCheck } from 'lucide-react'
import { Logo } from '../app/components/ui'
import { useStore } from '../store/useStore'
import { api, type Tokens } from '../api/client'

const field = 'mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100'

/** Single sign-on buttons for whichever providers the server has configured. */
function SSOButtons({ redirect }: { redirect: string }) {
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    api.raw<{ id: string; name: string }[]>('GET', '/auth/providers', { anonymous: true }).then(setProviders, () => setProviders([]))
  }, [])
  if (!providers.length) return null
  return (
    <div className="mt-8 -mb-4 space-y-2">
      {providers.map((p) => (
        <a
          key={p.id}
          href={`/api/v1/auth/oauth/${p.id}/start?redirect=${encodeURIComponent(redirect)}`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 py-2.5 text-sm font-semibold hover:bg-stone-50"
        >
          {p.id === 'google' ? <GoogleMark /> : <KeyRound size={16} />} Continue with {p.name}
        </a>
      ))}
      <div className="flex items-center gap-3 py-2 text-xs text-stone-400">
        <span className="h-px flex-1 bg-stone-200" /> or with email <span className="h-px flex-1 bg-stone-200" />
      </div>
    </div>
  )
}

const GoogleMark = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.2-.1-2.3-.4-3.5z" />
  </svg>
)

/** Second step of sign-in when the account has two-factor authentication on. */
export function MfaStep({ mfaToken, onDone, onCancel }: { mfaToken: string; onDone: () => void; onCancel: () => void }) {
  const completeMfa = useStore((s) => s.completeMfa)
  const [code, setCode] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await completeMfa(mfaToken, code.trim())
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code didn’t work')
      setCode('')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div className="flex items-start gap-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
        <ShieldCheck size={18} className="mt-0.5 shrink-0" />
        {recovery ? 'Enter one of the recovery codes you saved when you turned on two-factor authentication.' : 'Open your authenticator app and enter the 6-digit code for Meetspace.'}
      </div>
      <label className="block">
        <span className="text-sm font-medium">{recovery ? 'Recovery code' : 'Authentication code'}</span>
        <input
          autoFocus
          required
          value={code}
          onChange={(e) => setCode(recovery ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode={recovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          placeholder={recovery ? 'XXXX-XXXX' : '123456'}
          className={`${field} text-center font-mono text-lg tracking-[0.3em]`}
        />
      </label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={busy || (!recovery && code.length !== 6)} className="w-full rounded-xl bg-stone-950 py-3 font-semibold text-white hover:bg-stone-800 disabled:opacity-60">
        {busy ? 'Checking…' : 'Verify and log in'}
      </button>
      <div className="flex justify-between text-sm">
        <button type="button" onClick={() => (setRecovery((v) => !v), setCode(''), setError(null))} className="font-medium text-brand-600 hover:underline">
          {recovery ? 'Use authenticator code' : 'Use a recovery code'}
        </button>
        <button type="button" onClick={onCancel} className="text-stone-500 hover:underline">
          Back
        </button>
      </div>
    </form>
  )
}

/** Sign in or create an account against the Meetspace API. */
function AuthShell({ mode }: { mode: 'login' | 'signup' }) {
  const { signIn, signUp } = useStore()
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string; notice?: string; email?: string } }
  const [name, setName] = useState('')
  const [email, setEmail] = useState(loc.state?.email ?? '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const isSignup = mode === 'signup'
  const next = loc.state?.from ?? '/app/home'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (isSignup) await signUp(name.trim(), email.trim(), password)
      else {
        const r = await signIn(email.trim(), password)
        if (r.mfaToken) return setMfaToken(r.mfaToken)
      }
      nav(next, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-full bg-white text-stone-950 lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/">
          <Logo size={28} />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-3xl font-bold tracking-tight">{mfaToken ? 'Two-factor authentication' : isSignup ? 'Create your workspace' : 'Welcome back'}</h1>
          <p className="mt-2 text-stone-600">{mfaToken ? 'One more step to keep your account safe.' : isSignup ? 'Free forever. No credit card needed.' : 'Log in to pick up where you left off.'}</p>
          {loc.state?.notice && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{loc.state.notice}</p>}
          {mfaToken ? (
            <MfaStep mfaToken={mfaToken} onDone={() => nav(next, { replace: true })} onCancel={() => (setMfaToken(null), setPassword(''))} />
          ) : (
          <>
          <SSOButtons redirect={next} />
          <form onSubmit={submit} className="mt-8 space-y-4">
            {isSignup && (
              <label className="block">
                <span className="text-sm font-medium">Full name</span>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Rivera" autoComplete="name" className="mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
              </label>
            )}
            <label className="block">
              <span className="text-sm font-medium">Work email</span>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" className="mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
            </label>
            <label className="block">
              <span className="flex items-center text-sm font-medium">
                Password
                {!isSignup && (
                  <Link to="/forgot-password" state={{ email }} className="ml-auto text-xs font-medium text-brand-600 hover:underline">
                    Forgot password?
                  </Link>
                )}
              </span>
              <input
                required
                type="password"
                minLength={isSignup ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignup ? 'At least 8 characters' : ''}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                className="mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button disabled={busy} className="w-full rounded-xl bg-stone-950 py-3 font-semibold text-white hover:bg-stone-800 disabled:opacity-60">
              {busy ? 'One moment…' : isSignup ? 'Create workspace' : 'Log in'}
            </button>
          </form>
          </>
          )}
          <p className="mt-6 text-sm text-stone-600">
            {isSignup ? 'Already have a workspace? ' : 'New to Meetspace? '}
            <Link to={isSignup ? '/login' : '/signup'} className="font-semibold text-brand-600 hover:underline">
              {isSignup ? 'Log in' : 'Sign up free'}
            </Link>
          </p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 p-12 text-white lg:flex lg:flex-col lg:justify-center">
        <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-white/10" />
        <h2 className="max-w-md text-4xl leading-tight font-bold tracking-tight">Everything your team is working on, in one lane.</h2>
        <ul className="mt-8 space-y-3 text-lg text-white/90">
          {['Lists, Boards, Calendar, Table & Gantt', 'Docs that live next to tasks', 'An Inbox that keeps you in the loop', 'Dashboards for the big picture'].map((x) => (
            <li key={x} className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                <Check size={14} />
              </span>
              {x}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export const LoginPage = () => <AuthShell mode="login" />

/** Where single sign-on lands: tokens (or a 2FA step, or an error) arrive in the URL fragment. */
export function AuthCallbackPage() {
  const nav = useNavigate()
  const signInWithTokens = useStore((s) => s.signInWithTokens)
  const [params] = useState(() => new URLSearchParams(window.location.hash.slice(1)))
  const [error, setError] = useState(params.get('error'))
  const mfa = params.get('mfa')
  const redirect = params.get('redirect')?.startsWith('/') && !params.get('redirect')?.startsWith('//') ? params.get('redirect')! : '/app/home'
  useEffect(() => {
    // Drop the tokens from the address bar and history straight away.
    history.replaceState(null, '', window.location.pathname)
    const access = params.get('access')
    const refresh = params.get('refresh')
    if (access && refresh) {
      signInWithTokens({ accessToken: access, refreshToken: refresh } as Tokens).then(
        () => nav(redirect, { replace: true }),
        (e) => setError(e instanceof Error ? e.message : 'Couldn’t finish signing in'),
      )
    }
  }, []) // runs once with the fragment captured at load
  return (
    <div className="flex min-h-full items-center justify-center bg-white px-6 text-stone-950">
      <div className="w-full max-w-sm">
        <Logo size={28} />
        {mfa && !error ? (
          <>
            <h1 className="mt-8 text-2xl font-bold">Two-factor authentication</h1>
            <MfaStep mfaToken={mfa} onDone={() => nav(redirect, { replace: true })} onCancel={() => nav('/login', { replace: true })} />
          </>
        ) : error ? (
          <>
            <h1 className="mt-8 text-2xl font-bold">Couldn’t sign you in</h1>
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            <Link to="/login" className="mt-6 inline-block font-semibold text-brand-600 hover:underline">
              Back to log in
            </Link>
          </>
        ) : (
          <p className="mt-8 text-stone-600">Signing you in…</p>
        )}
      </div>
    </div>
  )
}
