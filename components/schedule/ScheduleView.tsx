'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import { CbbGame, CbbTeam, ParticipationRow } from '@/lib/supabase/types';
import { GameCard } from './GameCard';
import { GameDetailModal } from './GameDetailModal';
import { FiltersModal } from './FiltersModal';
import { ScheduleSkeleton } from './ScheduleSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { useFilterMemory } from '@/lib/hooks/useFilterMemory';
import { cn } from '@/lib/utils';
import { getTeamRecord } from '@/lib/stats/team-records';
import { TeamRecord } from '@/lib/stats/types';

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
  const [favoriteTeamIds, setFavoriteTeamIds] = useState<Set<string>>(new Set());
  const [favoriteGameIds, setFavoriteGameIds] = useLocalStorage<string[]>('cbb-favorite-games', []);
  const [watchedGameIds, setWatchedGameIds] = useLocalStorage<string[]>('cbb-watched-games', []);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [viewMode, setViewMode] = useState<'games' | 'series'>('games');
  const [virtualScroll, setVirtualScroll] = useState(false);
  const [expandAll, setExpandAll] = useState(false);

  // Filter memory hook - persists filter state across sessions
  const { filters, setFilters, clearFilters, isRestored, dismissRestored } = useFilterMemory({
    key: 'schedule-filters',
    defaultFilters: {
      conferences: [],
      teamSearch: '',
      showFavorites: false,
      watchOrder: 'all',
      pitcherFilter: 'favorites-or-played',
      selectedWeeks: [],
    },
  });

  // Derived state from filter memory
  const conferences = useMemo(() => new Set(filters.conferences as string[]), [filters.conferences]);
  const teamSearch = filters.teamSearch as string;
  const showFavorites = filters.showFavorites as boolean;
  const watchOrder = filters.watchOrder as 'all' | 'unwatched' | 'watched' | 'finals' | 'upcoming' | 'favorites';
  const pitcherFilter = filters.pitcherFilter as 'favorites-or-played' | 'favorites-only' | 'played-only' | 'all';
  const selectedWeeks = useMemo(() => new Set(filters.selectedWeeks as number[]), [filters.selectedWeeks]);

  // Setters that update filter memory
  const setConferences = useCallback((confs: Set<string>) => {
    setFilters(prev => ({ ...prev, conferences: Array.from(confs) }));
  }, [setFilters]);

  const setTeamSearch = useCallback((search: string) => {
    setFilters(prev => ({ ...prev, teamSearch: search }));
  }, [setFilters]);

  const setShowFavorites = useCallback((show: boolean | ((prev: boolean) => boolean)) => {
    setFilters(prev => ({ ...prev, showFavorites: typeof show === 'function' ? show(prev.showFavorites as boolean) : show }));
  }, [setFilters]);

  const setWatchOrder = useCallback((order: 'all' | 'unwatched' | 'watched' | 'finals' | 'upcoming' | 'favorites') => {
    setFilters(prev => ({ ...prev, watchOrder: order }));
  }, [setFilters]);

  const setPitcherFilter = useCallback((filter: 'favorites-or-played' | 'favorites-only' | 'played-only' | 'all') => {
    setFilters(prev => ({ ...prev, pitcherFilter: filter }));
  }, [setFilters]);

  const setSelectedWeeks = useCallback((weeks: Set<number>) => {
    setFilters(prev => ({ ...prev, selectedWeeks: Array.from(weeks) }));
  }, [setFilters]);

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
  // team_id → TeamRecord map for showing records on game cards
  const [teamRecords, setTeamRecords] = useState<Record<string, TeamRecord>>({});

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

  // Load team records for all teams in the schedule
  useEffect(() => {
    async function loadRecords() {
      if (!games || games.length === 0) return;

      // Get unique teams from games
      const teamSet = new Set<string>();
      const teamInfo: Record<string, { name: string; conference: string }> = {};

      games.forEach(game => {
        teamSet.add(game.home_team_id);
        teamSet.add(game.away_team_id);
        if (!teamInfo[game.home_team_id]) {
          teamInfo[game.home_team_id] = {
            name: game.home_name || 'Unknown Team',
            conference: (game as any).home_conference || ''
          };
        }
        if (!teamInfo[game.away_team_id]) {
          teamInfo[game.away_team_id] = {
            name: game.away_name || 'Unknown Team',
            conference: (game as any).away_conference || ''
          };
        }
      });

      // Load records
      const records: Record<string, TeamRecord> = {};
      for (const teamId of Array.from(teamSet)) {
        const info = teamInfo[teamId];
        const record = await getTeamRecord(teamId, info.name, info.conference);
        records[teamId] = record;
      }

      setTeamRecords(records);
    }

    loadRecords();
  }, [games]);

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

    // Conference filter (checks either tracked team) - multi-select
    if (conferences.size > 0) {
      result = result.filter(g => {
        const conf = getGameConference(g);
        return Array.from(conferences).some(selectedConf => {
          if (selectedConf === 'SEC') return conf.includes('SEC');
          if (selectedConf === 'ACC') return conf.includes('ACC');
          if (selectedConf === 'Big 12') return conf.includes('Big 12');
          if (selectedConf === 'Big Ten') return conf.includes('Big Ten');
          if (selectedConf === 'Pac-12') return conf.includes('Pac-12') || conf.includes('Pac 12');
          if (selectedConf === 'American') return conf.includes('American');
          if (selectedConf === 'Sun Belt') return conf.includes('Sun Belt');
          if (selectedConf === 'C-USA') return conf.includes('C-USA') || conf.includes('Conference USA');
          if (selectedConf === 'Mountain West') return conf.includes('Mountain West');
          if (selectedConf === 'MAC') return conf.includes('MAC');
          if (selectedConf === 'Other') {
            return !['SEC','ACC','Big 12','Big Ten','Pac-12','American','Sun Belt','C-USA','Mountain West','MAC'].some(c => conf.includes(c));
          }
          return false;
        });
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
        // Check for game-level issues
        if (gameIssuesMap.has(g.game_id)) {
          return true;
        }

        // Check for pitcher-level issues
        const gameParticipation = participationByGame[g.game_id] || [];
        return gameParticipation.some(row => {
          const pitcherKey = `${g.game_id}:${row.pitcher_id || row.pitcher_name}`;
          return pitcherIssuesMap.has(pitcherKey);
        });
      });
    }

    // Watch order filter
    if (watchOrder === 'finals') {
      result = result.filter(g => g.completed);
    } else if (watchOrder === 'upcoming') {
      result = result.filter(g => !g.completed);
    } else if (watchOrder === 'watched') {
      result = result.filter(g => watchedGameIds.includes(g.game_id));
    } else if (watchOrder === 'unwatched') {
      result = result.filter(g => !watchedGameIds.includes(g.game_id));
    } else if (watchOrder === 'favorites') {
      result = result.filter(g => favoriteGameIds.includes(g.game_id));
    }

    // Pitcher filter - requires participation data to be loaded
    if (pitcherFilter !== 'favorites-or-played' && pitcherFilter !== 'all') {
      result = result.filter(g => {
        const gameParticipation = participationByGame[g.game_id] || [];
        if (gameParticipation.length === 0) return false;

        if (pitcherFilter === 'favorites-only') {
          return gameParticipation.some(row => favoritePitcherIds.has(row.pitcher_id || ''));
        } else if (pitcherFilter === 'played-only') {
          return gameParticipation.length > 0;
        }
        return true;
      });
    }

    return result;
  }, [games, conferences, teams, teamSearch, showFavorites, favoriteTeamIds, getGameConference, showIssuesOnly, participationByGame, pitcherIssuesMap, gameIssuesMap, watchOrder, pitcherFilter, favoritePitcherIds, watchedGameIds, favoriteGameIds]);

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

  // Group games into series (same teams, within 3 days)
  const seriesByWeek = useMemo(() => {
    const seriesGroups: Record<number, CbbGame[][]> = {};

    Object.entries(gamesByWeek).forEach(([weekStr, weekGames]) => {
      const week = parseInt(weekStr);
      const series: CbbGame[][] = [];
      const processed = new Set<string>();

      // Sort games by date
      const sortedGames = [...weekGames].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      sortedGames.forEach(game => {
        if (processed.has(game.game_id)) return;

        // Find all games in this series (same teams, within 3 days)
        const seriesGames = [game];
        processed.add(game.game_id);

        const gameDate = new Date(game.date);
        const threeDays = 3 * 24 * 60 * 60 * 1000;

        sortedGames.forEach(otherGame => {
          if (processed.has(otherGame.game_id)) return;

          // Check if same teams (either direction)
          const sameTeams =
            (game.home_team_id === otherGame.home_team_id && game.away_team_id === otherGame.away_team_id) ||
            (game.home_team_id === otherGame.away_team_id && game.away_team_id === otherGame.home_team_id);

          if (sameTeams) {
            const otherDate = new Date(otherGame.date);
            const daysDiff = Math.abs(otherDate.getTime() - gameDate.getTime());

            if (daysDiff <= threeDays) {
              seriesGames.push(otherGame);
              processed.add(otherGame.game_id);
            }
          }
        });

        series.push(seriesGames);
      });

      seriesGroups[week] = series;
    });

    return seriesGroups;
  }, [gamesByWeek]);

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

  const toggleFavoriteGame = useCallback((gameId: string) => {
    setFavoriteGameIds(prev => {
      if (prev.includes(gameId)) {
        return prev.filter(id => id !== gameId);
      } else {
        return [...prev, gameId];
      }
    });
  }, [setFavoriteGameIds]);

  const toggleWatchedGame = useCallback((gameId: string) => {
    setWatchedGameIds(prev => {
      if (prev.includes(gameId)) {
        return prev.filter(id => id !== gameId);
      } else {
        return [...prev, gameId];
      }
    });
  }, [setWatchedGameIds]);

  const handleExportCSV = useCallback(() => {
    const csvRows: string[] = [];
    // Header
    csvRows.push(['Date', 'Week', 'Home Team', 'Away Team', 'Home Score', 'Away Score', 'Status', 'Venue'].join(','));

    // Data rows
    filteredGames.forEach(game => {
      const homeTeam = teams[game.home_team_id]?.display_name || game.home_name || '';
      const awayTeam = teams[game.away_team_id]?.display_name || game.away_name || '';
      const row = [
        game.date,
        game.week?.toString() || '',
        `"${homeTeam}"`,
        `"${awayTeam}"`,
        game.home_score || '',
        game.away_score || '',
        game.completed ? 'Final' : 'Scheduled',
        `"${game.venue || ''}"`,
      ];
      csvRows.push(row.join(','));
    });

    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cbb-schedule-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredGames, teams]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case '/':
          e.preventDefault();
          document.querySelector<HTMLInputElement>('input[placeholder="Search teams..."]')?.focus();
          break;
        case 'f':
        case 'F':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            setShowFiltersModal(true);
          }
          break;
        case 'e':
        case 'E':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            handleExportCSV();
          }
          break;
        case 'Escape':
          setShowFiltersModal(false);
          setSelectedGame(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExportCSV]);

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
    return <ScheduleSkeleton />;
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
      {/* Filter restoration notification */}
      {isRestored && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
          <span>Filters restored from last visit</span>
          <button
            onClick={dismissRestored}
            className="text-blue-500 hover:text-blue-700 dark:text-blue-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search + Favorites row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          onClick={() => setShowFiltersModal(true)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
            'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/30'
          )}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters & Presets
        </button>
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

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-100 rounded-full p-1 border border-slate-300">
          <button
            onClick={() => setViewMode('games')}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
              viewMode === 'games'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Games
          </button>
          <button
            onClick={() => setViewMode('series')}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
              viewMode === 'series'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Series
          </button>
        </div>

        {/* Control Buttons */}
        <button
          onClick={() => {
            if (expandAll) {
              // Collapse all
              setExpandedWeeks(new Set());
              setExpandAll(false);
            } else {
              // Expand all
              setExpandedWeeks(new Set(weeks));
              setExpandAll(true);
            }
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={expandAll ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
          </svg>
          {expandAll ? 'Collapse All' : 'Expand All'}
        </button>

        <button
          onClick={() => setVirtualScroll(!virtualScroll)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
            virtualScroll
              ? 'bg-slate-600 text-white hover:bg-slate-700'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
          )}
        >
          Virtual Scroll: {virtualScroll ? 'ON' : 'OFF'}
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
              onClick={handleExportCSV}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                'bg-green-600 text-white hover:bg-green-700 shadow-sm'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
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
        {conferences.size > 0 && ` in ${Array.from(conferences).join(', ')}`}
      </p>

      <div className="space-y-6">
        {weeks.filter(week => selectedWeeks.size === 0 || selectedWeeks.has(week)).map(week => (
          <div key={week} className="space-y-3">
            <div className="sticky top-32 z-30 bg-slate-50 dark:bg-slate-900 py-2 -mx-4 px-4">
              <button
                onClick={() => toggleWeek(week)}
                className="flex items-center gap-3 w-full text-left group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-400 bg-gradient-to-r from-[#1a73e8]/10 to-[#ea4335]/10 border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-full">
                    Week {week}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{gamesByWeek[week].length} games</span>
                  {loadingWeeks.has(week) && (
                    <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandedWeeks.has(week) ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {expandedWeeks.has(week) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                {viewMode === 'games' ? (
                  // Individual games view
                  gamesByWeek[week].map((game, i) => (
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
                        isFavorite={favoriteGameIds.includes(game.game_id)}
                        isWatched={watchedGameIds.includes(game.game_id)}
                        onToggleFavorite={() => toggleFavoriteGame(game.game_id)}
                        onToggleWatched={() => toggleWatchedGame(game.game_id)}
                      />
                    </motion.div>
                  ))
                ) : (
                  // Series view
                  seriesByWeek[week]?.map((seriesGames, i) => (
                    <motion.div
                      key={seriesGames[0].game_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.3 }}
                      className="space-y-2"
                    >
                      {/* Series header */}
                      {seriesGames.length > 1 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                          <span className="text-xs font-bold text-blue-700">
                            {seriesGames.length}-Game Series
                          </span>
                          <span className="text-xs text-slate-500">
                            {teams[seriesGames[0].away_team_id]?.display_name || seriesGames[0].away_name} vs{' '}
                            {teams[seriesGames[0].home_team_id]?.display_name || seriesGames[0].home_name}
                          </span>
                        </div>
                      )}
                      {/* Games in series */}
                      {seriesGames.map(game => (
                        <GameCard
                          key={game.game_id}
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
                          isFavorite={favoriteGameIds.includes(game.game_id)}
                          isWatched={watchedGameIds.includes(game.game_id)}
                          onToggleFavorite={() => toggleFavoriteGame(game.game_id)}
                          onToggleWatched={() => toggleWatchedGame(game.game_id)}
                        />
                      ))}
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}
          </div>
        ))}

        {weeks.length === 0 && (
          <EmptyState
            icon={
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            title="No games found"
            description="No games match your current filters. Try adjusting your conference, week, or team selections."
            action={{
              label: "Clear all filters",
              onClick: clearFilters,
            }}
          />
        )}
      </div>

      <GameDetailModal
        game={selectedGame}
        teams={teams}
        favoritePitcherIds={favoritePitcherIds}
        onClose={() => setSelectedGame(null)}
      />

      <FiltersModal
        isOpen={showFiltersModal}
        onClose={() => setShowFiltersModal(false)}
        conferences={conferences}
        teamSearch={teamSearch}
        showFavorites={showFavorites}
        showIssuesOnly={showIssuesOnly}
        watchOrder={watchOrder}
        pitcherFilter={pitcherFilter}
        selectedWeeks={selectedWeeks}
        availableWeeks={weeks}
        conferenceCounts={conferenceCounts}
        onConferencesChange={setConferences}
        onTeamSearchChange={setTeamSearch}
        onShowFavoritesChange={setShowFavorites}
        onShowIssuesOnlyChange={setShowIssuesOnly}
        onWatchOrderChange={setWatchOrder}
        onPitcherFilterChange={setPitcherFilter}
        onSelectedWeeksChange={setSelectedWeeks}
        onClearAllFilters={clearFilters}
      />
    </div>
  );
}
