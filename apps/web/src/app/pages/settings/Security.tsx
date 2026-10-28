import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, Download, KeyRound, Laptop, LogOut, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react'
import { api } from '../../../api/client'
import { useStore } from '../../../store/useStore'
import { Modal } from '../../components/ui'
import { cn, timeAgo } from '../../../lib/utils'

interface TwoFactor {
  enabled: boolean
  recoveryLeft: number
  hasPassword: boolean
}
interface SessionRow {
  id: string
  userAgent: string
  ip: string
  startedAt: string
  lastSeen: string
  current: boolean
}
interface SecurityEvent {
  id: string
  action: string
  ip?: string
  userAgent?: string
  meta?: Record<string, unknown>
  createdAt: string
}

const card = 'border-app rounded-xl border p-4'
const input = 'border-app focus:border-brand-500 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none'
const btn = 'bg-brand-600 hover:bg-brand-700 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-50'
const ghost = 'border-app hover-surface rounded-lg border px-3 py-1.5 text-sm font-medium'

/** "Chrome on macOS" from a user agent string. */
export function deviceName(ua: string) {
  if (!ua) return 'Unknown device'
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /curl|Go-http/.test(ua) ? 'API client' : 'Browser'
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : ''
  return os ? `${browser} on ${os}` : browser
}

export const EVENT_LABEL: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.login_failed': 'Failed sign-in attempt',
  'auth.mfa_failed': 'Wrong two-factor code',
  'auth.logout': 'Signed out',
  'auth.registered': 'Account created',
  'auth.password_changed': 'Password changed',
  'auth.2fa_enabled': 'Two-factor turned on',
  'auth.2fa_disabled': 'Two-factor turned off',
  'auth.recovery_codes_regenerated': 'New recovery codes',
  'auth.session_revoked': 'Signed out a device',
  'auth.sessions_revoked': 'Signed out other devices',
}

export default function Security() {
  return (
    <div className="max-w-2xl space-y-4">
      <TwoFactorCard />
      <SessionsCard />
      <LinkedAccounts />
      <ActivityCard />
    </div>
  )
}

