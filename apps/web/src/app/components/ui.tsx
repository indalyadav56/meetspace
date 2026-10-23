import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Check, Flag, UserPlus, X } from 'lucide-react'
import type { ID, Priority, Status } from '../../store/types'
import { useStore } from '../../store/useStore'
import { useShallow } from 'zustand/react/shallow'
import { PRIORITIES, cn, friendlyDate, initials, isOverdue, priorityMeta, tagColor } from '../../lib/utils'

/** Meetspace mark: two arches forming an "m" (people meeting) with a coral live dot. */
export function Logo({ size = 28, withText = true, className }: { size?: number; withText?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-bold', className)}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
        <defs>
          <linearGradient id="ms-tile" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#149c89" />
            <stop offset="1" stopColor="#0c665c" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9.5" fill="url(#ms-tile)" />
        <path d="M8.5 23v-7.25a3.75 3.75 0 0 1 7.5 0V23m0-7.25a3.75 3.75 0 0 1 7.5 0V23" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24.25" cy="8.25" r="2.75" fill="#fd7f4f" />
      </svg>
      {withText && (
        <span className="font-display tracking-tight" style={{ fontSize: size * 0.74 }}>
          meetspace
        </span>
      )}
    </span>
  )
}

export function Avatar({ userId, size = 24, ring = false }: { userId: ID; size?: number; ring?: boolean }) {
  const user = useStore((s) => s.users.find((u) => u.id === userId))
  if (!user) return null
  return (
    <span
      title={user.name}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', ring && 'ring-2 ring-[var(--bg)]')}
      style={{ width: size, height: size, background: user.color, fontSize: size * 0.4 }}
    >
      {initials(user.name)}
    </span>
  )
}

export function AvatarStack({ ids, size = 24, max = 3 }: { ids: ID[]; size?: number; max?: number }) {
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {ids.slice(0, max).map((id) => (
        <Avatar key={id} userId={id} size={size} ring />
      ))}
      {ids.length > max && (
        <span className="surface-muted text-muted inline-flex items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-[var(--bg)]" style={{ width: size, height: size }}>
          +{ids.length - max}
        </span>
      )}
    </span>
  )
}

/** Anchored floating panel rendered in a portal, closes on outside click / Escape. */
export function Popover({
  open,
  onClose,
  anchor,
  children,
  align = 'start',
  side = 'bottom',
  width = 220,
}: {
  open: boolean
  onClose: () => void
  anchor: HTMLElement | null
  children: ReactNode
  align?: 'start' | 'end'
  /** bottom: below the anchor (flips above if needed); right: beside it, e.g. from the rail. */
  side?: 'bottom' | 'right'
  width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchor) return
    const r = anchor.getBoundingClientRect()
    const h = ref.current?.offsetHeight ?? 240
    if (side === 'right') {
      setPos({ top: Math.min(Math.max(8, r.top), window.innerHeight - h - 8), left: Math.min(r.right + 8, window.innerWidth - width - 8) })
      return
    }
    let top = r.bottom + 4
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4)
    let left = align === 'end' ? r.right - width : r.left
    left = Math.min(Math.max(8, left), window.innerWidth - width - 8)
    setPos({ top, left })
  }, [open, anchor, align, side, width])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, anchor])

  if (!open) return null
  return createPortal(
    <div
      ref={ref}
      className="surface shadow-pop text-app fixed z-[100] rounded-lg p-1 text-sm"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}

export function MenuItem({ children, onClick, active, danger }: { children: ReactNode; onClick?: () => void; active?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('hover-surface flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left', danger && 'text-red-500')}
    >
      {children}
      {active && <Check size={14} className="ml-auto text-brand-600" />}
    </button>
  )
}

export function usePopover() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return {
    anchor,
    open: !!anchor,
    toggle: (e: React.MouseEvent<HTMLElement>) => {
      e.stopPropagation()
      const el = e.currentTarget
      setAnchor((a) => (a ? null : el))
    },
    close: () => setAnchor(null),
  }
}

export function StatusPill({ status, size = 'sm' }: { status?: Status; size?: 'sm' | 'xs' }) {
  if (!status) return null
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded font-semibold uppercase tracking-wide text-white', size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-1.5 py-px text-[10px]')}
      style={{ background: status.color }}
    >
      {status.name}
    </span>
  )
}

export function StatusDot({ status, size = 14 }: { status?: Status; size?: number }) {
  if (!status) return null
  const done = status.type === 'done' || status.type === 'closed'
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, border: `2px solid ${status.color}`, background: done ? status.color : status.type === 'active' ? `${status.color}33` : 'transparent' }}
    >
      {done && <Check size={size - 6} strokeWidth={4} className="text-white" />}
    </span>
  )
}

export function StatusMenu({ statuses, value, onChange, children, className }: { statuses: Status[]; value: ID; onChange: (id: ID) => void; children: ReactNode; className?: string }) {
  const p = usePopover()
  return (
    <>
      <button type="button" onClick={p.toggle} className={className}>
        {children}
      </button>
      <Popover open={p.open} anchor={p.anchor} onClose={p.close}>
        <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">Status</div>
        {statuses.map((s) => (
          <MenuItem key={s.id} active={s.id === value} onClick={() => (onChange(s.id), p.close())}>
            <StatusDot status={s} />
            {s.name}
          </MenuItem>
        ))}
      </Popover>
    </>
  )
}

