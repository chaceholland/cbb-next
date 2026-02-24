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
