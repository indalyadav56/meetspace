import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MarketingFooter, MarketingNav } from './Chrome'
import { api } from '../api/client'

/*
 * Privacy Policy and Terms of Service, written for India's Digital Personal
 * Data Protection Act, 2023 and its 2025 Rules. This is a starting point, not
 * legal advice: have a lawyer review it, and fill in the company name, address
 * and grievance officer (APP_PRIVACY_GRIEVANCE_*) before launch.
 *
 * Changing either document? Bump POLICY_VERSION here and PolicyVersion in
 * internal/identity/application/privacy.go so everyone is asked to accept it.
 */
export const POLICY_VERSION = '2026-10-29'
const UPDATED = '29 October 2026'

interface Contact {
  name: string
  email: string
  address?: string
}

function useGrievanceContact() {
  const [c, setC] = useState<Contact | null>(null)
  useEffect(() => {
    api.raw<Contact>('GET', '/public/privacy/contact', { anonymous: true }).then(setC, () => setC(null))
  }, [])
  return c
}

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white text-stone-950">
      <MarketingNav />
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-stone-500">
          Version {POLICY_VERSION} · Last updated {UPDATED}
        </p>
        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-stone-700 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-stone-950 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">{children}</div>
      </main>
      <MarketingFooter />
    </div>
  )
}

