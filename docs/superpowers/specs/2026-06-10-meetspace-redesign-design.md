# Meetspace Web Redesign — ClickUp + Jira + Teams in One Platform

**Date:** 2026-06-10
**Scope:** `apps/web` — full visual redesign (shell + theme + all pages). No feature, data, or routing changes.

## Goal

Replace the current design with a Linear-style, dense, dark-first UI that positions
Meetspace as a unified alternative to ClickUp, Jira, and Microsoft Teams. Same
features and mock data, completely new look and navigation structure.

## Decisions (confirmed with user)

- **Visual style:** Linear-style — dark-leaning, compact, small type, subtle 1px borders, high information density.
- **App shell:** Slim icon rail + contextual second panel (Teams/Slack pattern).
- **Theme:** Dark mode default, indigo/violet accent. Light mode kept and re-tuned via existing `next-themes` toggle.
- **Scope:** Full reskin + new shell; keep all existing features. New Jira views (Backlog/Sprints/Roadmap) are explicitly a later phase.
- **Approach:** Restyle in place (no parallel v2 tree). `lib/store.tsx`, `lib/types.ts`, `lib/mock-data.ts` untouched.

## 1. Design tokens (`app/globals.css`)

Dark default:

- Backgrounds layered: app `~#0A0A0C`, panel `~#101014`, raised surface `~#16161C`, hover `~#1C1C24`.
- Borders: subtle, ~`#26262E` at 1px; no heavy shadows — elevation via background steps.
- Accent: indigo→violet family, primary ~`#6E6ADE`–`#7C6AEF`; used for focus rings, active nav, primary buttons, selection.
- Text: high-contrast off-white `~#EDEDF2`, secondary `~#9B9BA7`, muted `~#62626E`.
- Status colors (task states): backlog gray, todo slate, in-progress amber/blue, done green, canceled muted red — used as small dots/icons, not large fills.
- Light theme: same structure inverted — white/very-light-gray layers, same accent, re-tuned for contrast.

Typography & density:

- App chrome base 13px; page titles 15–16px semibold; metadata 11–12px.
- Radius scale tightened: 4px default, 6px for cards/dialogs.
- Control heights: 28px (compact buttons/inputs in toolbars), 32px (default).
- Keep Tailwind v4 `@theme` token approach already in `globals.css`; replace values, keep variable names where shadcn expects them (`--background`, `--primary`, etc.) so `components/ui/*` keep working.

## 2. App shell

Replaces `components/app-sidebar.tsx` and the layout wiring in `app/layout.tsx`.

- **Icon rail** (~48px, fixed left): workspace avatar (top), then Home, My Tasks, Tasks/Projects, Chat, Calendar, Teams; theme toggle + user avatar (bottom). Active item: accent indicator + filled icon. Tooltips on hover.
- **Contextual panel** (~240px, collapsible): content depends on active area —
  - Chat: channel/DM list (reuses existing chat data from store).
  - Tasks/Teams: teams & projects list + view links (board/list/timeline).
  - Home / My Tasks / Calendar: compact secondary nav or filters.
- **Content header** (slim, ~44px): breadcrumb, ⌘K search trigger (existing `command-menu.tsx` kept), presence avatars, page-level actions.
- Existing `project-switcher.tsx`, `workspace-switcher.tsx`, `nav-user.tsx` are restyled/absorbed into the rail and panel.
- Mobile: rail collapses to a bottom/overlay pattern using the existing `use-mobile.ts` hook; contextual panel becomes a sheet.

## 3. Page restyles (in place, logic untouched)

- **Home (`app/page.tsx`, `components/dashboard/*`):** Linear-style Home — "Assigned to you", recent activity (`activity-feed.tsx`), upcoming events; dense card-less sections with row lists.
- **Tasks (`app/tasks`, `components/tasks/*`):** board/list/timeline kept. Compact cards: status dot, ID-style label, title, priority icon, assignee avatars, due chip. Toolbar (`task-toolbar.tsx`) becomes a 28px-control filter bar. Detail sheet restyled with sectioned metadata sidebar.
- **My Tasks (`app/my-tasks`):** same dense list treatment grouped by status.
- **Chat (`app/chat`, `app/teams/[teamId]/[channelId]`, `components/chat/*`):** flat hover-highlight message rows, grouped consecutive messages, slim composer with icon actions, restyled thread panel.
- **Calendar (`app/calendar`, `components/calendar/*`):** dense grid, accent event chips, today highlight.
- **Teams (`app/teams`, `components/teams/*`):** compact team rows/cards with presence and member stacks.
- **Shared (`components/shared/*`):** avatars, meta badges, presence dots re-tuned to the new scale.

## 4. Out of scope

- No changes to `lib/` (store, types, mock-data), routes, or features.
- No new views (Backlog/Sprints/Roadmap) — future phase per product goal.
- No new dependencies.

## 5. Error handling & edge cases

- Both themes must pass basic contrast sanity (text vs background) — verify visually in both modes.
- Empty states (`ui/empty.tsx`) restyled to match; pages with no data must not look broken.
- Mobile breakpoint must remain usable (rail/panel collapse).

## 6. Verification

- `npm run build` (or `next build`) passes with no type/lint errors.
- Dev-server preview: screenshot every page (Home, Tasks board/list/timeline, My Tasks, Chat, Calendar, Teams, team detail) in dark and spot-check light; console free of errors.
- Interactions spot-checked: view switching, task detail sheet, create dialogs, ⌘K menu, theme toggle.

## 7. Testing

No test suite exists in `apps/web`; verification is build + visual/interaction checks above. (Adding tests is out of scope for a visual redesign.)
