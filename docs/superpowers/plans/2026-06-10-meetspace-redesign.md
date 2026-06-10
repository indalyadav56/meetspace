# Meetspace Linear-Style Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the meetspace web app's design with a Linear-style, dense, dark-first UI: new theme tokens, a slim icon-rail + contextual-panel shell, and in-place restyles of every page — zero feature/data/routing changes.

**Architecture:** Theme tokens change first (everything downstream inherits them), then the new shell (rail + panel + header) replaces the shadcn `Sidebar` composition in `app/layout.tsx`, then each feature area is restyled in place. `lib/store.tsx`, `lib/types.ts`, `lib/mock-data.ts`, and all routes are untouched.

**Tech Stack:** Next.js 16.2.7 (App Router, React 19), Tailwind CSS v4 (`@theme` in `globals.css`, no config file), shadcn/ui primitives in `components/ui/`, lucide-react icons, next-themes.

**Spec:** `docs/superpowers/specs/2026-06-10-meetspace-redesign-design.md`

**Working directory:** all paths below are relative to `apps/web/`.

**No test runner exists** (per CLAUDE.md). Verification per task = `npm run lint` + `npm run build` must pass, plus visual checks in the final task. Commit after every task.

**Next.js 16 warning (from AGENTS.md):** before writing any Next.js-API code, read the relevant doc under `node_modules/next/dist/docs/`. Dynamic route `params` are Promises. The tasks below only touch client components and `layout.tsx`, so this mostly matters if you deviate.

---

## Design recipe (shared vocabulary used by every task)

All restyle tasks apply this recipe. When a task says "apply the recipe", it means these exact conventions:

- **Type scale:** app chrome `text-[13px]`; page titles `text-[15px] font-semibold`; metadata/labels `text-xs text-muted-foreground` (12px) or `text-[11px]` for chips; never larger than `text-base` outside empty states.
- **Density:** toolbar controls `h-7` (28px), default controls `h-8`; row padding `px-3 py-1.5`; section padding `px-4 py-3`; gaps `gap-1.5`/`gap-2`.
- **Surfaces:** no `glass-card`, `glass-panel`, `glow-card`, gradients, or `backdrop-blur` anywhere — delete these usages on sight. Elevation = background steps (`bg-background` → `bg-card` → `bg-accent` on hover) + `border border-border`. No drop shadows except popovers/dialogs (shadcn defaults are fine).
- **Hover/active rows:** `hover:bg-accent/50 rounded-md transition-colors duration-100`. Active/selected: `bg-accent text-accent-foreground`.
- **Status/priority:** keep using `STATUS_MAP`/`PRIORITY_MAP` from `lib/config.ts`; render status as a small colored icon/dot (`size-3.5`), never a large filled pill.
- **Tags/chips:** `rounded` (4px), `px-1.5 py-0`, `text-[11px]`, soft background via existing `tagColor()`.
- **Radius:** rely on token scale (Task 1 sets `--radius: 0.375rem`); don't hardcode `rounded-xl`+ — use `rounded-md` cards, `rounded` chips.
- **Animations:** keep them ≤150ms, `transition-colors` only. Remove `translateY` hover lifts.

---

### Task 1: Theme tokens — rewrite `app/globals.css`

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace the token + base-layer portion of `globals.css`**

Keep lines 1–49 (imports, `@custom-variant`, the `@theme inline` block) EXCEPT change the radius line inside `@theme inline`: it already derives from `--radius`, so no change needed there. Replace everything from the `:root {` block through the `@layer base { ... }` block (current lines 51–135) with:

```css
/* Linear-style theme — dark by default app feel; light kept and re-tuned. */
:root {
  --background: oklch(0.99 0.002 277);
  --foreground: oklch(0.21 0.012 277);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.21 0.012 277);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.21 0.012 277);
  --primary: oklch(0.54 0.19 282);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.962 0.004 277);
  --secondary-foreground: oklch(0.3 0.012 277);
  --muted: oklch(0.962 0.004 277);
  --muted-foreground: oklch(0.5 0.014 277);
  --accent: oklch(0.945 0.006 277);
  --accent-foreground: oklch(0.25 0.012 277);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.91 0.005 277);
  --input: oklch(0.91 0.005 277);
  --ring: oklch(0.54 0.19 282);
  --chart-1: oklch(0.54 0.19 282);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.7 0.15 50);
  --chart-4: oklch(0.65 0.2 13);
  --chart-5: oklch(0.6 0.12 145);
  --radius: 0.375rem;
  --sidebar: oklch(0.975 0.003 277);
  --sidebar-foreground: oklch(0.33 0.012 277);
  --sidebar-primary: oklch(0.54 0.19 282);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.93 0.006 277);
  --sidebar-accent-foreground: oklch(0.25 0.012 277);
  --sidebar-border: oklch(0.905 0.005 277);
  --sidebar-ring: oklch(0.54 0.19 282);
}

.dark {
  --background: oklch(0.155 0.006 285);   /* app canvas ~#0E0E12 */
  --foreground: oklch(0.93 0.005 277);
  --card: oklch(0.19 0.007 285);          /* raised surface */
  --card-foreground: oklch(0.93 0.005 277);
  --popover: oklch(0.205 0.008 285);
  --popover-foreground: oklch(0.93 0.005 277);
  --primary: oklch(0.68 0.16 282);        /* indigo/violet */
  --primary-foreground: oklch(0.99 0 0);
  --secondary: oklch(0.235 0.008 285);
  --secondary-foreground: oklch(0.93 0.005 277);
  --muted: oklch(0.235 0.008 285);
  --muted-foreground: oklch(0.64 0.012 277);
  --accent: oklch(0.255 0.01 285);        /* hover layer */
  --accent-foreground: oklch(0.95 0.005 277);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 8%);
  --input: oklch(1 0 0 / 10%);
  --ring: oklch(0.68 0.16 282);
  --chart-1: oklch(0.68 0.16 282);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.645 0.246 16.439);
  --chart-5: oklch(0.7 0.15 145);
  --sidebar: oklch(0.135 0.006 285);      /* rail/panel, darkest layer */
  --sidebar-foreground: oklch(0.78 0.008 277);
  --sidebar-primary: oklch(0.68 0.16 282);
  --sidebar-primary-foreground: oklch(0.99 0 0);
  --sidebar-accent: oklch(0.225 0.009 285);
  --sidebar-accent-foreground: oklch(0.95 0.005 277);
  --sidebar-border: oklch(1 0 0 / 7%);
  --sidebar-ring: oklch(0.68 0.16 282);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground text-[13px];
  }
  html {
    @apply font-sans;
  }
}
```

Key deltas: dark surfaces get a violet-tinted near-black ramp, `--radius` drops 0.5rem→0.375rem, body gets 13px base, and the radial-gradient `background-image` on `body` is REMOVED (flat canvas).

- [ ] **Step 2: Delete the glass/glow utilities**

Remove the `.glass-panel`, `.glass-card`, `.glass-card:hover`, `.glow-card`, `.glow-card::after`, `.glow-card:hover::after` rules entirely. KEEP `.custom-scrollbar` rules and the `wave`/`.voice-wave-bar` animation block (chat uses it).

- [ ] **Step 3: Remove now-dead class usages**

Run: `grep -rln "glass-card\|glass-panel\|glow-card" components app`
For every hit, delete those class names from the `className` strings (leave the elements; they'll get proper styling in their area's task — a plain `border border-border bg-card` is an acceptable interim if an element loses all visible styling).

- [ ] **Step 4: Default theme to dark**

In `app/layout.tsx` change `defaultTheme="light"` to `defaultTheme="dark"` (keep `enableSystem`).

- [ ] **Step 5: Verify build**

