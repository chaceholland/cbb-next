import { supabase } from '../supabase/client';
import { PitcherGameStats, PitcherSeasonStats } from '../stats/types';
import {
  parseInningsPitched,
  calculateERA,
  calculateWHIP,
  calculateKPer9,
  calculateBBPer9,
  calculateKBBRatio
} from '../stats/calculations';
import { aggregateSeasonStats } from '../stats/aggregations';

// Helper function to transform database participation record + game to PitcherGameStats
function transformGameStats(participation: any, game: any): PitcherGameStats {
  const stats = participation.stats || {};
  const inningsPitched = parseInningsPitched(stats.IP || '0');
  const earnedRuns = parseInt(stats.ER || '0', 10);
  const strikeouts = parseInt(stats.K || '0', 10);
  const walks = parseInt(stats.BB || '0', 10);
  const hits = parseInt(stats.H || '0', 10);
  const homeRuns = parseInt(stats.HR || '0', 10);
  const runs = parseInt(stats.R || '0', 10);
  const pitchCount = parseInt(stats.PC || '0', 10);

  return {
    game_id: participation.game_id,
    pitcher_id: participation.pitcher_id,
    pitcher_name: participation.pitcher_name,
    date: game.date,
    opponent: participation.team_id === game.home_team_id ? game.away_team_id : game.home_team_id,
    inningsPitched,
    earnedRuns,
    strikeouts,
    walks,
    hits,
    homeRuns,
    runs,
    pitchCount,
    era: calculateERA(earnedRuns, inningsPitched),
    whip: calculateWHIP(walks, hits, inningsPitched),
    kPer9: calculateKPer9(strikeouts, inningsPitched),
    bbPer9: calculateBBPer9(walks, inningsPitched),
    kBBRatio: calculateKBBRatio(strikeouts, walks)
  };
}

/**
 * Get aggregated season stats for a single pitcher
 * @param pitcherId - ESPN pitcher ID
 * @returns PitcherSeasonStats or null if pitcher not found
 */
export async function getPitcherSeasonStats(pitcherId: string): Promise<PitcherSeasonStats | null> {
  const { data: participations, error: partError } = await supabase
    .from('cbb_pitcher_participation')
    .select('*, game:cbb_games(*)')
    .eq('pitcher_id', pitcherId)
    .order('game(date)', { ascending: false });

  if (partError || !participations || participations.length === 0) {
    return null;
  }

  const gameStats: PitcherGameStats[] = participations.map(p =>
    transformGameStats(p, p.game)
  );

  const firstParticipation = participations[0];
  return aggregateSeasonStats(
    gameStats,
    pitcherId,
    firstParticipation.pitcher_name,
    firstParticipation.team_id
  );
}

/**
 * Get recent game stats for a pitcher (most recent N games)
 * @param pitcherId - ESPN pitcher ID
 * @param lastN - Number of recent games to return (default: 3)
 * @returns Array of PitcherGameStats sorted by date (most recent first)
 */
export async function getPitcherRecentStats(pitcherId: string, lastN: number = 3): Promise<PitcherGameStats[]> {
  const { data: participations, error } = await supabase
    .from('cbb_pitcher_participation')
    .select('*, game:cbb_games(*)')
    .eq('pitcher_id', pitcherId)
    .order('game(date)', { ascending: false })
    .limit(lastN);

  if (error || !participations) {
    return [];
  }

  return participations.map(p => transformGameStats(p, p.game));
}

/**
 * Get season stats for all pitchers
 * @returns Array of PitcherSeasonStats for all pitchers with participation data
 */
export async function getAllPitcherStats(): Promise<PitcherSeasonStats[]> {
  const { data: participations, error } = await supabase
    .from('cbb_pitcher_participation')
    .select('*, game:cbb_games(*)');

  if (error || !participations) {
    return [];
  }

  // Group by pitcher_id
  const pitcherMap = new Map<string, any[]>();
  participations.forEach(p => {
    if (!pitcherMap.has(p.pitcher_id)) {
      pitcherMap.set(p.pitcher_id, []);
    }
    pitcherMap.get(p.pitcher_id)!.push(p);
  });

  // Aggregate each pitcher's stats
  const seasonStats: PitcherSeasonStats[] = [];
  pitcherMap.forEach((pitcherParticipations, pitcherId) => {
    const gameStats = pitcherParticipations.map(p => transformGameStats(p, p.game));
    const firstP = pitcherParticipations[0];
    seasonStats.push(aggregateSeasonStats(gameStats, pitcherId, firstP.pitcher_name, firstP.team_id));
  });

  return seasonStats;
}

/**
 * Get season stats for all pitchers on a specific team
 * @param teamId - ESPN team ID
 * @returns Array of PitcherSeasonStats for all pitchers on the team
 */
export async function getTeamPitcherStats(teamId: string): Promise<PitcherSeasonStats[]> {
  const { data: participations, error } = await supabase
    .from('cbb_pitcher_participation')
    .select('*, game:cbb_games(*)')
    .eq('team_id', teamId);

  if (error || !participations) {
    return [];
  }

  // Group by pitcher_id
  const pitcherMap = new Map<string, any[]>();
  participations.forEach(p => {
    if (!pitcherMap.has(p.pitcher_id)) {
      pitcherMap.set(p.pitcher_id, []);
    }
    pitcherMap.get(p.pitcher_id)!.push(p);
  });

  // Aggregate each pitcher's stats
  const seasonStats: PitcherSeasonStats[] = [];
  pitcherMap.forEach((pitcherParticipations, pitcherId) => {
    const gameStats = pitcherParticipations.map(p => transformGameStats(p, p.game));
    const firstP = pitcherParticipations[0];
    seasonStats.push(aggregateSeasonStats(gameStats, pitcherId, firstP.pitcher_name, firstP.team_id));
  });

  return seasonStats;
}
