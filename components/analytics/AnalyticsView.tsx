'use client';

import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase/client';
import { CbbPitcher, CbbTeam, EnrichedPitcher } from '@/lib/supabase/types';
import { CONFERENCES } from '@/components/FilterPills';
import { cn } from '@/lib/utils';

const CONF_COLORS: Record<string, string> = {
  SEC: 'bg-blue-500',
  ACC: 'bg-orange-500',
  'Big 12': 'bg-red-500',
  'Big Ten': 'bg-purple-500',
  'Pac-12': 'bg-blue-400',
  American: 'bg-teal-500',
  'Sun Belt': 'bg-yellow-500',
  'C-USA': 'bg-green-500',
  'Mountain West': 'bg-sky-500',
  MAC: 'bg-amber-500',
  Other: 'bg-slate-400',
};

function getConfLabel(conf: string): string {
  if (conf.includes('SEC')) return 'SEC';
  if (conf.includes('ACC')) return 'ACC';
  if (conf.includes('Big 12')) return 'Big 12';
  if (conf.includes('Big Ten')) return 'Big Ten';
  if (conf.includes('Pac-12') || conf.includes('Pac 12')) return 'Pac-12';
  if (conf.includes('American')) return 'American';
  if (conf.includes('Sun Belt')) return 'Sun Belt';
  if (conf.includes('C-USA') || conf.includes('Conference USA')) return 'C-USA';
  if (conf.includes('Mountain West')) return 'Mountain West';
  if (conf.includes('MAC')) return 'MAC';
  return 'Other';
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={cn('rounded-2xl p-5 border-2 bg-white', color)}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function HorizontalBar({ label, value, max, color, logo }: {
  label: string; value: number; max: number; color: string; logo?: string | null;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      {logo && (
        <div className="w-6 h-6 shrink-0">
          <Image src={logo} alt={label} width={24} height={24} className="object-contain w-full h-full"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}
      <div className="w-28 shrink-0 text-xs text-slate-600 truncate text-right">{label}</div>
      <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-6 shrink-0 text-xs font-bold text-slate-700 text-right">{value}</div>
    </div>
  );
}

export function AnalyticsView() {
  const [pitchers, setPitchers] = useState<EnrichedPitcher[]>([]);
  const [teams, setTeams] = useState<CbbTeam[]>([]);
  const [gamesTracked, setGamesTracked] = useState(0);
  const [pitchersTracked, setPitchersTracked] = useState(0);
  const [loading, setLoading] = useState(true);
  const [conference, setConference] = useState('All');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        const [teamsResult, countResult] = await Promise.all([
          supabase.from('cbb_teams').select('*').order('display_name', { ascending: true }),
          supabase.from('cbb_pitcher_participation').select('game_id', { count: 'exact', head: false }),
        ]);

        const teamsMap: Record<string, CbbTeam> = {};
        (teamsResult.data || []).forEach((t: CbbTeam) => { teamsMap[t.team_id] = t; });
        setTeams(teamsResult.data || []);

        // Count distinct games from participation
        const gameIds = new Set((countResult.data || []).map((r: { game_id: string }) => r.game_id));
        setGamesTracked(gameIds.size);
        setPitchersTracked(countResult.data?.length || 0);

        const allPitchers: CbbPitcher[] = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
          const { data } = await supabase
            .from('cbb_pitchers')
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1)
            .order('name', { ascending: true });
          if (!data || data.length === 0) break;
          allPitchers.push(...data);
          if (data.length < pageSize) break;
          page++;
        }

        const enriched: EnrichedPitcher[] = allPitchers
          .filter(p => teamsMap[p.team_id])
          .map(p => ({ ...p, team: teamsMap[p.team_id] }));

        setPitchers(enriched);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Filter by conference
  const filteredPitchers = useMemo(() => {
    if (conference === 'All') return pitchers;
    return pitchers.filter(p => getConfLabel(p.team.conference || '') === conference);
  }, [pitchers, conference]);

  const filteredTeams = useMemo(() => {
    if (conference === 'All') return teams;
    return teams.filter(t => getConfLabel(t.conference || '') === conference);
  }, [teams, conference]);

  // Roster sizes by team (top 25)
  const rosterByTeam = useMemo(() => {
    const map: Record<string, { team: CbbTeam; count: number }> = {};
    filteredPitchers.forEach(p => {
      if (!map[p.team_id]) map[p.team_id] = { team: p.team, count: 0 };
      map[p.team_id].count++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 25);
  }, [filteredPitchers]);

  // Position distribution
  const positionDist = useMemo(() => {
    const counts = { RHP: 0, LHP: 0, Unknown: 0 };
    filteredPitchers.forEach(p => {
      const pos = (p.position || '').toUpperCase();
      if (pos.includes('LHP') || pos.includes('LEFT')) counts.LHP++;
      else if (pos.includes('RHP') || pos.includes('RIGHT')) counts.RHP++;
      else counts.Unknown++;
    });
    return counts;
  }, [filteredPitchers]);

  // Class year breakdown
  const classYear = useMemo(() => {
    const counts: Record<string, number> = { Fr: 0, So: 0, Jr: 0, Sr: 0, Gr: 0, Other: 0 };
    filteredPitchers.forEach(p => {
      const yr = (p.year || '').toLowerCase();
      if (yr.includes('fr') || yr.includes('fresh')) counts.Fr++;
      else if (yr.includes('so') || yr.includes('soph')) counts.So++;
      else if (yr.includes('jr') || yr.includes('jun')) counts.Jr++;
      else if (yr.includes('sr') || yr.includes('sen')) counts.Sr++;
      else if (yr.includes('gr') || yr.includes('grad')) counts.Gr++;
      else counts.Other++;
    });
    return counts;
  }, [filteredPitchers]);

  // Conference depth
  const confDepth = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTeams.forEach(t => {
      const label = getConfLabel(t.conference || '');
      counts[label] = (counts[label] || 0) + 1;
    });
    const pitchersByConf: Record<string, number> = {};
    filteredPitchers.forEach(p => {
      const label = getConfLabel(p.team.conference || '');
      pitchersByConf[label] = (pitchersByConf[label] || 0) + 1;
    });
    return CONFERENCES.map(conf => ({
      conf,
      teams: counts[conf] || 0,
      pitchers: pitchersByConf[conf] || 0,
      avg: counts[conf] ? Math.round((pitchersByConf[conf] || 0) / counts[conf]) : 0,
    })).filter(d => d.teams > 0);
  }, [filteredTeams, filteredPitchers]);

  const avgRosterSize = filteredTeams.length > 0
    ? (filteredPitchers.length / filteredTeams.length).toFixed(1)
    : '—';

  const maxRosterSize = rosterByTeam.length > 0 ? rosterByTeam[0].count : 1;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Conference filter */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Conference</label>
        <div className="flex gap-2 flex-wrap">
          {['All', ...CONFERENCES].map(conf => (
            <button
              key={conf}
              onClick={() => setConference(conf)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
                conference === conf
                  ? 'bg-gradient-to-r from-[#1a73e8] to-[#ea4335] text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              )}
            >
              {conf}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Teams" value={filteredTeams.length} color="border-green-200" />
        <StatCard label="Total Pitchers" value={filteredPitchers.length.toLocaleString()} color="border-blue-200" />
        <StatCard label="Avg Roster Size" value={avgRosterSize} color="border-yellow-200" />
        <StatCard
          label="Games Tracked"
          value={gamesTracked}
          sub={`${pitchersTracked.toLocaleString()} pitcher appearances`}
          color="border-purple-200"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Roster Sizes by Team */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">📊 Roster Sizes by Team (Top 25)</h3>
          <div className="space-y-1.5">
            {rosterByTeam.map(({ team, count }) => (
              <HorizontalBar
                key={team.team_id}
                label={team.display_name}
                value={count}
                max={maxRosterSize}
                color={CONF_COLORS[getConfLabel(team.conference || '')] || 'bg-slate-400'}
                logo={team.logo}
              />
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Position Distribution */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-700 mb-4">⚾ Position Distribution</h3>
            <div className="space-y-3">
              {[
                { label: 'RHP', count: positionDist.RHP, color: 'bg-blue-500' },
                { label: 'LHP', count: positionDist.LHP, color: 'bg-green-500' },
                { label: 'Unknown', count: positionDist.Unknown, color: 'bg-slate-300' },
              ].map(({ label, count, color }) => {
                const pct = filteredPitchers.length > 0 ? ((count / filteredPitchers.length) * 100).toFixed(1) : '0';
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span className="font-medium">{label}</span>
                      <span>{count.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Class Year Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-700 mb-4">🎓 Class Year Breakdown</h3>
            <div className="space-y-3">
              {[
                { label: 'Freshman', key: 'Fr', color: 'bg-sky-400' },
                { label: 'Sophomore', key: 'So', color: 'bg-blue-500' },
                { label: 'Junior', key: 'Jr', color: 'bg-violet-500' },
                { label: 'Senior', key: 'Sr', color: 'bg-orange-500' },
                { label: 'Graduate', key: 'Gr', color: 'bg-red-500' },
                { label: 'Other', key: 'Other', color: 'bg-slate-300' },
              ].map(({ label, key, color }) => {
                const count = classYear[key] || 0;
                const pct = filteredPitchers.length > 0 ? ((count / filteredPitchers.length) * 100).toFixed(1) : '0';
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span className="font-medium">{label}</span>
                      <span>{count.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Conference Roster Depth */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">🏆 Conference Roster Depth</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2">Conference</th>
                <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2">Teams</th>
                <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2">Pitchers</th>
                <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2">Avg/Team</th>
              </tr>
            </thead>
            <tbody>
              {confDepth.sort((a, b) => b.pitchers - a.pitchers).map(({ conf, teams: t, pitchers: p, avg }) => (
                <tr key={conf} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', CONF_COLORS[conf] || 'bg-slate-300')} />
                      <span className="font-medium text-slate-700">{conf}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right text-slate-600 tabular-nums">{t}</td>
                  <td className="py-2.5 text-right font-bold text-slate-800 tabular-nums">{p}</td>
                  <td className="py-2.5 text-right text-slate-600 tabular-nums">{avg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
