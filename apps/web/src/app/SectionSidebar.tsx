import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  AlarmClock,
  AtSign,
  Bell,
  CalendarDays,
  CheckSquare,
  Clock,
  Database,
  FileText,
  Film,
  Inbox as InboxIcon,
  LayoutDashboard,
  Layers,
  List as ListIcon,
  MessageSquareDot,
  Mic,
  Monitor,
  PenTool,
  Plus,
  Settings,
  ScrollText,
  ShieldCheck, UserLock,
  Share2,
  Star,
  Archive,
  CheckCircle2,
  CheckCheck,
  AlertTriangle,
  UserPlus,
  Tag as TagIcon,
  Target,
  Timer,
  Trash2,
  Users,
  Video,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useInbox, type InboxKind } from './inbox/items'
import { useStore } from '../store/useStore'
import { ProjectsSidebar, rowCls } from './Sidebar'
import { AISidebar } from './pages/ai/AISidebar'
import { PlannerSidebar } from './pages/planner/PlannerSidebar'
import { AppsSidebar } from './pages/apps/AppsSidebar'
import { TeamsSidebar } from './pages/teams/TeamsSidebar'
import { cn } from '../lib/utils'

/*
 * The second column follows the rail: each section shows its own navigation
 * (Home → your work, Docs → docs, AI → assistant and agents, …). Links that
 * carry ?tab= / ?project= query parameters drive the page's own state.
 */

export function SidebarShell({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <aside className="surface-subtle text-app flex h-full w-full min-w-0 flex-col overflow-y-auto px-2 pb-4 scroll-thin md:w-64" aria-label={`${title} navigation`}>
      <div className="flex h-11 shrink-0 items-center px-2">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </aside>
  )
}

