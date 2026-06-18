# `components/shared/` — canonical tracker UI primitives

This folder is the **single source of truth** for the cross-tracker design system
(Pass 3). It is intentionally **self-contained and copy-portable**: nothing here
imports from outside this folder (its own `cn.ts`, not the app's `lib/utils`), so the
whole directory can be copied verbatim into the other React trackers (MLB, swim).

Peer deps the folder assumes: `react`, `clsx`, `tailwind-merge`, Tailwind 4.

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
promoted into the set and CBB re-pointed to consume them via the barrel (Pass 3 B1).
Next freshness-chip consumer planned = CBB layout footer (Pass 3 B4).
