import { CbbGame, CbbTeam, ParticipationRow } from '@/lib/supabase/types';
import { formatGameDate, cn, getEspnLogoUrl } from '@/lib/utils';
import Image from 'next/image';

interface Props {
  game: CbbGame;
  teams: Record<string, CbbTeam>;
  trackedTeamIds: Set<string>;
  participation: ParticipationRow[];
  headshotsMap?: Record<string, string | null>;
  onClick?: () => void;
}

function TeamLogo({ team, teamId, size = 64 }: { team: CbbTeam | undefined; teamId: string; size?: number }) {
  // Use team logo if available, otherwise fall back to ESPN CDN logo
  const logoSrc = team?.logo || getEspnLogoUrl(teamId);
  return (
    <div className="relative rounded-full overflow-hidden bg-slate-50 shadow-md shrink-0" style={{ width: size, height: size }}>
      {logoSrc && (
        <Image
          src={logoSrc}
          alt={team?.display_name ?? teamId}
          width={size}
          height={size}
          className="object-contain p-1"
          unoptimized
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
    </div>
  );
}

const normalizeName = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

function PitcherRow({
  row,
  teamId,
  teams,
  headshotSrc,
}: {
  row: ParticipationRow;
  teamId: string;
  teams: Record<string, CbbTeam>;
  headshotSrc?: string | null;
}) {
  const team = teams[teamId];
  const fallbackSrc = team?.logo || getEspnLogoUrl(teamId);
  // Use actual headshot if available, otherwise fall back to team logo
  const imgSrc = headshotSrc || fallbackSrc;

  const ip = row.stats?.IP;
  const k = row.stats?.K;
  const er = row.stats?.ER;

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-100 mb-2 last:mb-0 shadow-sm">
      {/* Headshot */}
      <div className="w-16 h-16 rounded-full overflow-hidden bg-white shrink-0 border-2 border-yellow-200 shadow-md">
        {imgSrc && (
          <Image
            src={imgSrc}
            alt={row.pitcher_name}
            width={64}
            height={64}
            className="object-cover w-full h-full"
            unoptimized
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              if (fallbackSrc && img.src !== fallbackSrc) {
                img.src = fallbackSrc;
              } else {
                img.style.display = 'none';
              }
            }}
          />
        )}
      </div>

      {/* Name + stats */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-bold text-slate-800 truncate">{row.pitcher_name}</span>
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Pitched in this game" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {ip && (
            <span className="text-xs font-bold text-slate-700">{ip} IP</span>
          )}
          {k && (
            <span className="text-xs text-slate-600">{k}K</span>
          )}
          {er !== undefined && er !== null && er !== '' && (
            <span className="text-xs text-slate-600">{er}ER</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamColumn({
  team,
  teamId,
  name,
  score,
  isWinner,
  isTracked,
  label,
  rows,
  teams,
  headshotsMap,
}: {
  team: CbbTeam | undefined;
  teamId: string;
  name: string | null;
  score: number | null;
  isWinner: boolean;
  isTracked: boolean;
  label: string;
  rows: ParticipationRow[];
  teams: Record<string, CbbTeam>;
  headshotsMap?: Record<string, string | null>;
}) {
  const displayName = team?.display_name ?? name ?? 'Unknown';

  return (
    <div className="flex-1 min-w-0">
      {/* Team header */}
      <div className="flex flex-col items-center gap-2 mb-4">
        <TeamLogo team={team} teamId={teamId} size={72} />
        <div className="text-center">
          <p className={cn('text-sm font-bold leading-tight line-clamp-2', isWinner ? 'text-slate-900' : 'text-slate-600')}>
            {displayName}
          </p>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full mt-1">{label}</span>
        </div>
        {score !== null && (
          <span className={cn('text-xl font-black tabular-nums', isWinner ? 'text-slate-900' : 'text-slate-400')}>
            {score}
          </span>
        )}
      </div>

      {/* Pitchers */}
      <div>
        {rows.length === 0 ? (
          <p className="text-[10px] text-slate-400 italic text-center py-2">
            {isTracked ? 'No data yet' : 'Not tracked'}
          </p>
        ) : (
          <div>
            {rows.slice(0, 4).map(row => (
              <PitcherRow
                key={row.id}
                row={row}
                teamId={teamId}
                teams={teams}
                headshotSrc={headshotsMap?.[normalizeName(row.pitcher_name)] ?? null}
              />
            ))}
            {rows.length > 4 && (
              <p className="text-[10px] text-slate-400 text-center pt-1">+{rows.length - 4} more</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function GameCard({ game, teams, trackedTeamIds, participation, headshotsMap, onClick }: Props) {
  const homeTeam = teams[game.home_team_id];
  const awayTeam = teams[game.away_team_id];

  const isCompleted = game.completed;
  const homeScore = game.home_score ? parseInt(game.home_score) : null;
  const awayScore = game.away_score ? parseInt(game.away_score) : null;
  const homeWon = homeScore !== null && awayScore !== null && homeScore > awayScore;
  const awayWon = homeScore !== null && awayScore !== null && awayScore > homeScore;

  let resultBadge: { label: string; className: string } | null = null;
  if (isCompleted && homeScore !== null && awayScore !== null) {
    if (trackedTeamIds.has(game.home_team_id)) {
      resultBadge = homeWon
        ? { label: 'W', className: 'bg-green-100 text-green-700 border-green-200' }
        : { label: 'L', className: 'bg-red-100 text-red-700 border-red-200' };
    } else if (trackedTeamIds.has(game.away_team_id)) {
      resultBadge = awayWon
        ? { label: 'W', className: 'bg-green-100 text-green-700 border-green-200' }
        : { label: 'L', className: 'bg-red-100 text-red-700 border-red-200' };
    }
  }

  const homeRows = participation.filter(r => r.team_id === game.home_team_id);
  const awayRows = participation.filter(r => r.team_id === game.away_team_id);
  const hasPitching = homeRows.length > 0 || awayRows.length > 0;

  return (
    <div
      className="rounded-2xl bg-white shadow-md hover:shadow-xl transition-all duration-200 border border-slate-100 cursor-pointer active:scale-[0.98] overflow-hidden"
      onClick={onClick}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-50">
        <span className="text-xs text-slate-400">{formatGameDate(game.date)}</span>
        <div className="flex items-center gap-2">
          {isCompleted && hasPitching && (
            <span className="text-[10px] text-green-600 font-medium">● Live Data</span>
          )}
          {isCompleted && resultBadge ? (
            <span className={cn('text-xs font-bold px-2.5 py-0.5 rounded-full border', resultBadge.className)}>
              {resultBadge.label}
            </span>
          ) : !isCompleted ? (
            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200">
              Upcoming
            </span>
          ) : null}
        </div>
      </div>

      {/* Score bar (completed games) */}
      {isCompleted && homeScore !== null && awayScore !== null && (
        <div className="flex items-center justify-center gap-3 py-2 bg-slate-50 border-b border-slate-100">
          <span className={cn('text-sm font-bold truncate max-w-[100px] text-right', awayWon ? 'text-slate-900' : 'text-slate-400')}>
            {awayTeam?.display_name ?? game.away_name}
          </span>
          <span className="text-lg font-black tabular-nums text-slate-800 shrink-0">{awayScore} – {homeScore}</span>
          <span className={cn('text-sm font-bold truncate max-w-[100px]', homeWon ? 'text-slate-900' : 'text-slate-400')}>
            {homeTeam?.display_name ?? game.home_name}
          </span>
        </div>
      )}

      {/* Pitching columns */}
      {hasPitching ? (
        <div className="p-4 flex gap-4">
          <TeamColumn
            team={awayTeam}
            teamId={game.away_team_id}
            name={game.away_name}
            score={awayScore}
            isWinner={awayWon}
            isTracked={trackedTeamIds.has(game.away_team_id)}
            label="Away"
            rows={awayRows}
            teams={teams}
            headshotsMap={headshotsMap}
          />
          <div className="w-px bg-slate-100 shrink-0" />
          <TeamColumn
            team={homeTeam}
            teamId={game.home_team_id}
            name={game.home_name}
            score={homeScore}
            isWinner={homeWon}
            isTracked={trackedTeamIds.has(game.home_team_id)}
            label="Home"
            rows={homeRows}
            teams={teams}
            headshotsMap={headshotsMap}
          />
        </div>
      ) : (
        /* No pitching data — compact card */
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col items-center gap-2 flex-1">
              <TeamLogo team={awayTeam} teamId={game.away_team_id} size={56} />
              <span className="text-sm font-medium text-slate-700 text-center leading-tight line-clamp-2">
                {awayTeam?.display_name ?? game.away_name ?? 'Unknown'}
              </span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Away</span>
            </div>
            <div className="text-base font-bold text-slate-400 shrink-0">VS</div>
            <div className="flex flex-col items-center gap-2 flex-1">
              <TeamLogo team={homeTeam} teamId={game.home_team_id} size={56} />
              <span className="text-sm font-medium text-slate-700 text-center leading-tight line-clamp-2">
                {homeTeam?.display_name ?? game.home_name ?? 'Unknown'}
              </span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Home</span>
            </div>
          </div>
        </div>
      )}

      {/* Venue */}
      {game.venue && (
        <div className="px-3 pb-2">
          <p className="text-[10px] text-slate-400 truncate">{game.venue}</p>
        </div>
      )}
    </div>
  );
}
