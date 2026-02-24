# Sprint 2 (Stats Week) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the CBB Pitcher Tracker from a roster tool into a comprehensive performance analysis platform with pitcher statistics, team records, leaderboards, charts, and analytics.

**Architecture:** Build a stats calculation engine that aggregates data from `cbb_pitcher_participation` (JSONB stats column with IP, ER, K, BB, H fields). Create materialized views/tables for pre-computed season stats. Add visualization layer with Recharts. Implement real-time calculations for recent form and matchup analysis.

**Tech Stack:** TypeScript, Next.js 16, Supabase (PostgreSQL JSONB), Recharts for charts, React Query for caching

---

## Data Context

**Existing Tables:**
- `cbb_pitcher_participation`: game_id, team_id, pitcher_id, pitcher_name, stats (JSONB)
- `cbb_games`: game_id, date, week, season, home/away team/score, completed, venue
- `cbb_teams`: team_id, name, conference, logo_url
- `cbb_pitchers`: pitcher_id, name, team_id, position, year, height, weight, hometown, bats_throws

**Stats JSONB Structure:**
```json
{
  "IP": "3.0",
  "ER": "5",
  "K": "2",
  "BB": "1",
  "H": "6",
  "HR": "0",
  "R": "5",
  "PC": "51",
  "ERA": "12.46",
  "PC-ST": "51-31",
  "innings_list": [...]
}
```

---

## Task 1: Create Stats Calculation Engine

**Files:**
- Create: `lib/stats/types.ts`
- Create: `lib/stats/calculations.ts`
- Create: `lib/stats/aggregations.ts`

**Step 1: Create stats types**

Create `lib/stats/types.ts`:

```typescript
export interface PitcherGameStats {
  game_id: string;
  pitcher_id: string;
  pitcher_name: string;
  team_id: string;
  date: string;
  opponent_id: string;
  opponent_name: string;
  innings_pitched: number;
  earned_runs: number;
  strikeouts: number;
  walks: number;
  hits: number;
  home_runs: number;
  pitch_count: number;
}

export interface PitcherSeasonStats {
  pitcher_id: string;
  pitcher_name: string;
  team_id: string;
  games: number;
  innings_pitched: number;
  earned_runs: number;
  strikeouts: number;
  walks: number;
  hits: number;
  home_runs: number;
  era: number;
  whip: number;
  k_per_9: number;
  bb_per_9: number;
  k_bb_ratio: number;
}

export interface TeamRecord {
  team_id: string;
  team_name: string;
  conference: string;
  wins: number;
  losses: number;
  win_percentage: number;
  home_record: string;
  away_record: string;
  conference_wins: number;
  conference_losses: number;
  streak: string; // "W3", "L2", etc.
}
```

**Step 2: Create calculation functions**

Create `lib/stats/calculations.ts`:

```typescript
/**
 * Parse innings pitched string (e.g., "3.0", "5.2", "6.1") to decimal
 */
export function parseInningsPitched(ip: string): number {
  const parts = ip.split('.');
  const wholeInnings = parseInt(parts[0] || '0', 10);
  const outs = parseInt(parts[1] || '0', 10);
  return wholeInnings + (outs / 3);
}

/**
 * Calculate ERA: (ER × 9) / IP
 * Min 1.0 IP to avoid division by zero
 */
export function calculateERA(earnedRuns: number, inningsPitched: number): number {
  if (inningsPitched < 0.33) return 0; // Less than 1 out = N/A
  return (earnedRuns * 9) / inningsPitched;
}

/**
 * Calculate WHIP: (BB + H) / IP
 */
export function calculateWHIP(walks: number, hits: number, inningsPitched: number): number {
  if (inningsPitched < 0.33) return 0;
  return (walks + hits) / inningsPitched;
}

/**
 * Calculate K/9: (K × 9) / IP
 */
export function calculateKPer9(strikeouts: number, inningsPitched: number): number {
  if (inningsPitched < 0.33) return 0;
  return (strikeouts * 9) / inningsPitched;
}

/**
 * Calculate BB/9: (BB × 9) / IP
 */
export function calculateBBPer9(walks: number, inningsPitched: number): number {
  if (inningsPitched < 0.33) return 0;
  return (walks * 9) / inningsPitched;
}

/**
 * Calculate K/BB ratio
 */
export function calculateKBBRatio(strikeouts: number, walks: number): number {
  if (walks === 0) return strikeouts > 0 ? 999 : 0; // Infinite ratio
  return strikeouts / walks;
}

/**
 * Format stat number for display (2 decimal places)
 */
export function formatStat(value: number): string {
  return value.toFixed(2);
}
```

**Step 3: Create aggregation functions**

