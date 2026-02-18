import { CbbGame, CbbTeam } from '@/lib/supabase/types';
import { formatGameDate, cn } from '@/lib/utils';
import Image from 'next/image';

interface Props {
  game: CbbGame;
  teams: Record<string, CbbTeam>;
  trackedTeamIds: Set<string>;
}

function TeamLogo({ team, size = 40 }: { team: CbbTeam | undefined; size?: number }) {
  if (!team) return (
    <div
      className="rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs"
      style={{ width: size, height: size }}
    >
      ?
    </div>
  );

  if (team.logo) {
    return (
      <div className="relative rounded-full overflow-hidden bg-white shadow-sm" style={{ width: size, height: size }}>
        <Image
          src={team.logo}
          alt={team.display_name}
          width={size}
          height={size}
          className="object-contain p-0.5"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  // Initials fallback
  const initials = team.display_name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="rounded-full bg-gradient-to-br from-[#1a73e8] to-[#ea4335] flex items-center justify-center text-white font-bold text-xs"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}

export function GameCard({ game, teams, trackedTeamIds }: Props) {
  const homeTeam = teams[game.home_team_id];
  const awayTeam = teams[game.away_team_id];

  // Determine if completed and W/L
  const isCompleted = game.completed;
  const homeScore = game.home_score ? parseInt(game.home_score) : null;
  const awayScore = game.away_score ? parseInt(game.away_score) : null;

  // Determine W/L from perspective of one of our tracked teams
  let resultBadge: { label: string; className: string } | null = null;
  if (isCompleted && homeScore !== null && awayScore !== null) {
    if (trackedTeamIds.has(game.home_team_id)) {
      const homeWon = homeScore > awayScore;
      resultBadge = homeWon
        ? { label: 'W', className: 'bg-green-100 text-green-700 border-green-200' }
        : { label: 'L', className: 'bg-red-100 text-red-700 border-red-200' };
    } else if (trackedTeamIds.has(game.away_team_id)) {
      const awayWon = awayScore > homeScore;
      resultBadge = awayWon
        ? { label: 'W', className: 'bg-green-100 text-green-700 border-green-200' }
        : { label: 'L', className: 'bg-red-100 text-red-700 border-red-200' };
    }
  }

  return (
    <div className="rounded-2xl bg-white shadow-md hover:shadow-xl transition-shadow duration-200 p-4 border border-slate-100">
      {/* Top row: week pill + result badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          Week {game.week}
        </span>
        {isCompleted && resultBadge ? (
          <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border', resultBadge.className)}>
            {resultBadge.label}
          </span>
        ) : !isCompleted ? (
          <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
            Upcoming
          </span>
        ) : null}
      </div>

      {/* Teams row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {/* Away team */}
        <div className="flex flex-col items-center gap-1 flex-1">
          <TeamLogo team={awayTeam} size={44} />
          <span className="text-xs font-medium text-slate-700 text-center leading-tight line-clamp-2">
            {awayTeam?.display_name ?? game.away_name ?? 'Unknown'}
          </span>
          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Away</span>
        </div>

        {/* Score / VS */}
        <div className="flex flex-col items-center gap-1 px-2">
          {isCompleted && homeScore !== null && awayScore !== null ? (
            <div className="text-center">
              <div className="text-lg font-bold text-slate-800">
                {awayScore} – {homeScore}
              </div>
              <div className="text-xs text-slate-400">Final</div>
            </div>
          ) : (
            <div className="text-sm font-bold text-slate-400">VS</div>
          )}
        </div>

        {/* Home team */}
        <div className="flex flex-col items-center gap-1 flex-1">
          <TeamLogo team={homeTeam} size={44} />
          <span className="text-xs font-medium text-slate-700 text-center leading-tight line-clamp-2">
            {homeTeam?.display_name ?? game.home_name ?? 'Unknown'}
          </span>
          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Home</span>
        </div>
      </div>

      {/* Date row */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-2">
        <span className="text-xs text-slate-500">
          {formatGameDate(game.date)}
        </span>
        {game.venue && (
          <span className="text-xs text-slate-400 truncate max-w-[120px]" title={game.venue}>
            {game.venue}
          </span>
        )}
      </div>
    </div>
  );
}
