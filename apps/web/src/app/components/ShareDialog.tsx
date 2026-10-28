import { useEffect, useState } from 'react'
import { addDays } from 'date-fns'
import { Check, Copy, Globe, Link2, Lock, Mail, Share2, Users, X } from 'lucide-react'
import { api } from '../../api/client'
import { useStore } from '../../store/useStore'
import type { ID } from '../../store/types'
import { Avatar, Modal } from './ui'
import { cn, timeAgo } from '../../lib/utils'

interface LinkInfo {
  id: string
  token: string
  expiresAt: string | null
  views: number
  lastViewedAt: string | null
}

const EXPIRY = [
  { key: 'never', label: 'Never expires', days: 0 },
  { key: '1', label: 'Expires in 1 day', days: 1 },
  { key: '7', label: 'Expires in 7 days', days: 7 },
  { key: '30', label: 'Expires in 30 days', days: 30 },
]

/** The "Share" button and dialog for a Doc, List or Whiteboard. */
export function ShareButton({ kind, id, title, spaceId, className }: { kind: 'doc' | 'list' | 'whiteboard'; id: ID; title: string; spaceId?: ID | null; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className={cn('border-app hover-surface inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium', className)}>
        <Share2 size={14} /> Share
      </button>
      {open && <ShareDialog kind={kind} id={id} title={title} spaceId={spaceId} onClose={() => setOpen(false)} />}
    </>
  )
}

function ShareDialog({ kind, id, title, spaceId, onClose }: { kind: 'doc' | 'list' | 'whiteboard'; id: ID; title: string; spaceId?: ID | null; onClose: () => void }) {
  const s = useStore()
  const ws = s.currentWorkspaceId
  const space = s.spaces.find((x) => x.id === spaceId)
  const [link, setLink] = useState<LinkInfo | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    api.raw<LinkInfo>('GET', `/workspaces/${ws}/share/${kind}/${id}`).then(setLink, () => setLink(null))
  }, [ws, kind, id])
  const url = link ? `${location.origin}/s/${link.token}` : ''

  const enable = async (days = 0) => {
    setBusy(true)
    try {
      setLink(await api.raw<LinkInfo>('PUT', `/workspaces/${ws}/share/${kind}/${id}`, { body: { expiresAt: days ? addDays(new Date(), days).toISOString() : null } }))
    } catch (e) {
      s.toast(e instanceof Error ? e.message : 'Could not create a link', 'error')
    } finally {
      setBusy(false)
    }
  }
  const disable = async () => {
    setBusy(true)
    await api.raw('DELETE', `/workspaces/${ws}/share/${kind}/${id}`).catch(() => {})
    setLink(null)
    setBusy(false)
    s.toast('Public link turned off')
  }
  const copy = () => {
    void navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const expiryKey = link?.expiresAt ? 'custom' : 'never'

  return (
    <Modal open onClose={onClose} className="mt-[12vh] max-w-lg">
      <div className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">Share “{title || 'Untitled'}”</h2>
          <button onClick={onClose} className="hover-surface text-muted rounded p-1" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <section className="border-app rounded-xl border p-3">
          <div className="flex items-center gap-3">
            <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', link ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15' : 'surface-muted text-muted')}>
              {link ? <Globe size={17} /> : <Lock size={17} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{link ? 'Anyone with the link can view' : 'Public link is off'}</div>
              <div className="text-muted text-xs">{link ? `Read-only, no sign-in. ${link.views} view${link.views === 1 ? '' : 's'}${link.lastViewedAt ? `, last ${timeAgo(link.lastViewedAt)}` : ''}.` : 'Only people in this workspace can open it.'}</div>
            </div>
            {link === undefined ? null : link ? (
              <button disabled={busy} onClick={() => void disable()} className="text-muted hover:text-app text-xs font-medium">
                Turn off
              </button>
            ) : (
              <button disabled={busy} onClick={() => void enable()} className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                Create link
              </button>
            )}
          </div>
          {link && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <input readOnly value={url} onFocus={(e) => e.target.select()} className="border-app surface-muted min-w-0 flex-1 rounded-md border px-2 py-1.5 font-mono text-xs" aria-label="Share link" />
                <button onClick={copy} className="bg-brand-600 hover:bg-brand-700 inline-flex items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-white">
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <select value={expiryKey} onChange={(e) => void enable(EXPIRY.find((x) => x.key === e.target.value)?.days ?? 0)} className="border-app surface h-8 rounded-md border px-2 text-xs" aria-label="Expiry">
                {EXPIRY.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.label}
                  </option>
                ))}
                {expiryKey === 'custom' && <option value="custom">Expires {new Date(link.expiresAt!).toLocaleDateString()}</option>}
              </select>
            </div>
          )}
        </section>

        {kind === 'list' && <ListEmail listId={id} />}
        {space && (
          <section className="border-app mt-3 rounded-xl border p-3 text-sm">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-muted" />
              <span className="flex-1">
                Inside <b>{space.name}</b>: {space.private ? 'private to its members' : 'everyone in the workspace'}
              </span>
              <SpaceAccessButton spaceId={space.id} />
            </div>
          </section>
        )}
        <p className="text-faint mt-3 flex items-center gap-1.5 text-xs">
          <Link2 size={12} /> Turning the link off breaks it for everyone; a new link gets a new address.
        </p>
      </div>
    </Modal>
  )
}

