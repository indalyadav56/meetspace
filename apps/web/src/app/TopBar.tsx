import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, Keyboard, Settings, Sparkles, LogOut, Menu, Moon, PanelLeft, Pause, Plus, Search, Sun } from 'lucide-react'
import { clock, useElapsed } from './task/TaskExtras'
import { useMe, useStore } from '../store/useStore'
import { Avatar, Logo, MenuItem, Modal, Popover, usePopover } from './components/ui'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import { useAssistant } from './ai/useAssistant'
import { CallPill } from './calls/CallLayer'
import { useCall } from './calls/useCall'

export default function TopBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const me = useMe()
  const { theme, setTheme, logout, toggleSidebar, lists, addTask, openTask } = useStore()
  const unread = useStore((s) => s.notifications.filter((n) => !n.read && !n.cleared).length)
  const nav = useNavigate()
  const userMenu = usePopover()
  const newMenu = usePopover()
  const [confirmLogout, setConfirmLogout] = useState(false)

  const quickTask = () => {
    const listId = lists[0]?.id
    if (!listId) return
    const id = addTask({ listId, title: 'New task', assignees: [me.id] })
    openTask(id)
    newMenu.close()
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
        className="surface border-app text-faint mx-auto flex h-8 w-full max-w-md items-center gap-2 rounded-lg border px-3 text-sm"
      >
        <Search size={15} />
        <span className="truncate">Search tasks, docs, lists…</span>
        <kbd className="surface-muted ml-auto hidden rounded px-1.5 text-[11px] sm:inline">⌘K</kbd>
      </button>

      <CallPill />
      <RunningTimer />
      <button
        onClick={() => useAssistant.getState().setOpen(!useAssistant.getState().open)}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-teal-500 px-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        title="Ask AI (⌘J)"
      >
        <Sparkles size={15} /> <span className="hidden sm:inline">Ask AI</span>
      </button>
      <button onClick={newMenu.toggle} className="bg-brand-600 hover:bg-brand-700 inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold text-white">
        <Plus size={16} /> <span className="hidden sm:inline">New</span>
      </button>
      <Popover open={newMenu.open} anchor={newMenu.anchor} onClose={newMenu.close} align="end">
        <MenuItem onClick={quickTask}>Task</MenuItem>
        <MenuItem
          onClick={() => {
            const id = useStore.getState().addDoc(null)
            nav(`/app/docs/${id}`)
            newMenu.close()
          }}
        >
          Doc
        </MenuItem>
      </Popover>

      <Link to="/app/inbox" className="hover-surface text-muted relative rounded-md p-1.5" aria-label="Inbox">
        <Bell size={18} />
        {unread > 0 && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />}
      </Link>

      <button onClick={userMenu.toggle} className="rounded-full" aria-label="Account menu">
        <Avatar userId={me.id} size={28} />
      </button>
      <Popover open={userMenu.open} anchor={userMenu.anchor} onClose={userMenu.close} align="end" width={240}>
        <div className="flex items-center gap-2 px-2 py-2">
          <Avatar userId={me.id} size={32} />
          <div className="min-w-0">
            <div className="truncate font-semibold">{me.name}</div>
            <div className="text-muted truncate text-xs">{me.email}</div>
          </div>
        </div>
        <div className="border-app my-1 border-t" />
        <MenuItem onClick={() => (nav('/app/settings'), userMenu.close())}>
          <Settings size={15} /> Settings & members
        </MenuItem>
        <MenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />} {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </MenuItem>
        <MenuItem onClick={() => (window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' })), userMenu.close())}>
          <Keyboard size={15} /> Keyboard shortcuts
        </MenuItem>
        <MenuItem onClick={() => (userMenu.close(), setConfirmLogout(true))}>
          <LogOut size={15} /> Log out
        </MenuItem>
      </Popover>
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
        <span className="hidden max-w-36 truncate lg:inline">{task?.title}</span>
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
