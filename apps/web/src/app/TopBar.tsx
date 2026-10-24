import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, BellOff, CalendarClock, CheckSquare, FileText, ListChecks, LogOut, Menu, MessageSquareText, PanelLeft, Pause, PenTool, Plus, Search, Sparkles, Target } from 'lucide-react'
import { clock, useElapsed } from './task/TaskExtras'
import { useMe, useStore } from '../store/useStore'
import { Avatar, Logo, MenuItem, Modal, Popover, usePopover } from './components/ui'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import { cn } from '../lib/utils'
import { useAssistant } from './ai/useAssistant'
import { CallPill } from './calls/CallLayer'
import QuickActions from './QuickActions'
import { useCall } from './calls/useCall'
import { useCreateTask } from './task/CreateTaskModal'
import AccountMenu, { liveStatus } from './AccountMenu'
import { isMuted, usePersonal } from './personal'

export default function TopBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const me = useMe()
  const { logout, toggleSidebar } = useStore()
  const myStatus = liveStatus(me)
  const mutedUntil = usePersonal((s) => s.mutedUntil)
  const muted = isMuted(mutedUntil)
  // Re-render when a mute runs out so the bell comes back on its own.
  const [, tick] = useState(0)
  useEffect(() => {
    if (!muted || !mutedUntil) return
    const t = setTimeout(() => tick((n) => n + 1), Math.min(new Date(mutedUntil).getTime() - Date.now() + 500, 2 ** 31 - 1))
    return () => clearTimeout(t)
  }, [muted, mutedUntil])
  const unread = useStore((s) => s.notifications.filter((n) => !n.read && !n.cleared).length)
  const nav = useNavigate()
  const userMenu = usePopover()
  const newMenu = usePopover()
  const aiMenu = usePopover()
  const aiOpen = useAssistant((s) => s.open)
  const openTaskId = useStore((s) => s.openTaskId)
  const askAI = (prompt?: string) => {
    aiMenu.close()
    if (prompt) useAssistant.getState().ask(prompt)
    else useAssistant.getState().setOpen(true)
  }
  const create = (fn: () => void) => () => {
    fn()
    newMenu.close()
  }
  const [confirmLogout, setConfirmLogout] = useState(false)

  const quickTask = () => {
    newMenu.close()
    useCreateTask.getState().open({ listId: location.pathname.match(/\/app\/list\/([^/]+)/)?.[1], assignees: [me.id] })
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 px-2 md:px-3">
      <button onClick={onMenu} className="hover-surface rounded-md p-1.5 md:hidden" aria-label="Open navigation">
        <Menu size={18} />
      </button>
      <Link to="/app/home" className="flex items-center md:w-[60px] md:justify-center">
        <Logo size={24} withText={false} />
      </Link>
      <button onClick={toggleSidebar} className="hover-surface text-muted hidden rounded-md p-1.5 md:inline-flex" aria-label="Toggle sidebar">
        <PanelLeft size={17} />
      </button>
      <WorkspaceSwitcher />

      <button
        onClick={onSearch}
        className="surface border-app text-faint mx-auto flex h-8 w-full min-w-0 max-w-md items-center gap-2 rounded-lg border px-3 text-sm"
      >
        <Search size={15} />
        <span className="truncate">Search tasks, docs, lists…</span>
        <kbd className="surface-muted ml-auto hidden rounded px-1.5 text-[11px] sm:inline">⌘K</kbd>
      </button>

      <CallPill />
      <RunningTimer />
      <QuickActions />
      <button
        onClick={aiMenu.toggle}
        aria-expanded={aiMenu.open}
        className={cn(
          'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ring-1 transition-colors ring-inset',
          aiOpen || aiMenu.open
            ? 'bg-brand-600 text-white ring-brand-600'
            : 'bg-brand-50 text-brand-700 ring-brand-200 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30 dark:hover:bg-brand-500/25',
        )}
        title="Ask AI (⌘J)"
      >
        <Sparkles size={15} className={aiOpen || aiMenu.open ? '' : 'text-accent-500'} /> <span className="hidden sm:inline">Ask AI</span>
      </button>
      <Popover open={aiMenu.open} anchor={aiMenu.anchor} onClose={aiMenu.close} align="end" width={250}>
        <MenuItem onClick={() => askAI()}>
          <Sparkles size={15} className="text-accent-500" /> Ask anything…
          <kbd className="surface-muted text-faint ml-auto rounded px-1.5 text-[11px]">⌘J</kbd>
        </MenuItem>
        <div className="border-app my-1 border-t" />
        {openTaskId && (
          <MenuItem onClick={() => askAI('Summarize this task')}>
            <MessageSquareText size={15} className="text-muted" /> Summarize this task
          </MenuItem>
        )}
        <MenuItem onClick={() => askAI('What should I work on next?')}>
          <Target size={15} className="text-muted" /> What should I work on next?
        </MenuItem>
        <MenuItem onClick={() => askAI("What's overdue?")}>
          <CalendarClock size={15} className="text-muted" /> What’s overdue?
        </MenuItem>
        <MenuItem onClick={() => askAI('Write my standup')}>
          <ListChecks size={15} className="text-muted" /> Write my standup
        </MenuItem>
      </Popover>
      <button onClick={newMenu.toggle} aria-expanded={newMenu.open} className="bg-brand-600 hover:bg-brand-700 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-white ring-1 ring-brand-600 ring-inset">
        <Plus size={15} /> <span className="hidden sm:inline">New</span>
      </button>
      <Popover open={newMenu.open} anchor={newMenu.anchor} onClose={newMenu.close} align="end" width={200}>
        <MenuItem onClick={quickTask}>
          <CheckSquare size={15} className="text-muted" /> Task
        </MenuItem>
        <MenuItem onClick={create(() => nav(`/app/docs/${useStore.getState().addDoc(null)}`))}>
          <FileText size={15} className="text-muted" /> Doc
        </MenuItem>
        <MenuItem onClick={create(() => nav(`/app/whiteboards/${useStore.getState().addWhiteboard()}`))}>
          <PenTool size={15} className="text-muted" /> Whiteboard
        </MenuItem>
        <MenuItem onClick={create(() => (useStore.getState().addGoal(), nav('/app/goals')))}>
          <Target size={15} className="text-muted" /> Goal
        </MenuItem>
      </Popover>

      <Link to="/app/inbox" className="hover-surface text-muted relative rounded-md p-1.5" aria-label={muted ? 'Inbox (notifications muted)' : 'Inbox'} title={muted ? 'Notifications are muted' : undefined}>
        {muted ? <BellOff size={18} className="text-amber-500" /> : <Bell size={18} />}
        {unread > 0 && !muted && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />}
      </Link>

      <button onClick={userMenu.toggle} className="relative rounded-full" aria-label="Account menu" title={myStatus ? `${myStatus.emoji} ${myStatus.text}`.trim() : undefined}>
        <Avatar userId={me.id} size={28} />
        {myStatus?.emoji && <span className="surface absolute -right-1.5 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] shadow-sm">{myStatus.emoji}</span>}
      </button>
      <AccountMenu open={userMenu.open} anchor={userMenu.anchor} onClose={userMenu.close} onLogout={() => setConfirmLogout(true)} />
      <LogoutDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false)
          if (useCall.getState().phase !== 'idle') useCall.getState().leave()
          logout()
          nav('/')
        }}
      />
    </header>
  )
}