function GrievanceOfficer() {
  const c = useGrievanceContact()
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm">
      <div className="font-semibold text-stone-950">{c?.name || 'Grievance Officer'}</div>
      {c?.email ? (
        <a href={`mailto:${c.email}`} className="text-brand-700 underline">
          {c.email}
        </a>
      ) : (
        <span className="text-stone-500">Contact details are being set up. Until then, use the email address you received from us.</span>
      )}
      {c?.address && <div className="mt-1 whitespace-pre-line text-stone-600">{c.address}</div>}
      <div className="mt-2 text-stone-500">We reply within 7 days and resolve complaints within 30 days.</div>
    </div>
  )
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <section>
        <p>
          This policy explains what personal data Meetspace collects, why, and the rights you have over it under India’s Digital Personal Data Protection Act, 2023 (the “DPDP Act”) and its Rules. If your
          workspace is run by your employer or another organisation, they decide what goes into it; we process that content on their behalf.
        </p>
      </section>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <b>Account:</b> your name, email address, password (stored only as a one-way hash), profile colour and status, and whether you use two-factor sign-in or a single sign-on provider.
          </li>
          <li>
            <b>What you create:</b> tasks, comments, docs, chat messages, whiteboards, recordings, time entries and files you add to a workspace.
          </li>
          <li>
            <b>Devices and security:</b> the browser and IP address of each signed-in session, and a log of sign-ins and changes (the audit log).
          </li>
          <li>
            <b>Settings:</b> notification preferences, push-notification subscriptions, calendar feeds and saved searches.
          </li>
        </ul>
        <p className="mt-2">We don’t sell your data, show ads, or use advertising or tracking cookies.</p>
      </section>
      <section>
        <h2>Why we use it</h2>
        <ul>
          <li>To run the service you signed up for: sign you in, store and sync your work, and send the notifications you choose.</li>
          <li>To keep accounts secure: detect suspicious sign-ins and keep an audit trail for workspace admins.</li>
          <li>To meet legal obligations, such as responding to lawful requests and reporting security incidents.</li>
        </ul>
        <p className="mt-2">We rely on the consent you give when you sign up, and on the legitimate uses the DPDP Act allows. You can withdraw consent at any time by deleting your account.</p>
      </section>
      <section>
        <h2>Who we share it with</h2>
        <p>Only with service providers that help us run Meetspace, under contracts that require them to protect it:</p>
        <ul>
          <li>Hosting, database and file storage providers.</li>
          <li>Our email provider, to send sign-in, invite and notification emails.</li>
          <li>Google (Gemini), only when your workspace uses AI features, to process the text you ask about.</li>
          <li>Your browser’s push service (for example Google or Apple), if you turn on push notifications.</li>
        </ul>
        <p className="mt-2">Some of these providers may process data outside India, which the DPDP Act permits except to countries the Government restricts.</p>
      </section>
      <section>
        <h2>How long we keep it</h2>
        <ul>
          <li>Account and content: while your account is active.</li>
          <li>Audit log: 365 days, then deleted automatically.</li>
          <li>Deleted items stay in a workspace’s Trash until someone empties it.</li>
          <li>When you delete your account we immediately remove your name, email, password, sign-in methods, devices and personal settings. What you wrote in shared workspaces stays there, shown as “Deleted user”, because it belongs to that workspace.</li>
        </ul>
      </section>
      <section>
        <h2>Your rights</h2>
        <ul>
          <li>
            <b>Access:</b> download a copy of your data from Settings → Privacy &amp; data.
          </li>
          <li>
            <b>Correction:</b> edit your name and profile at any time; ask us to correct anything else.
          </li>
          <li>
            <b>Erasure:</b> delete your account from Settings → Privacy &amp; data.
          </li>
          <li>
            <b>Grievance:</b> complain to our Grievance Officer (below). If you’re not satisfied, you can escalate to the Data Protection Board of India.
          </li>
          <li>
            <b>Nomination:</b> name someone who can exercise these rights for you if you die or can’t act yourself, by writing to the Grievance Officer.
          </li>
        </ul>
      </section>
      <section>
        <h2>Security and breaches</h2>
        <p>
          We encrypt connections, hash passwords, offer two-factor sign-in and restrict access to your data. If a breach affects your personal data, we’ll tell you and the Data Protection Board of India as
          the DPDP Rules require, including what happened and what you can do.
        </p>
      </section>
      <section>
        <h2>Children</h2>
        <p>Meetspace is for people aged 18 and over. We don’t knowingly collect data from children; if you think we have, contact us and we’ll delete it.</p>
      </section>
      <section id="cookies">
        <h2>Cookies and local storage</h2>
        <p>We don’t use advertising or analytics cookies. Your browser stores your sign-in session and a few preferences (like theme) so the app works; clearing site data signs you out.</p>
      </section>
      <section>
        <h2>Grievance Officer</h2>
        <GrievanceOfficer />
      </section>
      <section>
        <h2>Changes</h2>
        <p>When this policy changes we’ll update the version above and ask you to accept the new version the next time you open Meetspace.</p>
      </section>
    </LegalShell>
  )
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <section>
        <p>
          These terms are an agreement between you and Meetspace for using the service. By creating an account you accept them and our{' '}
          <Link to="/privacy" className="text-brand-700 underline">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
      <section>
        <h2>Your account</h2>
        <ul>
          <li>You must be 18 or older and give accurate information.</li>
          <li>Keep your password safe; you’re responsible for what happens under your account. We recommend turning on two-factor sign-in.</li>
          <li>Workspace owners and admins control who can join a workspace and can remove members.</li>
        </ul>
      </section>
      <section>
        <h2>Your content</h2>
        <p>
          You (or the organisation that runs your workspace) own what you put into Meetspace. You give us permission to store, process and display it only to provide the service. You’re responsible for having
          the right to upload it.
        </p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>Don’t break the law, infringe others’ rights, or upload malware.</li>
          <li>Don’t try to access accounts or data that aren’t yours, or disrupt the service.</li>
          <li>Don’t use Meetspace to send spam or harass people.</li>
        </ul>
        <p className="mt-2">We may suspend accounts that break these rules, and will tell you why unless the law prevents it.</p>
      </section>
      <section>
        <h2>Paid plans</h2>
        <p>Paid plans are billed in advance and renew until cancelled. Prices are shown on the pricing page and include applicable taxes where stated.</p>
      </section>
      <section>
        <h2>Ending your account</h2>
        <p>You can delete your account at any time from Settings → Privacy &amp; data. Workspaces you alone use are deleted with it; you’ll need to hand over any shared workspace you own first.</p>
      </section>
      <section>
        <h2>Disclaimers and liability</h2>
        <p>
          We work hard to keep Meetspace available and your data safe, but the service is provided “as is”. To the extent the law allows, we aren’t liable for indirect or consequential losses, and our total
          liability is limited to what you paid us in the 12 months before the claim.
        </p>
      </section>
      <section>
        <h2>Governing law</h2>
        <p>These terms are governed by the laws of India. Courts in the city of our registered office have jurisdiction.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <GrievanceOfficer />
      </section>
    </LegalShell>
  )
}
