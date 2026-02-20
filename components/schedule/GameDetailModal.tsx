'use client';

import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import { CbbGame, CbbTeam, ParticipationRow } from '@/lib/supabase/types';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { cn, formatGameDate, getEspnLogoUrl } from '@/lib/utils';

export type ParticipationPitcherDataQualityIssue = {
  gameId: string;
  pitcherName: string;
  teamName: string;
  issues: string[];
  customNote?: string;
};

interface Props {
  game: CbbGame | null;
  teams: Record<string, CbbTeam>;
  favoritePitcherIds: Set<string>;
  onClose: () => void;
}

const normalizeName = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

function PitcherAvatar({ name, headshot, teamId, teamLogo, size = 28 }: { name: string; headshot?: string; teamId?: string; teamLogo?: string | null; size?: number }) {
  // Priority: headshot → team logo from tracked teams → ESPN CDN
  const fallbackSrc = teamLogo || (teamId ? getEspnLogoUrl(teamId) : undefined);
  const imgSrc = headshot || fallbackSrc;

  return (
    <div
      className="rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-200"
      style={{ width: size, height: size }}
    >
      {imgSrc ? (
        <Image
          src={imgSrc}
          alt={name}
          width={size}
          height={size}
          className="object-cover w-full h-full"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div
          className="w-full h-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-white font-bold"
          style={{ fontSize: Math.round(size * 0.35) }}
        >
          {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function TeamPitching({
  team,
  teamId,
  fallbackName,
  rows,
  favoriteNames,
  headshotMap,
  label,
  gameId,
  issueMap,
  onIssueToggle,
}: {
  team: CbbTeam | undefined;
  teamId: string;
  fallbackName?: string;
  rows: ParticipationRow[];
  favoriteNames: Set<string>;
  headshotMap: Record<string, string>;
  label: string;
  gameId: string;
  issueMap: Map<string, ParticipationPitcherDataQualityIssue>;
  onIssueToggle: (gameId: string, pitcherName: string, teamName: string, issues: string[], customNote?: string) => void;
}) {
  const displayName = team?.display_name ?? fallbackName ?? 'Unknown';
  const logoSrc = team?.logo || getEspnLogoUrl(teamId);

  return (
    <div className="flex-1 min-w-0">
      {/* Team header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 shrink-0">
          <Image src={logoSrc} alt={displayName} width={32} height={32} className="object-contain w-full h-full"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-800 truncate">{displayName}</div>
          <div className="text-[10px] text-slate-400">{label}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No pitching data</p>
      ) : (
        <div className="space-y-1.5">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto_auto] gap-x-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-2">
            <span>Pitcher</span>
            <span>IP</span>
            <span>K</span>
            <span>H</span>
            <span>BB</span>
            <span>ER</span>
            <span>PC</span>
            <span className="w-8"></span>
          </div>
          {rows.map(row => {
            const isFav = favoriteNames.has(normalizeName(row.pitcher_name));
            const headshot = headshotMap[normalizeName(row.pitcher_name)];
            const issueKey = `${gameId}:${normalizeName(row.pitcher_name)}`;
            const hasIssue = issueMap.has(issueKey);
            const issueData = issueMap.get(issueKey);
            return (
              <div
                key={row.id}
                className={cn(
                  'grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto_auto] gap-x-2 items-center px-2 py-1.5 rounded-lg',
                  isFav ? 'bg-yellow-50 border border-yellow-200' : 'bg-slate-50'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <PitcherAvatar
                    name={row.pitcher_name}
                    headshot={headshot}
                    teamId={teamId}
                    teamLogo={team?.logo}
                    size={28}
                  />
                  {isFav && (
                    <svg className="w-3 h-3 text-yellow-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  )}
                  <span className="text-xs font-medium text-slate-700 truncate">{row.pitcher_name}</span>
                </div>
                <span className="text-xs font-bold text-slate-800 tabular-nums">{row.stats.IP ?? '—'}</span>
                <span className="text-xs text-slate-600 tabular-nums">{row.stats.K ?? '—'}</span>
                <span className="text-xs text-slate-600 tabular-nums">{row.stats.H ?? '—'}</span>
                <span className="text-xs text-slate-600 tabular-nums">{row.stats.BB ?? '—'}</span>
                <span className="text-xs text-slate-600 tabular-nums">{row.stats.ER ?? '—'}</span>
                <span className="text-xs text-slate-400 tabular-nums">{row.stats.PC ?? '—'}</span>
                <ParticipationIssueButton
                  gameId={gameId}
                  pitcherName={row.pitcher_name}
                  teamName={displayName}
                  hasIssue={hasIssue}
                  issueData={issueData}
                  onIssueToggle={onIssueToggle}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function GameDetailModal({ game, teams, favoritePitcherIds, onClose }: Props) {
  const [participation, setParticipation] = useState<ParticipationRow[]>([]);
  const [favoriteNames, setFavoriteNames] = useState<Set<string>>(new Set());
  const [headshotMap, setHeadshotMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [participationIssues, setParticipationIssues] = useLocalStorage<ParticipationPitcherDataQualityIssue[]>('cbb-participation-pitcher-issues', []);

  const issueMap = useMemo(() => {
    const map = new Map<string, ParticipationPitcherDataQualityIssue>();
    participationIssues.forEach(issue => {
      const key = `${issue.gameId}:${normalizeName(issue.pitcherName)}`;
      map.set(key, issue);
    });
    return map;
  }, [participationIssues]);

  const handleIssueToggle = (
    gameId: string,
    pitcherName: string,
    teamName: string,
    selectedIssues: string[],
    customNote?: string
  ) => {
    setParticipationIssues(prev => {
      const key = `${gameId}:${normalizeName(pitcherName)}`;
      const existing = prev.filter(issue => {
        const existingKey = `${issue.gameId}:${normalizeName(issue.pitcherName)}`;
        return existingKey !== key;
      });
      if (selectedIssues.length === 0) {
        return existing;
      }
      return [...existing, { gameId, pitcherName, teamName, issues: selectedIssues, customNote }];
    });
  };

  useEffect(() => {
    if (!game) return;
    setLoading(true);
    setParticipation([]);
    setFavoriteNames(new Set());
    setHeadshotMap({});

    const favIds = [...favoritePitcherIds];

    Promise.all([
      // Fetch participation for this game
      supabase
        .from('cbb_pitcher_participation')
        .select('*')
        .eq('game_id', game.game_id),

      // Fetch favorite pitchers' names (for teams in this game)
      favIds.length > 0
        ? supabase
            .from('cbb_pitchers')
            .select('name')
            .in('pitcher_id', favIds)
            .in('team_id', [game.home_team_id, game.away_team_id])
        : Promise.resolve({ data: [] }),

      // Fetch headshots for pitchers on both teams
      supabase
        .from('cbb_pitchers')
        .select('name, headshot')
        .in('team_id', [game.home_team_id, game.away_team_id])
        .not('headshot', 'is', null),
    ]).then(([partResult, favResult, headshotResult]) => {
      setParticipation(partResult.data || []);

      const names = new Set(
        (favResult.data || []).map((p: { name: string }) => normalizeName(p.name))
      );
      setFavoriteNames(names);

      const hsMap: Record<string, string> = {};
      ((headshotResult as { data: { name: string; headshot: string }[] | null }).data || []).forEach(p => {
        if (p.headshot) hsMap[normalizeName(p.name)] = p.headshot;
      });
      setHeadshotMap(hsMap);

      setLoading(false);
    });
  }, [game, favoritePitcherIds]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = game ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [game]);

  if (!game) return null;

  const homeTeam = teams[game.home_team_id];
  const awayTeam = teams[game.away_team_id];
  const homeRows = participation.filter(r => r.team_id === game.home_team_id);
  const awayRows = participation.filter(r => r.team_id === game.away_team_id);

  const homeScore = game.home_score ? parseInt(game.home_score) : null;
  const awayScore = game.away_score ? parseInt(game.away_score) : null;
  const homeWon = homeScore !== null && awayScore !== null && homeScore > awayScore;
  const awayWon = homeScore !== null && awayScore !== null && awayScore > homeScore;

  return (
    <AnimatePresence>
      {game && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col pointer-events-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/10 hover:bg-black/20 text-slate-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Score header */}
              <div className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  {/* Away */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Image
                      src={awayTeam?.logo || getEspnLogoUrl(game.away_team_id)}
                      alt={awayTeam?.display_name ?? game.away_name ?? ''}
                      width={40}
                      height={40}
                      className="object-contain shrink-0"
                      unoptimized
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="min-w-0">
                      <div className={cn('text-sm font-bold truncate', awayWon ? 'text-slate-900' : 'text-slate-500')}>
                        {awayTeam?.display_name ?? game.away_name}
                      </div>
                      <div className="text-[10px] text-slate-400">Away</div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-center shrink-0 px-2">
                    {game.completed && awayScore !== null && homeScore !== null ? (
                      <>
                        <div className="text-2xl font-bold text-slate-800 tabular-nums">
                          {awayScore} – {homeScore}
                        </div>
                        <div className="text-xs text-slate-400">Final</div>
                      </>
                    ) : (
                      <div className="text-lg font-bold text-slate-400">VS</div>
                    )}
                  </div>

                  {/* Home */}
                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    <div className="min-w-0 text-right">
                      <div className={cn('text-sm font-bold truncate', homeWon ? 'text-slate-900' : 'text-slate-500')}>
                        {homeTeam?.display_name ?? game.home_name}
                      </div>
                      <div className="text-[10px] text-slate-400">Home</div>
                    </div>
                    <Image
                      src={homeTeam?.logo || getEspnLogoUrl(game.home_team_id)}
                      alt={homeTeam?.display_name ?? game.home_name ?? ''}
                      width={40}
                      height={40}
                      className="object-contain shrink-0"
                      unoptimized
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 mt-2 text-xs text-slate-400">
                  <span>{formatGameDate(game.date)}</span>
                  {game.venue && <><span>·</span><span className="truncate max-w-[200px]">{game.venue}</span></>}
                </div>
              </div>

              {/* Pitching */}
              <div className="p-6 overflow-y-auto flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pitching</h3>
                  {favoriteNames.size > 0 && (
                    <span className="text-[10px] text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
                      ★ = your favorites
                    </span>
                  )}
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : participation.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-10">No pitching data available for this game.</p>
                ) : (
                  <div className="flex gap-6">
                    <TeamPitching
                      team={awayTeam}
                      teamId={game.away_team_id}
                      fallbackName={game.away_name ?? undefined}
                      rows={awayRows}
                      favoriteNames={favoriteNames}
                      headshotMap={headshotMap}
                      label="Away"
                      gameId={game.game_id}
                      issueMap={issueMap}
                      onIssueToggle={handleIssueToggle}
                    />
                    <div className="w-px bg-slate-200 shrink-0" />
                    <TeamPitching
                      team={homeTeam}
                      teamId={game.home_team_id}
                      fallbackName={game.home_name ?? undefined}
                      rows={homeRows}
                      favoriteNames={favoriteNames}
                      headshotMap={headshotMap}
                      label="Home"
                      gameId={game.game_id}
                      issueMap={issueMap}
                      onIssueToggle={handleIssueToggle}
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ParticipationIssueButton({
  gameId,
  pitcherName,
  teamName,
  hasIssue,
  issueData,
  onIssueToggle,
}: {
  gameId: string;
  pitcherName: string;
  teamName: string;
  hasIssue?: boolean;
  issueData?: ParticipationPitcherDataQualityIssue;
  onIssueToggle: (gameId: string, pitcherName: string, teamName: string, issues: string[], customNote?: string) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (showModal && issueData) {
      setSelectedIssues(issueData.issues || []);
      setCustomNote(issueData.customNote || '');
    } else if (showModal) {
      setSelectedIssues([]);
      setCustomNote('');
    }
  }, [showModal, issueData]);

  const handleSave = () => {
    onIssueToggle(gameId, pitcherName, teamName, selectedIssues, customNote || undefined);
    setShowModal(false);
  };

  const handleClear = () => {
    onIssueToggle(gameId, pitcherName, teamName, [], undefined);
    setSelectedIssues([]);
    setCustomNote('');
    setShowModal(false);
  };

  const issueOptions = [
    'Wrong pitcher name',
    'Incorrect stats (IP, K, H, BB, ER, PC)',
    'Pitcher not on this team',
    'Duplicate pitcher entry',
    'Missing pitcher from game',
    'Wrong team assignment',
    'Stats don\'t match official box score',
    'Other (see note)',
  ];

  const toggleIssue = (issue: string) => {
    setSelectedIssues(prev =>
      prev.includes(issue) ? prev.filter(i => i !== issue) : [...prev, issue]
    );
  };

  const modal = showModal && mounted ? createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-800 mb-1">Report Participation Data Issue</h3>
        <p className="text-sm text-slate-500 mb-4">{pitcherName} • {teamName}</p>

        <div className="space-y-2 mb-4">
          {issueOptions.map(issue => (
            <label key={issue} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedIssues.includes(issue)}
                onChange={() => toggleIssue(issue)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
              />
              <span className="text-sm text-slate-700 group-hover:text-slate-900">{issue}</span>
            </label>
          ))}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Additional notes (optional)
          </label>
          <textarea
            value={customNote}
            onChange={e => setCustomNote(e.target.value)}
            placeholder="Describe the issue..."
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={selectedIssues.length === 0}
            className="flex-1 px-4 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            Save
          </button>
          {hasIssue && (
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setShowModal(false)}
            className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0',
          hasIssue
            ? 'bg-orange-100 text-orange-600 hover:bg-orange-200 border border-orange-300'
            : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
        )}
        title={hasIssue ? 'Has data quality issues' : 'Report data quality issue'}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </button>
      {modal}
    </>
  );
}
