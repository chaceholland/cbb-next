import { CbbGame, CbbTeam, ParticipationRow } from '@/lib/supabase/types';
import { formatGameDate, cn, getEspnLogoUrl } from '@/lib/utils';
import Image from 'next/image';
import { PitcherDataQualityIssue, GameDataQualityIssue } from './ScheduleView';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  game: CbbGame;
  teams: Record<string, CbbTeam>;
  trackedTeamIds: Set<string>;
  participation: ParticipationRow[];
  headshotsMap?: Record<string, string | null>;
  pitcherIssuesMap?: Map<string, PitcherDataQualityIssue>;
  gameIssuesMap?: Map<string, GameDataQualityIssue>;
  onPitcherIssueToggle?: (
    gameId: string,
    pitcherId: string,
    pitcherName: string,
    teamId: string,
    gameDate: string,
    selectedIssues: string[],
    customNote?: string
  ) => void;
  onGameIssueToggle?: (
    gameId: string,
    gameDate: string,
    homeTeam: string,
    awayTeam: string,
    selectedIssues: string[],
    customNote?: string
  ) => void;
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
  gameId,
  gameDate,
  pitcherIssuesMap,
  onPitcherIssueToggle,
}: {
  row: ParticipationRow;
  teamId: string;
  teams: Record<string, CbbTeam>;
  headshotSrc?: string | null;
  gameId: string;
  gameDate: string;
  pitcherIssuesMap?: Map<string, PitcherDataQualityIssue>;
  onPitcherIssueToggle?: (
    gameId: string,
    pitcherId: string,
    pitcherName: string,
    teamId: string,
    gameDate: string,
    selectedIssues: string[],
    customNote?: string
  ) => void;
}) {
  const team = teams[teamId];
  const fallbackSrc = team?.logo || getEspnLogoUrl(teamId);
  // Use actual headshot if available, otherwise fall back to team logo
  const imgSrc = headshotSrc || fallbackSrc;

  const ip = row.stats?.IP;
  const k = row.stats?.K;
  const er = row.stats?.ER;

  const pitcherKey = `${gameId}:${row.pitcher_id || row.pitcher_name}`;
  const hasIssue = pitcherIssuesMap?.has(pitcherKey) ?? false;
  const issueData = pitcherIssuesMap?.get(pitcherKey);

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

      {/* Issue Button */}
      {onPitcherIssueToggle && (
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <IssueButton
            gameId={gameId}
            pitcherId={row.pitcher_id}
            pitcherName={row.pitcher_name}
            teamId={teamId}
            gameDate={gameDate}
            hasIssue={hasIssue}
            issueData={issueData}
            onIssueToggle={onPitcherIssueToggle}
          />
        </div>
      )}
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
  gameId,
  gameDate,
  pitcherIssuesMap,
  onPitcherIssueToggle,
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
  gameId: string;
  gameDate: string;
  pitcherIssuesMap?: Map<string, PitcherDataQualityIssue>;
  onPitcherIssueToggle?: (
    gameId: string,
    pitcherId: string,
    pitcherName: string,
    teamId: string,
    gameDate: string,
    selectedIssues: string[],
    customNote?: string
  ) => void;
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
                gameId={gameId}
                gameDate={gameDate}
                pitcherIssuesMap={pitcherIssuesMap}
                onPitcherIssueToggle={onPitcherIssueToggle}
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

export function GameCard({ game, teams, trackedTeamIds, participation, headshotsMap, pitcherIssuesMap, gameIssuesMap, onPitcherIssueToggle, onGameIssueToggle, onClick }: Props) {
  const homeTeam = teams[game.home_team_id];
  const awayTeam = teams[game.away_team_id];

  const isCompleted = game.completed;
  const homeScore = game.home_score ? parseInt(game.home_score) : null;
  const awayScore = game.away_score ? parseInt(game.away_score) : null;
  const homeWon = homeScore !== null && awayScore !== null && homeScore > awayScore;
  const awayWon = homeScore !== null && awayScore !== null && awayScore > homeScore;

  const hasGameIssue = gameIssuesMap?.has(game.game_id) ?? false;
  const gameIssueData = gameIssuesMap?.get(game.game_id);

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
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{formatGameDate(game.date)}</span>
          {onGameIssueToggle && (
            <div onClick={(e) => e.stopPropagation()}>
              <GameIssueButton
                gameId={game.game_id}
                gameDate={game.date}
                homeTeam={homeTeam?.display_name ?? game.home_name ?? 'Unknown'}
                awayTeam={awayTeam?.display_name ?? game.away_name ?? 'Unknown'}
                hasIssue={hasGameIssue}
                issueData={gameIssueData}
                onIssueToggle={onGameIssueToggle}
              />
            </div>
          )}
        </div>
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
            gameId={game.game_id}
            gameDate={game.date}
            pitcherIssuesMap={pitcherIssuesMap}
            onPitcherIssueToggle={onPitcherIssueToggle}
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
            gameId={game.game_id}
            gameDate={game.date}
            pitcherIssuesMap={pitcherIssuesMap}
            onPitcherIssueToggle={onPitcherIssueToggle}
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

// Issue Button Component
function IssueButton({
  gameId,
  pitcherId,
  pitcherName,
  teamId,
  gameDate,
  hasIssue,
  issueData,
  onIssueToggle,
}: {
  gameId: string;
  pitcherId: string;
  pitcherName: string;
  teamId: string;
  gameDate: string;
  hasIssue: boolean;
  issueData?: PitcherDataQualityIssue;
  onIssueToggle: (
    gameId: string,
    pitcherId: string,
    pitcherName: string,
    teamId: string,
    gameDate: string,
    selectedIssues: string[],
    customNote?: string
  ) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Track if component is mounted (for SSR compatibility)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state with props when modal opens
  useEffect(() => {
    if (showMenu) {
      setSelectedIssues(issueData?.issues || []);
      setCustomNote(issueData?.customNote || '');
      setShowCustomInput((issueData?.issues || []).includes('Misc.'));
    }
  }, [showMenu, issueData]);

  const issueOptions = [
    'Missing headshot',
    'Wrong team',
    'Missing position',
    'Missing height/weight',
    'Missing hometown',
    'Missing bats/throws',
    'Incorrect stats',
    'Misc.',
  ];

  const handleIssueSelect = (issue: string) => {
    if (issue === 'Misc.') {
      setShowCustomInput(!showCustomInput);
    }

    setSelectedIssues(prev => {
      if (prev.includes(issue)) {
        return prev.filter(i => i !== issue);
      } else {
        return [...prev, issue];
      }
    });
  };

  const handleSave = () => {
    onIssueToggle(gameId, pitcherId, pitcherName, teamId, gameDate, selectedIssues, customNote);
    setShowMenu(false);
  };

  const handleClear = () => {
    setSelectedIssues([]);
    setCustomNote('');
    setShowCustomInput(false);
    onIssueToggle(gameId, pitcherId, pitcherName, teamId, gameDate, [], '');
    setShowMenu(false);
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className={cn(
          'p-1.5 rounded-lg transition-all',
          hasIssue
            ? 'bg-orange-500 text-white hover:bg-orange-600'
            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
        )}
        aria-label="Report data quality issue"
        type="button"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </button>

      {showMenu && mounted && createPortal(
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="p-6 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Data Quality Issues</h3>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-700 hover:text-slate-900 flex-shrink-0"
                  aria-label="Close modal"
                  type="button"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-2">{pitcherName}</p>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-3">
                {issueOptions.map(option => (
                  <label
                    key={option}
                    className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-3 rounded-lg transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIssues.includes(option)}
                      onChange={() => handleIssueSelect(option)}
                      className="w-5 h-5 text-blue-600 bg-white border-2 border-slate-300 rounded cursor-pointer focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 checked:bg-blue-600 checked:border-blue-600 accent-blue-600"
                    />
                    <span className="text-base text-slate-700">{option}</span>
                  </label>
                ))}

                {showCustomInput && (
                  <textarea
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="Describe the issue..."
                    className="w-full mt-3 p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handleClear}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Game Issue Button Component
function GameIssueButton({
  gameId,
  gameDate,
  homeTeam,
  awayTeam,
  hasIssue,
  issueData,
  onIssueToggle,
}: {
  gameId: string;
  gameDate: string;
  homeTeam: string;
  awayTeam: string;
  hasIssue: boolean;
  issueData?: GameDataQualityIssue;
  onIssueToggle: (
    gameId: string,
    gameDate: string,
    homeTeam: string,
    awayTeam: string,
    selectedIssues: string[],
    customNote?: string
  ) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Track if component is mounted (for SSR compatibility)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state with props when modal opens
  useEffect(() => {
    if (showMenu) {
      setSelectedIssues(issueData?.issues || []);
      setCustomNote(issueData?.customNote || '');
      setShowCustomInput((issueData?.issues || []).includes('Misc.'));
    }
  }, [showMenu, issueData]);

  const issueOptions = [
    'Missing game data',
    'Incorrect score',
    'Wrong venue',
    'Missing participation data',
    'Incorrect date/time',
    'Wrong teams',
    'Missing team logo',
    'Team missing some players in roster scrape',
    'Misc.',
  ];

  const handleIssueSelect = (issue: string) => {
    if (issue === 'Misc.') {
      setShowCustomInput(!showCustomInput);
    }

    setSelectedIssues(prev => {
      if (prev.includes(issue)) {
        return prev.filter(i => i !== issue);
      } else {
        return [...prev, issue];
      }
    });
  };

  const handleSave = () => {
    onIssueToggle(gameId, gameDate, homeTeam, awayTeam, selectedIssues, customNote);
    setShowMenu(false);
  };

  const handleClear = () => {
    setSelectedIssues([]);
    setCustomNote('');
    setShowCustomInput(false);
    onIssueToggle(gameId, gameDate, homeTeam, awayTeam, [], '');
    setShowMenu(false);
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className={cn(
          'p-1.5 rounded-lg transition-all',
          hasIssue
            ? 'bg-orange-500 text-white hover:bg-orange-600'
            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
        )}
        aria-label="Report game data quality issue"
        type="button"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </button>

      {showMenu && mounted && createPortal(
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="p-6 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Game Data Quality Issues</h3>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-700 hover:text-slate-900 flex-shrink-0"
                  aria-label="Close modal"
                  type="button"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-2">{awayTeam} @ {homeTeam}</p>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-3">
                {issueOptions.map(option => (
                  <label
                    key={option}
                    className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-3 rounded-lg transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIssues.includes(option)}
                      onChange={() => handleIssueSelect(option)}
                      className="w-5 h-5 text-blue-600 bg-white border-2 border-slate-300 rounded cursor-pointer focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 checked:bg-blue-600 checked:border-blue-600 accent-blue-600"
                    />
                    <span className="text-base text-slate-700">{option}</span>
                  </label>
                ))}

                {showCustomInput && (
                  <textarea
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="Describe the issue..."
                    className="w-full mt-3 p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handleClear}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