export function Group({ label, action, children }: { label?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-2">
      {label && (
        <div className="flex items-center px-2 py-1">
          <span className="text-faint text-[11px] font-semibold tracking-wide uppercase">{label}</span>
          {action && <span className="ml-auto">{action}</span>}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * A sidebar link. It is active when the path matches and, for each key in
 * `keys`, the query parameter matches too (missing = the page's default).
 */
export function Row({
  to,
  icon: Icon,
  iconNode,
  label,
  count,
  keys = [],
  prefix,
  isDefault,
  onClick,
}: {
  to?: string
  icon?: LucideIcon
  iconNode?: ReactNode
  label: string
  count?: number
  keys?: string[]
  prefix?: boolean
  /** Also active when none of `keys` is in the URL (the page's default choice). */
  isDefault?: boolean
  onClick?: () => void
}) {
  const loc = useLocation()
  let active = false
  if (to) {
    const target = new URL(to, 'http://x')
    const cur = new URLSearchParams(loc.search)
    const pathOk = prefix ? loc.pathname.startsWith(target.pathname) : loc.pathname === target.pathname
    const unset = keys.length > 0 && keys.every((k) => !cur.has(k))
    active = pathOk && (keys.every((k) => (cur.get(k) ?? '') === (target.searchParams.get(k) ?? '')) || (!!isDefault && unset))
  }
  const body = (
    <>
      {iconNode ?? (Icon && <Icon size={15} className={active ? '' : 'text-muted'} />)}
      <span className="truncate">{label}</span>
      {count !== undefined && count > 0 && <span className="text-faint ml-auto text-[11px] tabular-nums">{count}</span>}
    </>
  )
  if (!to)
    return (
      <button type="button" onClick={onClick} className={cn(rowCls({ isActive: false }), 'w-full text-left')}>
        {body}
      </button>
    )
  return (
    <Link to={to} onClick={onClick} className={rowCls({ isActive: active })} aria-current={active ? 'page' : undefined}>
      {body}
    </Link>
  )
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-muted hover-surface rounded p-1" aria-label={label} title={label}>
      <Plus size={15} />
    </button>
  )
}

const Swatch = ({ color, name }: { color: string; name: string }) => (
  <span className="inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded text-[9px] font-bold text-white" style={{ background: color }}>
    {name[0]?.toUpperCase()}
  </span>
)

/** Projects as filter rows (?project=) for pages that work per project. */
function ProjectFilter({ path, all, defaultIndex }: { path: string; all?: string; defaultIndex?: number }) {
  const spaces = useStore((s) => s.spaces)
  return (
    <Group label="Spaces">
      {all && <Row to={path} icon={Layers} label={all} keys={['project']} />}
      {spaces.map((sp, i) => (
        <Row key={sp.id} to={`${path}?project=${sp.id}`} iconNode={<Swatch color={sp.color} name={sp.name} />} label={sp.name} keys={['project']} isDefault={!all && i === (defaultIndex ?? 0)} />
      ))}
    </Group>
  )
}

function useFavoritesAndRecents() {
  const s = useStore()
  const resolve = (id: string) => {
    const l = s.lists.find((x) => x.id === id)
    if (l) return { id, label: l.name, to: `/app/list/${id}`, icon: ListIcon }
    const d = s.docs.find((x) => x.id === id)
    if (d) return { id, label: d.title || 'Untitled', to: `/app/docs/${id}`, icon: FileText }
    const t = s.tasks.find((x) => x.id === id)
    if (t) return { id, label: t.title, task: id, icon: CheckSquare }
    return null
  }
  return {
    favorites: s.favorites.map(resolve).filter(Boolean) as NonNullable<ReturnType<typeof resolve>>[],
    recents: s.recents.map(resolve).filter(Boolean).slice(0, 8) as NonNullable<ReturnType<typeof resolve>>[],
  }
}

function HomeSidebar() {
  const s = useStore()
  const me = s.currentUserId
  const unread = s.notifications.filter((n) => !n.read && !n.cleared).length
  const mine = s.tasks.filter((t) => me && t.assignees.includes(me) && !t.parentId).length
  const assignedComments = s.comments.filter((c) => c.assignee === me && !c.resolved).length
  const { favorites, recents } = useFavoritesAndRecents()
  return (
    <SidebarShell title="Home">
      <Group>
        <Row to="/app/home" icon={LayoutDashboard} label="Overview" />
        <Row to="/app/inbox" icon={InboxIcon} label="Inbox" count={unread} />
        <Row to="/app/planner" icon={CalendarDays} label="Planner" />
        <Row to="/app/comments" icon={MessageSquareDot} label="Assigned comments" count={assignedComments} keys={['tab']} prefix />
        <Row to="/app/meetings" icon={Video} label="Meetings" />
        <Row to="/app/everything?mine=1" icon={CheckSquare} label="My tasks" count={mine} keys={['mine']} />
        <Row to="/app/timesheets" icon={Timer} label="My timesheet" />
      </Group>
      {favorites.length > 0 && (
        <Group label="Favorites">
          {favorites.map((f) => (
            <Row key={f.id} to={f.to} onClick={f.task ? () => s.openTask(f.task!) : undefined} iconNode={<Star size={14} className="fill-amber-400 text-amber-400" />} label={f.label} />
          ))}
        </Group>
      )}
      {recents.length > 0 && (
        <Group label="Recent">
          {recents.map((r) => (r.task ? <Row key={r.id} icon={r.icon} label={r.label} onClick={() => s.openTask(r.task!)} /> : <Row key={r.id} to={r.to} icon={r.icon} label={r.label} />))}
        </Group>
      )}
    </SidebarShell>
  )
}

function InboxSidebar() {
  const inbox = useInbox()
  const unread = useStore((s) => s.notifications.filter((n) => !n.read && !n.cleared).length)
  const n = (k: InboxKind) => inbox.todo.filter((it) => it.kind === k).length
  return (
    <SidebarShell title="Inbox">
      <Group>
        <Row to="/app/inbox" icon={InboxIcon} label="To do" count={inbox.todo.length} keys={['tab', 'kind']} />
        <Row to="/app/inbox?tab=later" icon={AlarmClock} label="Later" count={inbox.later.length} keys={['tab', 'kind']} />
        <Row to="/app/inbox?tab=done" icon={CheckCheck} label="Done" keys={['tab', 'kind']} />
      </Group>
      <Group label="Needs you">
        <Row to="/app/inbox?kind=overdue" icon={AlertTriangle} label="Overdue" count={n('overdue')} keys={['tab', 'kind']} />
        <Row to="/app/inbox?kind=today" icon={CalendarDays} label="Due today" count={n('today')} keys={['tab', 'kind']} />
        <Row to="/app/inbox?kind=assigned" icon={UserPlus} label="Assigned to you" count={n('assigned')} keys={['tab', 'kind']} />
        <Row to="/app/inbox?kind=mention" icon={AtSign} label="Mentions" count={n('mention')} keys={['tab', 'kind']} />
        <Row to="/app/inbox?kind=comment" icon={MessageSquareDot} label="Assigned comments" count={n('comment')} keys={['tab', 'kind']} />
        <Row to="/app/inbox?kind=reminder" icon={AlarmClock} label="Reminders" count={n('reminder')} keys={['tab', 'kind']} />
      </Group>
      <Group label="Related">
        <Row to="/app/notifications" icon={Bell} label="Notifications" count={unread} />
        <Row to="/app/planner" icon={CalendarDays} label="Planner" />
        <Row to="/app/settings?tab=notifications" icon={Settings} label="Notification settings" />
      </Group>
    </SidebarShell>
  )
}

function DocsSidebar() {
  const s = useStore()
  const nav = useNavigate()
  const favs = s.docs.filter((d) => s.favorites.includes(d.id))
  const groups = [{ id: null as string | null, name: 'Workspace', color: '#78716c' }, ...s.spaces.map((sp) => ({ id: sp.id, name: sp.name, color: sp.color }))]
  return (
    <SidebarShell title="Docs" action={<AddButton label="New doc" onClick={() => nav(`/app/docs/${s.addDoc(null)}`)} />}>
      <Group>
        <Row to="/app/docs" icon={FileText} label="All docs" count={s.docs.length} keys={['in']} />
        <Row to="/app/docs?in=mine" icon={Users} label="My docs" count={s.docs.filter((d) => d.createdBy === s.currentUserId).length} keys={['in']} />
        <Row to="/app/docs?in=meetings" icon={Video} label="Meeting notes" keys={['in']} />
        <Row to="/app/docs?in=favorites" icon={Star} label="Favorites" count={favs.length} keys={['in']} />
      </Group>
      {favs.length > 0 && (
        <Group label="Favorites">
          {favs.map((d) => (
            <Row key={d.id} to={`/app/docs/${d.id}`} iconNode={<span className="w-[15px] text-center text-xs">{d.emoji}</span>} label={d.title || 'Untitled'} />
          ))}
        </Group>
      )}
      {groups.map((g) => {
        const docs = s.docs.filter((d) => (d.spaceId ?? null) === g.id)
        if (!docs.length) return null
        return (
          <Group key={g.id ?? 'ws'} label={g.name} action={<AddButton label={`New doc in ${g.name}`} onClick={() => nav(`/app/docs/${s.addDoc(g.id)}`)} />}>
            {docs.map((d) => (
              <Row key={d.id} to={`/app/docs/${d.id}`} iconNode={<span className="w-[15px] text-center text-xs">{d.emoji}</span>} label={d.title || 'Untitled'} />
            ))}
          </Group>
        )
      })}
    </SidebarShell>
  )
}

function BoardsSidebar() {
  const s = useStore()
  const nav = useNavigate()
  const mine = s.whiteboards.filter((w) => w.createdBy === s.currentUserId)
  const favs = s.whiteboards.filter((w) => s.favorites.includes(w.id))
  const recent = s.recents.map((id) => s.whiteboards.find((w) => w.id === id)).filter((w) => !!w).slice(0, 6)
  const board = (w: { id: string; title: string }) => <Row key={w.id} to={`/app/whiteboards/${w.id}`} icon={PenTool} label={w.title || 'Untitled whiteboard'} />
  return (
    <SidebarShell title="Whiteboard" action={<AddButton label="New whiteboard" onClick={() => nav(`/app/whiteboards/${s.addWhiteboard()}`)} />}>
      <Group>
        <Row to="/app/whiteboards" icon={PenTool} label="All whiteboards" count={s.whiteboards.length} keys={['mine']} />
        <Row to="/app/whiteboards?mine=1" icon={Users} label="My whiteboards" count={mine.length} keys={['mine']} />
      </Group>
      <Group label="Favorites">
        {favs.length ? favs.map(board) : <p className="text-faint px-2 py-1 text-xs">Star a whiteboard to see it here.</p>}
      </Group>
      {recent.length > 0 && <Group label="Recents">{recent.map(board)}</Group>}
    </SidebarShell>
  )
}

function DashboardsSidebar() {
  const s = useStore()
  const nav = useNavigate()
  const mine = s.dashboards.filter((d) => d.createdBy === s.currentUserId)
  const favs = s.dashboards.filter((d) => s.favorites.includes(d.id))
  const dash = (d: { id: string; title: string }) => <Row key={d.id} to={`/app/dashboards/${d.id}`} icon={LayoutDashboard} label={d.title} />
  return (
    <SidebarShell title="Dashboards" action={<AddButton label="New dashboard" onClick={() => nav(`/app/dashboards/${s.addDashboard()}`)} />}>
      <Group>
        <Row to="/app/dashboards" icon={LayoutDashboard} label="All dashboards" count={s.dashboards.length} keys={['in']} />
        <Row to="/app/dashboards?in=mine" icon={Users} label="My dashboards" count={mine.length} keys={['in']} />
        <Row to="/app/dashboards?in=favorites" icon={Star} label="Favorites" count={favs.length} keys={['in']} />
      </Group>
      {s.dashboards.length > 0 && <Group label="Dashboards">{s.dashboards.map(dash)}</Group>}
    </SidebarShell>
  )
}

function FormsSidebar() {
  const s = useStore()
  const nav = useNavigate()
  const list = s.lists[0]
  return (
    <SidebarShell title="Forms" action={list && <AddButton label="New form" onClick={() => nav(`/app/forms/${s.addForm(list.id)}`)} />}>
      <Group>
        <Row to="/app/forms" icon={FileText} label="All forms" count={s.forms.length} keys={['in']} />
        <Row to="/app/forms?in=active" icon={CheckCircle2} label="Active" count={s.forms.filter((f) => f.active).length} keys={['in']} />
        <Row to="/app/forms?in=closed" icon={Archive} label="Closed" count={s.forms.filter((f) => !f.active).length} keys={['in']} />
        <Row to="/app/forms?in=favorites" icon={Star} label="Favorites" count={s.forms.filter((f) => s.favorites.includes(f.id)).length} keys={['in']} />
      </Group>
      {s.forms.length > 0 && (
        <Group label="Forms">
          {s.forms.map((f) => (
            <Row key={f.id} to={`/app/forms/${f.id}`} iconNode={<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.color }} />} label={f.title} count={f.submissions} />
          ))}
        </Group>
      )}
    </SidebarShell>
  )
}

function ClipsSidebar() {
  const clips = useStore((s) => s.clips)
  const me = useStore((s) => s.currentUserId)
  const n = (k?: string) => (k ? clips.filter((c) => c.kind === k).length : clips.length)
  return (
    <SidebarShell title="Clips">
      <Group>
        <Row to="/app/clips" icon={Film} label="All clips" count={n()} keys={['kind', 'owner']} />
        <Row to="/app/clips?kind=video" icon={Monitor} label="Video clips" count={n('screen') + n('camera') + n('screen+camera')} keys={['kind', 'owner']} />
        <Row to="/app/clips?kind=audio" icon={Mic} label="Voice clips" count={n('audio')} keys={['kind', 'owner']} />
        <Row to="/app/clips?kind=call" icon={Video} label="Call recordings" count={n('call')} keys={['kind', 'owner']} />
      </Group>
      <Group label="People">
        <Row to="/app/clips?owner=mine" icon={Users} label="Created by me" count={clips.filter((c) => c.createdBy === me).length} keys={['kind', 'owner']} />
        <Row to="/app/clips?owner=others" icon={Share2} label="Shared with me" count={clips.filter((c) => c.createdBy !== me).length} keys={['kind', 'owner']} />
      </Group>
    </SidebarShell>
  )
}

function GoalsSidebar() {
  const s = useStore()
  const folders = [...new Set(s.goals.map((g) => g.folder || 'Goals'))]
  return (
    <SidebarShell title="Goals" action={<AddButton label="New goal" onClick={() => s.addGoal()} />}>
      <Group>
        <Row to="/app/goals" icon={Target} label="All goals" count={s.goals.length} keys={['goal']} />
      </Group>
      {folders.map((f) => (
        <Group key={f} label={f}>
          {s.goals
            .filter((g) => (g.folder || 'Goals') === f)
            .map((g) => (
              <Row key={g.id} to={`/app/goals?goal=${g.id}`} iconNode={<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.color }} />} label={g.name} keys={['goal']} />
            ))}
        </Group>
      ))}
    </SidebarShell>
  )
}

