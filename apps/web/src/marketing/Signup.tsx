import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Briefcase, Check, Eye, EyeOff, GraduationCap, Home, Mail, Plus, X } from 'lucide-react'
import { Logo } from '../app/components/ui'
import { useStore } from '../store/useStore'
import { LIST_TEMPLATES } from '../store/templates'
import { SPACE_COLORS, cn } from '../lib/utils'
import { ApiError } from '../api/client'

/*
 * Sign-up is a short wizard: email → name & password (the account is created
 * here) → a few onboarding questions → name the workspace → invite teammates.
 * The workspace, invites and starter Lists are created on the last step.
 */

type Step = 'email' | 'account' | 'use' | 'team' | 'manage' | 'workspace' | 'invite'
const ONBOARDING: Step[] = ['use', 'team', 'manage', 'workspace', 'invite']

const USES = [
  { key: 'work', label: 'Work', icon: Briefcase },
  { key: 'personal', label: 'Personal', icon: Home },
  { key: 'school', label: 'School', icon: GraduationCap },
]
const TEAM_SIZES = ['Just me', '2–5', '6–10', '11–25', '26–50', '51–200', '200+']
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default function SignupPage() {
  const nav = useNavigate()
  const { signUp, setupWorkspace } = useStore()
  const signedIn = useStore((s) => s.signedIn)
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [use, setUse] = useState('work')
  const [team, setTeam] = useState('')
  const [manage, setManage] = useState<string[]>([])
  const [wsName, setWsName] = useState('')
  const [wsColor, setWsColor] = useState(SPACE_COLORS[0])
  const [invites, setInvites] = useState<string[]>(['', ''])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Someone already signed in who lands here (not mid-wizard) goes to the app.
  const startedHere = useRef(false)
  useEffect(() => {
    if (signedIn && !startedHere.current) nav('/app/home', { replace: true })
  }, [signedIn, nav])

  const createAccount = async () => {
    setBusy(true)
    setError(null)
    try {
      startedHere.current = true
      await signUp(name.trim(), email.trim(), password)
      setWsName(`${name.trim().split(' ')[0]}’s Workspace`)
      setStep('use')
    } catch (e) {
      startedHere.current = false
      setError(e instanceof ApiError && e.code === 'email_exists' ? 'exists' : e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const finish = async (emails = invites) => {
    setBusy(true)
    setError(null)
    try {
      await setupWorkspace({ name: wsName.trim() || 'My Workspace', color: wsColor, invites: emails.map((x) => x.trim()).filter((x) => EMAIL_RE.test(x)), templates: manage })
      nav('/app/home', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t create your workspace')
      setBusy(false)
    }
  }

  if (step === 'email' || step === 'account')
    return (
      <AuthBackdrop>
        <div className="w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-[0_20px_60px_-20px_rgba(15,23,42,.35)] ring-1 ring-slate-900/5">
          {step === 'email' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (EMAIL_RE.test(email.trim())) setStep('account')
              }}
            >
              <h1 className="text-center text-[26px] font-bold tracking-tight">Create your account</h1>
              <p className="mt-1.5 text-center text-sm text-slate-500">Tasks, docs, chat and calls — one place for your team.</p>
              <label className="mt-7 block text-sm font-medium">Work email</label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-300 px-3 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100">
                <Mail size={16} className="text-slate-400" />
                <input autoFocus required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" className="h-11 flex-1 bg-transparent outline-none" />
              </div>
              <button disabled={!EMAIL_RE.test(email.trim())} className="mt-5 h-11 w-full rounded-xl bg-indigo-600 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                Continue
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void createAccount()
              }}
            >
              <button type="button" onClick={() => (setStep('email'), setError(null))} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
                <ArrowLeft size={15} /> Back
              </button>
              <h1 className="text-[26px] font-bold tracking-tight">Set up your profile</h1>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
                Signing up as <span className="font-medium text-slate-800">{email}</span>
              </p>
              <label className="mt-6 block text-sm font-medium">Full name</label>
              <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Rivera" autoComplete="name" className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100" />
              <label className="mt-4 block text-sm font-medium">Password</label>
              <div className="mt-1.5 flex items-center rounded-xl border border-slate-300 pr-1 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100">
                <input required minLength={8} type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" className="h-11 flex-1 bg-transparent px-3 outline-none" />
                <button type="button" onClick={() => setShowPw((x) => !x)} className="rounded-lg p-2 text-slate-400 hover:text-slate-700" aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <PasswordHint password={password} />
              {error === 'exists' ? (
                <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  There’s already an account for this email.{' '}
                  <Link to="/login" className="font-semibold underline">
                    Log in instead
                  </Link>
                </p>
              ) : (
                error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              )}
              <button disabled={busy || !name.trim() || password.length < 8} className="mt-5 h-11 w-full rounded-xl bg-indigo-600 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {busy ? 'Creating your account…' : 'Create account'}
              </button>
              <p className="mt-4 text-center text-xs text-slate-500">By creating an account you agree to the Terms of Service and Privacy Policy.</p>
            </form>
          )}
        </div>
      </AuthBackdrop>
    )

  // ---- onboarding (signed in)
  const index = ONBOARDING.indexOf(step)
  const back = index > 0 ? () => setStep(ONBOARDING[index - 1]) : undefined
  const next = () => (index < ONBOARDING.length - 1 ? setStep(ONBOARDING[index + 1]) : void finish())
  const canNext = step === 'team' ? !!team : step === 'workspace' ? !!wsName.trim() : true

  return (
    <div className="flex min-h-full flex-col bg-white text-slate-950">
      <header className="flex items-center px-6 py-5 sm:px-10">
        <Logo size={28} />
        <span className="ml-auto text-sm text-slate-500">
          Welcome, <span className="font-medium text-slate-800">{name.split(' ')[0]}</span>
        </span>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-10">
        {step === 'use' && (
          <Question title="What will you use Meetspace for?">
            <div className="grid gap-3 sm:grid-cols-3">
              {USES.map(({ key, label, icon: Icon }) => (
                <Choice key={key} selected={use === key} onClick={() => setUse(key)} className="flex-col py-6">
                  <Icon size={26} className={use === key ? 'text-indigo-600' : 'text-slate-400'} />
                  <span className="mt-2 text-base font-semibold">{label}</span>
                </Choice>
              ))}
            </div>
          </Question>
        )}
        {step === 'team' && (
          <Question title={use === 'work' ? 'How many people work on your team?' : 'How many people will you work with?'}>
            <div className="flex flex-wrap gap-2.5">
              {TEAM_SIZES.map((t) => (
                <Choice key={t} selected={team === t} onClick={() => setTeam(t)}>
                  {t}
                </Choice>
              ))}
            </div>
          </Question>
        )}
        {step === 'manage' && (
          <Question title="What would you like to manage first?" hint="We’ll add a ready-made List for each one. Pick as many as you like, or skip.">
            <div className="grid gap-3 sm:grid-cols-2">
              {LIST_TEMPLATES.map((t) => {
                const on = manage.includes(t.key)
                return (
                  <Choice key={t.key} selected={on} onClick={() => setManage((m) => (on ? m.filter((x) => x !== t.key) : [...m, t.key]))} className="items-start justify-start text-left">
                    <span className="text-2xl">{t.emoji}</span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{t.name}</span>
                      <span className="block text-sm font-normal text-slate-500">{t.description}</span>
                    </span>
                    <span className={cn('ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300')}>{on && <Check size={13} />}</span>
                  </Choice>
                )
              })}
            </div>
          </Question>
        )}
        {step === 'workspace' && (
          <Question title="Name your Workspace" hint="Usually your company or team name. You can change it later.">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl font-bold text-white" style={{ background: wsColor }}>
                {wsName.trim()[0]?.toUpperCase() ?? 'W'}
              </span>
              <input autoFocus value={wsName} onChange={(e) => setWsName(e.target.value)} maxLength={120} className="h-14 flex-1 rounded-xl border border-slate-300 px-4 text-lg outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100" aria-label="Workspace name" />
            </div>
            <div className="mt-5 flex gap-2">
              {SPACE_COLORS.map((c) => (
                <button key={c} onClick={() => setWsColor(c)} className={cn('h-7 w-7 rounded-full ring-offset-2', wsColor === c && 'ring-2 ring-slate-900')} style={{ background: c }} aria-label={`Color ${c}`} />
              ))}
            </div>
          </Question>
        )}
        {step === 'invite' && (
          <Question title="Invite people to your Workspace" hint="They get access right away. You can always invite more from Settings.">
            <div className="space-y-2.5">
              {invites.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-300 px-3 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100">
                    <Mail size={16} className="text-slate-400" />
                    <input type="email" value={v} onChange={(e) => setInvites((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} placeholder="teammate@company.com" className="h-11 flex-1 bg-transparent outline-none" aria-label={`Teammate email ${i + 1}`} />
                  </div>
                  {invites.length > 1 && (
                    <button onClick={() => setInvites((xs) => xs.filter((_, j) => j !== i))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Remove">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              {invites.length < 10 && (
                <button onClick={() => setInvites((xs) => [...xs, ''])} className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline">
                  <Plus size={15} /> Add another
                </button>
              )}
            </div>
            {invites.some((x) => x.trim() && !EMAIL_RE.test(x.trim())) && <p className="mt-3 text-sm text-amber-700">Addresses that aren’t valid emails will be skipped.</p>}
          </Question>
        )}
        {error && <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </main>
      <footer className="border-t border-slate-200 px-6 py-4 sm:px-10">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={1} aria-valuemax={ONBOARDING.length} aria-valuenow={index + 1}>
            <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${((index + 1) / ONBOARDING.length) * 100}%` }} />
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {index + 1}/{ONBOARDING.length}
          </span>
          {back && (
            <button onClick={back} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Back
            </button>
          )}
          {(step === 'manage' || step === 'invite') && (
            <button onClick={() => (step === 'invite' ? void finish([]) : (setManage([]), next()))} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Skip
            </button>
          )}
          <button onClick={next} disabled={!canNext || busy} className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {step === 'invite' ? (busy ? 'Setting up…' : 'Finish') : 'Next'}
          </button>
        </div>
      </footer>
    </div>
  )
}

function AuthBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-slate-50 text-slate-950">
      <div className="pointer-events-none absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-indigo-400/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 -bottom-48 h-[560px] w-[560px] rounded-full bg-teal-300/35 blur-3xl" />
      <header className="relative flex items-center px-6 py-5 sm:px-10">
        <Link to="/">
          <Logo size={28} />
        </Link>
        <span className="ml-auto text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="rounded-lg bg-white px-3 py-1.5 font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 hover:bg-slate-50">
            Log in
          </Link>
        </span>
      </header>
      <main className="relative flex flex-1 items-center justify-center px-4 pb-16">{children}</main>
    </div>
  )
}

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {hint && <p className="mt-2 text-slate-500">{hint}</p>}
      <div className="mt-8">{children}</div>
    </section>
  )
}

function Choice({ selected, onClick, className, children }: { selected: boolean; onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex items-center justify-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors',
        selected ? 'border-indigo-600 bg-indigo-50 text-indigo-950' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
        className,
      )}
    >
      {children}
    </button>
  )
}

function PasswordHint({ password }: { password: string }) {
  if (!password) return null
  const ok = password.length >= 8
  return <p className={cn('mt-1.5 flex items-center gap-1 text-xs', ok ? 'text-emerald-600' : 'text-slate-500')}>{ok ? <Check size={12} /> : null} At least 8 characters</p>
}