export function PriorityFlag({ priority, showLabel = false }: { priority: Priority; showLabel?: boolean }) {
  const m = priorityMeta(priority)
  if (!m) return <Flag size={14} className="text-faint" />
  return (
    <span className="inline-flex items-center gap-1.5">
      <Flag size={14} fill={m.color} color={m.color} />
      {showLabel && <span>{m.label}</span>}
    </span>
  )
}

export function PriorityMenu({ value, onChange, showLabel, className }: { value: Priority; onChange: (p: Priority) => void; showLabel?: boolean; className?: string }) {
  const p = usePopover()
  return (
    <>
      <button type="button" onClick={p.toggle} className={cn('hover-surface inline-flex items-center rounded px-1 py-0.5', className)}>
        <PriorityFlag priority={value} showLabel={showLabel && !!value} />
        {showLabel && !value && <span className="text-faint ml-1.5">Empty</span>}
      </button>
      <Popover open={p.open} anchor={p.anchor} onClose={p.close} width={180}>
        {PRIORITIES.map((pr) => (
          <MenuItem key={pr.value} active={value === pr.value} onClick={() => (onChange(pr.value), p.close())}>
            <Flag size={14} fill={pr.color} color={pr.color} /> {pr.label}
          </MenuItem>
        ))}
        <div className="border-app my-1 border-t" />
        <MenuItem onClick={() => (onChange(null), p.close())}>
          <X size={14} /> Clear
        </MenuItem>
      </Popover>
    </>
  )
}

export function AssigneeMenu({ value, onChange, size = 24, className }: { value: ID[]; onChange: (ids: ID[]) => void; size?: number; className?: string }) {
  const users = useStore(
    useShallow((s) => {
      const members = s.workspaces.find((w) => w.id === s.currentWorkspaceId)?.members
      return members?.length ? s.users.filter((u) => members.some((m) => m.userId === u.id)) : s.users
    }),
  )
  const p = usePopover()
  const [q, setQ] = useState('')
  return (
    <>
      <button type="button" onClick={p.toggle} className={cn('inline-flex items-center rounded', className)}>
        {value.length ? (
          <AvatarStack ids={value} size={size} />
        ) : (
          <span className="text-faint inline-flex items-center justify-center rounded-full border border-dashed border-current" style={{ width: size, height: size }}>
            <UserPlus size={size * 0.55} />
          </span>
        )}
      </button>
      <Popover open={p.open} anchor={p.anchor} onClose={p.close} width={240}>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="surface-subtle border-app mb-1 w-full rounded-md border px-2 py-1.5 outline-none" />
        {users
          .filter((u) => u.name.toLowerCase().includes(q.toLowerCase()))
          .map((u) => (
            <MenuItem key={u.id} active={value.includes(u.id)} onClick={() => onChange(value.includes(u.id) ? value.filter((x) => x !== u.id) : [...value, u.id])}>
              <Avatar userId={u.id} size={22} /> {u.name}
            </MenuItem>
          ))}
      </Popover>
    </>
  )
}

export function DateButton({ value, onChange, done = false, placeholder, className }: { value: string | null; onChange: (v: string | null) => void; done?: boolean; placeholder?: ReactNode; className?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const overdue = isOverdue(value, done)
  return (
    <span className={cn('group/date relative inline-flex items-center', className)}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          try {
            ref.current?.showPicker()
          } catch {
            ref.current?.focus()
          }
        }}
        className={cn('hover-surface inline-flex items-center gap-1 rounded px-1 py-0.5 text-[13px]', overdue ? 'text-red-500' : value ? '' : 'text-faint')}
      >
        {value ? friendlyDate(value) : placeholder ?? <Calendar size={14} />}
      </button>
      {value && (
        <button type="button" onClick={(e) => (e.stopPropagation(), onChange(null))} className="text-faint ml-0.5 hidden group-hover/date:inline-flex" aria-label="Clear date">
          <X size={12} />
        </button>
      )}
      <input ref={ref} type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0" tabIndex={-1} />
    </span>
  )
}

export function Tag({ name, onRemove }: { name: string; onRemove?: () => void }) {
  const c = tagColor(name)
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[11px] font-medium" style={{ background: `${c}22`, color: c }}>
      {name}
      {onRemove && (
        <button type="button" onClick={(e) => (e.stopPropagation(), onRemove())} aria-label={`Remove ${name}`}>
          <X size={10} />
        </button>
      )}
    </span>
  )
}

export function Modal({ open, onClose, children, className }: { open: boolean; onClose: () => void; children: ReactNode; className?: string }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-2 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cn('surface text-app shadow-pop max-h-full w-full overflow-hidden rounded-xl', className)}>{children}</div>
    </div>,
    document.body,
  )
}

export function InlineEdit({ value, onSave, className, placeholder }: { value: string; onSave: (v: string) => void; className?: string; placeholder?: string }) {
  const [v, setV] = useState(value)
  useEffect(() => {
    setV(value)
  }, [value])
  return (
    <input
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() && v !== value ? onSave(v.trim()) : setV(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') (setV(value), (e.target as HTMLInputElement).blur())
      }}
      className={cn('min-w-0 bg-transparent outline-none', className)}
    />
  )
}
