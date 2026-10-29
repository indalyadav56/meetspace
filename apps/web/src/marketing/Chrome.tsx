import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarDays,
  ChevronDown,
  Code2,
  FileText,
  GanttChart,
  GraduationCap,
  Inbox,
  KanbanSquare,
  LifeBuoy,
  List,
  Megaphone,
  Menu,
  Newspaper,
  Rocket,
  Users,
  Workflow,
  X,
} from 'lucide-react'
import { Logo } from '../app/components/ui'
import { useStore } from '../store/useStore'
import { cn } from '../lib/utils'

type MenuGroup = { heading: string; items: { icon: typeof List; title: string; desc: string; to: string }[] }

const MENUS: Record<string, MenuGroup[]> = {
  Product: [
    {
      heading: 'Plan & track',
      items: [
        { icon: List, title: 'Lists', desc: 'Group, sort and filter every task', to: '/signup' },
        { icon: KanbanSquare, title: 'Boards', desc: 'Drag work across stages', to: '/signup' },
        { icon: GanttChart, title: 'Gantt', desc: 'Schedule with timelines', to: '/signup' },
        { icon: CalendarDays, title: 'Calendar', desc: 'See deadlines at a glance', to: '/signup' },
      ],
    },
    {
      heading: 'Collaborate',
      items: [
        { icon: FileText, title: 'Docs', desc: 'Write specs next to the work', to: '/signup' },
        { icon: Inbox, title: 'Inbox', desc: 'Every update, triaged', to: '/signup' },
        { icon: BarChart3, title: 'Dashboards', desc: 'Live team reporting', to: '/signup' },
        { icon: Workflow, title: 'Automations', desc: 'Skip the busywork', to: '/signup' },
      ],
    },
  ],
  Solutions: [
    {
      heading: 'By team',
      items: [
        { icon: Rocket, title: 'Product', desc: 'Roadmaps to releases', to: '/signup' },
        { icon: Code2, title: 'Engineering', desc: 'Sprints, bugs and on-call', to: '/signup' },
        { icon: Megaphone, title: 'Marketing', desc: 'Campaigns and calendars', to: '/signup' },
        { icon: Users, title: 'People ops', desc: 'Hiring and onboarding', to: '/signup' },
      ],
    },
    {
      heading: 'By size',
      items: [
        { icon: Briefcase, title: 'Startups', desc: 'Move fast without the mess', to: '/pricing' },
        { icon: BarChart3, title: 'Enterprise', desc: 'Scale with control', to: '/pricing' },
      ],
    },
  ],
  Learn: [
    {
      heading: 'Resources',
      items: [
        { icon: BookOpen, title: 'Guides', desc: 'Step-by-step playbooks', to: '/' },
        { icon: GraduationCap, title: 'Academy', desc: 'Short video courses', to: '/' },
        { icon: Newspaper, title: 'Blog', desc: 'Ideas on how teams work', to: '/' },
        { icon: LifeBuoy, title: 'Help center', desc: 'Answers, fast', to: '/' },
      ],
    },
  ],
}

