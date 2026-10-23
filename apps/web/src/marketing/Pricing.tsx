import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Minus } from 'lucide-react'
import { MarketingFooter, MarketingNav } from './Chrome'
import { cn } from '../lib/utils'

const PLANS = [
  { name: 'Free', monthly: 0, yearly: 0, tagline: 'For individuals and tiny teams getting organised.', cta: 'Get started', features: ['Unlimited tasks', 'Up to 5 members', 'List, Board & Calendar views', '100 MB storage', 'Docs & Inbox'] },
  { name: 'Team', monthly: 10, yearly: 8, tagline: 'For growing teams that need more views and control.', cta: 'Start free trial', popular: true, features: ['Everything in Free', 'Unlimited members', 'Gantt & Table views', 'Dashboards', 'Unlimited storage', 'Guests & permissions'] },
  { name: 'Business', monthly: 18, yearly: 14, tagline: 'For departments running many projects at once.', cta: 'Start free trial', features: ['Everything in Team', 'Automations (10k runs/mo)', 'Workload & time tracking', 'Advanced reporting', 'Priority support'] },
  { name: 'Enterprise', monthly: null, yearly: null, tagline: 'For organisations with security and scale needs.', cta: 'Contact sales', features: ['Everything in Business', 'SAML SSO & SCIM', 'Audit logs', 'Data residency', 'Dedicated success manager', '99.9% uptime SLA'] },
]

type Cell = boolean | string
const MATRIX: { group: string; rows: [string, Cell, Cell, Cell, Cell][] }[] = [
  {
    group: 'Core',
    rows: [
      ['Tasks & subtasks', true, true, true, true],
      ['Members', 'Up to 5', 'Unlimited', 'Unlimited', 'Unlimited'],
      ['Storage', '100 MB', 'Unlimited', 'Unlimited', 'Unlimited'],
      ['Docs', true, true, true, true],
    ],
  },
  {
    group: 'Views',
    rows: [
      ['List, Board, Calendar', true, true, true, true],
      ['Table', false, true, true, true],
      ['Gantt', false, true, true, true],
      ['Dashboards', false, true, true, true],
    ],
  },
  {
    group: 'Admin & security',
    rows: [
      ['Guests', false, true, true, true],
      ['Automations', false, '1k / mo', '10k / mo', 'Unlimited'],
      ['SSO & SCIM', false, false, false, true],
      ['Audit logs', false, false, false, true],
    ],
  },
]

const FAQ = [
  ['Is the Free plan really free?', 'Yes. The Free plan has no time limit and doesn’t require a credit card. Upgrade only when you need more.'],
  ['Can I switch plans later?', 'Any time. Upgrades take effect immediately; downgrades apply at the end of your billing period.'],
  ['Do you offer discounts for non-profits?', 'We offer reduced pricing for registered non-profits and education. Reach out to our sales team.'],
  ['How does billing for guests work?', 'Guests are free on paid plans, up to a limit based on the number of paid members.'],
  ['Is my data secure?', 'Data is encrypted in transit and at rest. Enterprise adds SSO, audit logs and data residency options.'],
]

function CellView({ v }: { v: Cell }) {
  if (v === true) return <Check size={18} className="mx-auto text-indigo-600" />
  if (v === false) return <Minus size={18} className="mx-auto text-slate-300" />
  return <span className="text-sm text-slate-700">{v}</span>
}

export default function Pricing() {
  const [yearly, setYearly] = useState(true)
  const [faq, setFaq] = useState<number | null>(0)
  return (
    <div className="bg-white text-slate-950">
      <MarketingNav />
      <main>
        <section className="mx-auto max-w-[1280px] px-4 pt-16 text-center sm:px-6 sm:pt-24 lg:px-10">
          <h1 className="text-5xl font-bold tracking-[-0.04em] sm:text-7xl">Simple pricing that scales with you</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">Start free. Pay per member when your team needs more.</p>
          <div className="mt-10 inline-flex items-center rounded-full bg-slate-100 p-1 text-sm font-semibold">
            {[false, true].map((y) => (
              <button key={String(y)} onClick={() => setYearly(y)} className={cn('rounded-full px-4 py-2 transition', yearly === y ? 'bg-white shadow' : 'text-slate-500')}>
                {y ? 'Yearly' : 'Monthly'}
                {y && <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-[11px] text-teal-700">Save 20%</span>}
              </button>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-12 grid max-w-[1280px] gap-4 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-10">
          {PLANS.map((p) => {
            const price = yearly ? p.yearly : p.monthly
            return (
              <div
                key={p.name}
                id={p.name === 'Enterprise' ? 'enterprise' : undefined}
                className={cn('relative flex flex-col rounded-3xl border p-7', p.popular ? 'border-indigo-600 shadow-xl ring-1 ring-indigo-600' : 'border-slate-200')}
              >
                {p.popular && <span className="absolute -top-3 left-7 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">Most popular</span>}
                <h2 className="text-xl font-bold">{p.name}</h2>
                <p className="mt-2 min-h-[48px] text-sm text-slate-600">{p.tagline}</p>
                <div className="mt-6 flex items-end gap-1">
                  {price === null ? (
                    <span className="text-4xl font-bold">Custom</span>
                  ) : (
                    <>
                      <span className="text-5xl font-bold tracking-tight">${price}</span>
                      <span className="mb-1.5 text-sm text-slate-500">/member/mo</span>
                    </>
                  )}
                </div>
                <p className="mt-1 h-5 text-xs text-slate-500">{price ? (yearly ? 'billed yearly' : 'billed monthly') : ''}</p>
                <Link
                  to={p.name === 'Enterprise' ? '/pricing#enterprise' : '/signup'}
                  className={cn('mt-6 rounded-xl py-3 text-center font-semibold transition', p.popular ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-950 text-white hover:bg-slate-800')}
                >
                  {p.cta}
                </Link>
                <ul className="mt-7 space-y-3 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <Check size={17} className="mt-px shrink-0 text-indigo-600" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </section>

        <section className="mx-auto mt-24 max-w-[1280px] px-4 sm:px-6 lg:px-10">
          <h2 className="mb-8 text-3xl font-bold tracking-tight">Compare plans</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="sticky top-16 bg-white">
                <tr className="border-b border-slate-200">
                  <th className="py-4 font-semibold" />
                  {PLANS.map((p) => (
                    <th key={p.name} className="py-4 text-center font-semibold">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((g) => (
                  <Fragment key={g.group}>
                    <tr>
                      <td colSpan={5} className="pt-8 pb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                        {g.group}
                      </td>
                    </tr>
                    {g.rows.map(([label, ...cells]) => (
                      <tr key={label} className="border-b border-slate-100">
                        <td className="py-3.5 text-sm font-medium">{label}</td>
                        {cells.map((c, i) => (
                          <td key={i} className="py-3.5 text-center">
                            <CellView v={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mx-auto mt-24 mb-24 max-w-3xl px-4 sm:px-6">
          <h2 className="mb-8 text-center text-3xl font-bold tracking-tight">Frequently asked questions</h2>
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {FAQ.map(([q, a], i) => (
              <div key={q}>
                <button onClick={() => setFaq(faq === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left text-lg font-semibold" aria-expanded={faq === i}>
                  {q}
                  <ChevronDown size={20} className={cn('shrink-0 transition-transform', faq === i && 'rotate-180')} />
                </button>
                {faq === i && <p className="animate-fade-up pb-5 text-slate-600 [animation-duration:.2s]">{a}</p>}
              </div>
            ))}
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