function SettingsSidebar() {
  return (
    <SidebarShell title="Settings">
      <Group label="Workspace">
        <Row to="/app/settings" icon={Settings} label="General" keys={['tab']} />
        <Row to="/app/settings?tab=members" icon={Users} label="Members" keys={['tab']} />
        <Row to="/app/settings?tab=data" icon={Database} label="Import & export" keys={['tab']} />
        <Row to="/app/settings?tab=notifications" icon={Bell} label="Notifications" keys={['tab']} />
        <Row to="/app/settings?tab=calendar" icon={CalendarDays} label="Calendar sync" keys={['tab']} />
      </Group>
      <Group label="Security">
        <Row to="/app/settings?tab=security" icon={ShieldCheck} label="Security & sign-in" keys={['tab']} />
        <Row to="/app/settings?tab=privacy" icon={UserLock} label="Privacy & data" keys={['tab']} />
        <Row to="/app/settings?tab=audit" icon={ScrollText} label="Audit log" keys={['tab']} />
      </Group>
      <Group label="Features">
        <Row to="/app/settings?tab=tags" icon={TagIcon} label="Tag manager" keys={['tab']} />
        <Row to="/app/settings?tab=trash" icon={Trash2} label="Trash" keys={['tab']} />
      </Group>
      <Group label="Connections">
        <Row to="/app/apps" icon={Zap} label="App Center" prefix />
        <Row to="/app/automations" icon={Workflow} label="Automations" />
      </Group>
    </SidebarShell>
  )
}