Create `lib/stats/aggregations.ts`:

```typescript
import { PitcherGameStats, PitcherSeasonStats } from './types';
import {
  parseInningsPitched,
  calculateERA,
  calculateWHIP,
  calculateKPer9,
  calculateBBPer9,
  calculateKBBRatio,
} from './calculations';

/**
 * Aggregate game stats into season totals
 */
export function aggregateSeasonStats(
  games: PitcherGameStats[]
): PitcherSeasonStats | null {
  if (games.length === 0) return null;

  const totals = games.reduce(
    (acc, game) => ({
      innings_pitched: acc.innings_pitched + game.innings_pitched,
      earned_runs: acc.earned_runs + game.earned_runs,
      strikeouts: acc.strikeouts + game.strikeouts,
      walks: acc.walks + game.walks,
      hits: acc.hits + game.hits,
      home_runs: acc.home_runs + game.home_runs,
    }),
    { innings_pitched: 0, earned_runs: 0, strikeouts: 0, walks: 0, hits: 0, home_runs: 0 }
  );

  const pitcher = games[0];

  return {
    pitcher_id: pitcher.pitcher_id,
    pitcher_name: pitcher.pitcher_name,
    team_id: pitcher.team_id,
    games: games.length,
    ...totals,
    era: calculateERA(totals.earned_runs, totals.innings_pitched),
    whip: calculateWHIP(totals.walks, totals.hits, totals.innings_pitched),
    k_per_9: calculateKPer9(totals.strikeouts, totals.innings_pitched),
    bb_per_9: calculateBBPer9(totals.walks, totals.innings_pitched),
    k_bb_ratio: calculateKBBRatio(totals.strikeouts, totals.walks),
  };
}

/**
 * Get recent form (last N games)
 */
export function getRecentForm(
  games: PitcherGameStats[],
  lastN: number = 5
): PitcherSeasonStats | null {
  const sortedGames = games.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recentGames = sortedGames.slice(0, lastN);
  return aggregateSeasonStats(recentGames);
}
```

**Step 4: Test calculations**

Run: `npm run build`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add lib/stats/
git commit -m "feat: add stats calculation engine

- Create types for pitcher game/season stats and team records
- Add pure functions for ERA, WHIP, K/9, BB/9, K/BB calculations
- Add aggregation functions for season totals and recent form
- Parse innings pitched decimal format (e.g., 5.2 = 5 2/3 innings)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Database Query Layer

**Files:**
- Create: `lib/stats/queries.ts`

**Step 1: Create Supabase query functions**

Create `lib/stats/queries.ts`:

```typescript
import { createClient } from '@/lib/supabase/client';
import { PitcherGameStats } from './types';
import { parseInningsPitched } from './calculations';

/**
 * Fetch all game stats for a pitcher
 */
export async function getPitcherGameStats(pitcherId: string): Promise<PitcherGameStats[]> {
  const supabase = createClient();

  const { data: participation, error } = await supabase
    .from('cbb_pitcher_participation')
    .select(`
      game_id,
      pitcher_id,
      pitcher_name,
      team_id,
      stats,
      cbb_games!inner(
        date,
        home_team_id,
        away_team_id,
        home_name,
        away_name,
        completed
      )
    `)
    .eq('pitcher_id', pitcherId)
    .eq('cbb_games.completed', true)
    .order('cbb_games(date)', { ascending: false });

  if (error) {
    console.error('Error fetching pitcher stats:', error);
    return [];
  }

  if (!participation) return [];

  return participation.map((p: any) => {
    const game = p.cbb_games;
    const stats = p.stats || {};

    // Determine opponent
    const isHome = p.team_id === game.home_team_id;
    const opponent_id = isHome ? game.away_team_id : game.home_team_id;
    const opponent_name = isHome ? game.away_name : game.home_name;

    return {
      game_id: p.game_id,
      pitcher_id: p.pitcher_id,
      pitcher_name: p.pitcher_name,
      team_id: p.team_id,
      date: game.date,
      opponent_id,
      opponent_name,
      innings_pitched: parseInningsPitched(stats.IP || '0'),
      earned_runs: parseInt(stats.ER || '0', 10),
      strikeouts: parseInt(stats.K || '0', 10),
      walks: parseInt(stats.BB || '0', 10),
      hits: parseInt(stats.H || '0', 10),
      home_runs: parseInt(stats.HR || '0', 10),
      pitch_count: parseInt(stats.PC || '0', 10),
    };
  });
}

/**
 * Fetch game stats for all pitchers on a team
 */
export async function getTeamPitcherStats(teamId: string): Promise<Record<string, PitcherGameStats[]>> {
  const supabase = createClient();

  const { data: participation, error } = await supabase
    .from('cbb_pitcher_participation')
    .select(`
      game_id,
      pitcher_id,
      pitcher_name,
      team_id,
      stats,
      cbb_games!inner(
        date,
        home_team_id,
        away_team_id,
        home_name,
        away_name,
        completed
      )
    `)
    .eq('team_id', teamId)
    .eq('cbb_games.completed', true)
    .order('cbb_games(date)', { ascending: false });

  if (error || !participation) {
    return {};
  }

  // Group by pitcher_id
  const grouped: Record<string, PitcherGameStats[]> = {};

  participation.forEach((p: any) => {
    if (!grouped[p.pitcher_id]) {
      grouped[p.pitcher_id] = [];
    }

    const game = p.cbb_games;
    const stats = p.stats || {};
    const isHome = p.team_id === game.home_team_id;

    grouped[p.pitcher_id].push({
      game_id: p.game_id,
      pitcher_id: p.pitcher_id,
      pitcher_name: p.pitcher_name,
      team_id: p.team_id,
      date: game.date,
      opponent_id: isHome ? game.away_team_id : game.home_team_id,
      opponent_name: isHome ? game.away_name : game.home_name,
      innings_pitched: parseInningsPitched(stats.IP || '0'),
      earned_runs: parseInt(stats.ER || '0', 10),
      strikeouts: parseInt(stats.K || '0', 10),
      walks: parseInt(stats.BB || '0', 10),
      hits: parseInt(stats.H || '0', 10),
      home_runs: parseInt(stats.HR || '0', 10),
      pitch_count: parseInt(stats.PC || '0', 10),
    });
  });

  return grouped;
}
```

