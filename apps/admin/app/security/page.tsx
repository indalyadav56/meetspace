import type { Metadata } from "next"
import {
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Lock,
  ShieldCheck,
  UserX,
  XCircle,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/admin/page-header"
import { StatCard } from "@/components/admin/stat-card"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/date"
import { getUser, USERS } from "@/lib/data"

export const metadata: Metadata = { title: "Security · Meetspace Admin" }

const POSTURE = [
  { label: "SSO / SAML enforced", state: "on", detail: "Required for Business & Enterprise" },
  { label: "Audit logging", state: "on", detail: "Retained for 90 days" },
  { label: "Encryption at rest", state: "on", detail: "AES-256, all regions" },
  { label: "Mandatory 2FA", state: "warn", detail: "Enforced on 62% of accounts" },
  { label: "IP allowlisting", state: "off", detail: "Available on Enterprise" },
] as const

const EVENTS = [
  { id: "e1", kind: "suspend", message: "User suspended for policy violation", userId: "u20", at: 26 },
  { id: "e2", kind: "login", message: "5 failed login attempts blocked", userId: "u7", at: 31 },
  { id: "e3", kind: "key", message: "API key rotated", userId: "u18", at: 48 },
  { id: "e4", kind: "mfa", message: "2FA enabled", userId: "u9", at: 72 },
  { id: "e5", kind: "login", message: "New device sign-in approved", userId: "u4", at: 90 },
] as const

const EVENT_ICON = {
  suspend: UserX,
  login: Fingerprint,
  key: KeyRound,
  mfa: ShieldCheck,
}

const STATE_STYLE = {
  on: { icon: CheckCircle2, cls: "text-emerald-500" },
  warn: { icon: AlertTriangle, cls: "text-amber-500" },
  off: { icon: XCircle, cls: "text-muted-foreground" },
}

export default function SecurityPage() {
  const mfa = USERS.filter((u) => u.mfa).length
  const mfaPct = Math.round((mfa / USERS.length) * 100)
  const suspended = USERS.filter((u) => u.status === "suspended").length

  return (
    <>
      <PageHeader
        title="Security"
        description="Platform-wide security posture and recent events."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="2FA adoption" value={`${mfaPct}%`} icon={ShieldCheck} />
        <StatCard label="Suspended users" value={String(suspended)} icon={UserX} />
        <StatCard label="Active sessions" value="3,412" icon={Fingerprint} />
        <StatCard
          label="Blocked attempts (24h)"
          value="18"
          icon={Lock}
          delta={-22}
          invertDelta
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Security posture</CardTitle>
            <CardDescription>Platform-level controls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {POSTURE.map((p) => {
              const { icon: Icon, cls } = STATE_STYLE[p.state]
              return (
                <div
                  key={p.label}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5"
                >
                  <Icon className={cn("size-5 shrink-0", cls)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{p.label}</div>
                    <div className="text-muted-foreground text-xs">{p.detail}</div>
                  </div>
                  <Badge
                    variant="ghost"
                    className={cn(
                      p.state === "on" &&
                        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                      p.state === "warn" &&
                        "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                      p.state === "off" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {p.state === "on" ? "Enabled" : p.state === "warn" ? "Partial" : "Off"}
                  </Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent security events</CardTitle>
            <CardDescription>Audit log, last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {EVENTS.map((e) => {
              const Icon = EVENT_ICON[e.kind]
              const user = getUser(e.userId)
              const at = new Date(
                Date.now() - e.at * 60 * 60 * 1000,
              ).toISOString()
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5"
                >
                  <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{e.message}</div>
                    <div className="text-muted-foreground text-xs">
                      {user?.name ?? "System"} · {timeAgo(at)}
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
