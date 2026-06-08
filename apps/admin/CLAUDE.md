@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Next.js dev server (default: http://localhost:3000)
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`, extends `eslint-config-next/core-web-vitals` + `typescript`)

There is no test runner configured.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4 (`@import "tailwindcss"` in `app/globals.css`, no `tailwind.config`)
- shadcn/ui — `style: "radix-nova"`, base color `neutral`, icons via `lucide-react` (see `components.json`)
- `next-themes` for light/dark, `sonner` for toasts, `radix-ui` for primitives
- Path alias: `@/*` → repo root (see `tsconfig.json`)

Heed the AGENTS.md warning: this is Next.js 16, not what most training data covers. Before writing route handlers, layouts, async APIs (`cookies()`, `headers()`, `params`), metadata, or anything framework-shaped, check `node_modules/next/dist/docs/01-app/` for the current API.

## Architecture

This is the **admin console** for Meetspace (sibling apps `../web` is the customer app, `../backend` is Go). It is a read-mostly dashboard built on mock data — there is **no API layer, no database, no auth**. All data lives in `lib/mock-data.ts` and is consumed synchronously.

### Layout shell

`app/layout.tsx` wraps every route in: `ThemeProvider` → `TooltipProvider` → `SidebarProvider` (`AppSidebar` + `SidebarInset` containing `Topbar` and `<main>`). Pages render directly into that `<main>`; they should not re-mount sidebars or topbars.

### Routes (all under `app/`)

`/` dashboard, `/workspaces`, `/users`, `/tasks`, `/billing`, `/analytics`, `/security`, `/feature-flags`, `/settings`. Each route is a single `page.tsx` server component that imports aggregates/lookups from `@/lib/data` and renders cards + tables. Interactive pieces (filters, toggles, command menus) are extracted into `*-client.tsx` files under `components/admin/` and marked `"use client"`.

### Data layer (`lib/`)

- `types.ts` — domain model: `Workspace`, `User`, `Team`, `Task`, `Invoice`, `Activity`, `FeatureFlag`, plus the union string-literal IDs (`PlanId`, `StatusId`, `PriorityId`, `WorkspaceStatus`, `UserStatus`, `InvoiceStatus`, `PlatformRole`). The customer product is workspaces → teams → tasks; admin sits above it managing accounts, billing, and platform health.
- `mock-data.ts` — the fixtures. Don't import this from pages directly.
- `data.ts` — the **single import surface** for pages. Builds id→entity `Map` lookups (`getUser`, `getWorkspace`, `getTeam`), computes aggregate KPIs (`totalMrr`, `activeWorkspaces`, …), exposes series helpers (`seriesTotal`, `seriesTrend`, `periodTrend`), and re-exports the raw collections. New aggregates go here.
- `config.ts` — visual metadata for enum-like IDs: `PLANS`, `WORKSPACE_STATUS`, `USER_STATUS`, `INVOICE_STATUS`, `STATUSES`/`STATUS_MAP`, `PRIORITIES`/`PRIORITY_MAP`, `TAG_COLORS`. Every status/plan/priority badge in the UI reads its label, `soft` (bg+text class pair), and `dot` color from here — do **not** hardcode tone classes in components.
- `format.ts`, `date.ts` — formatters (`formatCurrency`, `formatCompact`, `formatNumber`, `timeAgo`).
- `utils.ts` — `cn()` (clsx + tailwind-merge).

### Components

- `components/ui/*` — shadcn primitives. Regenerate/add via the `shadcn` CLI; don't hand-edit unless customizing.
- `components/admin/*` — composed admin pieces: `app-sidebar`, `topbar`, `page-header`, `stat-card`, `charts` (custom SVG `AreaChart`/`DonutChart`), `tone-badge` (renders a `Tone` from `config.ts`), `user-cell`, and the per-route `*-table` / `*-client` components.
- `components/shared/*` — cross-cutting (currently just `user-avatar`).
- `components/theme-provider.tsx`, `theme-toggle.tsx` — `next-themes` wiring.

### Conventions

- Server components by default; opt into `"use client"` only for interactivity (the `*-client.tsx` pattern).
- Status/plan/priority rendering goes through `ToneBadge` + the `config.ts` maps. Adding a new status means adding it to the union in `types.ts` *and* the corresponding map in `config.ts`.
- Charts are inline SVG (`components/admin/charts.tsx`), not a charting lib — extend that file rather than pulling one in.
- Use the `@/` alias for all internal imports.
