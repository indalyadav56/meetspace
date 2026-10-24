import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { useStore } from './store/useStore'
import Landing from './marketing/Landing'
import Pricing from './marketing/Pricing'
import { LoginPage } from './marketing/Auth'
import SignupPage from './marketing/Signup'
import { ForgotPasswordPage, ResetPasswordPage } from './marketing/PasswordReset'
import AppLayout from './app/AppLayout'
import Home from './app/pages/Home'
import Inbox from './app/pages/Inbox'
import DocsPage from './app/pages/DocsPage'
import Dashboards from './app/pages/Dashboards'
import ListPage from './app/pages/ListPage'
import SpacePage from './app/pages/SpacePage'
import Everything from './app/pages/Everything'
import ChatPage, { ChatCalls } from './app/pages/ChatPage'
import WhiteboardsPage from './app/pages/WhiteboardsPage'
import GoalsPage from './app/pages/GoalsPage'
import TimesheetsPage from './app/pages/TimesheetsPage'
import AutomationsPage from './app/pages/AutomationsPage'
import ClipsPage from './app/pages/ClipsPage'
import FormsPage from './app/pages/FormsPage'
import SprintsPage from './app/pages/SprintsPage'
import SettingsPage from './app/pages/SettingsPage'
import AIPage from './app/pages/ai/AIPage'
import PlannerPage from './app/pages/planner/PlannerPage'
import AppsPage from './app/pages/apps/AppsPage'
import TeamsPage from './app/pages/teams/TeamsPage'
import AssignedComments from './app/pages/AssignedComments'
import MeetingsPage from './app/pages/MeetingsPage'
import PublicForm from './marketing/PublicForm'
import { Logo } from './app/components/ui'

function RequireAuth({ children }: { children: ReactNode }) {
  const signedIn = useStore((s) => s.signedIn)
  const status = useStore((s) => s.status)
  const loadError = useStore((s) => s.loadError)
  const loc = useLocation()

  useEffect(() => {
    if (signedIn && status === 'idle') void useStore.getState().bootstrap()
  }, [signedIn, status])

  if (!signedIn) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (status !== 'ready')
    return (
      <div className="surface-subtle text-app flex h-full flex-col items-center justify-center gap-4">
        <Logo size={32} />
        {status === 'error' ? (
          <>
            <p className="text-muted max-w-sm text-center text-sm">{loadError ?? 'Could not load your workspace.'}</p>
            <div className="flex gap-2">
              <button onClick={() => void useStore.getState().bootstrap()} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
                Try again
              </button>
              <button onClick={() => useStore.getState().logout()} className="hover-surface rounded-lg px-4 py-2 text-sm">
                Log out
              </button>
            </div>
          </>
        ) : (
          <p className="text-muted text-sm">Loading your workspace…</p>
        )}
      </div>
    )
  return <>{children}</>
}

/** Shareable task link (/app/t/:taskId): opens the task over its List. */
function TaskLink() {
  const { taskId = '' } = useParams()
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId))
  const openTask = useStore((s) => s.openTask)
  useEffect(() => {
    if (task) openTask(task.id)
  }, [task, openTask])
  if (!task) return <div className="text-muted p-10 text-center text-sm">This task doesn’t exist or you don’t have access to it.</div>
  return <Navigate to={`/app/list/${task.listId}`} replace />
}

export default function App() {
  const theme = useStore((s) => s.theme)
  const { pathname } = useLocation()
  const inApp = pathname.startsWith('/app')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', inApp && theme === 'dark')
  }, [theme, inApp])

  useEffect(() => {
    if (!inApp) window.scrollTo(0, 0)
  }, [pathname, inApp])

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/form/:formId" element={<PublicForm />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<Home />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="docs" element={<DocsPage />} />
        <Route path="docs/:docId" element={<DocsPage />} />
        <Route path="dashboards" element={<Dashboards />} />
        <Route path="dashboards/:dashboardId" element={<Dashboards />} />
        <Route path="everything" element={<Everything />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="chat/calls" element={<ChatCalls />} />
        <Route path="chat/:channelId" element={<ChatPage />} />
        <Route path="whiteboards" element={<WhiteboardsPage />} />
        <Route path="whiteboards/:boardId" element={<WhiteboardsPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="timesheets" element={<TimesheetsPage />} />
        <Route path="automations" element={<AutomationsPage />} />
        <Route path="calls" element={<Navigate to="/app/chat/calls" replace />} />
        <Route path="clips" element={<ClipsPage />} />
        <Route path="forms" element={<FormsPage />} />
        <Route path="sprints" element={<SprintsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="ai" element={<AIPage />} />
        <Route path="planner" element={<PlannerPage />} />
        <Route path="apps" element={<AppsPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="comments" element={<AssignedComments />} />
        <Route path="meetings" element={<MeetingsPage />} />
        <Route path="forms/:formId" element={<FormsPage />} />
        <Route path="space/:spaceId" element={<SpacePage />} />
        <Route path="list/:listId" element={<ListPage />} />
        <Route path="t/:taskId" element={<TaskLink />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
