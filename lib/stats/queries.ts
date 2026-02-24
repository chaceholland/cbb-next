import { createClient } from '@/lib/supabase/client';
import { PitcherGameStats } from './types';
import { parseInningsPitched } from './calculations';

/**
 * Transform raw database participation record to typed PitcherGameStats
 */
function mapParticipationToGameStats(p: any): PitcherGameStats {
  const game = p.cbb_games;
  const stats = p.stats ?? {};

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
    innings_pitched: parseInningsPitched(stats.IP ?? '0'),
    earned_runs: parseInt(stats.ER ?? '0', 10),
    strikeouts: parseInt(stats.K ?? '0', 10),
    walks: parseInt(stats.BB ?? '0', 10),
    hits: parseInt(stats.H ?? '0', 10),
    home_runs: parseInt(stats.HR ?? '0', 10),
    pitch_count: parseInt(stats.PC ?? '0', 10),
  };
}

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
    .eq('cbb_games.completed', true);

  if (error) {
    console.error('Error fetching pitcher stats:', error);
    return [];
  }

  if (!participation) return [];

  return participation.map(mapParticipationToGameStats);
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
    .eq('cbb_games.completed', true);

  if (error) {
    console.error('Error fetching team pitcher stats:', error);
    return {};
  }

  if (!participation) return {};

  // Group by pitcher_id
  const grouped: Record<string, PitcherGameStats[]> = {};

  participation.forEach((p) => {
    if (!grouped[p.pitcher_id]) {
      grouped[p.pitcher_id] = [];
    }
    grouped[p.pitcher_id].push(mapParticipationToGameStats(p));
  });

  return grouped;
}
