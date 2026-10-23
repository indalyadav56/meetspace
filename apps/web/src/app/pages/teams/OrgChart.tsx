import { useState } from 'react'
import { ChevronDown, ChevronRight, Network } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import type { ID } from '../../../store/types'
import { Avatar } from '../../components/ui'
import { cn } from '../../../lib/utils'
import { usePeople, type Person } from './shared'

const MIME = 'application/x-ms-person'

/** Reporting lines from each member's manager. Admins drag a card onto another to change who they report to. */
export default function OrgChart() {
  const setMemberProfile = useStore((s) => s.setMemberProfile)
  const { people, byId, canManage, teamsOf } = usePeople()
  const [collapsed, setCollapsed] = useState<Set<ID>>(new Set())
  const [over, setOver] = useState<ID | 'root' | null>(null)
  const reports = (id: ID) => people.filter((p) => p.member.managerId === id)
  const roots = people.filter((p) => !p.member.managerId || !byId.has(p.member.managerId))

  const drop = (e: React.DragEvent, managerId: ID | null) => {
    e.preventDefault()
    e.stopPropagation()
    setOver(null)
    const id = e.dataTransfer.getData(MIME)
    if (id && id !== managerId) void setMemberProfile(id, { managerId })
  }
  const target = (id: ID | 'root') => ({
    onDragOver: (e: React.DragEvent) => {
      if (!canManage || !e.dataTransfer.types.includes(MIME)) return
      e.preventDefault()
      e.stopPropagation()
      setOver(id)
    },
    onDragLeave: () => setOver((o) => (o === id ? null : o)),
    onDrop: (e: React.DragEvent) => drop(e, id === 'root' ? null : id),
  })

  const node = (p: Person, depth: number): React.ReactNode => {
    const kids = reports(p.user.id)
    const closed = collapsed.has(p.user.id)
    return (
      <li key={p.user.id} className="flex flex-col items-center">
        <div
          draggable={canManage}
          onDragStart={(e) => e.dataTransfer.setData(MIME, p.user.id)}
          {...target(p.user.id)}
          className={cn(
            'surface border-app relative w-52 rounded-xl border p-3 text-left shadow-sm transition-colors',
            canManage && 'cursor-grab',
            over === p.user.id && 'border-brand-500 ring-brand-500/30 ring-2',
          )}
        >
          <div className="flex items-center gap-2.5">
            <span className="relative shrink-0">
              <Avatar userId={p.user.id} size={34} />
              <span className={cn('absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg)]', p.online ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-600')} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{p.user.name}</span>
              <span className="text-muted block truncate text-xs">{p.member.title || <span className="capitalize">{p.member.role}</span>}</span>
            </span>
          </div>
          {teamsOf(p.user.id).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {teamsOf(p.user.id)
                .slice(0, 3)
                .map((t) => (
                  <span key={t.id} className="rounded px-1.5 py-px text-[10px] font-medium" style={{ background: `${t.color}22`, color: t.color }}>
                    {t.name}
                  </span>
                ))}
            </div>
          )}
          {kids.length > 0 && (
            <button
              onClick={() => setCollapsed((c) => (c.has(p.user.id) ? new Set([...c].filter((x) => x !== p.user.id)) : new Set([...c, p.user.id])))}
              className="surface border-app text-muted absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border px-1.5 text-[10px] font-semibold"
              aria-label={closed ? `Show ${p.user.name}'s reports` : `Hide ${p.user.name}'s reports`}
            >
              {closed ? <ChevronRight size={11} /> : <ChevronDown size={11} />} {kids.length}
            </button>
          )}
        </div>
        {kids.length > 0 && !closed && depth < 12 && (
          <>
            <span className="h-5 w-px bg-[var(--border)]" />
            <ul className="flex">
              {kids.map((k, i) => (
                <div key={k.user.id} className="relative flex flex-col items-center px-2 pt-6">
                  {i > 0 && <span className="absolute top-0 right-1/2 left-0 h-px bg-[var(--border)]" />}
                  {i < kids.length - 1 && <span className="absolute top-0 right-0 left-1/2 h-px bg-[var(--border)]" />}
                  <span className="absolute top-0 left-1/2 h-6 w-px bg-[var(--border)]" />
                  {node(k, depth + 1)}
                </div>
              ))}
            </ul>
          </>
        )}
      </li>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Org Chart</h1>
        <span className="text-muted text-sm">{canManage ? 'Drag someone onto their manager to change who they report to' : 'Who reports to whom'}</span>
      </div>
      {people.every((p) => !p.member.managerId) && (
        <div className="border-app surface-subtle mb-5 flex items-center gap-3 rounded-xl border p-3 text-sm">
          <Network size={18} className="text-brand-600 shrink-0" />
          <span className="text-muted">No reporting lines yet. {canManage ? 'Drag a card onto another, or set “Reports to” in All People.' : 'An admin can set them in All People.'}</span>
        </div>
      )}
      <div className="overflow-x-auto pb-8 scroll-thin">
        <ul className="flex w-max min-w-full justify-center gap-6 pt-2 pb-4">{roots.map((p) => node(p, 0))}</ul>
      </div>
      {canManage && (
        <div {...target('root')} className={cn('border-app text-faint mx-auto mt-2 max-w-md rounded-xl border-2 border-dashed px-4 py-3 text-center text-xs', over === 'root' && 'border-brand-500 text-brand-600')}>
          Drop here to move someone to the top level
        </div>
      )}
    </div>
  )
}
