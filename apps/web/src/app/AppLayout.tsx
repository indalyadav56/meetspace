import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ShortcutsHelp } from './components/Dialogs'
import AssistantPanel from './ai/AssistantPanel'
import CallLayer from './calls/CallLayer'
import Recorder from './clips/Recorder'
import { useAssistant } from './ai/useAssistant'
import { useStore } from '../store/useStore'
import Sidebar, { hasSectionSidebar } from './SectionSidebar'
import TopBar from './TopBar'
import Rail from './Rail'
import TaskDetail from './task/TaskDetail'
import CreateTaskModal from './task/CreateTaskModal'
import CommandPalette from './CommandPalette'
import { cn } from '../lib/utils'
import { refreshPush } from './notifications/push'
import { X } from 'lucide-react'

/** Short-lived messages, e.g. a change the server rejected. */
function Toaster() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-4 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div key={t.id} role="status" className={cn('flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-white shadow-lg', t.tone === 'error' ? 'bg-red-600' : 'bg-stone-900')}>
          {t.text}
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

export default function AppLayout() {
  const collapsed = useStore((s) => s.sidebarCollapsed)
  const [mobileNav, setMobileNav] = useState(false)
  const [palette, setPalette] = useState(false)
  const [help, setHelp] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()

  // Keep this browser's push subscription tied to whoever is signed in.
  const me = useStore((s) => s.currentUserId)
  useEffect(() => {
    if (me) void refreshPush()
  }, [me])
  useEffect(() => {
    setMobileNav(false)
  }, [loc.pathname])

  useEffect(() => {
    let gPressed = 0
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        const a = useAssistant.getState()
        a.setOpen(!a.open)
        return
      }
      const el = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest('input, textarea, select, [contenteditable="true"]')) return
      // whiteboard canvas owns single-letter keys
      if (location.pathname.startsWith('/app/whiteboards/')) return
      const s = useStore.getState()
      if (s.openTaskId) return
      const k = e.key.toLowerCase()
      if (Date.now() - gPressed < 1000) {
        gPressed = 0
        const to = { h: 'home', i: 'inbox', c: 'chat', d: 'docs', t: 'timesheets', g: 'goals', w: 'whiteboards' }[k]
        if (to) nav(`/app/${to}`)
        return
      }
      if (k === 'g') gPressed = Date.now()
      else if (e.key === '?') setHelp(true)
      else if (k === 'c') {
        const listMatch = location.pathname.match(/\/app\/list\/([^/]+)/)
        const listId = listMatch?.[1] ?? s.lists[0]?.id
        if (listId && s.currentUserId) s.openTask(s.addTask({ listId, title: 'New task', assignees: [s.currentUserId] }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="surface-subtle text-app flex h-full flex-col">
      <TopBar onMenu={() => setMobileNav(true)} onSearch={() => setPalette(true)} />
      <div className="flex min-h-0 flex-1">
        <Rail />
        {/* Desktop sidebar: follows the rail section (chat brings its own channel list) */}
        {hasSectionSidebar(loc.pathname) && (
          <div className={cn('hidden shrink-0 transition-[width] duration-200 md:block', collapsed ? 'w-0 overflow-hidden' : 'w-64')}>
            <Sidebar />
          </div>
        )}
        {/* Mobile drawer */}
        {mobileNav && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNav(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw]">
              <Rail mobile />
              {hasSectionSidebar(loc.pathname) && <Sidebar />}
            </div>
          </div>
        )}
        <main className="surface border-app m-0 min-w-0 flex-1 overflow-hidden md:mr-2 md:mb-2 md:rounded-xl md:border">
          <Outlet />
        </main>
      </div>
      <TaskDetail />
      <CreateTaskModal />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <ShortcutsHelp open={help} onClose={() => setHelp(false)} />
      <AssistantPanel />
      <CallLayer />
      <Recorder />
      <Toaster />
    </div>
  )
}
