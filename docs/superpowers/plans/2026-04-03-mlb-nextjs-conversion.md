# MLB Tracker Next.js Conversion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the MLB Pitcher Tracker from vanilla HTML/JS to a Next.js app with React components, matching the CBB tracker's architecture. Implement CBB-style roster page (team grid → team detail).

**Architecture:** Next.js 16 App Router with TypeScript and Tailwind CSS 4. Data loaded from existing static JSON files in `data/`. Favorites persisted to Supabase `mlb_favorites` table via REST API. Dark theme throughout using slate color palette.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase (anon key REST), Vercel deployment

**Project root:** `/Users/chace/mlb-pitcher-tracker/`

**Reference project:** `/Users/chace/Desktop/cbb-next/` (CBB tracker — target architecture)

---

## File Structure

```
mlb-pitcher-tracker/
├── app/
│   ├── layout.tsx              — Root layout: dark bg, Inter font, metadata
│   ├── page.tsx                — Main page: tab state (schedule/roster), renders active view
│   ├── globals.css             — Tailwind imports + dark scrollbar + animations
│   └── api/update/route.ts     — Cron endpoint (port from api/update.js)
├── components/
│   ├── Navigation.tsx          — Sticky top bar + tab switcher
│   ├── roster/
│   │   ├── RosterView.tsx      — Two-level view: team grid ↔ team detail
│   │   ├── TeamCard.tsx        — Team card in grid (logo, name, division, count, star)
│   │   └── PitcherCard.tsx     — Pitcher card in detail view (headshot, name, role, star)
│   └── schedule/
│       ├── ScheduleView.tsx    — Week accordion, filters, game list
│       └── GameCard.tsx        — Full-width matchup card (away | VS | home)
├── lib/
│   ├── types.ts                — TypeScript interfaces for all data
│   ├── data.ts                 — JSON data loaders
│   ├── utils.ts                — ESPN URLs, name normalization
│   ├── supabase.ts             — Supabase client setup
│   └── hooks/
│       └── useFavorites.ts     — Supabase-backed favorites hook
├── data/                       — Existing JSON files (unchanged)
├── public/
│   └── favicon.ico             — Existing favicon
├── next.config.ts              — Image domains config
├── tailwind.config.ts          — Tailwind config (if needed beyond v4 defaults)
├── postcss.config.mjs          — PostCSS for Tailwind v4
├── tsconfig.json               — TypeScript config
├── package.json                — Dependencies
└── vercel.json                 — Cron config (updated for Next.js)
```

---

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json` (overwrite existing)
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `app/globals.css`
- Create: `app/layout.tsx`
- Create: `app/page.tsx` (placeholder)
- Modify: `vercel.json`
- Preserve: `data/` directory, `api/update.js` (temporarily)

- [ ] **Step 1: Back up existing files and initialize Next.js**

```bash
cd /Users/chace/mlb-pitcher-tracker
# Back up the HTML files
mkdir -p archive
mv schedule.html archive/
mv roster.html archive/
mv server.mjs archive/
mv api archive/ 2>/dev/null

# Install Next.js and dependencies
npm install next@latest react@latest react-dom@latest typescript @types/react @types/react-dom @tailwindcss/postcss tailwindcss
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "archive"]
}
```

- [ ] **Step 3: Create next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "a.espncdn.com" },
      { protocol: "https", hostname: "*.espncdn.com" },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 4: Create postcss.config.mjs**

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

- [ ] **Step 5: Create app/globals.css**

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
}

html, body {
  height: 100%;
}

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

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 6: Create app/layout.tsx**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MLB Pitcher Tracker",
  description: "MLB Weekly Matchups & Pitcher Participation Tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-slate-900 text-slate-100 font-sans">{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Create placeholder app/page.tsx**

```tsx
export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-3xl font-bold text-blue-400">MLB Pitcher Tracker</h1>
    </div>
  );
}
```

- [ ] **Step 8: Update vercel.json for Next.js**

```json
{
  "crons": [
    { "path": "/api/update", "schedule": "0 6 * * *" }
  ]
}
```

- [ ] **Step 9: Update package.json scripts**

Add to the existing package.json's scripts section:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

- [ ] **Step 10: Verify the app builds and runs**

```bash
cd /Users/chace/mlb-pitcher-tracker
npx next build
```

Expected: Build succeeds with the placeholder page.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js project structure

Convert MLB Pitcher Tracker from vanilla HTML to Next.js 16 with
TypeScript and Tailwind CSS 4. Existing HTML files archived.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Types, Data Loaders, and Utilities

**Files:**
- Create: `lib/types.ts`
- Create: `lib/data.ts`
- Create: `lib/utils.ts`
- Create: `lib/supabase.ts`
- Create: `lib/hooks/useFavorites.ts`

- [ ] **Step 1: Create lib/types.ts**

```typescript
export interface MlbTeam {
  id: string;
  team_id: string;
  team: string;
  displayName: string;
  abbr: string;
  logo: string;
  logo_dark: string;
  division: string;
  conference: string;
  color: string;
  alternateColor: string;
  location: string;
  nickname: string;
}

export interface MlbPitcher {
  id: string;
  player_id: string;
  name: string;
  firstName: string;
  lastName: string;
  displayName: string;
  shortName: string;
  number: string;
  position: string;
  role: string;
  team_id: string;
  team: string;
  team_abbr: string;
  height: string;
  weight: string;
  age: number;
  dateOfBirth: string;
  espn_link: string;
  headshot: string;
}

