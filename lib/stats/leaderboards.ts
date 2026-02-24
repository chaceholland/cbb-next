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
        return b.strikeouts - a.strikeouts; // Higher is better
      case 'ip':
        return b.innings_pitched - a.innings_pitched; // Higher is better
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
