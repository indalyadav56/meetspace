import { Link, useNavigate } from 'react-router-dom'
import { Bell, Keyboard, Settings, Sparkles, LogOut, Menu, Moon, PanelLeft, Pause, Plus, Search, Sun } from 'lucide-react'
import { clock, useElapsed } from './task/TaskExtras'
import { useMe, useStore } from '../store/useStore'
import { Avatar, Logo, MenuItem, Popover, usePopover } from './components/ui'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import { useAssistant } from './ai/useAssistant'
import { CallPill } from './calls/CallLayer'

export default function TopBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const me = useMe()
  const { theme, setTheme, logout, toggleSidebar, lists, addTask, openTask } = useStore()
  const unread = useStore((s) => s.notifications.filter((n) => !n.read && !n.cleared).length)
  const nav = useNavigate()
  const userMenu = usePopover()
  const newMenu = usePopover()

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
        <MenuItem
          onClick={() => {
            logout()
            nav('/')
          }}
        >
          <LogOut size={15} /> Log out
        </MenuItem>
      </Popover>
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
