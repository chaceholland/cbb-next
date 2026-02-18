'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import { CbbGame, CbbTeam } from '@/lib/supabase/types';
import { GameCard } from './GameCard';
import { ScheduleFilterPills } from '@/components/FilterPills';

export function ScheduleView() {
  const [games, setGames] = useState<CbbGame[]>([]);
  const [teams, setTeams] = useState<Record<string, CbbTeam>>({});
  const [trackedTeamIds, setTrackedTeamIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conference, setConference] = useState('All');
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // Fetch all teams first
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

        // Fetch all games in pages of 1000
        const allGames: CbbGame[] = [];
        let page = 0;
        const pageSize = 1000;

        while (true) {
          const { data, error: gamesError } = await supabase
            .from('cbb_games')
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1)
            .order('date', { ascending: true });

          if (gamesError) throw gamesError;
          if (!data || data.length === 0) break;

          allGames.push(...data);
          if (data.length < pageSize) break;
          page++;
        }

        // Filter to only games involving our 64 tracked teams
        const filteredGames = allGames.filter(
          g => teamIds.has(g.home_team_id) || teamIds.has(g.away_team_id)
        );

        setGames(filteredGames);

        // Default: expand the first 3 weeks
        const weeks = [...new Set(filteredGames.map(g => g.week))].sort((a, b) => a - b);
        setExpandedWeeks(new Set(weeks.slice(0, 3)));
      } catch (err) {
        console.error('Error fetching schedule:', err);
        setError('Failed to load schedule. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Conference counts based on home team's conference
  const conferenceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    games.forEach(g => {
      const homeTeam = teams[g.home_team_id];
      const conf = homeTeam?.conference;
      if (conf) {
        // Map to the pill label
        let label = conf;
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
      }
    });
    return counts;
  }, [games, teams]);

  // Filtered games
  const filteredGames = useMemo(() => {
    if (conference === 'All') return games;
    return games.filter(g => {
      const homeTeam = teams[g.home_team_id];
      const conf = homeTeam?.conference || '';
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
      // Other
      return !['SEC', 'ACC', 'Big 12', 'Big Ten', 'Pac-12', 'American', 'Sun Belt', 'C-USA', 'Mountain West', 'MAC'].some(
        c => conf.includes(c)
      );
    });
  }, [games, teams, conference]);

  // Group by week
  const gamesByWeek = useMemo(() => {
    const groups: Record<number, CbbGame[]> = {};
    filteredGames.forEach(g => {
      if (!groups[g.week]) groups[g.week] = [];
      groups[g.week].push(g);
    });
    return groups;
  }, [filteredGames]);

  const weeks = useMemo(() => Object.keys(gamesByWeek).map(Number).sort((a, b) => a - b), [gamesByWeek]);

  const toggleWeek = (week: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week);
      else next.add(week);
      return next;
    });
  };

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
          <button
            onClick={() => window.location.reload()}
            className="text-blue-500 hover:underline text-sm"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Pills */}
      <ScheduleFilterPills
        conference={conference}
        conferenceCounts={conferenceCounts}
        totalCount={games.length}
        onConferenceChange={setConference}
      />

      <p className="text-sm text-slate-500 mb-6">
        Showing <span className="font-semibold text-slate-700">{filteredGames.length.toLocaleString()}</span> games
        {conference !== 'All' && ` in ${conference}`}
      </p>

      {/* Weeks */}
      <div className="space-y-6">
        {weeks.map(week => (
          <div key={week} className="space-y-3">
            {/* Week header */}
            <button
              onClick={() => toggleWeek(week)}
              className="flex items-center gap-3 w-full text-left group"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-600 bg-gradient-to-r from-[#1a73e8]/10 to-[#ea4335]/10 border border-blue-200 px-3 py-1 rounded-full">
                  Week {week}
                </span>
                <span className="text-xs text-slate-400">
                  {gamesByWeek[week].length} games
                </span>
              </div>
              <div className="flex-1 h-px bg-slate-200" />
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandedWeeks.has(week) ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Games grid */}
            {expandedWeeks.has(week) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {gamesByWeek[week].map((game, i) => (
                  <motion.div
                    key={game.game_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.3 }}
                  >
                    <GameCard
                      game={game}
                      teams={teams}
                      trackedTeamIds={trackedTeamIds}
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
    </div>
  );
}
