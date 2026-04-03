# CBB Tracker Dark Theme Restyle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the CBB Pitcher Tracker from light theme to dark theme matching the MLB tracker's visual design. Restructure schedule GameCard to match MLB's matchup layout.

**Architecture:** Keep existing Next.js 16 + React 19 + Tailwind CSS 4 stack. Replace light Tailwind classes with dark equivalents throughout all components. Restructure GameCard layout to match MLB's away | VS | home pattern.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4 (existing)

**Project root:** `/Users/chace/Desktop/cbb-next/`

---

## Color Mapping

Every component needs these class replacements:

| Light Class | Dark Replacement |
|-------------|-----------------|
| `bg-white` | `bg-slate-800` |
| `bg-slate-50` | `bg-slate-900` |
| `bg-slate-100` | `bg-slate-700` |
| `bg-gradient-to-r from-yellow-50 to-amber-50` | `bg-slate-900` |
| `border-slate-100` | `border-slate-700` |
| `border-slate-200` | `border-slate-600` |
| `border-yellow-100` | `border-slate-700` |
| `border-yellow-200` | `border-slate-600` |
| `text-slate-800` | `text-slate-100` |
| `text-slate-700` | `text-slate-200` |
| `text-slate-600` | `text-slate-300` |
| `text-slate-500` | `text-slate-400` |
| `shadow-md` | `shadow-md shadow-black/30` |

---

### Task 1: Global Theme — Layout and Globals

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Update app/layout.tsx body class**

Change the body element to use dark background:

In `app/layout.tsx`, find the `<body>` tag and add dark background classes:
```tsx
<body className="bg-slate-900 text-slate-100 font-sans antialiased">
```

Also add Inter font import in `<head>` if not present:
```tsx
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Update app/globals.css**

Add dark scrollbar styles and gradient animation:

```css
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: #1e293b;
}
::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

@keyframes gradient {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/chace/Desktop/cbb-next && npx next build
```

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: apply dark theme to global layout and CSS

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Navigation Component Dark Theme

**Files:**
- Modify: `components/Navigation.tsx`

- [ ] **Step 1: Read current Navigation.tsx**

Read the file to understand current styling.

- [ ] **Step 2: Replace light classes with dark equivalents**

Apply the color mapping: white → slate-800, slate-50 → slate-900, light borders → slate-700, etc. Add gradient title styling matching MLB:

```
bg-gradient-to-r from-blue-500 to-red-500 bg-clip-text text-transparent
```

Tab bar: dark background with gradient active tab.

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/Navigation.tsx
git commit -m "feat: restyle Navigation to dark theme

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Schedule ScheduleView Dark Theme

**Files:**
- Modify: `components/schedule/ScheduleView.tsx`

- [ ] **Step 1: Read current ScheduleView.tsx**

Understand all the Tailwind classes used throughout the component.

- [ ] **Step 2: Apply color mapping to all light classes**

Systematically replace every light-themed class in ScheduleView with dark equivalents per the color mapping table. Key areas:
- Week accordion headers
- Filter bar inputs and buttons
- Counter badges
- Empty states
- Loading skeletons
- Background colors on expanded week content

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/schedule/ScheduleView.tsx
git commit -m "feat: restyle ScheduleView to dark theme

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Schedule GameCard — Restructure to Matchup Layout

**Files:**
- Modify: `components/schedule/GameCard.tsx`

This is the biggest change — restructure the card layout from the current compact light-theme card to the MLB-style full-width dark matchup card.

- [ ] **Step 1: Read current GameCard.tsx fully**

Understand all props, sub-components (TeamColumn, PitcherRow, TeamLogo), and functionality.

- [ ] **Step 2: Restructure to matchup layout**

Replace the current layout with:
- **Game header bar**: dark bg (`bg-slate-900`), date, week, action buttons (favorite, watched, status badges)
- **Match body**: `grid grid-cols-[1fr_28px_1fr]`
  - Away TeamSide: team logo (110px), name, pitcher grid
  - VS divider: `text-3xl font-black text-slate-600`
  - Home TeamSide: same layout
- **PitcherRow**: headshot (100px) with hover zoom, name with favorite star, stats badges, all on dark bg
- **Dark color scheme**: `bg-slate-800` card, `bg-slate-900` surfaces, `border-slate-700` borders
- Preserve ALL existing props and functionality: favorites, watched, issues, participation data, headshot lookup

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Visual verification**

```bash
npx next dev --turbopack
```

Open the Schedule tab and verify game cards render correctly with the new layout.

- [ ] **Step 5: Commit**

```bash
git add components/schedule/GameCard.tsx
git commit -m "feat: restructure GameCard to dark matchup layout

Away | VS | Home layout with team logos, pitcher grids,
headshot zoom, dark theme throughout.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Roster Components Dark Theme

**Files:**
- Modify: `components/roster/RosterView.tsx`
- Modify: `components/roster/PitcherCard.tsx`
- Modify: `components/roster/PitcherModal.tsx`
- Modify: `components/roster/RosterSkeleton.tsx`

- [ ] **Step 1: Read each file**

Read all four roster component files.

- [ ] **Step 2: Apply color mapping to RosterView.tsx**

Replace all light classes: team grid, team detail header, filter bar, counters, empty states.

- [ ] **Step 3: Apply color mapping to PitcherCard.tsx**

Card background, borders, text colors, favorite star, role badges.

- [ ] **Step 4: Apply color mapping to PitcherModal.tsx**

Modal overlay, card surface, text, borders, buttons.

- [ ] **Step 5: Apply color mapping to RosterSkeleton.tsx**

Skeleton pulse colors: use `bg-slate-700 animate-pulse` instead of light grays.

- [ ] **Step 6: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add components/roster/
git commit -m "feat: restyle all roster components to dark theme

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Supporting Components Dark Theme

**Files:**
- Modify: `components/FilterPills.tsx`
- Modify: `components/ui/EmptyState.tsx` (if exists)
- Modify: `components/schedule/ScheduleSkeleton.tsx`
- Modify: `components/schedule/GameDetailModal.tsx`
- Modify: `components/schedule/FiltersModal.tsx`
- Modify: `components/analytics/AnalyticsView.tsx`
- Modify: `components/analytics/AnalyticsSkeleton.tsx`

- [ ] **Step 1: Read each file and apply color mapping**

For each file, replace light Tailwind classes with dark equivalents per the mapping table.

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add components/
git commit -m "feat: restyle all supporting components to dark theme

FilterPills, EmptyState, skeletons, modals, analytics.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Final Verification and Deploy

- [ ] **Step 1: Full build**

```bash
cd /Users/chace/Desktop/cbb-next
npx next build
```

- [ ] **Step 2: Visual verification**

```bash
npx next dev --turbopack
```

Check all pages:
- Schedule tab: dark theme, matchup layout game cards, week accordion
- Roster tab: dark team grid, dark pitcher cards, dark modal
- Analytics tab: dark charts and stats

- [ ] **Step 3: Commit and push**

```bash
git add -A
git commit -m "feat: complete dark theme restyle matching MLB tracker

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
git push origin main
```

Expected: Vercel deploys successfully with dark theme.
