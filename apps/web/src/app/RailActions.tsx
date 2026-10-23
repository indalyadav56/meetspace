import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Crown, Mail, UserPlus, X } from 'lucide-react'
import { Modal } from './components/ui'
import { useMe, useStore } from '../store/useStore'
import type { MemberRole } from '../store/types'
import { PLANS } from '../marketing/Pricing'
import { cn } from '../lib/utils'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Quick invite from the rail: one or more emails and a role. */
export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe()
  const ws = useStore((s) => s.workspaces.find((w) => w.id === s.currentWorkspaceId))
  const inviteMember = useStore((s) => s.inviteMember)
  const toast = useStore((s) => s.toast)
  const [emails, setEmails] = useState('')
  const [role, setRole] = useState<MemberRole>('member')
  const myRole = ws?.members.find((m) => m.userId === me.id)?.role
  const canInvite = myRole === 'owner' || myRole === 'admin'
  const list = emails.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean)
  const valid = list.filter((x) => EMAIL_RE.test(x))

  const close = () => {
    setEmails('')
    onClose()
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid.length) return
    valid.forEach((email) => inviteMember('', email, role))
    toast(`Invited ${valid.length} ${valid.length === 1 ? 'person' : 'people'} to ${ws?.name ?? 'the workspace'}`)
    close()
  }

  return (
    <Modal open={open} onClose={close} className="mt-[14vh] max-w-md">
      <form onSubmit={submit} className="p-5">
        <div className="flex items-center gap-3">
          <span className="bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-100 flex h-10 w-10 items-center justify-center rounded-full">
            <UserPlus size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Invite people</h2>
            <p className="text-muted truncate text-sm">to {ws?.name}</p>
          </div>
          <button type="button" onClick={close} className="hover-surface text-muted ml-auto rounded-md p-1.5" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {canInvite ? (
          <>
            <label className="mt-5 block text-sm font-medium" htmlFor="invite-emails">
              Email addresses
            </label>
            <div className="border-app focus-within:border-brand-500 mt-1.5 flex items-start gap-2 rounded-lg border px-3 py-2">
              <Mail size={16} className="text-faint mt-0.5" />
              <textarea id="invite-emails" autoFocus rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="ann@company.com, bo@company.com" className="min-w-0 flex-1 resize-none bg-transparent text-sm outline-none" />
            </div>
            <p className="text-faint mt-1.5 text-xs">Separate several addresses with commas or spaces. Everyone gets an email invite.</p>
            <label className="mt-4 block text-sm font-medium" htmlFor="invite-role">
              Role
            </label>
            <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as MemberRole)} className="border-app surface mt-1.5 h-9 w-full rounded-lg border px-2 text-sm">
              <option value="member">Member — can view and edit everything</option>
              <option value="admin">Admin — can also manage people and settings</option>
              <option value="guest">Guest — read-only, can comment</option>
            </select>
            {list.length > valid.length && <p className="mt-3 text-xs text-amber-600">{list.length - valid.length} address(es) aren’t valid and will be skipped.</p>}
            <div className="mt-5 flex items-center gap-2">
              <Link to="/app/settings" onClick={close} className="text-muted text-sm hover:underline">
                Manage members
              </Link>
              <button disabled={!valid.length} className="bg-brand-600 hover:bg-brand-700 ml-auto rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                Send {valid.length > 1 ? `${valid.length} invites` : 'invite'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-muted mt-5 text-sm">Only owners and admins can invite people to this workspace. Ask an admin to add your teammate.</p>
        )}
      </form>
    </Modal>
  )
}

/** Plans for the current workspace (every workspace starts on Free). */
export function UpgradeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ws = useStore((s) => s.workspaces.find((w) => w.id === s.currentWorkspaceId))
  const members = ws?.members.length ?? 1
  return (
    <Modal open={open} onClose={onClose} className="mt-[6vh] max-w-4xl">
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="bg-accent-100 text-accent-700 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <Crown size={18} />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Upgrade {ws?.name}</h2>
            <p className="text-muted text-sm">
              You’re on the <span className="text-app font-medium">Free</span> plan with {members} {members === 1 ? 'member' : 'members'}. Unlock more views, automations and admin controls.
            </p>
          </div>
          <button onClick={onClose} className="hover-surface text-muted ml-auto rounded-md p-1.5" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => {
            const current = p.name === 'Free'
            return (
              <div key={p.name} className={cn('flex flex-col rounded-xl border p-4', p.popular ? 'border-brand-500 ring-brand-500/20 ring-2' : 'border-app')}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{p.name}</span>
                  {p.popular && <span className="bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-100 rounded-full px-2 py-0.5 text-[10px] font-semibold">Popular</span>}
                </div>
                <div className="mt-2 text-2xl font-bold">
                  {p.yearly === null ? 'Custom' : `$${p.yearly}`}
                  {p.yearly !== null && <span className="text-muted text-xs font-normal"> /member/mo</span>}
                </div>
                <p className="text-muted mt-1 text-xs">{p.tagline}</p>
                <ul className="mt-3 flex-1 space-y-1.5 text-xs">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-1.5">
                      <Check size={13} className="text-brand-600 mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                {current ? (
                  <span className="border-app text-muted mt-4 rounded-lg border py-2 text-center text-sm font-medium">Current plan</span>
                ) : (
                  <Link to="/pricing" target="_blank" className={cn('mt-4 rounded-lg py-2 text-center text-sm font-semibold', p.popular ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'hover-surface border-app border')}>
                    {p.yearly === null ? 'Contact sales' : `Choose ${p.name}`}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-faint mt-4 text-center text-xs">Prices billed yearly. Compare every feature on the pricing page.</p>
      </div>
    </Modal>
  )
}