Run: `npm run lint && npm run build`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web
git commit -m "feat(web): new Linear-style dark-first theme tokens"
```

---

### Task 2: Icon rail — `components/shell/app-rail.tsx`

**Files:**
- Create: `components/shell/app-rail.tsx`

- [ ] **Step 1: Create the rail component**

```tsx
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Calendar,
  CheckSquare,
  Home,
  MessagesSquare,
  Search,
  SquareKanban,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ThemeToggle } from "@/components/theme-toggle"
import { NavUser } from "@/components/nav-user"

const NAV = [
  { title: "Home", href: "/", icon: Home, exact: true },
  { title: "My Tasks", href: "/my-tasks", icon: CheckSquare },
  { title: "Tasks", href: "/tasks", icon: SquareKanban },
  { title: "Chat", href: "/chat", icon: MessagesSquare },
  { title: "Calendar", href: "/calendar", icon: Calendar },
  { title: "Teams", href: "/teams", icon: Users },
]

function openCommandMenu() {
  window.dispatchEvent(new CustomEvent("meetspace:command"))
}

export function AppRail() {
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  return (
    <nav className="flex h-svh w-12 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-2">
      <Link
        href="/"
        className="mb-2 flex size-8 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground"
        aria-label="Meetspace home"
      >
        M
      </Link>

      <RailButton title="Search ⌘K" onClick={openCommandMenu}>
        <Search className="size-4" />
      </RailButton>

      <div className="my-1 h-px w-6 bg-sidebar-border" />

      <div className="flex flex-1 flex-col items-center gap-0.5">
        {NAV.map((item) => {
          const active = isActive(item.href, item.exact)
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex size-8 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors duration-100",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  {active && (
                    <span className="absolute -left-2 h-4 w-0.5 rounded-full bg-primary" />
                  )}
                  <item.icon className="size-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.title}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      <div className="flex flex-col items-center gap-1">
        <ThemeToggle />
        <NavUser compact />
      </div>
    </nav>
  )
}

function RailButton({
  title,
  onClick,
  children,
}: {
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className="flex size-8 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors duration-100 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{title}</TooltipContent>
    </Tooltip>
  )
}
```

- [ ] **Step 2: Adapt `NavUser` and `ThemeToggle` to fit the rail**

Read `components/nav-user.tsx` and `components/theme-toggle.tsx`. `NavUser` currently renders for the shadcn sidebar footer; add an optional `compact?: boolean` prop that renders ONLY the avatar (`size-7`) as the dropdown trigger, keeping the existing dropdown menu content. Ensure `ThemeToggle` renders as a plain `size-8` icon button (`variant="ghost"`, `size="icon"`, `className="size-8"`). Keep both components' existing behavior for any other call sites.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (layout.tsx not wired yet; the component just has to compile).

- [ ] **Step 4: Commit**

```bash
git add -A apps/web
git commit -m "feat(web): icon rail shell component"
```

---

### Task 3: Contextual panel — `components/shell/app-panel.tsx`

**Files:**
- Create: `components/shell/app-panel.tsx`

- [ ] **Step 1: Create the panel component**

The panel renders area-specific navigation based on the current pathname. It uses `useWorkspace()` selectors only (no mutations).

```tsx
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Hash, Lock, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { useWorkspace } from "@/lib/store"
import { useIsMobile } from "@/hooks/use-mobile"

export function AppPanel() {
  const pathname = usePathname()
  const isMobile = useIsMobile()

  // Areas with their own full-width content get no panel.
  const section = pathname.split("/")[1] ?? ""
  const hasPanel = ["chat", "tasks", "teams"].includes(section)
  if (!hasPanel || isMobile) return null

  return (
    <aside className="flex h-svh w-60 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar custom-scrollbar">
      {section === "chat" && <ChatPanel pathname={pathname} />}
      {(section === "tasks" || section === "teams") && (
        <TeamsPanel pathname={pathname} />
      )}
    </aside>
  )
}

function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  )
}

function PanelLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        "mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors duration-100",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
      )}
    >
      {children}
    </Link>
  )
}

