import { PitcherGameStats, PitcherSeasonStats } from './types';
import { calculateERA, calculateWHIP, calculateKPer9, calculateBBPer9, calculateKBBRatio } from './calculations';

// Aggregate multiple game stats into season totals
export function aggregateSeasonStats(
  games: PitcherGameStats[],
  pitcherId: string,
  pitcherName: string,
  teamId: string
): PitcherSeasonStats {
  const totals = games.reduce((acc, game) => ({
    inningsPitched: acc.inningsPitched + game.inningsPitched,
    earnedRuns: acc.earnedRuns + game.earnedRuns,
    strikeouts: acc.strikeouts + game.strikeouts,
    walks: acc.walks + game.walks,
    hits: acc.hits + game.hits,
    homeRuns: acc.homeRuns + game.homeRuns,
    runs: acc.runs + game.runs
  }), {
    inningsPitched: 0,
    earnedRuns: 0,
    strikeouts: 0,
    walks: 0,
    hits: 0,
    homeRuns: 0,
    runs: 0
  });

  return {
    pitcher_id: pitcherId,
    pitcher_name: pitcherName,
    team_id: teamId,
    gamesPlayed: games.length,
    ...totals,
    era: calculateERA(totals.earnedRuns, totals.inningsPitched),
    whip: calculateWHIP(totals.walks, totals.hits, totals.inningsPitched),
    kPer9: calculateKPer9(totals.strikeouts, totals.inningsPitched),
    bbPer9: calculateBBPer9(totals.walks, totals.inningsPitched),
    kBBRatio: calculateKBBRatio(totals.strikeouts, totals.walks)
  };
}

// Get recent form (last N games)
export function getRecentForm(games: PitcherGameStats[], lastN: number = 3): PitcherGameStats[] {
  return games
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, lastN);
}
