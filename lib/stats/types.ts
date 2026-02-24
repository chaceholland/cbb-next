// Pitcher stats from a single game
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

// Aggregated season stats
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

// Team record
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
  streak: string; // "W3", "L2"
}