**Step 2: Test query**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add lib/stats/queries.ts
git commit -m "feat: add database query layer for pitcher stats

- Create getPitcherGameStats to fetch all games for a pitcher
- Create getTeamPitcherStats to fetch all pitchers for a team
- Join with cbb_games to get opponent and date info
- Parse JSONB stats column to typed PitcherGameStats
- Filter to completed games only

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Build Stats Display Components

**Files:**
- Create: `components/stats/PitcherStatsCard.tsx`
- Create: `components/stats/StatsTable.tsx`

**Step 1: Create PitcherStatsCard component**

Create `components/stats/PitcherStatsCard.tsx`:

```typescript
import { PitcherSeasonStats } from '@/lib/stats/types';
import { formatStat } from '@/lib/stats/calculations';

interface PitcherStatsCardProps {
  stats: PitcherSeasonStats | null;
  label?: string;
  className?: string;
}

export function PitcherStatsCard({ stats, label = 'Season Stats', className = '' }: PitcherStatsCardProps) {
  if (!stats) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 ${className}`}>
        <h3 className="mb-2 font-semibold text-gray-900 dark:text-slate-100">{label}</h3>
        <p className="text-sm text-gray-600 dark:text-slate-400">No stats available</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      <h3 className="mb-4 font-semibold text-gray-900 dark:text-slate-100">{label}</h3>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <div>
          <div className="text-xs text-gray-600 dark:text-slate-400">Games</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stats.games}</div>
        </div>

        <div>
          <div className="text-xs text-gray-600 dark:text-slate-400">IP</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {formatStat(stats.innings_pitched)}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-600 dark:text-slate-400">ERA</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatStat(stats.era)}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-600 dark:text-slate-400">WHIP</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatStat(stats.whip)}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-600 dark:text-slate-400">K</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stats.strikeouts}</div>
        </div>

        <div>
          <div className="text-xs text-gray-600 dark:text-slate-400">BB</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stats.walks}</div>
        </div>

        <div>
          <div className="text-xs text-gray-600 dark:text-slate-400">K/9</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatStat(stats.k_per_9)}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-600 dark:text-slate-400">K/BB</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatStat(stats.k_bb_ratio)}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create StatsTable component**

Create `components/stats/StatsTable.tsx`:

