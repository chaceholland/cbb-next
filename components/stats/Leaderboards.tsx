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
  { id: 'era', label: 'ERA', minIP: 10 },
  { id: 'whip', label: 'WHIP', minIP: 10 },
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
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Leaderboard table */}
      <div className="overflow-hidden rounded-lg border border-slate-700">
        <table className="w-full">
          <thead className="border-b border-slate-700 bg-slate-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Rank</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Pitcher</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300">Value</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300">IP</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300">G</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700 bg-slate-800">
            {leaders.map(({ rank, pitcher }) => (
              <tr
                key={pitcher.pitcher_id}
                onClick={() => onPitcherClick?.(pitcher.pitcher_id)}
                className={onPitcherClick ? 'cursor-pointer hover:bg-slate-700' : ''}
              >
                <td className="px-4 py-3 text-sm font-bold text-slate-100">
                  #{rank}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-100">
                  {pitcher.pitcher_name}
                </td>
                <td className="px-4 py-3 text-right text-lg font-bold text-blue-400">
                  {selectedCategory === 'k'
                    ? Math.round(pitcher.strikeouts)
                    : selectedCategory === 'ip'
                    ? formatStat(pitcher.innings_pitched)
                    : formatStat(pitcher[selectedCategory])}
                </td>
                <td className="px-4 py-3 text-right text-sm text-slate-300">
                  {formatStat(pitcher.innings_pitched)}
                </td>
                <td className="px-4 py-3 text-right text-sm text-slate-300">
                  {pitcher.games}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {currentCategory && currentCategory.minIP > 0 && (
        <p className="text-xs text-slate-400">
          * Minimum {currentCategory.minIP} innings pitched to qualify
        </p>
      )}
    </div>
  );
}
