import { CbbGame, CbbTeam, ParticipationRow } from '@/lib/supabase/types';
import { formatGameDate, cn, getEspnLogoUrl } from '@/lib/utils';
import Image from 'next/image';

interface Props {
  game: CbbGame;
  teams: Record<string, CbbTeam>;
  trackedTeamIds: Set<string>;
  participation: ParticipationRow[];
  onClick?: () => void;
}

function TeamLogo({ team, teamId, size = 40 }: { team: CbbTeam | undefined; teamId: string; size?: number }) {
  const logoSrc = team?.logo || getEspnLogoUrl(teamId);
  return (
    <div className="relative rounded-full overflow-hidden bg-white shadow-sm shrink-0" style={{ width: size, height: size }}>
      <Image
        src={logoSrc}
        alt={team?.display_name ?? teamId}
        width={size}
        height={size}
        className="object-contain p-0.5"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    </div>
  );
}

function InlinePitcherRow({
  row,
  teamId,
  teams,
  headshotMap,
}: {
  row: ParticipationRow;
  teamId: string;
  teams: Record<string, CbbTeam>;
  headshotMap: Record<string, string>;
}) {
  const team = teams[teamId];
  const fallbackSrc = team?.logo || getEspnLogoUrl(teamId);
  const headshot = headshotMap[row.pitcher_name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()];
  const imgSrc = headshot || fallbackSrc;
  const initials = row.pitcher_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={row.pitcher_name}
            width={20}
            height={20}
            className="object-cover w-full h-full"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full bg-slate-300 flex items-center justify-center text-[7px] font-bold text-slate-600">
            {initials}
          </div>
        )}
      </div>
      <span className="text-[10px] text-slate-600 truncate flex-1">{row.pitcher_name}</span>
      <span className="text-[10px] font-bold text-slate-700 tabular-nums shrink-0">{row.stats?.IP ?? '—'}</span>
    </div>
  );
}

export function GameCard({ game, teams, trackedTeamIds, participation, onClick }: Props) {
  const homeTeam = teams[game.home_team_id];
  const awayTeam = teams[game.away_team_id];

  const isCompleted = game.completed;
  const homeScore = game.home_score ? parseInt(game.home_score) : null;
  const awayScore = game.away_score ? parseInt(game.away_score) : null;

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

  const homeRows = participation.filter(r => r.team_id === game.home_team_id);
  const awayRows = participation.filter(r => r.team_id === game.away_team_id);
  const hasPitching = homeRows.length > 0 || awayRows.length > 0;

  // Headshot map is empty here — GameCard doesn't pre-fetch headshots (too expensive at scale)
  // Fallback to team logo is handled in InlinePitcherRow
  const headshotMap: Record<string, string> = {};

  return (
    <div
      className="rounded-2xl bg-white shadow-md hover:shadow-xl transition-all duration-200 p-4 border border-slate-100 cursor-pointer active:scale-[0.98] flex flex-col gap-3"
      onClick={onClick}
    >
      {/* Top row: result badge */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{formatGameDate(game.date)}</span>
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
      <div className="flex items-center justify-between gap-2">
        {/* Away team */}
        <div className="flex flex-col items-center gap-1 flex-1">
          <TeamLogo team={awayTeam} teamId={game.away_team_id} size={40} />
          <span className="text-xs font-medium text-slate-700 text-center leading-tight line-clamp-2">
            {awayTeam?.display_name ?? game.away_name ?? 'Unknown'}
          </span>
          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Away</span>
        </div>

        {/* Score / VS */}
        <div className="flex flex-col items-center gap-1 px-2">
          {isCompleted && homeScore !== null && awayScore !== null ? (
            <div className="text-center">
              <div className="text-lg font-bold text-slate-800">{awayScore} – {homeScore}</div>
              <div className="text-xs text-slate-400">Final</div>
            </div>
          ) : (
            <div className="text-sm font-bold text-slate-400">VS</div>
          )}
        </div>

        {/* Home team */}
        <div className="flex flex-col items-center gap-1 flex-1">
          <TeamLogo team={homeTeam} teamId={game.home_team_id} size={40} />
          <span className="text-xs font-medium text-slate-700 text-center leading-tight line-clamp-2">
            {homeTeam?.display_name ?? game.home_name ?? 'Unknown'}
          </span>
          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Home</span>
        </div>
      </div>

      {/* Inline pitching */}
      {hasPitching && (
        <div className="border-t border-slate-100 pt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
          {/* Away pitchers */}
          <div className="space-y-0.5">
            {awayRows.slice(0, 3).map(row => (
              <InlinePitcherRow
                key={row.id}
                row={row}
                teamId={game.away_team_id}
                teams={teams}
                headshotMap={headshotMap}
              />
            ))}
            {awayRows.length > 3 && (
              <p className="text-[10px] text-slate-400 pl-6">+{awayRows.length - 3} more</p>
            )}
          </div>
          {/* Home pitchers */}
          <div className="space-y-0.5">
            {homeRows.slice(0, 3).map(row => (
              <InlinePitcherRow
                key={row.id}
                row={row}
                teamId={game.home_team_id}
                teams={teams}
                headshotMap={headshotMap}
              />
            ))}
            {homeRows.length > 3 && (
              <p className="text-[10px] text-slate-400 pl-6">+{homeRows.length - 3} more</p>
            )}
          </div>
        </div>
      )}

      {/* Venue */}
      {game.venue && (
        <p className="text-[10px] text-slate-400 truncate">{game.venue}</p>
      )}
    </div>
  );
}