function TwoFactorCard() {
  const toast = useStore((s) => s.toast)
  const [st, setSt] = useState<TwoFactor | null>(null)
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'disable' | 'regenerate' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => api.get<TwoFactor>('/users/me/2fa').then(setSt, () => setSt(null)), [])
  useEffect(() => {
    void load()
  }, [load])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }
  const start = () =>
    run(async () => {
      const r = await api.raw<{ secret: string; otpauthUrl: string }>('POST', '/users/me/2fa/setup', { body: {} })
      setSetup({ secret: r.secret, qr: await QRCode.toDataURL(r.otpauthUrl, { margin: 1, width: 200 }) })
      setCode('')
    })
  const enable = () =>
    run(async () => {
      const r = await api.raw<{ recoveryCodes: string[] }>('POST', '/users/me/2fa/enable', { body: { code } })
      setSetup(null)
      setCodes(r.recoveryCodes)
      setCode('')
      toast('Two-factor authentication is on')
      void load()
    })
  const confirm = () =>
    run(async () => {
      if (mode === 'disable') {
        await api.raw('POST', '/users/me/2fa/disable', { body: { code, password } })
        toast('Two-factor authentication is off')
      } else {
        const r = await api.raw<{ recoveryCodes: string[] }>('POST', '/users/me/2fa/recovery-codes', { body: { code } })
        setCodes(r.recoveryCodes)
      }
      setMode(null)
      setCode('')
      setPassword('')
      void load()
    })

  const codeInput = (
    <input
      autoFocus
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/\s/g, '').slice(0, 9))}
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="6-digit code"
      className={cn(input, 'font-mono tracking-widest')}
      aria-label="Authentication code"
    />
  )

  return (
    <section className={card}>
      <div className="flex items-start gap-3">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', st?.enabled ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15' : 'surface-muted text-muted')}>
          {st?.enabled ? <ShieldCheck size={18} /> : <ShieldOff size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Two-factor authentication</h2>
          <p className="text-muted text-sm">
            {st?.enabled ? `On. ${st.recoveryLeft} recovery code${st.recoveryLeft === 1 ? '' : 's'} left.` : 'Require a code from an authenticator app (Google Authenticator, 1Password, Authy…) when you sign in.'}
          </p>
        </div>
        {st && !setup && (st.enabled ? (
          <div className="flex shrink-0 gap-2">
            <button onClick={() => (setMode('regenerate'), setError(null))} className={ghost}>
              New recovery codes
            </button>
            <button onClick={() => (setMode('disable'), setError(null))} className={cn(ghost, 'text-red-600')}>
              Turn off
            </button>
          </div>
        ) : (
          <button onClick={start} disabled={busy} className={btn}>
            Set up
          </button>
        ))}
      </div>

      {setup && (
        <div className="border-app mt-4 grid gap-4 border-t pt-4 sm:grid-cols-[200px_1fr]">
          <img src={setup.qr} alt="QR code for your authenticator app" width={200} height={200} className="rounded-lg bg-white p-1" />
          <div className="space-y-3 text-sm">
            <p>
              <b>1.</b> Scan the QR code with your authenticator app. Can’t scan? Enter this key:
            </p>
            <code className="surface-muted block rounded-md px-2 py-1.5 font-mono text-xs break-all select-all">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
            <p>
              <b>2.</b> Enter the 6-digit code it shows.
            </p>
            {codeInput}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button onClick={enable} disabled={busy || code.length !== 6} className={btn}>
                Turn on
              </button>
              <button onClick={() => setSetup(null)} className={ghost}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {error && !setup && !mode && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <Modal open={!!mode} onClose={() => setMode(null)} className="mt-[18vh] max-w-sm">
        <form onSubmit={(e) => (e.preventDefault(), void confirm())} className="space-y-3 p-5">
          <h3 className="text-lg font-semibold">{mode === 'disable' ? 'Turn off two-factor?' : 'Generate new recovery codes?'}</h3>
          <p className="text-muted text-sm">{mode === 'disable' ? 'Your account will be protected by your password only.' : 'Your old recovery codes stop working.'}</p>
          {mode === 'disable' && st?.hasPassword && (
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Current password" autoComplete="current-password" className={input} aria-label="Current password" />
          )}
          {codeInput}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setMode(null)} className={ghost}>
              Cancel
            </button>
            <button disabled={busy || code.length < 6} className={cn(btn, mode === 'disable' && 'bg-red-600 hover:bg-red-700')}>
              {mode === 'disable' ? 'Turn off' : 'Generate'}
            </button>
          </div>
        </form>
      </Modal>
      <RecoveryCodes codes={codes} onClose={() => setCodes(null)} />
    </section>
  )
}

function RecoveryCodes({ codes, onClose }: { codes: string[] | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  if (!codes) return null
  const text = `Meetspace recovery codes\nEach code works once. Keep them somewhere safe.\n\n${codes.join('\n')}\n`
  return (
    <Modal open onClose={() => {}} className="mt-[12vh] max-w-md">
      <div className="space-y-3 p-5">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <KeyRound size={18} className="text-brand-600" /> Save your recovery codes
        </h3>
        <p className="text-muted text-sm">If you lose your phone, each of these codes lets you sign in once. This is the only time they’re shown.</p>
        <div className="surface-muted grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg p-3 font-mono text-sm">
          {codes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => (void navigator.clipboard?.writeText(text), setCopied(true))} className={ghost}>
            {copied ? <Check size={14} className="mr-1 inline text-emerald-600" /> : <Copy size={14} className="mr-1 inline" />} Copy
          </button>
          <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`} download="meetspace-recovery-codes.txt" className={ghost}>
            <Download size={14} className="mr-1 inline" /> Download
          </a>
          <button onClick={onClose} className={cn(btn, 'ml-auto')}>
            I’ve saved them
          </button>
        </div>
      </div>
    </Modal>
  )
}

function SessionsCard() {
  const toast = useStore((s) => s.toast)
  const [rows, setRows] = useState<SessionRow[] | null>(null)
  const load = useCallback(() => api.get<SessionRow[]>('/users/me/sessions').then(setRows, () => setRows([])), [])
  useEffect(() => {
    void load()
  }, [load])
  const revoke = async (id: string) => {
    await api.raw('DELETE', `/users/me/sessions/${id}`)
    toast('Signed out that device')
    void load()
  }
  const others = (rows ?? []).filter((r) => !r.current).length
  return (
    <section className={card}>
      <div className="mb-3 flex items-center">
        <div>
          <h2 className="font-semibold">Where you’re signed in</h2>
          <p className="text-muted text-sm">Sign out any device you don’t recognise.</p>
        </div>
        {others > 0 && (
          <button
            onClick={async () => {
              const r = await api.raw<{ revoked: number }>('POST', '/users/me/sessions/revoke-others', { body: {} })
              toast(`Signed out ${r.revoked} other device${r.revoked === 1 ? '' : 's'}`)
              void load()
            }}
            className={cn(ghost, 'ml-auto')}
          >
            Sign out all others
          </button>
        )}
      </div>
      {rows === null ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
              {/iPhone|Android/.test(r.userAgent) ? <Smartphone size={18} className="text-muted" /> : <Laptop size={18} className="text-muted" />}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-medium">
                  {deviceName(r.userAgent)}
                  {r.current && <span className="rounded-full bg-emerald-50 px-1.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">This device</span>}
                </span>
                <span className="text-faint block text-xs">
                  {r.ip || 'IP unknown'} · active {timeAgo(r.lastSeen)} · signed in {timeAgo(r.startedAt)}
                </span>
              </span>
              {!r.current && (
                <button onClick={() => void revoke(r.id)} className="text-muted hover:text-app flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-[var(--bg-hover)]">
                  <LogOut size={13} /> Sign out
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function LinkedAccounts() {
  const [rows, setRows] = useState<{ provider: string; email: string; createdAt: string }[]>([])
  useEffect(() => {
    api.get<typeof rows>('/users/me/identities').then(setRows, () => setRows([]))
  }, [])
  if (!rows.length) return null
  return (
    <section className={card}>
      <h2 className="mb-2 font-semibold">Single sign-on</h2>
      <ul className="space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.provider + r.email} className="flex items-center gap-2">
            <Check size={14} className="text-emerald-600" />
            <span className="font-medium capitalize">{r.provider === 'oidc' ? 'SSO' : r.provider}</span>
            <span className="text-muted">{r.email}</span>
            <span className="text-faint ml-auto text-xs">linked {timeAgo(r.createdAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ActivityCard() {
  const [rows, setRows] = useState<SecurityEvent[]>([])
  useEffect(() => {
    api.get<SecurityEvent[]>('/users/me/security-activity').then(setRows, () => setRows([]))
  }, [])
  return (
    <section className={card}>
      <h2 className="mb-2 font-semibold">Recent security activity</h2>
      {rows.length === 0 ? (
        <p className="text-muted text-sm">Nothing yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {rows.slice(0, 15).map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', /failed/.test(e.action) ? 'bg-red-500' : 'bg-emerald-500')} />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{EVENT_LABEL[e.action] ?? e.action}</span>
                {typeof e.meta?.method === 'string' && <span className="text-faint"> · {String(e.meta.method).replace('sso:', 'SSO ').replace('password+', 'password + ').replace('_', ' ')}</span>}
                <span className="text-faint block text-xs">
                  {deviceName(e.userAgent ?? '')} · {e.ip || 'IP unknown'}
                </span>
              </span>
              <span className="text-faint shrink-0 text-xs">{timeAgo(e.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