/** Opens Space access: private or open, and who's in it (the only way guests see a Space). */
export function SpaceAccessButton({ spaceId, className }: { spaceId: ID; className?: string }) {
  const [open, setOpen] = useState(false)
  const space = useStore((s) => s.spaces.find((x) => x.id === spaceId))
  if (!space) return null
  return (
    <>
      <button onClick={() => setOpen(true)} className={cn('border-app hover-surface inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium', className)}>
        {space.private ? <Lock size={14} /> : <Users size={14} />} {space.private ? 'Private' : 'Members'}
      </button>
      {open && <SpaceAccessDialog spaceId={spaceId} onClose={() => setOpen(false)} />}
    </>
  )
}

function SpaceAccessDialog({ spaceId, onClose }: { spaceId: ID; onClose: () => void }) {
  const s = useStore()
  const space = s.spaces.find((x) => x.id === spaceId)!
  const wsObj = s.workspaces.find((w) => w.id === s.currentWorkspaceId)
  const roleOf = (id: ID) => wsObj?.members.find((m) => m.userId === id)?.role
  const [priv, setPriv] = useState(!!space.private)
  const [members, setMembers] = useState<ID[]>(space.members ?? [])
  const [busy, setBusy] = useState(false)
  const people = s.users.filter((u) => roleOf(u.id))
  const guests = people.filter((u) => roleOf(u.id) === 'guest')

  const save = async () => {
    setBusy(true)
    try {
      await api.raw('PUT', `/workspaces/${s.currentWorkspaceId}/projects/${space.id}/access`, { body: { private: priv, members } })
      s.toast(priv ? `${space.name} is private` : `${space.name} access saved`)
      onClose()
    } catch (e) {
      s.toast(e instanceof Error ? e.message : 'Could not save access', 'error')
    } finally {
      setBusy(false)
    }
  }
  const toggle = (id: ID) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))

  return (
    <Modal open onClose={onClose} className="mt-[10vh] max-w-md">
      <div className="p-5">
        <h2 className="mb-4 text-lg font-semibold">Who can see {space.name}?</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { v: false, icon: Users, label: 'Everyone', hint: 'All workspace members' },
            { v: true, icon: Lock, label: 'Private', hint: 'Only people added below' },
          ].map((o) => (
            <button key={o.label} onClick={() => setPriv(o.v)} className={cn('rounded-lg border p-3 text-left', priv === o.v ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/15' : 'border-app hover-surface')} aria-pressed={priv === o.v}>
              <o.icon size={16} className="mb-1" />
              <span className="block text-sm font-semibold">{o.label}</span>
              <span className="text-muted text-xs">{o.hint}</span>
            </button>
          ))}
        </div>
        <h3 className="mt-4 mb-1 text-sm font-semibold">{priv ? 'Members' : 'Guests with access'}</h3>
        <p className="text-muted mb-2 text-xs">{priv ? 'Owners and admins always see every Space.' : 'Members see open Spaces automatically. Guests only see Spaces they’re added to.'}</p>
        <div className="border-app max-h-64 divide-y divide-[var(--border)] overflow-y-auto rounded-lg border">
          {(priv ? people : guests).map((u) => {
            const role = roleOf(u.id)
            const always = role === 'owner' || role === 'admin'
            return (
              <label key={u.id} className="hover-surface flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                <input type="checkbox" disabled={always} checked={always || members.includes(u.id)} onChange={() => toggle(u.id)} className="accent-brand-600" />
                <Avatar userId={u.id} size={22} />
                <span className="min-w-0 flex-1 truncate">{u.name}</span>
                <span className="text-faint text-xs capitalize">{role}</span>
              </label>
            )
          })}
          {!priv && guests.length === 0 && <p className="text-muted px-3 py-4 text-center text-xs">No guests in this workspace. Invite one from Settings → Members.</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="hover-surface rounded-lg px-3.5 py-2 text-sm font-medium">
            Cancel
          </button>
          <button disabled={busy} onClick={() => void save()} className="bg-brand-600 hover:bg-brand-700 rounded-lg px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Email-to-task: a private address that turns each email into a task in this List. */
function ListEmail({ listId }: { listId: ID }) {
  const s = useStore()
  const base = `/workspaces/${s.currentWorkspaceId}/lists/${listId}/inbox`
  const [info, setInfo] = useState<{ address: string | null; configured: boolean } | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    api.raw<typeof info>('GET', base).then(setInfo, () => setInfo(null))
  }, [base])
  if (!info) return null
  const turnOn = async (rotate = false) => setInfo(await api.raw<typeof info>('POST', `${base}${rotate ? '?rotate=1' : ''}`, { body: {} }))
  return (
    <section className="border-app mt-3 rounded-xl border p-3 text-sm">
      <div className="flex items-center gap-2">
        <Mail size={15} className="text-muted" />
        <span className="flex-1 font-medium">Email tasks to this List</span>
        {info.configured && !info.address && (
          <button onClick={() => void turnOn()} className="text-brand-600 text-xs font-semibold hover:underline">
            Get address
          </button>
        )}
      </div>
      {!info.configured ? (
        <p className="text-muted mt-1 text-xs">Your admin needs to connect an inbound email domain first (APP_INBOUND_DOMAIN and APP_INBOUND_SECRET).</p>
      ) : info.address ? (
        <>
          <div className="mt-2 flex gap-2">
            <input readOnly value={info.address} onFocus={(e) => e.target.select()} className="border-app surface-muted min-w-0 flex-1 rounded-md border px-2 py-1.5 font-mono text-xs" aria-label="List email address" />
            <button onClick={() => (void navigator.clipboard?.writeText(info.address!), setCopied(true), setTimeout(() => setCopied(false), 1500))} className="border-app hover-surface inline-flex items-center gap-1 rounded-md border px-2.5 text-xs font-medium">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-faint mt-1 text-xs">
            The subject becomes the task name and the body its description. Only members who can see this List can add tasks this way.{' '}
            <button onClick={() => void turnOn(true)} className="underline">
              New address
            </button>{' '}
            ·{' '}
            <button onClick={() => void api.raw('DELETE', base).then(() => setInfo({ ...info, address: null }))} className="underline">
              Turn off
            </button>
          </p>
        </>
      ) : (
        <p className="text-muted mt-1 text-xs">Get a private address; anything a member emails to it becomes a task here.</p>
      )}
    </section>
  )
}
