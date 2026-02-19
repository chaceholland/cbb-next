'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import { CbbGame, CbbTeam, ParticipationRow } from '@/lib/supabase/types';
import { GameCard } from './GameCard';
import { GameDetailModal } from './GameDetailModal';
import { ScheduleFilterPills } from '@/components/FilterPills';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { cn } from '@/lib/utils';

export type PitcherDataQualityIssue = {
  pitcherKey: string; // game_id:pitcher_id or game_id:pitcher_name
  pitcherName: string;
  teamName: string;
  gameDate: string;
  issues: string[];
  customNote?: string;
};

export type GameDataQualityIssue = {
  gameId: string;
  gameDate: string;
  homeTeam: string;
  awayTeam: string;
  issues: string[];
  customNote?: string;
};

export function ScheduleView() {
  const [games, setGames] = useState<CbbGame[]>([]);
  const [teams, setTeams] = useState<Record<string, CbbTeam>>({});
  const [trackedTeamIds, setTrackedTeamIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<CbbGame | null>(null);
  const [favorites] = useLocalStorage<string[]>('cbb-favorites', []);
  const favoritePitcherIds = useMemo(() => new Set(favorites), [favorites]);
  const [conference, setConference] = useState('All');
  const [teamSearch, setTeamSearch] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  const [favoriteTeamIds, setFavoriteTeamIds] = useState<Set<string>>(new Set());
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  // Data quality issues
  const [pitcherDataQualityIssues, setPitcherDataQualityIssues] = useLocalStorage<PitcherDataQualityIssue[]>('cbb-pitcher-data-quality-issues', []);
  const [gameDataQualityIssues, setGameDataQualityIssues] = useLocalStorage<GameDataQualityIssue[]>('cbb-game-data-quality-issues', []);
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);

  // Participation data: keyed by game_id
  const [participationByGame, setParticipationByGame] = useState<Record<string, ParticipationRow[]>>({});
  const [loadedWeeks, setLoadedWeeks] = useState<Set<number>>(new Set());
  const [loadingWeeks, setLoadingWeeks] = useState<Set<number>>(new Set());
  // pitcher_id → headshot URL map for showing headshots on game cards
  const [headshotsMap, setHeadshotsMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        const { data: teamsData, error: teamsError } = await supabase
          .from('cbb_teams')
          .select('*');
        if (teamsError) throw teamsError;

        const teamsMap: Record<string, CbbTeam> = {};
        const teamIds = new Set<string>();
        (teamsData || []).forEach((t: CbbTeam) => {
          teamsMap[t.team_id] = t;
          teamIds.add(t.team_id);
        });
        setTeams(teamsMap);
        setTrackedTeamIds(teamIds);

        // Load pitcher headshots (map by normalized name for participation lookup)
        const allPitchers: { name: string; headshot: string | null }[] = [];
        let pitcherPage = 0;
        while (true) {
          const { data: pd } = await supabase
            .from('cbb_pitchers')
            .select('name, headshot')
            .range(pitcherPage * 1000, (pitcherPage + 1) * 1000 - 1);
          if (!pd || pd.length === 0) break;
          allPitchers.push(...pd);
          if (pd.length < 1000) break;
          pitcherPage++;
        }
        const hMap: Record<string, string | null> = {};
        allPitchers.forEach(p => {
          if (p.headshot?.startsWith('http')) {
            // Normalize name for matching against participation data
            const normalizedName = p.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
            hMap[normalizedName] = p.headshot;
          }
        });
        setHeadshotsMap(hMap);

        // Server-side filter: only games involving our 64 tracked teams
        const teamIdList = [...teamIds];
        const orFilter = `home_team_id.in.(${teamIdList.join(',')}),away_team_id.in.(${teamIdList.join(',')})`;

        const allGames: CbbGame[] = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error: gamesError } = await supabase
            .from('cbb_games')
            .select('*')
            .or(orFilter)
            .range(page * pageSize, (page + 1) * pageSize - 1)
            .order('date', { ascending: true });
          if (gamesError) throw gamesError;
          if (!data || data.length === 0) break;
          allGames.push(...data);
          if (data.length < pageSize) break;
          page++;
        }

        setGames(allGames);

        // Compute weeks from dates (season starts ~Feb 14)
        const seasonStart = new Date('2026-02-14');
        const computeWeek = (dateStr: string) => {
          const d = new Date(dateStr);
          return Math.max(1, Math.floor((d.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1);
        };
        const weeks = [...new Set(allGames.map(g => computeWeek(g.date)))].sort((a, b) => a - b);
        setExpandedWeeks(new Set(weeks.slice(0, 1)));
      } catch (err) {
        console.error('Error fetching schedule:', err);
        setError('Failed to load schedule. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Resolve which teams have favorited pitchers (for favorites filter)
  useEffect(() => {
    if (favorites.length === 0) {
      setFavoriteTeamIds(new Set());
      return;
    }
    supabase
      .from('cbb_pitchers')
      .select('team_id')
      .in('pitcher_id', favorites)
      .then(({ data }) => {
        setFavoriteTeamIds(new Set((data || []).map((p: { team_id: string }) => p.team_id)));
      });
  }, [favorites]);

  // Fetch participation for a week's completed games
  const fetchWeekParticipation = useCallback(async (week: number, weekGames: CbbGame[]) => {
    if (loadedWeeks.has(week) || loadingWeeks.has(week)) return;

    const completedGameIds = weekGames.filter(g => g.completed).map(g => g.game_id);
    if (completedGameIds.length === 0) {
      setLoadedWeeks(prev => new Set([...prev, week]));
      return;
    }

    setLoadingWeeks(prev => new Set([...prev, week]));

    const chunkSize = 200;
    const allRows: ParticipationRow[] = [];
    for (let i = 0; i < completedGameIds.length; i += chunkSize) {
      const chunk = completedGameIds.slice(i, i + chunkSize);
      const { data } = await supabase
        .from('cbb_pitcher_participation')
        .select('*')
        .in('game_id', chunk);
      if (data) allRows.push(...data);
    }

    setParticipationByGame(prev => {
      const next = { ...prev };
      allRows.forEach(row => {
        if (!next[row.game_id]) next[row.game_id] = [];
        next[row.game_id].push(row);
      });
      return next;
    });

    setLoadedWeeks(prev => new Set([...prev, week]));
    setLoadingWeeks(prev => { const s = new Set(prev); s.delete(week); return s; });
  }, [loadedWeeks, loadingWeeks]);

  // Helper: get the tracked team's conference for a game
  const getGameConference = useCallback((g: CbbGame): string => {
    const homeTeam = teams[g.home_team_id];
    const awayTeam = teams[g.away_team_id];
    return (homeTeam?.conference || awayTeam?.conference || '');
  }, [teams]);

  // Data quality issue handlers
  const handlePitcherIssueToggle = useCallback((
    gameId: string,
    pitcherId: string,
    pitcherName: string,
    teamId: string,
    gameDate: string,
    selectedIssues: string[],
    customNote?: string
  ) => {
    setPitcherDataQualityIssues(prev => {
      const pitcherKey = `${gameId}:${pitcherId || pitcherName}`;
      const existing = prev.find(issue => issue.pitcherKey === pitcherKey);
      const teamName = teams[teamId]?.display_name || 'Unknown Team';

      if (selectedIssues.length === 0 && !customNote) {
        // Remove if no issues selected
        return prev.filter(issue => issue.pitcherKey !== pitcherKey);
      }

      if (existing) {
        // Update existing
        return prev.map(issue =>
          issue.pitcherKey === pitcherKey
            ? { ...issue, issues: selectedIssues, customNote }
            : issue
        );
      } else {
        // Add new
        return [...prev, {
          pitcherKey,
          pitcherName,
          teamName,
          gameDate,
          issues: selectedIssues,
          customNote,
        }];
      }
    });
  }, [teams]);

  // Copy issues to clipboard
  const handleCopyIssues = useCallback(async () => {
    const gameIssueReport = gameDataQualityIssues
      .map(issue => {
        const issueText = issue.issues.join(', ');
        const customText = issue.customNote ? ` - ${issue.customNote}` : '';
        return `GAME: ${issue.awayTeam} @ ${issue.homeTeam} (${issue.gameDate}): ${issueText}${customText}`;
      })
      .join('\n');

    const pitcherIssueReport = pitcherDataQualityIssues
      .map(issue => {
        const issueText = issue.issues.join(', ');
        const customText = issue.customNote ? ` - ${issue.customNote}` : '';
        return `PITCHER: ${issue.pitcherName} (${issue.teamName}) - ${issue.gameDate}: ${issueText}${customText}`;
      })
      .join('\n');

    const combinedReport = [gameIssueReport, pitcherIssueReport].filter(Boolean).join('\n\n');

    try {
      await navigator.clipboard.writeText(combinedReport);
      alert('Issues copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [pitcherDataQualityIssues, gameDataQualityIssues]);

  // Game-level issue handler
  const handleGameIssueToggle = useCallback((
    gameId: string,
    gameDate: string,
    homeTeam: string,
    awayTeam: string,
    selectedIssues: string[],
    customNote?: string
  ) => {
    setGameDataQualityIssues(prev => {
      const existing = prev.find(issue => issue.gameId === gameId);

      if (selectedIssues.length === 0 && !customNote) {
        return prev.filter(issue => issue.gameId !== gameId);
      }

      if (existing) {
        return prev.map(issue =>
          issue.gameId === gameId
            ? { ...issue, issues: selectedIssues, customNote }
            : issue
        );
      } else {
        return [...prev, {
          gameId,
          gameDate,
          homeTeam,
          awayTeam,
          issues: selectedIssues,
          customNote,
        }];
      }
    });
  }, []);

  // Map for quick issue lookups
  const pitcherIssuesMap = useMemo(() => {
    const map = new Map<string, PitcherDataQualityIssue>();
    pitcherDataQualityIssues.forEach(issue => {
      map.set(issue.pitcherKey, issue);
    });
    return map;
  }, [pitcherDataQualityIssues]);

  const gameIssuesMap = useMemo(() => {
    const map = new Map<string, GameDataQualityIssue>();
    gameDataQualityIssues.forEach(issue => {
      map.set(issue.gameId, issue);
    });
    return map;
  }, [gameDataQualityIssues]);

  // Conference counts
  const conferenceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    games.forEach(g => {
      const conf = getGameConference(g);
      if (!conf) return;
      let label: string;
      if (conf.includes('SEC')) label = 'SEC';
      else if (conf.includes('ACC')) label = 'ACC';
      else if (conf.includes('Big 12')) label = 'Big 12';
      else if (conf.includes('Big Ten')) label = 'Big Ten';
      else if (conf.includes('Pac-12') || conf.includes('Pac 12')) label = 'Pac-12';
      else if (conf.includes('American')) label = 'American';
      else if (conf.includes('Sun Belt')) label = 'Sun Belt';
      else if (conf.includes('C-USA') || conf.includes('Conference USA')) label = 'C-USA';
      else if (conf.includes('Mountain West')) label = 'Mountain West';
      else if (conf.includes('MAC')) label = 'MAC';
      else label = 'Other';
      counts[label] = (counts[label] || 0) + 1;
    });
    return counts;
  }, [games, getGameConference]);

  const filteredGames = useMemo(() => {
    let result = games;

    // Conference filter (checks either tracked team)
    if (conference !== 'All') {
      result = result.filter(g => {
        const conf = getGameConference(g);
        if (conference === 'SEC') return conf.includes('SEC');
        if (conference === 'ACC') return conf.includes('ACC');
        if (conference === 'Big 12') return conf.includes('Big 12');
        if (conference === 'Big Ten') return conf.includes('Big Ten');
        if (conference === 'Pac-12') return conf.includes('Pac-12') || conf.includes('Pac 12');
        if (conference === 'American') return conf.includes('American');
        if (conference === 'Sun Belt') return conf.includes('Sun Belt');
        if (conference === 'C-USA') return conf.includes('C-USA') || conf.includes('Conference USA');
        if (conference === 'Mountain West') return conf.includes('Mountain West');
        if (conference === 'MAC') return conf.includes('MAC');
        return !['SEC','ACC','Big 12','Big Ten','Pac-12','American','Sun Belt','C-USA','Mountain West','MAC'].some(c => conf.includes(c));
      });
    }

    // Team search
    if (teamSearch.trim()) {
      const q = teamSearch.toLowerCase().trim();
      result = result.filter(g => {
        const hn = (teams[g.home_team_id]?.display_name || g.home_name || '').toLowerCase();
        const an = (teams[g.away_team_id]?.display_name || g.away_name || '').toLowerCase();
        return hn.includes(q) || an.includes(q);
      });
    }

    // Favorites filter
    if (showFavorites && favoriteTeamIds.size > 0) {
      result = result.filter(g =>
        favoriteTeamIds.has(g.home_team_id) || favoriteTeamIds.has(g.away_team_id)
      );
    }

    // Issues filter - only show games with data quality issues
    if (showIssuesOnly) {
      result = result.filter(g => {
        const gameParticipation = participationByGame[g.game_id] || [];
        return gameParticipation.some(row => {
          const pitcherKey = `${g.game_id}:${row.pitcher_id || row.pitcher_name}`;
          return pitcherIssuesMap.has(pitcherKey);
        });
      });
    }

    return result;
  }, [games, conference, teams, teamSearch, showFavorites, favoriteTeamIds, getGameConference, showIssuesOnly, participationByGame, pitcherIssuesMap]);

  // Compute week from date (season starts ~Feb 14 each year)
  const getWeekFromDate = useCallback((dateStr: string): number => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    // Season opener is typically the second Friday in February
    const seasonStart = new Date(`${year}-02-14`);
    const daysDiff = Math.floor((date.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.floor(daysDiff / 7) + 1);
  }, []);

  const gamesByWeek = useMemo(() => {
    const groups: Record<number, CbbGame[]> = {};
    filteredGames.forEach(g => {
      const week = getWeekFromDate(g.date);
      if (!groups[week]) groups[week] = [];
      groups[week].push(g);
    });
    return groups;
  }, [filteredGames, getWeekFromDate]);

  const weeks = useMemo(() => Object.keys(gamesByWeek).map(Number).sort((a, b) => a - b), [gamesByWeek]);

  const toggleWeek = (week: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(week)) {
        next.delete(week);
      } else {
        next.add(week);
        fetchWeekParticipation(week, gamesByWeek[week] || []);
      }
      return next;
    });
  };

  // Fetch participation for initially expanded weeks once games load
  useEffect(() => {
    if (games.length === 0) return;
    expandedWeeks.forEach(week => {
      const weekGames = games.filter(g => getWeekFromDate(g.date) === week);
      fetchWeekParticipation(week, weekGames);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <p className="text-red-500 font-medium mb-2">{error}</p>
          <button onClick={() => window.location.reload()} className="text-blue-500 hover:underline text-sm">
            Reload page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ScheduleFilterPills
        conference={conference}
        conferenceCounts={conferenceCounts}
        totalCount={games.length}
        onConferenceChange={setConference}
      />

      {/* Search + Favorites row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          value={teamSearch}
          onChange={e => setTeamSearch(e.target.value)}
          placeholder="Search teams..."
          className={cn(
            'px-4 py-2 rounded-xl text-sm w-56',
            'bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 shadow-sm'
          )}
        />
        <button
          onClick={() => setShowFavorites(prev => !prev)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
            showFavorites
              ? 'bg-gradient-to-r from-[#1a73e8] to-[#ea4335] text-white shadow-lg shadow-blue-500/30'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
          )}
        >
          <svg className="w-4 h-4" fill={showFavorites ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          Favorites Only
          {favoriteTeamIds.size > 0 && (
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full border',
              showFavorites ? 'bg-white/20 text-white border-white/30' : 'bg-slate-200 text-slate-600 border-slate-300'
            )}>
              {favoriteTeamIds.size} teams
            </span>
          )}
        </button>

        {/* Data Quality Buttons */}
        {(pitcherDataQualityIssues.length > 0 || gameDataQualityIssues.length > 0) && (
          <>
            <button
              onClick={() => setShowIssuesOnly(!showIssuesOnly)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                showIssuesOnly
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {showIssuesOnly ? 'Show All' : `Show Issues (${pitcherDataQualityIssues.length + gameDataQualityIssues.length})`}
            </button>
            <button
              onClick={handleCopyIssues}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Issues
            </button>
            <button
              onClick={() => {
                const total = pitcherDataQualityIssues.length + gameDataQualityIssues.length;
                if (confirm(`Clear all ${total} data quality issues?`)) {
                  setPitcherDataQualityIssues([]);
                  setGameDataQualityIssues([]);
                }
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                'bg-red-600 text-white hover:bg-red-700 shadow-sm'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear All
            </button>
          </>
        )}
      </div>

      <p className="text-sm text-slate-500 mb-6">
        Showing <span className="font-semibold text-slate-700">{filteredGames.length.toLocaleString()}</span> of{' '}
        <span className="font-semibold text-slate-700">{games.length.toLocaleString()}</span> tracked games
        {conference !== 'All' && ` in ${conference}`}
      </p>

      <div className="space-y-6">
        {weeks.map(week => (
          <div key={week} className="space-y-3">
            <button
              onClick={() => toggleWeek(week)}
              className="flex items-center gap-3 w-full text-left group"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-600 bg-gradient-to-r from-[#1a73e8]/10 to-[#ea4335]/10 border border-blue-200 px-3 py-1 rounded-full">
                  Week {week}
                </span>
                <span className="text-xs text-slate-400">{gamesByWeek[week].length} games</span>
                {loadingWeeks.has(week) && (
                  <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <div className="flex-1 h-px bg-slate-200" />
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandedWeeks.has(week) ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedWeeks.has(week) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                {gamesByWeek[week].map((game, i) => (
                  <motion.div
                    key={game.game_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.3 }}
                  >
                    <GameCard
                      game={game}
                      teams={teams}
                      trackedTeamIds={trackedTeamIds}
                      participation={participationByGame[game.game_id] || []}
                      headshotsMap={headshotsMap}
                      pitcherIssuesMap={pitcherIssuesMap}
                      gameIssuesMap={gameIssuesMap}
                      onPitcherIssueToggle={handlePitcherIssueToggle}
                      onGameIssueToggle={handleGameIssueToggle}
                      onClick={() => setSelectedGame(game)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        ))}

        {weeks.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            No games found for this filter.
          </div>
        )}
      </div>

      <GameDetailModal
        game={selectedGame}
        teams={teams}
        favoritePitcherIds={favoritePitcherIds}
        onClose={() => setSelectedGame(null)}
      />
    </div>
  );
}