export interface MlbTeamWithPitchers {
  team_id: string;
  id: string;
  team: string;
  team_abbr: string;
  displayName: string;
  pitchers: MlbPitcher[];
}

export interface PitchersData {
  lastUpdated: string;
  totalPitchers: number;
  totalTeams: number;
  teams: MlbTeamWithPitchers[];
}

export interface TeamsData {
  teams: MlbTeam[];
}

export interface ScheduleGame {
  game_id: string;
  week: number;
  date: string;
  venue: string;
  home_team_id: string;
  away_team_id: string;
  home_team: string;
  away_team: string;
  home_abbr: string;
  away_abbr: string;
  home_score: string | null;
  away_score: string | null;
  completed: boolean;
  status: string;
}

export interface WeekSchedule {
  week: number;
  startDate: string;
  endDate: string;
  games: ScheduleGame[];
}
```

- [ ] **Step 2: Create lib/utils.ts**

```typescript
export function getEspnLogoUrl(teamId: string): string {
  return `https://a.espncdn.com/i/teamlogos/mlb/500/${teamId}.png`;
}

export function getEspnPlayerUrl(playerId: string): string {
  return `https://www.espn.com/mlb/player/_/id/${playerId}`;
}

export function getEspnTeamUrl(teamId: string, page: "roster" | "schedule" = "roster"): string {
  return `https://www.espn.com/mlb/team/${page}/_/id/${teamId}`;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatGameDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
```

- [ ] **Step 3: Create lib/supabase.ts**

```typescript
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dtnozcqkuzhjmjvsfjqk.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function supabaseFetch(path: string, options?: RequestInit) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  return fetch(url, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
}
```

- [ ] **Step 4: Create lib/hooks/useFavorites.ts**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { supabaseFetch } from "@/lib/supabase";

type FavType = "pitchers" | "teams" | "games";

export function useFavorites() {
  const [pitchers, setPitchers] = useState<Set<string>>(new Set());
  const [teams, setTeams] = useState<Set<string>>(new Set());
  const [games, setGames] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const resp = await supabaseFetch("mlb_favorites?select=type,item_id");
        const data = await resp.json();
        const p = new Set<string>();
        const t = new Set<string>();
        const g = new Set<string>();
        for (const row of data) {
          if (row.type === "pitchers") p.add(String(row.item_id));
          else if (row.type === "teams") t.add(String(row.item_id));
          else if (row.type === "games") g.add(String(row.item_id));
        }
        setPitchers(p);
        setTeams(t);
        setGames(g);
      } catch (e) {
        console.error("[Fav] Failed to load:", e);
      }
      setLoaded(true);
    }
    load();
  }, []);

  const toggle = useCallback(
    async (type: FavType, id: string) => {
      const setFn = type === "pitchers" ? setPitchers : type === "teams" ? setTeams : setGames;
      const current = type === "pitchers" ? pitchers : type === "teams" ? teams : games;
      const itemId = String(id);

      if (current.has(itemId)) {
        setFn((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
        await supabaseFetch(
          `mlb_favorites?type=eq.${type}&item_id=eq.${encodeURIComponent(itemId)}`,
          { method: "DELETE" },
        );
      } else {
        setFn((prev) => new Set([...prev, itemId]));
        await supabaseFetch("mlb_favorites", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({ type, item_id: itemId }),
        });
      }
    },
    [pitchers, teams, games],
  );

  return { pitchers, teams, games, loaded, toggle };
}
```

- [ ] **Step 5: Create lib/data.ts**

```typescript
import type { TeamsData, PitchersData, MlbTeam } from "./types";

let teamsCache: TeamsData | null = null;
let pitchersCache: PitchersData | null = null;
let divMapCache: Record<string, string> | null = null;

export async function loadTeams(): Promise<TeamsData> {
  if (teamsCache) return teamsCache;
  const resp = await fetch("/data/teams.json");
  teamsCache = await resp.json();
  return teamsCache!;
}

export async function loadPitchers(): Promise<PitchersData> {
  if (pitchersCache) return pitchersCache;
  try {
    const resp = await fetch("/data/pitchers_enhanced.json");
    pitchersCache = await resp.json();
  } catch {
    const resp = await fetch("/data/pitchers.json");
    pitchersCache = await resp.json();
  }
  return pitchersCache!;
}

export async function loadDivisionMap(): Promise<Record<string, string>> {
  if (divMapCache) return divMapCache;
  const resp = await fetch("/data/divisions_map.json");
  divMapCache = await resp.json();
  return divMapCache!;
}

export async function loadWeekSchedule(week: number) {
  const padded = String(week).padStart(2, "0");
  const resp = await fetch(`/data/schedule_week_${padded}.json`);
  return resp.json();
}

export function buildTeamLookup(teams: TeamsData): Record<string, MlbTeam> {
  const map: Record<string, MlbTeam> = {};
  for (const t of teams.teams) {
    map[String(t.id || t.team_id)] = t;
  }
  return map;
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/chace/mlb-pitcher-tracker
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add lib/
git commit -m "feat: add types, data loaders, supabase client, favorites hook

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Navigation Component

**Files:**
- Create: `components/Navigation.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create components/Navigation.tsx**

```tsx
"use client";

import { cn } from "@/lib/utils";

export type TabId = "schedule" | "roster";

export function Navigation({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  return (
    <>
      {/* Sticky top bar */}
      <div className="sticky top-0 z-50 flex items-center gap-3 flex-wrap px-4 py-3 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700">
        <h1 className="flex-1 text-xl font-extrabold bg-gradient-to-r from-blue-500 to-red-500 bg-clip-text text-transparent">
          MLB Pitcher Tracker
        </h1>
      </div>

      {/* Tab bar */}
      <div className="sticky top-[49px] z-40 bg-slate-900 py-3 px-4 flex justify-center">
        <div className="flex gap-1 p-1 bg-slate-800 rounded-xl border border-slate-700">
          {(["schedule", "roster"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={cn(
                "relative px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                activeTab === tab
                  ? "bg-gradient-to-r from-blue-600 to-red-500 text-white"
                  : "text-slate-400 hover:text-slate-100",
              )}
            >
              {tab === "schedule" ? "Schedule" : "Rosters"}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Update app/page.tsx with tab navigation**

```tsx
"use client";

import { useState } from "react";
import { Navigation, TabId } from "@/components/Navigation";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("schedule");

  return (
    <>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main>
        {activeTab === "schedule" ? (
          <div className="p-8 text-center text-slate-400">Schedule view coming soon</div>
        ) : (
          <div className="p-8 text-center text-slate-400">Roster view coming soon</div>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npx next build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/Navigation.tsx app/page.tsx
git commit -m "feat: add navigation with tab switcher

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Roster — TeamCard Component

**Files:**
- Create: `components/roster/TeamCard.tsx`

- [ ] **Step 1: Create components/roster/TeamCard.tsx**

```tsx
"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { MlbTeam, MlbTeamWithPitchers } from "@/lib/types";

export function TeamCard({
  team,
  teamMeta,
  division,
  pitcherCount,
  favPitcherCount,
  isTeamFavorite,
  onToggleFavorite,
  onClick,
}: {
  team: MlbTeamWithPitchers;
  teamMeta?: MlbTeam;
  division: string;
  pitcherCount: number;
  favPitcherCount: number;
  isTeamFavorite: boolean;
  onToggleFavorite: () => void;
  onClick: () => void;
}) {
  const logo = teamMeta?.logo || `https://a.espncdn.com/i/teamlogos/mlb/500/${team.team_abbr?.toLowerCase()}.png`;
  const displayName = team.team || team.displayName || "Unknown";

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-2xl border bg-slate-800 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-black/30 hover:border-slate-600 active:scale-[0.98]",
        isTeamFavorite ? "border-amber-500/50 shadow-amber-500/10" : "border-slate-700",
      )}
    >
      <div className="flex flex-col items-center gap-3 p-5">
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 p-2">
          <Image
            src={logo}
            alt={displayName}
            width={80}
            height={80}
            className="object-contain w-full h-full"
            unoptimized
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-100 leading-tight line-clamp-2">
            {displayName}
          </p>
          <span className="inline-block mt-1 text-xs font-extrabold text-blue-400 bg-blue-400/15 px-2 py-0.5 rounded-full">
            {division}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-blue-400 bg-blue-400/15 px-2 py-0.5 rounded-full">
            {pitcherCount} P
          </span>
          {favPitcherCount > 0 && (
            <span className="text-xs font-bold text-amber-400 bg-amber-400/15 px-2 py-0.5 rounded-full">
              {favPitcherCount} ★
            </span>
          )}
        </div>
      </div>
      {/* Favorite star */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className={cn(
          "absolute top-3 right-3 text-lg transition-colors",
          isTeamFavorite ? "text-amber-400" : "text-slate-600 hover:text-amber-400",
        )}
      >
        {isTeamFavorite ? "★" : "☆"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/roster/TeamCard.tsx
git commit -m "feat: add TeamCard component for roster grid

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Roster — PitcherCard Component

**Files:**
- Create: `components/roster/PitcherCard.tsx`

- [ ] **Step 1: Create components/roster/PitcherCard.tsx**

```tsx
"use client";

import Image from "next/image";
import { cn, getEspnPlayerUrl } from "@/lib/utils";
import type { MlbPitcher } from "@/lib/types";

export function PitcherCard({
  pitcher,
  teamLogo,
  isFavorite,
  onToggleFavorite,
}: {
  pitcher: MlbPitcher;
  teamLogo: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const headshot = pitcher.headshot || teamLogo;
  const espnUrl = getEspnPlayerUrl(pitcher.id);
  const roleClass =
    pitcher.role === "Starter"
      ? "bg-blue-500 text-white"
      : pitcher.role === "Reliever"
        ? "bg-violet-500 text-white"
        : "bg-slate-600 text-slate-200";

  return (
    <div
      className={cn(
        "relative rounded-2xl border overflow-hidden bg-slate-800 transition-all duration-200 hover:shadow-xl hover:shadow-black/30 hover:border-slate-600 group",
        isFavorite ? "border-amber-500/50" : "border-slate-700",
      )}
    >
      {/* Headshot */}
      <div className="aspect-[3/4] overflow-hidden bg-slate-900 relative">
        <Image
          src={headshot}
          alt={pitcher.name}
          fill
          className="object-cover object-top transition-transform duration-300 group-hover:scale-105"
          unoptimized
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (img.src !== teamLogo) {
              img.src = teamLogo;
              img.style.objectFit = "contain";
              img.style.padding = "16px";
            }
          }}
        />
        {/* Favorite star */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={cn(
            "absolute top-2 right-2 text-xl transition-colors z-10",
            isFavorite ? "text-amber-400" : "text-white/50 hover:text-amber-400",
          )}
        >
          {isFavorite ? "★" : "☆"}
        </button>
        {/* Role badge */}
        <span
          className={cn(
            "absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded",
            roleClass,
          )}
        >
          {pitcher.role || "P"}
        </span>
      </div>
      {/* Info */}
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-slate-400 text-sm font-semibold">
            #{pitcher.number || "–"}
          </span>
          <span className="text-sm font-bold text-slate-100 truncate">
            {pitcher.name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
          {pitcher.height && <span>{pitcher.height}</span>}
          {pitcher.age && <span>Age {pitcher.age}</span>}
          <a
            href={espnUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline font-semibold"
            onClick={(e) => e.stopPropagation()}
          >
            ESPN →
          </a>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/roster/PitcherCard.tsx
git commit -m "feat: add PitcherCard component for roster detail

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Roster — RosterView (Two-Level View)

**Files:**
- Create: `components/roster/RosterView.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create components/roster/RosterView.tsx**

```tsx
"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { loadTeams, loadPitchers, loadDivisionMap, buildTeamLookup } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { TeamCard } from "./TeamCard";
import { PitcherCard } from "./PitcherCard";
import type { TeamsData, PitchersData, MlbTeam, MlbTeamWithPitchers } from "@/lib/types";

export function RosterView() {
  const [teamsData, setTeamsData] = useState<TeamsData | null>(null);
  const [pitchersData, setPitchersData] = useState<PitchersData | null>(null);
  const [divMap, setDivMap] = useState<Record<string, string>>({});
  const [teamLookup, setTeamLookup] = useState<Record<string, MlbTeam>>({});
  const [loading, setLoading] = useState(true);

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [divFilter, setDivFilter] = useState("");
  const [sortBy, setSortBy] = useState("team");
  const [showFavorites, setShowFavorites] = useState(false);
  const savedScrollY = useRef(0);

  const { pitchers: favPitchers, teams: favTeams, toggle, loaded: favsLoaded } = useFavorites();

  useEffect(() => {
    async function load() {
      const [t, p, d] = await Promise.all([loadTeams(), loadPitchers(), loadDivisionMap()]);
      setTeamsData(t);
      setPitchersData(p);
      setDivMap(d);
      setTeamLookup(buildTeamLookup(t));
      setLoading(false);
    }
    load();
  }, []);

  const divisions = useMemo(() => {
    if (!divMap) return [];
    return [...new Set(Object.values(divMap).filter((d) => d && d !== "Unknown"))].sort();
  }, [divMap]);

  const filteredTeams = useMemo(() => {
    if (!pitchersData) return [];
    let teams = pitchersData.teams;

    if (divFilter) {
      teams = teams.filter((t) => divMap[String(t.team_id)] === divFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      teams = teams.filter((t) => {
        const name = (t.team || t.displayName || "").toLowerCase();
        const pitcherNames = (t.pitchers || []).map((p) => p.name.toLowerCase()).join(" ");
        return name.includes(q) || pitcherNames.includes(q);
      });
    }

    return teams.slice().sort((a, b) => {
      if (sortBy === "division") {
        const aDiv = divMap[String(a.team_id)] || "";
        const bDiv = divMap[String(b.team_id)] || "";
        if (aDiv !== bDiv) return aDiv.localeCompare(bDiv);
      }
      if (sortBy === "favorites") {
        const aFav = favTeams.has(String(a.team_id)) || a.pitchers?.some((p) => favPitchers.has(String(p.id)));
        const bFav = favTeams.has(String(b.team_id)) || b.pitchers?.some((p) => favPitchers.has(String(p.id)));
        if (aFav !== bFav) return bFav ? 1 : -1;
      }
      return (a.team || "").localeCompare(b.team || "");
    });
  }, [pitchersData, divFilter, search, sortBy, divMap, favTeams, favPitchers]);

  const selectedTeam = useMemo(() => {
    if (!selectedTeamId || !pitchersData) return null;
    return pitchersData.teams.find((t) => String(t.team_id) === selectedTeamId) || null;
  }, [selectedTeamId, pitchersData]);

  const teamPitchers = useMemo(() => {
    if (!selectedTeam) return [];
    let list = selectedTeam.pitchers || [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (showFavorites) {
      list = list.filter((p) => favPitchers.has(String(p.id)));
    }
    return list.slice().sort((a, b) => {
      const aFav = favPitchers.has(String(a.id));
      const bFav = favPitchers.has(String(b.id));
      if (aFav !== bFav) return bFav ? 1 : -1;
      return (a.lastName || a.name || "").localeCompare(b.lastName || b.name || "");
    });
  }, [selectedTeam, search, showFavorites, favPitchers]);

  function selectTeam(teamId: string) {
    savedScrollY.current = window.scrollY;
    setSelectedTeamId(teamId);
    setSearch("");
    setShowFavorites(false);
    window.scrollTo(0, 0);
  }

  function goBack() {
    setSelectedTeamId(null);
    setSearch("");
    setShowFavorites(false);
    requestAnimationFrame(() => window.scrollTo(0, savedScrollY.current));
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 animate-pulse">Loading rosters...</div>
    );
  }

  // ─── Team Detail View ───
  if (selectedTeam) {
    const meta = teamLookup[String(selectedTeam.team_id)];
    const logo = meta?.logo || "";
    const division = divMap[String(selectedTeam.team_id)] || "";

    return (
      <div className="px-4 py-4 max-w-7xl mx-auto">
        {/* Back button */}
        <button
          onClick={goBack}
          className="mb-4 flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
        >
          <span>←</span> All Teams
        </button>

        {/* Team header */}
        <div className="flex items-center gap-4 mb-6 p-4 bg-slate-800 rounded-2xl border border-slate-700">
          {logo && (
            <img src={logo} alt={selectedTeam.team} className="w-[110px] h-[110px] rounded-xl object-contain bg-slate-900 border border-slate-700 p-2" />
          )}
          <div className="flex-1">
            <h2 className="text-xl font-extrabold text-slate-100">{selectedTeam.team || selectedTeam.displayName}</h2>
            <span className="text-sm text-blue-400 font-bold">{division}</span>
          </div>
          <button
            onClick={() => toggle("teams", selectedTeam.team_id)}
            className={cn(
              "text-2xl transition-colors",
              favTeams.has(String(selectedTeam.team_id)) ? "text-amber-400" : "text-slate-600 hover:text-amber-400",
            )}
          >
            {favTeams.has(String(selectedTeam.team_id)) ? "★" : "☆"}
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <input
            type="text"
            placeholder="Search pitchers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-800 text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setShowFavorites(!showFavorites)}
            className={cn(
              "px-3 py-2 rounded-lg text-sm font-semibold border transition-all",
              showFavorites
                ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                : "bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600",
            )}
          >
            ★ Favorites {showFavorites ? "ON" : ""}
          </button>
          <span className="text-sm text-slate-400">
            {teamPitchers.length} pitcher{teamPitchers.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Pitcher grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {teamPitchers.map((pitcher) => (
            <PitcherCard
              key={pitcher.id}
              pitcher={pitcher}
              teamLogo={logo}
              isFavorite={favPitchers.has(String(pitcher.id))}
              onToggleFavorite={() => toggle("pitchers", pitcher.id)}
            />
          ))}
        </div>
        {teamPitchers.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            {showFavorites ? "No favorite pitchers on this team." : "No pitchers match your search."}
          </div>
        )}
      </div>
    );
  }

  // ─── Team Grid View ───
  return (
    <div className="px-4 py-4 max-w-7xl mx-auto">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 bg-[length:200%_200%] animate-[gradient_8s_ease_infinite]" />
        <div className="relative z-10 text-center py-12 px-4">
          <h2 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent mb-2">
            MLB Rosters
          </h2>
          <p className="text-slate-400">Browse pitcher rosters across all 30 MLB teams</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search teams or pitchers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-800 text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={divFilter}
          onChange={(e) => setDivFilter(e.target.value)}
          className="bg-slate-800 text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Divisions</option>
          {divisions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-slate-800 text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm"
        >
          <option value="team">Team Name</option>
          <option value="division">Division</option>
          <option value="favorites">Favorites First</option>
        </select>
      </div>

      {/* Counters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <span className="text-xs font-bold text-blue-400 bg-blue-400/15 px-3 py-1 rounded-full">
          Teams: {filteredTeams.length}
        </span>
        <span className="text-xs font-bold text-blue-400 bg-blue-400/15 px-3 py-1 rounded-full">
          Pitchers: {filteredTeams.reduce((s, t) => s + (t.pitchers?.length || 0), 0)}
        </span>
        {favTeams.size > 0 && (
          <span className="text-xs font-bold text-amber-400 bg-amber-400/15 px-3 py-1 rounded-full">
            ★ Teams: {favTeams.size}
          </span>
        )}
        {favPitchers.size > 0 && (
          <span className="text-xs font-bold text-amber-400 bg-amber-400/15 px-3 py-1 rounded-full">
            ★ Pitchers: {favPitchers.size}
          </span>
        )}
      </div>

      {/* Team grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
        {filteredTeams.map((team) => (
          <TeamCard
            key={team.team_id}
            team={team}
            teamMeta={teamLookup[String(team.team_id)]}
            division={divMap[String(team.team_id)] || ""}
            pitcherCount={(team.pitchers || []).length}
            favPitcherCount={(team.pitchers || []).filter((p) => favPitchers.has(String(p.id))).length}
            isTeamFavorite={favTeams.has(String(team.team_id))}
            onToggleFavorite={() => toggle("teams", team.team_id)}
            onClick={() => selectTeam(team.team_id)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update app/page.tsx to use RosterView**

```tsx
"use client";

import { useState } from "react";
import { Navigation, TabId } from "@/components/Navigation";
import { RosterView } from "@/components/roster/RosterView";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("schedule");

  return (
    <>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main>
        {activeTab === "schedule" ? (
          <div className="p-8 text-center text-slate-400">Schedule view coming soon</div>
        ) : (
          <RosterView />
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npx next build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/roster/RosterView.tsx app/page.tsx
git commit -m "feat: add RosterView with team grid and pitcher detail views

Two-level roster: team card grid → click team → pitcher card grid
with headshots, favorites, search, division filter, sort.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Schedule — GameCard Component

**Files:**
- Create: `components/schedule/GameCard.tsx`

- [ ] **Step 1: Create components/schedule/GameCard.tsx**

This is the full-width matchup card matching the MLB schedule.html style: away side | VS | home side, with pitcher rows.

```tsx
"use client";

import Image from "next/image";
import { cn, formatGameDate } from "@/lib/utils";
import type { MlbTeam, MlbPitcher } from "@/lib/types";

interface PitcherParticipation {
  pitcher_id: string;
  pitcher_name: string;
  team_id: string;
  played: boolean;
  stats?: Record<string, string | null>;
  headshot?: string;
  role?: string;
}

interface GameCardProps {
  game: {
    game_id: string;
    week: number;
    date: string;
    home_team_id: string;
    away_team_id: string;
    home_team: string;
    away_team: string;
    home_score: string | null;
    away_score: string | null;
    completed: boolean;
    status: string;
  };
  homeTeam?: MlbTeam;
  awayTeam?: MlbTeam;
  homePitchers: PitcherParticipation[];
  awayPitchers: PitcherParticipation[];
  favPitcherIds: Set<string>;
  onTogglePitcherFav: (id: string) => void;
  isFavoriteGame: boolean;
  onToggleFavorite: () => void;
  isWatched: boolean;
  onToggleWatched: () => void;
}

function PitcherRow({
  p,
  teamLogo,
  isFav,
  onToggleFav,
}: {
  p: PitcherParticipation;
  teamLogo: string;
  isFav: boolean;
  onToggleFav: () => void;
}) {
  const headshot = p.headshot || teamLogo;

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-700">
      <div className="w-[100px] h-[100px] rounded-lg overflow-visible bg-blue-500/10 relative shrink-0 group/hs">
        <img
          src={headshot}
          alt={p.pitcher_name}
          className="w-full h-full object-cover rounded-lg transition-all duration-300 relative z-[1] group-hover/hs:scale-[2.2] group-hover/hs:z-[100] group-hover/hs:shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (img.src !== teamLogo) {
              img.src = teamLogo;
              img.style.objectFit = "contain";
              img.style.padding = "10px";
            }
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isFav && <span className="text-amber-400 text-sm">★</span>}
          <span className="text-sm font-bold text-slate-100 truncate">{p.pitcher_name}</span>
        </div>
        {p.role && (
          <span
            className={cn(
              "inline-block mt-1 text-xs font-bold px-1.5 py-0.5 rounded",
              p.role === "Starter" ? "bg-blue-500 text-white" : "bg-violet-500 text-white",
            )}
          >
            {p.role}
          </span>
        )}
        {p.played && p.stats && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {p.stats.IP && <span className="text-xs bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded">{p.stats.IP} IP</span>}
            {p.stats.K && <span className="text-xs bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded">{p.stats.K} K</span>}
            {p.stats.ER && <span className="text-xs bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded">{p.stats.ER} ER</span>}
          </div>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFav();
        }}
        className={cn(
          "text-lg transition-colors shrink-0",
          isFav ? "text-amber-400" : "text-slate-600 hover:text-amber-400",
        )}
      >
        {isFav ? "★" : "☆"}
      </button>
    </div>
  );
}

function TeamSide({
  team,
  teamName,
  teamId,
  score,
  isWinner,
  label,
  pitchers,
  favPitcherIds,
  onTogglePitcherFav,
}: {
  team?: MlbTeam;
  teamName: string;
  teamId: string;
  score: string | null;
  isWinner: boolean;
  label: string;
  pitchers: PitcherParticipation[];
  favPitcherIds: Set<string>;
  onTogglePitcherFav: (id: string) => void;
}) {
  const logo = team?.logo || `https://a.espncdn.com/i/teamlogos/mlb/500/${teamId}.png`;

  return (
    <div className="border border-slate-700 rounded-xl p-3 bg-slate-800">
      {/* Team header */}
      <div className="flex items-center gap-3 mb-3">
        <img
          src={logo}
          alt={teamName}
          className="w-[110px] h-[110px] rounded-xl object-contain bg-slate-900 border border-slate-700"
        />
        <div className="flex-1 min-w-0">
          <p className={cn("text-lg font-extrabold", isWinner ? "text-slate-100" : "text-slate-400")}>
            {teamName}
          </p>
          <span className="text-xs font-bold text-blue-400 bg-blue-400/15 px-2 py-0.5 rounded-full">
            {label}
          </span>
          {score !== null && (
            <p className={cn("text-2xl font-black tabular-nums mt-1", isWinner ? "text-slate-100" : "text-slate-500")}>
              {score}
            </p>
          )}
        </div>
      </div>
      {/* Pitcher list */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
        {pitchers.map((p) => (
          <PitcherRow
            key={p.pitcher_id || p.pitcher_name}
            p={p}
            teamLogo={logo}
            isFav={favPitcherIds.has(String(p.pitcher_id))}
            onToggleFav={() => onTogglePitcherFav(p.pitcher_id)}
          />
        ))}
      </div>
      {pitchers.length === 0 && (
        <p className="text-xs text-slate-500 italic text-center py-2">No pitcher data</p>
      )}
    </div>
  );
}

export function GameCard({
  game,
  homeTeam,
  awayTeam,
  homePitchers,
  awayPitchers,
  favPitcherIds,
  onTogglePitcherFav,
  isFavoriteGame,
  onToggleFavorite,
  isWatched,
  onToggleWatched,
}: GameCardProps) {
  const homeScore = game.home_score;
  const awayScore = game.away_score;
  const homeWon = game.completed && Number(homeScore) > Number(awayScore);
  const awayWon = game.completed && Number(awayScore) > Number(homeScore);

  return (
    <div
      className={cn(
        "rounded-2xl border bg-slate-800 shadow-md shadow-black/30 overflow-visible",
        isWatched ? "border-slate-600 opacity-80" : "border-slate-700",
      )}
    >
      {/* Game header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 rounded-t-2xl border-b border-slate-700">
        <div className="flex items-center gap-3">
          <span className="text-blue-400 font-extrabold text-sm uppercase tracking-wide">
            Week {game.week}
          </span>
          <span className="text-slate-400 text-sm">{formatGameDate(game.date)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleFavorite}
            className={cn(
              "px-2 py-1 rounded-lg border text-sm transition-all",
              isFavoriteGame
                ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
                : "text-slate-400 border-slate-600 bg-slate-700 hover:bg-slate-600",
            )}
          >
            {isFavoriteGame ? "★" : "☆"}
          </button>
          <button
            onClick={onToggleWatched}
            className={cn(
              "px-2 py-1 rounded-lg border text-xs font-semibold transition-all",
              isWatched
                ? "text-green-400 border-green-500/40 bg-green-500/10"
                : "text-slate-400 border-slate-600 bg-slate-700 hover:bg-slate-600",
            )}
          >
            {isWatched ? "✓ Watched" : "Watch"}
          </button>
          {game.completed && (
            <span
              className={cn(
                "text-xs font-bold px-2 py-0.5 rounded-full border",
                homeWon || awayWon
                  ? "bg-green-500/15 text-green-400 border-green-500/30"
                  : "bg-slate-700 text-slate-400 border-slate-600",
              )}
            >
              Final
            </span>
          )}
          {!game.completed && (
            <span className="text-xs font-medium text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full border border-slate-600">
              Upcoming
            </span>
          )}
        </div>
      </div>

      {/* Match body */}
      <div className="grid grid-cols-[1fr_28px_1fr] gap-3 p-4">
        <TeamSide
          team={awayTeam}
          teamName={game.away_team}
          teamId={game.away_team_id}
          score={awayScore}
          isWinner={awayWon}
          label="Away"
          pitchers={awayPitchers}
          favPitcherIds={favPitcherIds}
          onTogglePitcherFav={onTogglePitcherFav}
        />
        <div className="flex items-center justify-center">
          <span className="text-3xl font-black text-slate-600">VS</span>
        </div>
        <TeamSide
          team={homeTeam}
          teamName={game.home_team}
          teamId={game.home_team_id}
          score={homeScore}
          isWinner={homeWon}
          label="Home"
          pitchers={homePitchers}
          favPitcherIds={favPitcherIds}
          onTogglePitcherFav={onTogglePitcherFav}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/schedule/GameCard.tsx
git commit -m "feat: add GameCard with matchup layout (away | VS | home)

Full-width dark theme game card with team logos, pitcher rows,
headshot zoom, favorites, watched toggle.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Schedule — ScheduleView Component

**Files:**
- Create: `components/schedule/ScheduleView.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create components/schedule/ScheduleView.tsx**

This is a large component. It loads weekly schedule data, manages week accordion state, and renders GameCards. Port the core logic from `schedule.html`.

```tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { loadTeams, loadPitchers, loadDivisionMap, buildTeamLookup } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { GameCard } from "./GameCard";
import type { TeamsData, PitchersData, MlbTeam, WeekSchedule, ScheduleGame } from "@/lib/types";

export function ScheduleView() {
  const [teamsData, setTeamsData] = useState<TeamsData | null>(null);
  const [pitchersData, setPitchersData] = useState<PitchersData | null>(null);
  const [divMap, setDivMap] = useState<Record<string, string>>({});
  const [teamLookup, setTeamLookup] = useState<Record<string, MlbTeam>>({});
  const [weekData, setWeekData] = useState<Record<number, WeekSchedule>>({});
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const { pitchers: favPitchers, games: favGames, toggle, loaded: favsLoaded } = useFavorites();

  // Track watched games in localStorage (simple approach)
  const [watchedGames, setWatchedGames] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("mlb-watched");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  function toggleWatched(gameId: string) {
    setWatchedGames((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      localStorage.setItem("mlb-watched", JSON.stringify([...next]));
      return next;
    });
  }

  useEffect(() => {
    async function load() {
      const [t, p, d] = await Promise.all([loadTeams(), loadPitchers(), loadDivisionMap()]);
      setTeamsData(t);
      setPitchersData(p);
      setDivMap(d);
      setTeamLookup(buildTeamLookup(t));
      setLoading(false);

      // Determine current week and expand it
      // MLB season weeks 1-26, rough calculation
      const now = new Date();
      const seasonStart = new Date("2025-03-20"); // approximate
      const weekNum = Math.max(1, Math.min(26, Math.ceil((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000))));
      setExpandedWeeks(new Set([weekNum]));

      // Load that week's schedule
      try {
        const padded = String(weekNum).padStart(2, "0");
        const resp = await fetch(`/data/schedule_week_${padded}.json`);
        const data = await resp.json();
        setWeekData((prev) => ({ ...prev, [weekNum]: data }));
      } catch (e) {
        console.error("Failed to load week", weekNum, e);
      }
    }
    load();
  }, []);

  async function toggleWeek(week: number) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(week)) {
        next.delete(week);
      } else {
        next.add(week);
        // Load week data if not loaded
        if (!weekData[week]) {
          const padded = String(week).padStart(2, "0");
          fetch(`/data/schedule_week_${padded}.json`)
            .then((r) => r.json())
            .then((data) => setWeekData((p) => ({ ...p, [week]: data })))
            .catch((e) => console.error("Failed to load week", week, e));
        }
      }
      return next;
    });
  }

  // Build pitcher lookup for participation display
  const pitcherLookup = useMemo(() => {
    if (!pitchersData) return {};
    const map: Record<string, { headshot: string; role: string }> = {};
    for (const team of pitchersData.teams) {
      for (const p of team.pitchers || []) {
        map[String(p.id)] = { headshot: p.headshot, role: p.role };
      }
    }
    return map;
  }, [pitchersData]);

  const weeks = Array.from({ length: 26 }, (_, i) => i + 1);

  if (loading) {
    return <div className="p-8 text-center text-slate-400 animate-pulse">Loading schedule...</div>;
  }

  return (
    <div className="px-4 py-4 max-w-7xl mx-auto">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 bg-[length:200%_200%] animate-[gradient_8s_ease_infinite]" />
        <div className="relative z-10 text-center py-16 px-4">
          <h2 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent mb-2">
            MLB Weekly Matchups
          </h2>
          <p className="text-slate-400 text-lg">Pitcher Participation Tracker</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search teams or pitchers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-800 text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Week accordion */}
      <div className="space-y-3">
        {weeks.map((week) => {
          const wd = weekData[week];
          const games = wd?.games || [];
          const isExpanded = expandedWeeks.has(week);

          return (
            <div key={week} className="rounded-2xl border border-slate-700 overflow-hidden">
              {/* Week header */}
              <button
                onClick={() => toggleWeek(week)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-blue-400 font-extrabold">Week {week}</span>
                  {wd && (
                    <span className="text-xs text-slate-400">
                      {games.length} game{games.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <span className={cn("text-slate-400 transition-transform", isExpanded && "rotate-180")}>
                  ▼
                </span>
              </button>

              {/* Games */}
              {isExpanded && (
                <div className="p-3 space-y-4 bg-slate-900">
                  {games.length === 0 && (
                    <p className="text-center text-slate-500 py-4">
                      {wd ? "No games this week" : "Loading..."}
                    </p>
                  )}
                  {games.map((game: ScheduleGame) => (
                    <GameCard
                      key={game.game_id}
                      game={{ ...game, week }}
                      homeTeam={teamLookup[String(game.home_team_id)]}
                      awayTeam={teamLookup[String(game.away_team_id)]}
                      homePitchers={[]}
                      awayPitchers={[]}
                      favPitcherIds={favPitchers}
                      onTogglePitcherFav={(id) => toggle("pitchers", id)}
                      isFavoriteGame={favGames.has(game.game_id)}
                      onToggleFavorite={() => toggle("games", game.game_id)}
                      isWatched={watchedGames.has(game.game_id)}
                      onToggleWatched={() => toggleWatched(game.game_id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update app/page.tsx to use ScheduleView**

```tsx
"use client";

import { useState } from "react";
import { Navigation, TabId } from "@/components/Navigation";
import { RosterView } from "@/components/roster/RosterView";
import { ScheduleView } from "@/components/schedule/ScheduleView";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("schedule");

  return (
    <>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main>
        {activeTab === "schedule" ? <ScheduleView /> : <RosterView />}
      </main>
    </>
  );
}
```

- [ ] **Step 3: Create .env.local with Supabase keys**

```bash
echo 'NEXT_PUBLIC_SUPABASE_URL=https://dtnozcqkuzhjmjvsfjqk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c' > .env.local
```

- [ ] **Step 4: Verify build**

```bash
npx next build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/schedule/ScheduleView.tsx app/page.tsx
git commit -m "feat: add ScheduleView with week accordion and GameCards

Week-based schedule with expandable weeks, game cards with
matchup layout, favorites, watched toggle.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Port API Update Route

**Files:**
- Create: `app/api/update/route.ts`
- Reference: `archive/api/update.js`

- [ ] **Step 1: Read existing api/update.js to understand the logic**

Read `archive/api/update.js` (or the original `api/update.js` if it was moved). Port the core logic — fetching ESPN data, updating JSON files, etc. — into a Next.js route handler.

- [ ] **Step 2: Create app/api/update/route.ts**

Port the existing serverless function logic. The exact implementation depends on what `api/update.js` does — typically it fetches ESPN schedule/participation data and writes to the JSON files or Supabase. Keep the same logic, just wrap in Next.js route handler format:

```typescript
import { NextResponse } from "next/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Port the exact logic from archive/api/update.js
  // This will be implementation-specific based on reading that file

  return NextResponse.json({ ok: true, message: "Update complete" });
}
```

The engineer implementing this task should read `archive/api/update.js` and port the logic line by line.

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/update/route.ts
git commit -m "feat: port cron update endpoint to Next.js route handler

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Move Static Files, Update .gitignore, Final Build

**Files:**
- Move: `favicon.ico` → `public/favicon.ico` (if not already)
- Create/Update: `.gitignore`
- Verify: Full build and deployment readiness

- [ ] **Step 1: Move favicon to public directory**

```bash
mkdir -p public
cp favicon.ico public/ 2>/dev/null || true
```

- [ ] **Step 2: Update .gitignore**

Ensure `.gitignore` includes Next.js entries:

```
.next/
node_modules/
.env.local
archive/
```

- [ ] **Step 3: Full build verification**

```bash
npx next build
```

Expected: Build succeeds with all pages and API routes.

- [ ] **Step 4: Test locally**

```bash
npx next dev --turbopack
```

Open http://localhost:3000 and verify:
- Tab navigation works
- Roster shows team grid, clicking a team shows pitcher cards
- Schedule shows week accordion, expanding shows game cards
- Favorites toggle works

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "chore: finalize Next.js conversion, move static files

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
git push origin main
```

Expected: Vercel deploys successfully.