```typescript
import { PitcherSeasonStats } from '@/lib/stats/types';
import { formatStat } from '@/lib/stats/calculations';

interface StatsTableProps {
  pitchers: PitcherSeasonStats[];
  onPitcherClick?: (pitcherId: string) => void;
}

export function StatsTable({ pitchers, onPitcherClick }: StatsTableProps) {
  if (pitchers.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
        <p className="text-gray-600 dark:text-slate-400">No pitcher stats available</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
      <table className="w-full">
        <thead className="border-b border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-slate-300">Pitcher</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">G</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">IP</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">ERA</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">K</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">BB</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">WHIP</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">K/9</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
          {pitchers.map((pitcher) => (
            <tr
              key={pitcher.pitcher_id}
              onClick={() => onPitcherClick?.(pitcher.pitcher_id)}
              className={onPitcherClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700' : ''}
            >
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">
                {pitcher.pitcher_name}
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-slate-300">
                {pitcher.games}
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-slate-300">
                {formatStat(pitcher.innings_pitched)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600 dark:text-blue-400">
                {formatStat(pitcher.era)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-slate-300">
                {pitcher.strikeouts}
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-slate-300">
                {pitcher.walks}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600 dark:text-blue-400">
                {formatStat(pitcher.whip)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-green-600 dark:text-green-400">
                {formatStat(pitcher.k_per_9)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 3: Test components**

Run: `npm run build`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add components/stats/
git commit -m "feat: add stats display components

- Create PitcherStatsCard showing season/recent stats grid
- Create StatsTable for leaderboard display
- Highlight key stats (ERA, WHIP, K/9) with colors
- Support dark mode styling
- Add click handlers for drill-down

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add Team Records Calculation

**Files:**
- Create: `lib/stats/team-records.ts`

**Step 1: Create team records query and calculation**

Create `lib/stats/team-records.ts`:

```typescript
import { createClient } from '@/lib/supabase/client';
import { TeamRecord } from './types';

interface GameResult {
  game_id: string;
  date: string;
  team_id: string;
  team_name: string;
  opponent_id: string;
  opponent_name: string;
  team_score: number;
  opponent_score: number;
  is_home: boolean;
  is_win: boolean;
  is_conference: boolean;
}

/**
 * Fetch all completed games for a team
 */
async function getTeamGames(teamId: string): Promise<GameResult[]> {
  const supabase = createClient();

  const { data: games, error } = await supabase
    .from('cbb_games')
    .select('*')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq('completed', true)
    .order('date', { ascending: true });

  if (error || !games) return [];

  return games.map(game => {
    const isHome = game.home_team_id === teamId;
    const teamScore = isHome ? game.home_score : game.away_score;
    const opponentScore = isHome ? game.away_score : game.home_score;

    return {
      game_id: game.game_id,
      date: game.date,
      team_id: teamId,
      team_name: isHome ? game.home_name : game.away_name,
      opponent_id: isHome ? game.away_team_id : game.home_team_id,
      opponent_name: isHome ? game.away_name : game.home_name,
      team_score: teamScore || 0,
      opponent_score: opponentScore || 0,
      is_home: isHome,
      is_win: (teamScore || 0) > (opponentScore || 0),
      is_conference: false, // TODO: Add conference game detection
    };
  });
}

/**
 * Calculate team record from games
 */
export async function getTeamRecord(
  teamId: string,
  teamName: string,
  conference: string
): Promise<TeamRecord> {
  const games = await getTeamGames(teamId);

  const wins = games.filter(g => g.is_win).length;
  const losses = games.length - wins;

  const homeGames = games.filter(g => g.is_home);
  const homeWins = homeGames.filter(g => g.is_win).length;
  const homeLosses = homeGames.length - homeWins;

  const awayGames = games.filter(g => !g.is_home);
  const awayWins = awayGames.filter(g => g.is_win).length;
  const awayLosses = awayGames.length - awayWins;

  const confGames = games.filter(g => g.is_conference);
  const confWins = confGames.filter(g => g.is_win).length;
  const confLosses = confGames.length - confWins;

  // Calculate current streak
  let streak = '';
  if (games.length > 0) {
    const recentGames = games.slice(-10).reverse();
    let count = 0;
    const isWinStreak = recentGames[0].is_win;

    for (const game of recentGames) {
      if (game.is_win === isWinStreak) {
        count++;
      } else {
        break;
      }
    }

    streak = `${isWinStreak ? 'W' : 'L'}${count}`;
  }

  return {
    team_id: teamId,
    team_name: teamName,
    conference,
    wins,
    losses,
    win_percentage: games.length > 0 ? wins / games.length : 0,
    home_record: `${homeWins}-${homeLosses}`,
    away_record: `${awayWins}-${awayLosses}`,
    conference_wins: confWins,
    conference_losses: confLosses,
    streak,
  };
}

/**
 * Get conference standings
 */
export async function getConferenceStandings(conference: string): Promise<TeamRecord[]> {
  const supabase = createClient();

  const { data: teams, error } = await supabase
    .from('cbb_teams')
    .select('team_id, name, conference')
    .eq('conference', conference);

  if (error || !teams) return [];

  const records = await Promise.all(
    teams.map(team => getTeamRecord(team.team_id, team.name, team.conference))
  );

  // Sort by win percentage descending
  return records.sort((a, b) => b.win_percentage - a.win_percentage);
}
```

**Step 2: Test**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add lib/stats/team-records.ts
git commit -m "feat: add team records calculation

- Create getTeamGames to fetch all completed games
- Calculate wins, losses, win percentage
- Track home/away splits
- Calculate current win/loss streak
- Generate conference standings sorted by win%

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add Leaderboards Component

**Files:**
- Create: `components/stats/Leaderboards.tsx`
- Create: `lib/stats/leaderboards.ts`

**Step 1: Create leaderboard calculations**

Create `lib/stats/leaderboards.ts`:

```typescript
import { PitcherSeasonStats } from './types';

