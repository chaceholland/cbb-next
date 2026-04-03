# Unified Tracker Platform Design

**Date:** 2026-04-02
**Scope:** Convert MLB tracker to Next.js/React/Tailwind matching CBB's stack. Apply consistent dark theme and layout patterns across both trackers.

---

## 1. Overview

Two parallel workstreams:

1. **MLB Tracker** — Convert from vanilla HTML/JS to Next.js app with React components mirroring CBB's architecture. Implement CBB-style roster page (team grid → team detail).
2. **CBB Tracker** — Restyle existing React components to dark theme matching MLB's visual design. Restructure schedule game cards to match MLB's matchup layout.

Both trackers will share the same visual language, component patterns, and tech stack (Next.js 16 + React 19 + Tailwind CSS 4 + Supabase).

---

## 2. Shared Visual Language

| Element | Value |
|---------|-------|
| Background | `#0f172a` (slate-900) |
| Card surface | `#1e293b` (slate-800) |
| Elevated surface | `#334155` (slate-700) |
| Border | `#334155` (slate-700) |
| Border subtle | `#475569` (slate-600) |
| Primary text | `#f1f5f9` (slate-100) |
| Secondary text | `#94a3b8` (slate-400) |
| Muted text | `#64748b` (slate-500) |
| Accent | `#60a5fa` (blue-400) |
| Accent hover | `#3b82f6` (blue-500) |
| Favorite star | `#fbbf24` (amber-400) |
| Gradient | `#1a73e8` → `#ea4335` (header/hero) |
| Font | Inter (400, 600, 700, 800) |
| Team logos | 110px, rounded-xl, contain, dark bg |
| Headshots | 100px, rounded-lg, cover, hover scale-[2.2] with shadow |
| Cards | rounded-2xl, border slate-700, shadow |
| Scrollbar | 8px, slate-800 track, slate-600 thumb |

### Priority Colors (Schedule)

| Priority | Color | Soft BG |
|----------|-------|---------|
| Priority | `#7c3aed` (violet-600) | `rgba(124,58,237,0.15)` |
| High | `#ef4444` (red-500) | `rgba(239,68,68,0.15)` |
| Medium | `#10b981` (emerald-500) | `rgba(16,185,129,0.15)` |
| Low | `#f59e0b` (amber-500) | `rgba(245,158,11,0.15)` |

---

## 3. MLB Tracker — Convert to Next.js

### 3.1 Project Setup

Convert `/Users/chace/mlb-pitcher-tracker/` in-place:
- Initialize Next.js 16 with App Router, TypeScript, Tailwind CSS 4
- Keep existing `data/` directory with JSON files
- Keep existing `api/update.js` → convert to `app/api/update/route.ts`
- Keep `vercel.json` cron config
- Add Supabase client library

### 3.2 Data Sources

**Static JSON files** (already exist in `data/`):
- `pitchers.json` / `pitchers_enhanced.json` — pitcher profiles per team
- `schedule.json` — full season schedule
- `schedule_week_*.json` — weekly schedule data
- `divisions_map.json` — team_id → division name
- `divisions_meta.json` — division metadata
- `teams.json` — team profiles with logos

**Supabase tables** (already exist):
- `mlb_favorites` — type (pitchers/teams/games), item_id
- `mlb_watched` — game watch status
- `mlb_priority` — game priority ratings

### 3.3 Component Structure

```
app/
  layout.tsx          — dark theme root, Inter font, global styles
  page.tsx            — main page with tab navigation (Schedule / Rosters)
  api/update/route.ts — cron endpoint (convert from api/update.js)
components/
  Navigation.tsx      — sticky top bar + tab bar
  schedule/
    ScheduleView.tsx  — week accordion, game list, filters
    GameCard.tsx       — full-width matchup card (away | VS | home)
    PitcherRow.tsx    — pitcher in game context (headshot, name, stats, star)
  roster/
    RosterView.tsx    — two-level: team grid ↔ team detail
    TeamCard.tsx      — team card in grid (logo, name, division, pitcher count, star)
    PitcherCard.tsx   — pitcher card in team detail (headshot, name, number, role, star)
lib/
  supabase/client.ts  — Supabase client
  supabase/types.ts   — TypeScript types
  data.ts             — JSON data loaders
  utils.ts            — shared utilities (ESPN URLs, name normalization)
  hooks/
    useLocalStorage.ts
    useFavorites.ts   — Supabase-backed favorites (mlb_favorites table)
```

### 3.4 MLB Roster Page — New Design

