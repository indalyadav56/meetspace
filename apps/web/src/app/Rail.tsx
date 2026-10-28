import { useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Blocks, CalendarDays, ClipboardList, Crown, FileText, Film, Grip, Home, Inbox, Zap, LayoutDashboard, Layers, MessagesSquare, PenTool, Settings, Sparkles, Timer, Trophy, UserPlus, Users, Workflow, type LucideIcon } from 'lucide-react'
import { Popover, usePopover } from './components/ui'
import { InviteDialog, UpgradeDialog } from './RailActions'
import { useStore } from '../store/useStore'
import { useUnreadChat } from './pages/ChatPage'
import { useInbox } from './inbox/items'
import { cn } from '../lib/utils'

// The rail shows the everyday tools; the rest live under "More".
const items = [
  { to: '/app/home', label: 'Home', icon: Home },
  { to: '/app/inbox', label: 'Inbox', icon: Inbox },
  { to: '/app/planner', label: 'Planner', icon: CalendarDays },
  { to: '/app/ai', label: 'AI', icon: Sparkles },
  { to: '/app/chat', label: 'Chat', icon: MessagesSquare },
  { to: '/app/everything', label: 'Spaces', icon: Layers },
  { to: '/app/teams', label: 'Teams', icon: Users },
  { to: '/app/docs', label: 'Docs', icon: FileText },
  { to: '/app/dashboards', label: 'Dashboards', icon: LayoutDashboard },
  { to: '/app/whiteboards', label: 'Whiteboard', icon: PenTool },
  { to: '/app/forms', label: 'Forms', icon: ClipboardList },
  { to: '/app/clips', label: 'Clips', icon: Film },
  { to: '/app/goals', label: 'Goals', icon: Trophy },
]

const moreItems = [
  { to: '/app/sprints', label: 'Sprints', icon: Zap },
  { to: '/app/timesheets', label: 'Timesheets', icon: Timer },
  { to: '/app/automations', label: 'Automations', icon: Workflow },
  { to: '/app/apps', label: 'App Center', icon: Blocks },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

/** One rail entry: icon tile + label; `active` highlights it. */
function RailItem({ icon: Icon, label, active, mobile, children }: { icon: LucideIcon; label: string; active: boolean; mobile: boolean; children?: ReactNode }) {
  return (
    <>
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
          active ? 'bg-brand-600 text-white' : mobile ? 'group-hover:bg-white/10' : 'group-hover:bg-[var(--bg-hover)]',
        )}
      >
        <Icon size={17} />
      </span>
      {label}
      {children}
    </>
  )
}

const itemClass = (active: boolean, mobile: boolean) =>
  cn('group relative flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-lg py-1 text-[10px] font-medium', mobile ? 'text-white/70' : 'text-muted', active && (mobile ? 'text-white' : 'text-app'))

export default function Rail({ mobile = false }: { mobile?: boolean }) {
  // The Inbox badge counts to-dos; unread notifications live on the bell.
  const unread = useInbox().todo.length
  const chatUnread = [...useUnreadChat().values()].reduce((a, b) => a + b, 0)
  const liveCalls = useStore((s) => s.callLogs.filter((c) => !c.endedAt && c.liveParticipants?.length).length)
  const badge = (label: string) => (label === 'Inbox' ? unread : label === 'Chat' ? chatUnread : 0)
  const more = usePopover()
  const nav = useNavigate()
  const { pathname } = useLocation()
  const inMore = moreItems.some((m) => pathname.startsWith(m.to))
  const [dialog, setDialog] = useState<'invite' | 'upgrade' | null>(null)
  return (
    <nav className={cn('w-[68px] shrink-0 flex-col items-center', mobile ? 'flex bg-[var(--rail)]' : 'hidden md:flex')} aria-label="Primary">
      <div className="no-scrollbar flex min-h-0 w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto py-2">
        {items.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => itemClass(isActive, mobile)}>
            {({ isActive }) => (
              <RailItem icon={icon} label={label} active={isActive} mobile={mobile}>
                {badge(label) > 0 && <span className="absolute top-0 right-2 rounded-full bg-red-500 px-1 text-[9px] leading-4 font-bold text-white">{badge(label)}</span>}
                {label === 'Chat' && liveCalls > 0 && !badge(label) && <span className="absolute top-0.5 right-3 h-2.5 w-2.5 rounded-full border-2 border-[var(--rail,white)] bg-emerald-500" title="A call is live" />}
              </RailItem>
            )}
          </NavLink>
        ))}
        <button type="button" onClick={more.toggle} aria-haspopup="menu" aria-expanded={more.open} className={itemClass(more.open || inMore, mobile)}>
          <RailItem icon={Grip} label="More" active={more.open || inMore} mobile={mobile} />
        </button>
        <Popover open={more.open} anchor={more.anchor} onClose={more.close} side="right" width={264}>
          <div className="text-faint px-2 pt-1 pb-2 text-[11px] font-semibold uppercase">More tools</div>
          <div className="grid grid-cols-3 gap-1" role="menu">
            {moreItems.map(({ to, label, icon: Icon }) => {
              const active = pathname.startsWith(to)
              return (
                <button
                  key={to}
                  role="menuitem"
                  onClick={() => (more.close(), nav(to))}
                  className={cn('flex flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-[11px] font-medium', active ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-100' : 'hover-surface')}
                >
                  <Icon size={18} className={active ? '' : 'text-muted'} />
                  {label}
                </button>
              )
            })}
          </div>
        </Popover>
      </div>
      {/* Always visible below the scrolling list. */}
      <div className={cn('flex w-full flex-col items-center gap-0.5 border-t py-2', mobile ? 'border-white/10' : 'border-app')}>
        <button type="button" onClick={() => setDialog('invite')} className={itemClass(false, mobile)} title="Invite people">
          <RailItem icon={UserPlus} label="Invite" active={false} mobile={mobile} />
        </button>
        <button type="button" onClick={() => setDialog('upgrade')} className={itemClass(false, mobile)} title="Plans and upgrade">
          <RailItem icon={Crown} label="Upgrade" active={false} mobile={mobile} />
        </button>
      </div>
      <InviteDialog open={dialog === 'invite'} onClose={() => setDialog(null)} />
      <UpgradeDialog open={dialog === 'upgrade'} onClose={() => setDialog(null)} />
    </nav>
  )
}