export type LeaderboardCategory = 'era' | 'whip' | 'k' | 'ip' | 'k_per_9' | 'k_bb_ratio';

export interface LeaderboardEntry {
  rank: number;
  pitcher: PitcherSeasonStats;
}

/**
 * Get top N pitchers in a category
 */
export function getLeaders(
  pitchers: PitcherSeasonStats[],
  category: LeaderboardCategory,
  limit: number = 10,
  minInnings: number = 10 // Minimum IP to qualify
): LeaderboardEntry[] {
  // Filter to qualified pitchers
  const qualified = pitchers.filter(p => p.innings_pitched >= minInnings);

  // Sort based on category
  const sorted = qualified.sort((a, b) => {
    switch (category) {
      case 'era':
      case 'whip':
        return a[category] - b[category]; // Lower is better
      case 'k':
      case 'ip':
        return b[category] - a[category]; // Higher is better
      case 'k_per_9':
      case 'k_bb_ratio':
        return b[category] - a[category]; // Higher is better
      default:
        return 0;
    }
  });

  // Take top N and add rank
  return sorted.slice(0, limit).map((pitcher, index) => ({
    rank: index + 1,
    pitcher,
  }));
}
```

**Step 2: Create Leaderboards component**

Create `components/stats/Leaderboards.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { PitcherSeasonStats } from '@/lib/stats/types';
import { getLeaders, LeaderboardCategory } from '@/lib/stats/leaderboards';
import { formatStat } from '@/lib/stats/calculations';

interface LeaderboardsProps {
  pitchers: PitcherSeasonStats[];
  onPitcherClick?: (pitcherId: string) => void;
}

const CATEGORIES = [
  { id: 'era', label: 'ERA', minIP: 20 },
  { id: 'whip', label: 'WHIP', minIP: 20 },
  { id: 'k', label: 'Strikeouts', minIP: 0 },
  { id: 'ip', label: 'Innings Pitched', minIP: 0 },
  { id: 'k_per_9', label: 'K/9', minIP: 10 },
  { id: 'k_bb_ratio', label: 'K/BB Ratio', minIP: 10 },
] as const;