function TimeSidebar() {
  const timer = useStore((s) => s.timer)
  const task = useStore((s) => s.tasks.find((t) => t.id === s.timer?.taskId))
  const openTask = useStore((s) => s.openTask)
  return (
    <SidebarShell title="Time">
      <Group>
        <Row to="/app/timesheets" icon={Timer} label="Timesheets" />
        <Row to="/app/planner" icon={CalendarDays} label="Planner" />
      </Group>
      {timer && task && (
        <Group label="Running now">
          <Row icon={Clock} label={task.title} onClick={() => openTask(task.id)} />
        </Group>
      )}
    </SidebarShell>
  )
}

function SprintsSidebar() {
  // Mirrors SprintsPage's default: the first project that has sprints.
  const idx = useStore((s) => Math.max(0, s.spaces.findIndex((sp) => s.sprints.some((x) => x.spaceId === sp.id))))
  return (
    <SidebarShell title="Sprints">
      <ProjectFilter path="/app/sprints" defaultIndex={idx} />
    </SidebarShell>
  )
}

function sectionOf(pathname: string) {
  return pathname.split('/')[2] ?? 'home'
}

/** Sections that keep their own list inside the page (chat). */
export function hasSectionSidebar(pathname: string) {
  return sectionOf(pathname) !== 'chat'
}

export default function SectionSidebar() {
  const { pathname } = useLocation()
  switch (sectionOf(pathname)) {
    case 'home':
    case 'comments':
    case 'meetings':
      return <HomeSidebar />
    case 'inbox':
    case 'notifications':
      return <InboxSidebar />
    case 'docs':
      return <DocsSidebar />
    case 'whiteboards':
      return <BoardsSidebar />
    case 'forms':
      return <FormsSidebar />
    case 'clips':
      return <ClipsSidebar />
    case 'goals':
      return <GoalsSidebar />
    case 'settings':
      return <SettingsSidebar />
    case 'timesheets':
      return <TimeSidebar />
    case 'dashboards':
      return <DashboardsSidebar />
    case 'sprints':
      return <SprintsSidebar />
    case 'automations':
      return (
        <SidebarShell title="Automations">
          <ProjectFilter path="/app/automations" />
        </SidebarShell>
      )
    case 'ai':
      return <AISidebar />
    case 'planner':
      return <PlannerSidebar />
    case 'apps':
      return <AppsSidebar />
    case 'teams':
      return <TeamsSidebar />
    default:
      return (
        <SidebarShell title="Spaces">
          <ProjectsSidebar />
        </SidebarShell>
      )
  }
}