function RunningTimer() {
  const { timer, tasks, stopTimer, openTask } = useStore()
  const sec = useElapsed(timer?.start)
  if (!timer) return null
  const task = tasks.find((t) => t.id === timer.taskId)
  return (
    <span className="flex h-8 shrink-0 items-center overflow-hidden rounded-lg bg-emerald-500 text-sm font-medium text-white">
      <button onClick={() => openTask(timer.taskId)} className="flex items-center gap-2 px-2.5 hover:bg-emerald-600" title={task?.title}>
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
        <span className="font-mono tabular-nums">{clock(sec)}</span>
        <span className="hidden max-w-36 truncate 2xl:inline">{task?.title}</span>
      </button>
      <button onClick={stopTimer} className="flex h-full items-center border-l border-white/25 px-2 hover:bg-emerald-600" aria-label="Stop timer">
        <Pause size={14} />
      </button>
    </span>
  )
}

function LogoutDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  const me = useMe()
  const workspace = useStore((s) => s.workspaces.find((w) => w.id === s.currentWorkspaceId)?.name)
  const timer = useStore((s) => !!s.timer)
  const inCall = useCall((s) => s.phase === 'in-call')
  return (
    <Modal open={open} onClose={onClose} className="mt-[18vh] max-w-sm">
      <div role="alertdialog" aria-labelledby="logout-title" aria-describedby="logout-body" className="p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15">
            <LogOut size={18} />
          </span>
          <h2 id="logout-title" className="text-lg font-semibold">
            Log out of Meetspace?
          </h2>
        </div>
        <div id="logout-body" className="text-muted mt-3 space-y-2 text-sm">
          <p>
            You’re signed in as <span className="text-app font-medium">{me.email || me.name}</span>
            {workspace && (
              <>
                {' '}
                in <span className="text-app font-medium">{workspace}</span>
              </>
            )}
            . You’ll need to log in again to get back.
          </p>
          {inCall && <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">You’ll leave the call you’re in.</p>}
          {timer && <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">Your timer keeps running until you stop it.</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="hover-surface rounded-lg px-3.5 py-2 text-sm font-medium">
            Cancel
          </button>
          <button autoFocus onClick={onConfirm} className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700">
            Log out
          </button>
        </div>
      </div>
    </Modal>
  )
}