export function MarketingNav() {
  const [open, setOpen] = useState<string | null>(null)
  const [mobile, setMobile] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const authed = useStore((s) => s.signedIn)
  const closeTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const enter = (k: string) => {
    window.clearTimeout(closeTimer.current)
    setOpen(k)
  }
  const leave = () => {
    closeTimer.current = window.setTimeout(() => setOpen(null), 120)
  }

  return (
    <header className={cn('sticky top-0 z-50 bg-white/90 backdrop-blur transition-shadow', scrolled && 'shadow-[0_1px_0_#e5e7eb]')}>
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-6 px-4 sm:px-6 lg:px-10">
        <Link to="/" aria-label="Meetspace home">
          <Logo size={28} />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {Object.keys(MENUS).map((k) => (
            <div key={k} className="relative" onMouseEnter={() => enter(k)} onMouseLeave={leave}>
              <button
                onClick={() => setOpen(open === k ? null : k)}
                aria-expanded={open === k}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-[15px] font-medium text-stone-700 hover:bg-stone-100"
              >
                {k} <ChevronDown size={15} className={cn('transition-transform', open === k && 'rotate-180')} />
              </button>
              {open === k && (
                <div className="absolute top-full left-0 pt-2">
                  <div className="animate-fade-up flex gap-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl [animation-duration:.18s]">
                    {MENUS[k].map((g) => (
                      <div key={g.heading} className="w-64">
                        <div className="mb-3 text-xs font-semibold tracking-wide text-stone-400 uppercase">{g.heading}</div>
                        <div className="space-y-1">
                          {g.items.map((it) => (
                            <Link key={it.title} to={it.to} onClick={() => setOpen(null)} className="flex gap-3 rounded-xl p-2 hover:bg-stone-50">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                                <it.icon size={18} />
                              </span>
                              <span>
                                <span className="block text-sm font-semibold text-stone-900">{it.title}</span>
                                <span className="block text-[13px] text-stone-500">{it.desc}</span>
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <Link to="/pricing" className="rounded-lg px-3 py-2 text-[15px] font-medium text-stone-700 hover:bg-stone-100">
            Pricing
          </Link>
          <Link to="/pricing#enterprise" className="rounded-lg px-3 py-2 text-[15px] font-medium text-stone-700 hover:bg-stone-100">
            Enterprise
          </Link>
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <Link to="/pricing" className="px-3 py-2 text-[15px] font-medium text-stone-700 hover:text-stone-950">
            Talk to sales
          </Link>
          {authed ? (
            <Link to="/app/home" className="rounded-xl bg-stone-950 px-4 py-2 text-[15px] font-semibold text-white hover:bg-stone-800">
              Open app
            </Link>
          ) : (
            <>
              <Link to="/login" className="rounded-xl bg-stone-100 px-4 py-2 text-[15px] font-semibold text-stone-900 hover:bg-stone-200">
                Log in
              </Link>
              <Link to="/signup" className="rounded-xl bg-stone-950 px-4 py-2 text-[15px] font-semibold text-white hover:bg-stone-800">
                Sign up
              </Link>
            </>
          )}
        </div>
        <button className="ml-auto rounded-lg p-2 lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu">
          <Menu size={22} />
        </button>
      </div>

      {mobile && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-white lg:hidden">
          <div className="flex h-16 items-center px-4">
            <Logo size={28} />
            <button className="ml-auto rounded-lg p-2" onClick={() => setMobile(false)} aria-label="Close menu">
              <X size={22} />
            </button>
          </div>
          <div className="space-y-6 px-4 pb-10">
            {Object.entries(MENUS).map(([k, groups]) => (
              <details key={k} className="group border-b border-stone-100 pb-3">
                <summary className="flex cursor-pointer list-none items-center justify-between py-2 text-lg font-semibold">
                  {k} <ChevronDown size={18} className="transition-transform group-open:rotate-180" />
                </summary>
                {groups.flatMap((g) => g.items).map((it) => (
                  <Link key={it.title} to={it.to} onClick={() => setMobile(false)} className="flex items-center gap-3 py-2 text-stone-700">
                    <it.icon size={18} className="text-brand-600" /> {it.title}
                  </Link>
                ))}
              </details>
            ))}
            <Link to="/pricing" onClick={() => setMobile(false)} className="block text-lg font-semibold">
              Pricing
            </Link>
            <div className="grid gap-2 pt-4">
              <Link to="/login" className="rounded-xl bg-stone-100 py-3 text-center font-semibold">
                Log in
              </Link>
              <Link to="/signup" className="rounded-xl bg-stone-950 py-3 text-center font-semibold text-white">
                Sign up free
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

const FOOTER: Record<string, string[]> = {
  Product: ['Lists', 'Boards', 'Gantt', 'Calendar', 'Docs', 'Dashboards', 'Automations', 'Integrations'],
  Solutions: ['Product teams', 'Engineering', 'Marketing', 'Operations', 'People ops', 'Agencies', 'Startups', 'Enterprise'],
  Resources: ['Help center', 'Guides', 'Templates', 'Webinars', 'Community', 'Changelog', 'Status', 'API docs'],
  Company: ['About', 'Careers', 'Press', 'Security', 'Partners', 'Contact'],
  Compare: ['vs. spreadsheets', 'vs. sticky notes', 'vs. email threads', 'vs. scattered tools'],
}

export function MarketingFooter() {
  return (
    <footer className="bg-stone-950 text-stone-400">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 lg:px-10">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(5,1fr)]">
          <div>
            <Logo size={30} className="text-white" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed">One calm place for your team’s tasks, docs and decisions.</p>
            <div className="mt-6 flex gap-2">
              {['App Store', 'Google Play'].map((s) => (
                <span key={s} className="rounded-lg border border-stone-700 px-3 py-1.5 text-xs text-stone-300">
                  {s}
                </span>
              ))}
            </div>
          </div>
          {Object.entries(FOOTER).map(([h, items]) => (
            <div key={h}>
              <h3 className="mb-4 text-sm font-semibold text-white">{h}</h3>
              <ul className="space-y-2.5 text-sm">
                {items.map((i) => (
                  <li key={i}>
                    <a href="#" className="hover:text-white">
                      {i}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-4 border-t border-stone-800 pt-8 text-xs sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Meetspace. All rights reserved.</span>
          <div className="flex gap-5 sm:ml-auto">
            <a href="/privacy" className="hover:text-white">
              Privacy
            </a>
            <a href="/terms" className="hover:text-white">
              Terms
            </a>
            <a href="/privacy#cookies" className="hover:text-white">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
