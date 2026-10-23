/**
 * HTTP client for the Meetspace Go API.
 *
 * - Access/refresh tokens are kept in localStorage so a reload stays signed in.
 * - A 401 triggers one (shared) refresh and a retry; a failed refresh signs out.
 * - Writes go through a FIFO queue so optimistic changes reach the server in the
 *   order the user made them (create → edit → delete of the same item).
 */

export const API_BASE = '/api/v1'

export interface Tokens {
  accessToken: string
  refreshToken: string
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

const TOKEN_KEY = 'meetspace.auth'

function loadTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as Tokens) : null
  } catch {
    return null
  }
}

let tokens: Tokens | null = loadTokens()
const listeners = new Set<(signedIn: boolean) => void>()

export const session = {
  get accessToken() {
    return tokens?.accessToken ?? null
  },
  get signedIn() {
    return !!tokens
  },
  set(t: Tokens | null) {
    tokens = t
    try {
      if (t) localStorage.setItem(TOKEN_KEY, JSON.stringify(t))
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* storage unavailable: the session lasts until reload */
    }
    listeners.forEach((l) => l(!!t))
  },
  /** Called with false when the session ends (logout or a refresh that failed). */
  subscribe(fn: (signedIn: boolean) => void) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}

// Another tab signing in or out.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== TOKEN_KEY) return
    tokens = loadTokens()
    listeners.forEach((l) => l(!!tokens))
  })
}

let refreshing: Promise<boolean> | null = null

async function refresh(): Promise<boolean> {
  if (!tokens) return false
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens!.refreshToken }),
      })
      if (!res.ok) {
        session.set(null)
        return false
      }
      const body = await res.json()
      const t = (body.data ?? body) as Tokens
      session.set({ accessToken: t.accessToken, refreshToken: t.refreshToken })
      return true
    } catch {
      return false // offline: keep the tokens, the next call retries
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

/** Makes sure the access token is fresh enough for a WebSocket or media URL. */
export async function ensureFreshToken() {
  if (!tokens) return null
  try {
    const [, payload] = tokens.accessToken.split('.')
    const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (exp * 1000 - Date.now() < 60_000) await refresh()
  } catch {
    await refresh()
  }
  return session.accessToken
}

interface RequestOptions {
  body?: unknown
  form?: FormData
  signal?: AbortSignal
  /** Skip the auth header (public endpoints). */
  anonymous?: boolean
}

async function send<T>(method: string, path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (!opts.anonymous && tokens) headers.Authorization = `Bearer ${tokens.accessToken}`
  let res: Response
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: opts.signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'network', 'Can’t reach the Meetspace server. Check your connection.')
  }
  if (res.status === 401 && !opts.anonymous && !retried && tokens && (await refresh())) return send<T>(method, path, opts, true)
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = body.error ?? {}
    throw new ApiError(res.status, err.code ?? 'error', err.message ?? res.statusText)
  }
  return (body.data ?? body) as T
}

let queue: Promise<unknown> = Promise.resolve()
const failureHandlers = new Set<(e: ApiError) => void>()

/** Runs writes one after another; failures are reported to onWriteError listeners. */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn)
  queue = run.catch((e) => {
    if (e instanceof ApiError) failureHandlers.forEach((h) => h(e))
  })
  return run
}

export function onWriteError(fn: (e: ApiError) => void) {
  failureHandlers.add(fn)
  return () => failureHandlers.delete(fn)
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => send<T>('GET', path, opts),
  post: <T>(path: string, body?: unknown) => enqueue(() => send<T>('POST', path, { body: body ?? {} })),
  patch: <T>(path: string, body: unknown) => enqueue(() => send<T>('PATCH', path, { body })),
  put: <T>(path: string, body: unknown) => enqueue(() => send<T>('PUT', path, { body })),
  del: <T = void>(path: string) => enqueue(() => send<T>('DELETE', path)),
  upload: <T>(path: string, form: FormData) => enqueue(() => send<T>('POST', path, { form })),
  /** Requests whose result the caller handles itself (auth, public forms). */
  raw: send,
}

/** Client-generated ids let the UI show and link new items before the server answers. */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // randomUUID needs a secure context; plain-http LAN hosts fall back to a manual v4.
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