**State 1: Team Grid**
- Responsive grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
- Each team card shows:
  - Team logo (80px, rounded-xl)
  - Team name (bold)
  - Division label (small, accent color pill)
  - Pitcher count badge
  - Favorite star (amber when active)
- Click card → transition to team detail
- Search bar filters teams by name
- Division dropdown filter
- Sort: alphabetical, by division, favorites first

**State 2: Team Detail**
- Back button (← All Teams)
- Team header: large logo (110px), team name, division, ESPN links, favorite star
- Filter bar: search pitchers, show favorites only
- Pitcher grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
- Each pitcher card:
  - Headshot image (fills card, object-cover, object-top)
  - Name overlay at bottom
  - Jersey number
  - Role badge (Starter = blue, Reliever = violet)
  - Favorite star
  - Click → pitcher modal with full details + ESPN link
- Favorites stored in Supabase `mlb_favorites` table

### 3.5 MLB Schedule Page — Port Existing Design

Port the current `schedule.html` functionality into React components:
- Week accordion (collapsible week sections)
- Full-width game cards with matchup layout:
  - Game header: week tag, date, ESPN/priority/favorite/watched buttons
  - Match body: away side | VS divider | home side
  - Each side: team logo, team name, division pill, pitcher list
  - Pitcher list: 2-column grid, headshot + name + stats + favorite star
- Filters: search, week selector, show favorites, show watched, priority filter
- Priority system: color-coded left border + header background
- Watch/favorite toggles per game
- Hero section with animated gradient background

---

## 4. CBB Tracker — Dark Theme Restyle

### 4.1 Theme Changes

Apply dark theme to existing CBB components. Changes to:

**`app/layout.tsx`** — Set dark background on body/html
**`app/globals.css`** or Tailwind config — Dark color palette as defaults

**All components** — Replace light colors:
| Current (Light) | New (Dark) |
|-----------------|------------|
| `bg-white` | `bg-slate-800` |
| `bg-slate-50` | `bg-slate-900` |
| `bg-slate-100` | `bg-slate-700` |
| `border-slate-100` | `border-slate-700` |
| `border-slate-200` | `border-slate-600` |
| `text-slate-800` | `text-slate-100` |
| `text-slate-600` | `text-slate-300` |
| `text-slate-400` | `text-slate-400` (keep) |
| `shadow-md` | `shadow-md shadow-black/30` |

### 4.2 Schedule GameCard Restyle

Restructure the existing `GameCard.tsx` to match MLB's matchup layout:

**Current:** Compact card with team columns side-by-side, light theme
**New:** Full-width dark card with:
- Game header bar (dark bg, date, week, action buttons)
- Match body: `grid-template-columns: 1fr 28px 1fr`
  - Away side: team logo, name, division, pitcher list (2-col grid)
  - VS divider (large, muted)
  - Home side: same as away
- Pitcher rows: headshot (100px) + name + stats + favorite star
- Priority color left border (if priority system added)
- Watched state: muted opacity

### 4.3 Schedule ScheduleView Restyle

- Dark background throughout
- Week accordion headers: dark elevated surface
- Filter bar: dark inputs with blue focus ring
- Hero section: animated gradient matching MLB style
- Counter badges: blue-tinted dark pills

### 4.4 Roster — Minimal Changes

The roster page already has the correct two-level team grid → team detail flow. Only needs:
- Dark theme color swap (same mapping as above)
- All existing functionality preserved

### 4.5 Other Components

- `Navigation.tsx` — dark sticky bar with gradient title
- `FilterPills.tsx` — dark pill styling
- `PitcherModal` — dark overlay and card
- `EmptyState` — dark text colors
- Skeleton loaders — dark placeholder colors

---

## 5. Data & State Management

### MLB Favorites
- Stored in Supabase `mlb_favorites` table (already exists)
- Custom `useFavorites` hook wrapping Supabase REST calls
- Types: pitchers, teams, games
- Real-time sync not needed — read on load, write on toggle

### MLB Watch/Priority (Schedule)
- Stored in Supabase `mlb_watched` and `mlb_priority` tables
- Same pattern as favorites

### CBB — No Changes
- Favorites already in localStorage (`cbb-favorites`)
- All existing state management stays the same

---

## 6. Deployment

### MLB Tracker
- Vercel deployment (already configured)
- `vercel.json` cron preserved
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`

### CBB Tracker
- Existing Vercel deployment continues
- No infrastructure changes, only component restyling

---

## 7. Out of Scope

- No new database tables (use existing Supabase tables)
- No new data scraping logic (keep existing ESPN API patterns)
- No new features beyond visual consistency
- No SSR/ISR optimization (keep client-side rendering for both)
- No shared component library between projects (copy patterns, not code)
