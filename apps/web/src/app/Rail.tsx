import { NavLink } from 'react-router-dom'
import { ClipboardList, FileText, Film, Home, Inbox, Zap, LayoutDashboard, Layers, MessagesSquare, PenTool, Timer, Trophy, Workflow } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useUnreadChat } from './pages/ChatPage'
import { cn } from '../lib/utils'

const items = [
  { to: '/app/home', label: 'Home', icon: Home },
  { to: '/app/inbox', label: 'Inbox', icon: Inbox },
  { to: '/app/chat', label: 'Chat', icon: MessagesSquare },
  { to: '/app/everything', label: 'Projects', icon: Layers },
  { to: '/app/docs', label: 'Docs', icon: FileText },
  { to: '/app/whiteboards', label: 'Boards', icon: PenTool },
  { to: '/app/clips', label: 'Clips', icon: Film },
  { to: '/app/sprints', label: 'Sprints', icon: Zap },
  { to: '/app/dashboards', label: 'Dashboards', icon: LayoutDashboard },
  { to: '/app/goals', label: 'Goals', icon: Trophy },
  { to: '/app/timesheets', label: 'Time', icon: Timer },
  { to: '/app/forms', label: 'Forms', icon: ClipboardList },
  { to: '/app/automations', label: 'Automate', icon: Workflow },
]

export default function Rail({ mobile = false }: { mobile?: boolean }) {
  const unread = useStore((s) => s.notifications.filter((n) => !n.read && !n.cleared).length)
  const chatUnread = [...useUnreadChat().values()].reduce((a, b) => a + b, 0)
  const liveCalls = useStore((s) => s.callLogs.filter((c) => !c.endedAt && c.liveParticipants?.length).length)
  const badge = (label: string) => (label === 'Inbox' ? unread : label === 'Chat' ? chatUnread : 0)
  return (
    <nav className={cn('no-scrollbar w-[68px] shrink-0 flex-col items-center gap-0.5 overflow-y-auto py-2', mobile ? 'flex bg-[var(--rail)]' : 'hidden md:flex')} aria-label="Primary">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn('group relative flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-lg py-1 text-[10px] font-medium', mobile ? 'text-white/70' : 'text-muted', isActive && (mobile ? 'text-white' : 'text-app'))
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                  isActive ? 'bg-brand-600 text-white' : mobile ? 'group-hover:bg-white/10' : 'group-hover:bg-[var(--bg-hover)]',
                )}
              >
                <Icon size={17} />
              </span>
              {label}
              {badge(label) > 0 && <span className="absolute top-0 right-2 rounded-full bg-red-500 px-1 text-[9px] leading-4 font-bold text-white">{badge(label)}</span>}
              {label === 'Chat' && liveCalls > 0 && !badge(label) && <span className="absolute top-0.5 right-3 h-2.5 w-2.5 rounded-full border-2 border-[var(--rail,white)] bg-emerald-500" title="A call is live" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
