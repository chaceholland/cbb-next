export interface CbbTeam {
  team_id: string;
  name: string;
  display_name: string;
  conference: string | null;
  logo: string | null;
}

export interface CbbPitcher {
  pitcher_id: string;
  team_id: string;
  name: string;
  display_name: string | null;
  number: string | null;
  position?: string | null;     // may not exist yet
  year?: string | null;
  height?: string | null;
  weight?: string | null;
  hometown?: string | null;
  bats_throws?: string | null;
  headshot: string | null;
  espn_link: string | null;
}

export interface CbbGame {
  game_id: string;
  date: string;
  week: number;
  season: number;
  home_team_id: string;
  away_team_id: string;
  home_name: string | null;
  away_name: string | null;
  status: string | null;
  completed: boolean;
  venue: string | null;
  home_score: string | null;
  away_score: string | null;
}

export interface EnrichedPitcher extends CbbPitcher {
  team: CbbTeam;
}

export interface ParticipationRow {
  id: number;
  game_id: string;
  team_id: string;
  pitcher_id: string;
  pitcher_name: string;
  stats: Record<string, string>;
}
