import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Logo } from '../app/components/ui'
import { useStore } from '../store/useStore'

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
  const isSignup = mode === 'signup'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (isSignup) await signUp(name.trim(), email.trim(), password)
      else await signIn(email.trim(), password)
      nav(loc.state?.from ?? '/app/home', { replace: true })
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
          <h1 className="text-3xl font-bold tracking-tight">{isSignup ? 'Create your workspace' : 'Welcome back'}</h1>
          <p className="mt-2 text-stone-600">{isSignup ? 'Free forever. No credit card needed.' : 'Log in to pick up where you left off.'}</p>
          {loc.state?.notice && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{loc.state.notice}</p>}
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
