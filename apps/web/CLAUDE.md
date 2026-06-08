@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: Next.js version

This app runs Next.js **16.2.7** with React **19.2.4**. The version is newer than your training data — APIs, conventions, and file layout may differ. Before writing Next.js code, read the relevant guide under `node_modules/next/dist/docs/` (top-level: `01-app/`, `02-pages/`, `03-architecture/`). Heed deprecation notices.

One concrete consequence already in the codebase: dynamic route `params` are a `Promise` and must be awaited (see `app/teams/[teamId]/page.tsx`).

## Commands

```bash
npm run dev     # next dev — local dev server on :3000
npm run build   # next build
npm run start   # next start — serve production build
npm run lint    # eslint (flat config in eslint.config.mjs)
```

No test runner is configured.

## Architecture

This is the **`web`** app inside a monorepo at `/Users/indal/Desktop/Workspace/meetspace/` (siblings: `apps/admin` Next.js app, `apps/backend` Go service, root `docker-compose.yaml`). The web app is currently a self-contained UI prototype — there is no backend wiring; all data is in-memory.

### State: WorkspaceProvider (single source of truth)

`lib/store.tsx` defines `WorkspaceProvider` + `useWorkspace()`. It is mounted once in `app/layout.tsx` and wraps the entire tree. **All teams/tasks/users data lives here in React state, seeded from `lib/mock-data.ts`.** There is no API, no fetch, no persistence — mutations (`createTask`, `updateTask`, `moveTask`, `toggleSubtask`, `addComment`, `createTeam`, etc.) update React state directly and are lost on reload.

When adding a new entity or mutation, extend `WorkspaceContextValue` in `lib/store.tsx` and the seed data in `lib/mock-data.ts`. Domain types live in `lib/types.ts` (`Task`, `Team`, `User`, `StatusId`, `PriorityId`, `Subtask`, `Comment`).

Because the store relies on React Context, any component that calls `useWorkspace()` must be a Client Component (`"use client"`). Most route pages remain server components and delegate to client components in `components/` (e.g. `app/tasks/page.tsx` → `<TasksWorkspace />`).

### Visual config: STATUSES, PRIORITIES, TAG_COLORS

`lib/config.ts` is the canonical registry of status/priority metadata — icons (lucide), labels, colors, and the `STATUS_MAP` / `PRIORITY_MAP` lookups. UI components import from here rather than hardcoding status strings. Adding a new status or priority means updating `lib/types.ts` (the union) and `lib/config.ts` (the metadata), in that order.

### Routes (App Router)

- `app/page.tsx` — Home / overview
- `app/tasks/page.tsx` — All tasks across teams (board + list views via `TasksWorkspace`)
- `app/my-tasks/page.tsx` — Current-user filtered tasks
- `app/teams/page.tsx` — Teams overview
- `app/teams/[teamId]/page.tsx` — Team detail (note: `params` is a Promise)

Root layout composes: `ThemeProvider` (next-themes) → `WorkspaceProvider` → `TooltipProvider` → `SidebarProvider` with persistent `AppSidebar` + `SidebarInset` for page content.

### UI stack

- **shadcn/ui** with style `radix-nova`, RSC enabled, base color `neutral`, icons from `lucide-react`. Config in `components.json`. Primitives live in `components/ui/`.
- **Tailwind CSS v4** via `@tailwindcss/postcss` (no `tailwind.config.*` — config flows through `app/globals.css` and PostCSS).
- Path alias `@/*` → repo root of the `web` app. Aliases match `components.json`: `@/components`, `@/lib`, `@/hooks`, `@/components/ui`, `@/lib/utils`.

### Component layout

- `components/ui/` — shadcn primitives; do not hand-edit unless updating the primitive itself. Add new ones with the shadcn CLI.
- `components/tasks/`, `components/teams/`, `components/home/` — feature components consumed by routes.
- `components/shared/` — cross-feature pieces (`UserAvatar`, `AssigneeGroup`, `MetaBadges`).
- `components/app-sidebar.tsx`, `components/page-header.tsx`, `components/theme-*` — global chrome.

## Conventions worth knowing

- Task `key` is derived from team `key` + counter (e.g. `ENG-128`); generated inside `createTask` in the store.
- IDs are random slugs (`uid("task")` etc.) — fine for a prototype, not stable across reloads.
- `today()` returns `YYYY-MM-DD`; timestamps on comments use full ISO.
- `tagColor(tag)` in `lib/config.ts` maps known tags to Tailwind soft-pill classes; unknown tags fall back to neutral.