export function Leaderboards({ pitchers, onPitcherClick }: LeaderboardsProps) {
  const [selectedCategory, setSelectedCategory] = useState<LeaderboardCategory>('era');

  const currentCategory = CATEGORIES.find(c => c.id === selectedCategory);
  const leaders = getLeaders(pitchers, selectedCategory, 10, currentCategory?.minIP || 0);

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id as LeaderboardCategory)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selectedCategory === category.id
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Leaderboard table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-slate-300">Rank</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-slate-300">Pitcher</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">Value</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">IP</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">G</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
            {leaders.map(({ rank, pitcher }) => (
              <tr
                key={pitcher.pitcher_id}
                onClick={() => onPitcherClick?.(pitcher.pitcher_id)}
                className={onPitcherClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700' : ''}
              >
                <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-slate-100">
                  #{rank}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">
                  {pitcher.pitcher_name}
                </td>
                <td className="px-4 py-3 text-right text-lg font-bold text-blue-600 dark:text-blue-400">
                  {selectedCategory === 'k' || selectedCategory === 'ip'
                    ? Math.round(pitcher[selectedCategory])
                    : formatStat(pitcher[selectedCategory])}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-slate-300">
                  {formatStat(pitcher.innings_pitched)}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-slate-300">
                  {pitcher.games}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {currentCategory && currentCategory.minIP > 0 && (
        <p className="text-xs text-gray-600 dark:text-slate-400">
          * Minimum {currentCategory.minIP} innings pitched to qualify
        </p>
      )}
    </div>
  );
}
```

**Step 3: Test**

Run: `npm run build`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add lib/stats/leaderboards.ts components/stats/Leaderboards.tsx
git commit -m "feat: add leaderboards functionality

- Create getLeaders function with min IP qualifier
- Support 6 categories: ERA, WHIP, K, IP, K/9, K/BB
- Build Leaderboards component with category tabs
- Show rank, value, IP, and games for each leader
- Add minimum IP qualifier note

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Integrate Stats into Analytics View

**Files:**
- Modify: `components/analytics/AnalyticsView.tsx`

**Step 1: Add stats to Analytics view**

Read `components/analytics/AnalyticsView.tsx` to understand current structure, then add:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Leaderboards } from '@/components/stats/Leaderboards';
import { getPitcherGameStats } from '@/lib/stats/queries';
import { aggregateSeasonStats } from '@/lib/stats/aggregations';
import { PitcherSeasonStats } from '@/lib/stats/types';

// Inside AnalyticsView component:
const [allPitcherStats, setAllPitcherStats] = useState<PitcherSeasonStats[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function loadStats() {
    setLoading(true);

    // Fetch all pitchers
    const pitchers = /* get from existing data or Supabase */;

    // Aggregate stats for each pitcher
    const statsPromises = pitchers.map(async (pitcher) => {
      const games = await getPitcherGameStats(pitcher.pitcher_id);
      return aggregateSeasonStats(games);
    });

    const stats = await Promise.all(statsPromises);
    const validStats = stats.filter(s => s !== null) as PitcherSeasonStats[];

    setAllPitcherStats(validStats);
    setLoading(false);
  }

  loadStats();
}, []);

// Add to render:
<section>
  <h2 className="mb-4 text-xl font-bold">Pitcher Leaderboards</h2>
  {loading ? (
    <div>Loading stats...</div>
  ) : (
    <Leaderboards pitchers={allPitcherStats} />
  )}
</section>
```

**Step 2: Test**

Run: `npm run dev`
Navigate to Analytics view
Expected: Leaderboards appear with data

**Step 3: Commit**

```bash
git add components/analytics/AnalyticsView.tsx
git commit -m "feat: integrate stats into Analytics view

- Load all pitcher stats on Analytics page
- Display Leaderboards component
- Add loading state while fetching data
- Allow switching between stat categories

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Add Performance Charts with Recharts

**Files:**
- Create: `components/stats/PerformanceChart.tsx`
- Modify: `package.json` (add recharts)

**Step 1: Install Recharts**

Run: `npm install recharts`
Expected: Package installed successfully

**Step 2: Create PerformanceChart component**

Create `components/stats/PerformanceChart.tsx`:

```typescript
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PitcherGameStats } from '@/lib/stats/types';
import { calculateERA, calculateKPer9, formatStat } from '@/lib/stats/calculations';

interface PerformanceChartProps {
  games: PitcherGameStats[];
  metric: 'era' | 'k_per_9' | 'innings';
}

export function PerformanceChart({ games, metric }: PerformanceChartProps) {
  // Sort games by date
  const sortedGames = [...games].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate cumulative or per-game stats
  const chartData = sortedGames.map((game, index) => {
    const gamesUpToNow = sortedGames.slice(0, index + 1);

    const totalIP = gamesUpToNow.reduce((sum, g) => sum + g.innings_pitched, 0);
    const totalER = gamesUpToNow.reduce((sum, g) => sum + g.earned_runs, 0);
    const totalK = gamesUpToNow.reduce((sum, g) => sum + g.strikeouts, 0);

    return {
      date: new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      opponent: game.opponent_name,
      era: calculateERA(totalER, totalIP),
      k_per_9: calculateKPer9(totalK, totalIP),
      innings: game.innings_pitched,
    };
  });

  const metricLabel = {
    era: 'ERA (Season)',
    k_per_9: 'K/9 (Season)',
    innings: 'Innings Pitched',
  }[metric];

  const metricColor = {
    era: '#3b82f6', // blue
    k_per_9: '#10b981', // green
    innings: '#6366f1', // indigo
  }[metric];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-4 font-semibold text-gray-900 dark:text-slate-100">{metricLabel} Trend</h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <YAxis
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            domain={metric === 'innings' ? [0, 'auto'] : ['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value: number) => formatStat(value)}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                return `${label} vs ${payload[0].payload.opponent}`;
              }
              return label;
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey={metric}
            stroke={metricColor}
            strokeWidth={2}
            dot={{ fill: metricColor, r: 4 }}
            activeDot={{ r: 6 }}
            name={metricLabel}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Step 3: Test**

Run: `npm run build`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add package.json package-lock.json components/stats/PerformanceChart.tsx
git commit -m "feat: add performance charts with Recharts

- Install recharts library
- Create PerformanceChart for ERA, K/9, IP trends
- Show cumulative season stats per game
- Add tooltips with opponent info
- Support dark mode colors

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Add Stats to Pitcher Modal

**Files:**
- Modify: `components/roster/PitcherModal.tsx` (or create if doesn't exist)

**Step 1: Add stats tab to pitcher modal**

Create or modify `components/roster/PitcherModal.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { PitcherStatsCard } from '@/components/stats/PitcherStatsCard';
import { PerformanceChart } from '@/components/stats/PerformanceChart';
import { getPitcherGameStats } from '@/lib/stats/queries';
import { aggregateSeasonStats, getRecentForm } from '@/lib/stats/aggregations';
import { PitcherGameStats, PitcherSeasonStats } from '@/lib/stats/types';

interface PitcherModalProps {
  pitcherId: string;
  pitcherName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PitcherModal({ pitcherId, pitcherName, isOpen, onClose }: PitcherModalProps) {
  const [activeTab, setActiveTab] = useState<'bio' | 'stats'>('bio');
  const [games, setGames] = useState<PitcherGameStats[]>([]);
  const [seasonStats, setSeasonStats] = useState<PitcherSeasonStats | null>(null);
  const [recentStats, setRecentStats] = useState<PitcherSeasonStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && activeTab === 'stats') {
      loadStats();
    }
  }, [isOpen, activeTab, pitcherId]);

  async function loadStats() {
    setLoading(true);
    const gameStats = await getPitcherGameStats(pitcherId);
    setGames(gameStats);
    setSeasonStats(aggregateSeasonStats(gameStats));
    setRecentStats(getRecentForm(gameStats, 5));
    setLoading(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{pitcherName}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-4 border-b border-gray-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('bio')}
            className={`pb-2 text-sm font-medium ${
              activeTab === 'bio'
                ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500'
                : 'text-gray-600 dark:text-slate-400'
            }`}
          >
            Bio
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`pb-2 text-sm font-medium ${
              activeTab === 'stats'
                ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500'
                : 'text-gray-600 dark:text-slate-400'
            }`}
          >
            Stats
          </button>
        </div>

        {/* Content */}
        {activeTab === 'bio' && (
          <div>
            {/* Existing bio content */}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6">
            {loading ? (
              <div className="py-12 text-center text-gray-600 dark:text-slate-400">Loading stats...</div>
            ) : games.length === 0 ? (
              <div className="py-12 text-center text-gray-600 dark:text-slate-400">No stats available</div>
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <PitcherStatsCard stats={seasonStats} label="Season Stats" />
                  <PitcherStatsCard stats={recentStats} label="Last 5 Games" />
                </div>

                <PerformanceChart games={games} metric="era" />
                <PerformanceChart games={games} metric="k_per_9" />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Test**

Run: `npm run dev`
Click a pitcher to open modal
Click Stats tab
Expected: Season stats, recent stats, and charts appear

**Step 3: Commit**

```bash
git add components/roster/PitcherModal.tsx
git commit -m "feat: add stats tab to pitcher modal

- Add Bio/Stats tab switcher
- Show season totals and last 5 games stats
- Display ERA and K/9 trend charts
- Load stats on demand when Stats tab opened
- Add loading and empty states

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Add Team Records to Schedule View

**Files:**
- Modify: `components/schedule/ScheduleView.tsx`

**Step 1: Add team records to game cards**

Modify `components/schedule/ScheduleView.tsx` to fetch and display team records:

```typescript
import { useEffect, useState } from 'react';
import { getTeamRecord } from '@/lib/stats/team-records';
import { TeamRecord } from '@/lib/stats/types';

// Inside component:
const [teamRecords, setTeamRecords] = useState<Record<string, TeamRecord>>({});

useEffect(() => {
  async function loadRecords() {
    const teams = /* get unique teams from games */;
    const records: Record<string, TeamRecord> = {};

    for (const team of teams) {
      const record = await getTeamRecord(team.team_id, team.name, team.conference);
      records[team.team_id] = record;
    }

    setTeamRecords(records);
  }

  loadRecords();
}, [games]);

// In game card rendering:
<div className="flex items-center justify-between">
  <div>
    <div className="font-semibold">{game.away_name}</div>
    {teamRecords[game.away_team_id] && (
      <div className="text-xs text-gray-600 dark:text-slate-400">
        {teamRecords[game.away_team_id].wins}-{teamRecords[game.away_team_id].losses}
        {' '}
        <span className="text-green-600 dark:text-green-400">
          {teamRecords[game.away_team_id].streak}
        </span>
      </div>
    )}
  </div>
  <div className="text-lg font-bold">{game.away_score}</div>
</div>
```

**Step 2: Test**

Run: `npm run dev`
Navigate to Schedule
Expected: Team records appear next to team names

**Step 3: Commit**

```bash
git add components/schedule/ScheduleView.tsx
git commit -m "feat: add team records to schedule view

- Load team records for all teams in schedule
- Display W-L record next to team names
- Show current win/loss streak
- Update on game completion

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Create Conference Standings Component

**Files:**
- Create: `components/stats/ConferenceStandings.tsx`
- Modify: `components/analytics/AnalyticsView.tsx`

**Step 1: Create ConferenceStandings component**

Create `components/stats/ConferenceStandings.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { getConferenceStandings } from '@/lib/stats/team-records';
import { TeamRecord } from '@/lib/stats/types';

interface ConferenceStandingsProps {
  conference: string;
}

export function ConferenceStandings({ conference }: ConferenceStandingsProps) {
  const [standings, setStandings] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStandings() {
      setLoading(true);
      const data = await getConferenceStandings(conference);
      setStandings(data);
      setLoading(false);
    }

    loadStandings();
  }, [conference]);

  if (loading) {
    return <div className="py-8 text-center text-gray-600 dark:text-slate-400">Loading standings...</div>;
  }

  if (standings.length === 0) {
    return <div className="py-8 text-center text-gray-600 dark:text-slate-400">No teams found</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700">
      <table className="w-full">
        <thead className="border-b border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-slate-300">Team</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-slate-300">W-L</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-slate-300">PCT</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-slate-300">Home</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-slate-300">Away</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-slate-300">Streak</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
          {standings.map((team, index) => (
            <tr key={team.team_id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">
                {index + 1}. {team.team_name}
              </td>
              <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-slate-100">
                {team.wins}-{team.losses}
              </td>
              <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-slate-300">
                {team.win_percentage.toFixed(3)}
              </td>
              <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-slate-300">
                {team.home_record}
              </td>
              <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-slate-300">
                {team.away_record}
              </td>
              <td className={`px-4 py-3 text-center text-sm font-semibold ${
                team.streak.startsWith('W')
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {team.streak}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: Add to Analytics view**

Modify `components/analytics/AnalyticsView.tsx`:

```typescript
import { ConferenceStandings } from '@/components/stats/ConferenceStandings';

// Add to render:
<section>
  <h2 className="mb-4 text-xl font-bold">Conference Standings</h2>
  {/* Conference selector dropdown */}
  <ConferenceStandings conference={selectedConference} />
</section>
```

**Step 3: Test**

Run: `npm run dev`
Navigate to Analytics
Expected: Conference standings table appears

**Step 4: Commit**

```bash
git add components/stats/ConferenceStandings.tsx components/analytics/AnalyticsView.tsx
git commit -m "feat: add conference standings table

- Create ConferenceStandings component
- Display ranked teams with W-L, PCT, splits, streak
- Color-code win/loss streaks
- Add to Analytics view
- Support conference filtering

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Add Pitcher Usage Tracking (OPTIONAL - Can skip for MVP)

This task is optional and can be implemented later if time permits.

---

## Task 12: Final Testing & Documentation

**Files:**
- Create: `docs/SPRINT-2-TESTING.md`
- Update: `README.md`
- Update: `docs/SPRINT-2-COMPLETE.md`

**Step 1: Create testing checklist**

Create `docs/SPRINT-2-TESTING.md` with comprehensive test cases for:
- Stats calculations (verify ERA, WHIP, K/9 formulas)
- Leaderboards (verify sorting, min IP qualifications)
- Team records (verify W-L counts, streaks)
- Charts (verify data accuracy, tooltips)
- Component rendering (all views, dark mode)

**Step 2: Update README**

Add Sprint 2 features to README.md

**Step 3: Create completion report**

Create `docs/SPRINT-2-COMPLETE.md` summarizing:
- Features delivered
- Code statistics
- Known limitations
- Next steps for Sprint 3

**Step 4: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 5: Commit documentation**

```bash
git add docs/
git commit -m "docs: add Sprint 2 testing and completion docs

- Create comprehensive testing checklist
- Update README with stats features
- Document Sprint 2 completion
- List known limitations and next steps

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Success Criteria

- [ ] Stats calculation engine built with pure functions
- [ ] Pitcher game stats queried from cbb_pitcher_participation
- [ ] Season stats and recent form aggregated correctly
- [ ] Leaderboards show top 10 in 6 categories
- [ ] Team records calculated from cbb_games
- [ ] Conference standings table implemented
- [ ] Performance charts display ERA and K/9 trends
- [ ] Stats integrated into pitcher modal
- [ ] Team records shown in schedule view
- [ ] All calculations verified for accuracy
- [ ] Production build succeeds
- [ ] Documentation complete

---

## Notes

- Focus on core stats (ERA, WHIP, K/9) first, add advanced stats later
- Use React Query in future for caching to avoid recalculating
- Consider creating a Supabase Edge Function to pre-compute stats nightly
- Pitcher usage tracking and matchup analysis can be added in later iterations
- Keep calculations pure and testable
