import { PitcherGameStats, PitcherSeasonStats } from './types';
import { calculateERA, calculateWHIP, calculateKPer9, calculateBBPer9, calculateKBBRatio } from './calculations';

// Aggregate multiple game stats into season totals
export function aggregateSeasonStats(
  games: PitcherGameStats[],
  pitcherId: string,
  pitcherName: string,
  teamId: string
): PitcherSeasonStats {
  // Check for empty games array
  if (!games || games.length === 0) {
    return {
      pitcher_id: pitcherId,
      pitcher_name: pitcherName,
      team_id: teamId,
      games: 0,
      innings_pitched: 0,
      earned_runs: 0,
      strikeouts: 0,
      walks: 0,
      hits: 0,
      home_runs: 0,
      era: 0,
      whip: 0,
      k_per_9: 0,
      bb_per_9: 0,
      k_bb_ratio: 0
    };
  }

  const totals = games.reduce((acc, game) => ({
    innings_pitched: acc.innings_pitched + game.innings_pitched,
    earned_runs: acc.earned_runs + game.earned_runs,
    strikeouts: acc.strikeouts + game.strikeouts,
    walks: acc.walks + game.walks,
    hits: acc.hits + game.hits,
    home_runs: acc.home_runs + game.home_runs
  }), {
    innings_pitched: 0,
    earned_runs: 0,
    strikeouts: 0,
    walks: 0,
    hits: 0,
    home_runs: 0
  });

  return {
    pitcher_id: pitcherId,
    pitcher_name: pitcherName,
    team_id: teamId,
    games: games.length,
    ...totals,
    era: calculateERA(totals.earned_runs, totals.innings_pitched),
    whip: calculateWHIP(totals.walks, totals.hits, totals.innings_pitched),
    k_per_9: calculateKPer9(totals.strikeouts, totals.innings_pitched),
    bb_per_9: calculateBBPer9(totals.walks, totals.innings_pitched),
    k_bb_ratio: calculateKBBRatio(totals.strikeouts, totals.walks)
  };
}

// Get recent form (last N games)
export function getRecentForm(games: PitcherGameStats[], lastN: number = 3): PitcherGameStats[] {
  return [...games]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, lastN);
}
