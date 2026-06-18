# `components/shared/` — canonical tracker UI primitives

This folder is the **single source of truth** for the cross-tracker design system
(Pass 3). It is intentionally **self-contained and copy-portable**: nothing here
imports from outside this folder (its own `cn.ts`, not the app's `lib/utils`), so the
whole directory can be copied verbatim into the other React trackers (MLB, swim).

Peer deps the folder assumes: `react`, `clsx`, `tailwind-merge`, Tailwind 4, and
`framer-motion` (used only by `TabBar`'s active-tab slider — install it before
adopting `TabBar` in MLB/swim; CBB already has it).

## Contents
- `cn.ts` — classnames helper (clsx + tailwind-merge).
- `statusTokens.ts` — `TrackerStatus`, `STATUS_TOKENS`, `getStatusToken()`. The one
  place status colors are defined (Played green · DNP gray · Live red+pulse · Final
  blue · Scheduled slate · No data amber).
- `StatusChip.tsx` — presentational status pill built on the tokens.
- `DataFreshnessChip.tsx` — "Updated 2h ago · 70% coverage" pill; green/amber/slate by
  freshness. Feed it the latest `*_sync_log` time + optional coverage %.
- `SectionHeader.tsx` — generic section header (title + optional count pill / subtitle /
  right-aligned action slot).
- `StatCard.tsx` — generic stat tile (label, big value, optional hint/icon/tone) for KPI
  rows, analytics tiles, and data-health summaries.
- `ThemeProvider.tsx` / `ThemeToggle.tsx` — next-themes wrappers (dark/light toggle),
  promoted from CBB `components/` (Pass 3 B1). Client components; app-agnostic.
- `Navigation.tsx` — sticky top nav (brand, search, favorites, theme toggle). Props
  `brand`, `searchPlaceholder`, `brandGradient` default to CBB's values.
- `TabBar.tsx` — sticky tab switcher with a framer-motion active-pill slider. Generic
  over the tab-id union; pass `items` + `activeTab` + `onTabChange`. `activeGradient`
  defaults to CBB's. Requires `framer-motion`.
- `index.ts` — barrel export.

## Usage
```tsx
import { StatusChip, DataFreshnessChip } from "@/components/shared";

<StatusChip status={game.scrape_status} />
<DataFreshnessChip lastSync={lastSyncIso} coveragePct={70.2} />
```

## Adoption (other trackers)
Copy this folder into the target repo's `components/`, confirm `clsx` +
`tailwind-merge` are installed, then import from `@/components/shared`. Keep CBB's
copy as the source — port changes here first, then re-copy. (A future `claude-shared`
local package can replace the copy step.)

Status 2026-06-18: net-new primitives added (Pass 3 A1/A2); ThemeProvider/ThemeToggle
promoted (Pass 3 B1); Navigation + TabBar promoted and generalized to props, CBB
re-pointed via the barrel (Pass 3 B2). The brand gradient is a prop defaulting to
CBB's — the suite-wide identity decision (one shared gradient vs per-app) is left to
the §C rollout (C1/C2). Next: generalize HeroSection + FilterPills (B3), then wire
DataFreshnessChip into the CBB footer (B4).