function ChatPanel({ pathname }: { pathname: string }) {
  const { teams, channelsForTeam } = useWorkspace()
  return (
    <>
      <div className="px-3 pt-3 text-[13px] font-semibold">Chat</div>
      {teams.map((team) => (
        <React.Fragment key={team.id}>
          <PanelHeading>{team.name}</PanelHeading>
          {channelsForTeam(team.id).map((channel) => {
            const href = `/teams/${team.id}/${channel.id}`
            return (
              <PanelLink key={channel.id} href={href} active={pathname === href}>
                {channel.private ? (
                  <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <Hash className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{channel.name}</span>
              </PanelLink>
            )
          })}
        </React.Fragment>
      ))}
    </>
  )
}

function TeamsPanel({ pathname }: { pathname: string }) {
  const { teams } = useWorkspace()
  return (
    <>
      <div className="px-3 pt-3 text-[13px] font-semibold">Workspace</div>
      <PanelHeading>Views</PanelHeading>
      <PanelLink href="/tasks" active={pathname === "/tasks"}>
        All tasks
      </PanelLink>
      <PanelLink href="/my-tasks" active={pathname === "/my-tasks"}>
        My tasks
      </PanelLink>
      <PanelHeading>Teams</PanelHeading>
      {teams.map((team) => (
        <PanelLink
          key={team.id}
          href={`/teams/${team.id}`}
          active={pathname.startsWith(`/teams/${team.id}`)}
        >
          <span
            className="flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white"
            style={{ backgroundColor: team.color }}
          >
            {team.key.slice(0, 1)}
          </span>
          <span className="truncate">{team.name}</span>
        </PanelLink>
      ))}
    </>
  )
}
```

Note: BEFORE finalizing, check the chat routes that actually exist (`app/chat/page.tsx`, `app/teams/[teamId]/[channelId]/page.tsx`) and `components/chat/chat-view.tsx` to confirm the channel link shape (`/teams/{teamId}/{channelId}`) and whether `/chat` has its own DM list. If `/chat` renders its own conversation list inside the page, the ChatPanel should link to `/chat?...` routes the page already uses instead — match reality, don't invent routes.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add -A apps/web
git commit -m "feat(web): contextual panel shell component"
```

---

### Task 4: Wire the new shell into `app/layout.tsx`, delete old sidebar

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/page-header.tsx`
- Delete: `components/app-sidebar.tsx`
- Possibly modify: `components/project-switcher.tsx` callers (it was only used by app-sidebar)

- [ ] **Step 1: Rewrite the layout body**

Replace the `SidebarProvider`/`AppSidebar`/`SidebarInset` composition in `app/layout.tsx` with:

```tsx
<WorkspaceProvider>
  <TooltipProvider delayDuration={300}>
    <div className="flex h-svh overflow-hidden">
      <AppRail />
      <AppPanel />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
    <CommandMenu />
    <Toaster />
  </TooltipProvider>
</WorkspaceProvider>
```

Imports: remove `SidebarInset`, `SidebarProvider`, `AppSidebar`; add `AppRail` from `@/components/shell/app-rail` and `AppPanel` from `@/components/shell/app-panel`. Keep fonts, metadata, ThemeProvider (now `defaultTheme="dark"` from Task 1).

- [ ] **Step 2: Mobile fallback**

`AppPanel` already returns `null` on mobile. The rail is 48px and stays usable on mobile — verify nothing else depended on `SidebarProvider` context: run `grep -rln "useSidebar\|SidebarTrigger" components app` and remove/replace any usages found (e.g. `page-header.tsx` likely renders a `SidebarTrigger` — delete it and keep the breadcrumb).

- [ ] **Step 3: Restyle `components/page-header.tsx` as the slim content header**

Read it first. Target shape: sticky `h-11` bar, `border-b border-border bg-background`, containing breadcrumb (existing), spacer, presence avatars/actions slot (preserve existing props/children API so pages keep working), `px-4`, all text `text-[13px]`.

- [ ] **Step 4: Delete `components/app-sidebar.tsx`**

Run: `rm components/app-sidebar.tsx && grep -rln "app-sidebar\|AppSidebar" app components`
Expected: no hits. If `project-switcher.tsx` is now orphaned (only imported by app-sidebar), leave the file (workspace switching may return) but confirm nothing breaks.

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run build`
Expected: exit 0. Then `npm run dev`, load `/`, `/tasks`, `/chat` — rail visible everywhere, panel on tasks/chat/teams, no console errors.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web
git commit -m "feat(web): replace sidebar with icon rail + contextual panel shell"
```

---

### Task 5: Home dashboard restyle

**Files:**
- Modify: `app/page.tsx`, `components/dashboard/command-center.tsx`, `components/dashboard/tenant-admin-dashboard.tsx`, `components/activity/activity-feed.tsx`

- [ ] **Step 1: Read all four files**, then apply the design recipe:
  - Page becomes a Linear-style Home: greeting line (`text-[15px] font-semibold`), then stacked sections — "Assigned to you" (dense task rows: status icon, key in `font-mono text-[11px] text-muted-foreground`, title, priority icon, due chip), "Recent activity" (the feed, restyled to borderless rows with `size-6` avatars), "Upcoming" (meetings list).
  - Replace any large stat cards/gradients with a single compact stat strip (`flex gap-6`, each stat = number `text-[15px] font-semibold` + label `text-[11px] text-muted-foreground`).
  - Sections separated by `border-b border-border` or simple `mt-6` headings (`text-xs font-medium text-muted-foreground uppercase tracking-wider`), not cards.
  - Keep ALL data wiring (`useWorkspace()` calls) exactly as-is; this is a JSX/className change only.

- [ ] **Step 2: Verify** — `npm run lint && npm run build` exit 0; dev-load `/`, check both themes via toggle.

- [ ] **Step 3: Commit** — `git add -A apps/web && git commit -m "feat(web): restyle home dashboard"`

---

### Task 6: Tasks area restyle (board, list, timeline, toolbar, card, detail sheet, create dialog)

**Files:**
- Modify: `components/tasks/tasks-workspace.tsx`, `task-toolbar.tsx`, `task-board.tsx`, `task-card.tsx`, `task-list.tsx`, `task-timeline.tsx`, `team-board-view.tsx`, `task-detail-sheet.tsx`, `create-task-dialog.tsx`, and `app/tasks/page.tsx`, `app/teams/[teamId]/board/page.tsx` if they carry layout classes.

- [ ] **Step 1: Read the files**, then apply the recipe:
  - **Toolbar:** one `h-11` row under the page header — view switcher (board/list/timeline) as `h-7` segmented `ToggleGroup`, filter/sort dropdowns as `h-7 px-2 text-xs` ghost buttons, "New task" as the only `default`-variant `h-7` button (accent).
  - **Board columns:** column header = status icon + label `text-xs font-medium` + count `text-[11px] text-muted-foreground`, no filled header background; column body `bg-transparent`, cards stacked `gap-1.5`; column width ~`w-72`.
  - **Task card:** `rounded-md border border-border bg-card px-3 py-2` with `hover:border-muted-foreground/30`; line 1 = key (`font-mono text-[11px] text-muted-foreground`) + priority icon right-aligned; line 2 = title `text-[13px] leading-snug`; line 3 = tags + due chip + assignee avatars `size-5`. No shadows, no lift animation.
  - **List view:** flat full-width rows `h-9` (`flex items-center gap-3 px-3 border-b border-border/60 hover:bg-accent/50`): status icon, key, title (truncate), tags, due, priority, avatars. Group headers per status: sticky row with status icon + label + count.
  - **Detail sheet:** two zones — main (title `text-[15px] font-semibold`, description, subtasks with compact checkboxes, comments) and a `w-56` metadata column (rows of label `text-[11px] text-muted-foreground` + value control), like Linear's right sidebar.
  - **Create dialog:** compact — title input borderless `text-[15px]`, description textarea, then one row of `h-7` property pill-buttons (status/priority/assignee/team/due).
  - Keep every handler, store call, and prop signature unchanged.

- [ ] **Step 2: Verify** — lint + build exit 0; dev-check `/tasks` in board/list/timeline modes, open a task, create a task.

- [ ] **Step 3: Commit** — `git add -A apps/web && git commit -m "feat(web): restyle tasks board/list/timeline and detail views"`

---

### Task 7: My Tasks restyle

**Files:**
- Modify: `app/my-tasks/page.tsx` and whatever component it delegates to.

- [ ] **Step 1: Read, then apply the same list treatment as Task 6's list view** (status-grouped dense rows). If it reuses `task-list.tsx`, this task may only need page-level spacing/header cleanup — verify and adjust.

- [ ] **Step 2: Verify** — lint + build; dev-check `/my-tasks`.

- [ ] **Step 3: Commit** — `git add -A apps/web && git commit -m "feat(web): restyle my-tasks page"`

---

### Task 8: Chat restyle

**Files:**
- Modify: `components/chat/chat-view.tsx`, `channel-view.tsx`, `conversation-header.tsx`, `message-item.tsx`, `message-thread.tsx`, `message-composer.tsx`, `thread-panel.tsx`, `create-channel-dialog.tsx`, plus `app/chat/page.tsx`, `app/teams/[teamId]/[channelId]/page.tsx`.

- [ ] **Step 1: Read the files**, then apply the recipe:
  - **Conversation header:** `h-11 border-b border-border px-4`, channel name `text-[13px] font-semibold`, member presence avatars right.
  - **Message rows:** flat, full-width, `px-4 py-1 hover:bg-accent/40`; `size-7` avatar; author `text-[13px] font-semibold` + timestamp `text-[11px] text-muted-foreground`; consecutive messages from the same author within 5 min collapse the avatar/name (if the data flow makes grouping awkward, hover-only timestamp is the fallback — don't restructure message data).
  - **Reactions:** `h-5 rounded-full border border-border px-1.5 text-[11px]`, active reaction gets `border-primary/50 bg-primary/10`.
  - **Composer:** single `rounded-md border border-input bg-card` box pinned bottom with `p-1`: textarea (borderless, `text-[13px]`) + icon row (`size-7` ghost buttons) + send button `h-7` accent.
  - **Thread panel:** `w-80 border-l border-border`, same message row treatment.
  - If chat components contain duplicated date/avatar logic that fights the restyle, prefer the existing `components/shared/` helpers (`user-avatar.tsx`).
  - Keep `voice-wave-bar` usage as-is if present.

- [ ] **Step 2: Verify** — lint + build; dev-check `/chat` and a team channel route; send a message, open a thread, react.

- [ ] **Step 3: Commit** — `git add -A apps/web && git commit -m "feat(web): restyle chat surface"`

---

### Task 9: Calendar restyle

**Files:**
- Modify: `components/calendar/calendar-view.tsx`, `app/calendar/page.tsx`.

- [ ] **Step 1: Read, then apply the recipe:**
  - Month grid: cell borders `border-border/60`, day numbers `text-[11px] text-muted-foreground` (today: `bg-primary text-primary-foreground rounded-full size-5 inline-flex items-center justify-center`).
  - Events: `rounded px-1.5 py-0.5 text-[11px] truncate` chips using `bg-primary/15 text-primary` (or per-team color at 15% via `color-mix`/inline style).
  - Header: `h-11` toolbar — month label `text-[15px] font-semibold`, prev/next `size-7` ghost icon buttons, "Today" `h-7` outline button.

- [ ] **Step 2: Verify** — lint + build; dev-check `/calendar`, navigate months.

- [ ] **Step 3: Commit** — `git add -A apps/web && git commit -m "feat(web): restyle calendar"`

---

### Task 10: Teams pages restyle

**Files:**
- Modify: `components/teams/teams-overview.tsx`, `team-card.tsx`, `create-team-dialog.tsx`, `team-redirect.tsx` (check only), `app/teams/page.tsx`, `app/teams/[teamId]/page.tsx`.

- [ ] **Step 1: Read, then apply the recipe:**
  - Teams overview: dense rows or compact `rounded-md border bg-card` cards — team color square (`size-6 rounded`), name `text-[13px] font-medium`, key `font-mono text-[11px] text-muted-foreground`, member avatar stack `size-5`, task count.
  - Team detail: slim header (team identity + lead + members), then its existing tabbed/board content inherits Task 6 styles.
  - Create-team dialog: same compact dialog treatment as Task 6's create dialog.
  - `app/teams/[teamId]/page.tsx` has Promise `params` — don't touch the data flow.

- [ ] **Step 2: Verify** — lint + build; dev-check `/teams` and a team detail page.

- [ ] **Step 3: Commit** — `git add -A apps/web && git commit -m "feat(web): restyle teams pages"`

---

### Task 11: Shared components + empty states sweep

**Files:**
- Modify: `components/shared/user-avatar.tsx`, `assignee-group.tsx`, `meta-badges.tsx`, `presence-avatar.tsx`, `components/ui/empty.tsx` usages (not the primitive), `components/command-menu.tsx`.

- [ ] **Step 1: Read, then tune to the new scale:**
  - Avatars: default `size-6`, `text-[10px]` initials; presence dot `size-2` with `ring-2 ring-background`.
  - Meta badges/chips: recipe chip spec (`rounded px-1.5 text-[11px]`).
  - Command menu: ensure `text-[13px]` items, `h-8` rows — likely already close from cmdk defaults; adjust only if visibly off-scale.
  - Empty states: icon `size-8 text-muted-foreground`, title `text-[13px] font-medium`, hint `text-xs text-muted-foreground`, optional `h-7` action button.

- [ ] **Step 2: Full-app grep for leftover old-style classes**

Run: `grep -rn "backdrop-blur\|bg-gradient\|shadow-lg\|shadow-xl\|rounded-2xl\|rounded-3xl\|text-2xl\|text-3xl" components app --include="*.tsx" | grep -v components/ui`
Review each hit; replace with recipe equivalents unless genuinely warranted (dialog overlays may keep blur).

- [ ] **Step 3: Verify** — lint + build exit 0.

- [ ] **Step 4: Commit** — `git add -A apps/web && git commit -m "feat(web): align shared components and empty states to new design scale"`

---

### Task 12: Final verification (build + visual pass, both themes)

**Files:** none (verification only)

- [ ] **Step 1: Clean build**

Run: `npm run lint && npm run build`
Expected: exit 0, no type errors, no lint errors.

- [ ] **Step 2: Visual pass via dev-server preview**

Start the dev server (preview tooling if available, else `npm run dev`). For EACH page — `/`, `/tasks` (board, list, timeline), `/my-tasks`, `/chat`, a team channel chat route, `/calendar`, `/teams`, a team detail page:
  - Screenshot in dark mode (default).
  - Check the browser console is free of errors/warnings introduced by the redesign.
Then toggle to light mode and spot-check `/`, `/tasks` board, `/chat` for contrast/legibility.

- [ ] **Step 3: Interaction spot-checks**

- Switch board/list/timeline views on `/tasks`.
- Open a task detail sheet; toggle a subtask; add a comment.
- Create a task via dialog; create a team.
- Send a chat message; open a thread; toggle a reaction.
- Open ⌘K command menu and navigate somewhere.
- Resize to mobile width: rail still usable, panel hidden, pages not broken.

- [ ] **Step 4: Fix anything found, re-verify, then commit**

```bash
git add -A apps/web
git commit -m "chore(web): redesign verification fixes"
```

(Skip the commit if nothing changed.)
