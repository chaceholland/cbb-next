// Pitcher stats from a single game
export interface PitcherGameStats {
  game_id: string;
  pitcher_id: string;
  pitcher_name: string;
  date: string;
  opponent: string;
  inningsPitched: number; // parsed decimal
  earnedRuns: number;
  strikeouts: number;
  walks: number;
  hits: number;
  homeRuns: number;
  runs: number;
  pitchCount: number;
  era: number;
  whip: number;
  kPer9: number;
  bbPer9: number;
  kBBRatio: number;
}

// Aggregated season stats
export interface PitcherSeasonStats {
  pitcher_id: string;
  pitcher_name: string;
  team_id: string;
  gamesPlayed: number;
  inningsPitched: number;
  earnedRuns: number;
  strikeouts: number;
  walks: number;
  hits: number;
  homeRuns: number;
  runs: number;
  era: number;
  whip: number;
  kPer9: number;
  bbPer9: number;
  kBBRatio: number;
}

// Team record
export interface TeamRecord {
  team_id: string;
  team_name: string;
  wins: number;
  losses: number;
  winPct: number;
  conferenceWins: number;
  conferenceLosses: number;
  conferenceWinPct: number;
  streak: string; // "W3", "L2"
  lastTen: string; // "7-3"
}
