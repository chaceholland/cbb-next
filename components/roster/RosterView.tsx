'use client';

import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase/client';
import { CbbPitcher, CbbTeam, EnrichedPitcher } from '@/lib/supabase/types';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { PitcherModal } from './PitcherModal';
import { CONFERENCES } from '@/components/FilterPills';
import { cn, getEspnLogoUrl } from '@/lib/utils';

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

function PitcherRow({
  pitcher,
  isFavorite,
  onToggleFavorite,
  onClick,
}: {
  pitcher: EnrichedPitcher;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onClick: () => void;
}) {
  const logoSrc = pitcher.team?.logo || getEspnLogoUrl(pitcher.team_id);
  const validHeadshot = pitcher.headshot?.startsWith('http') && !pitcher.headshot.includes('supabase.co') ? pitcher.headshot : null;
  const imgSrc = validHeadshot || logoSrc;
  const pos = (pitcher.position || '').toUpperCase();
  const isLHP = pos.includes('LHP') || pos.includes('LEFT');
  const isRHP = pos.includes('RHP') || pos.includes('RIGHT');

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors',
        isFavorite ? 'bg-yellow-50' : ''
      )}
      onClick={onClick}
    >
      {/* Headshot */}
      <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-100 shrink-0 border-2 border-white shadow-sm">
        <Image
          src={imgSrc}
          alt={pitcher.name}
          width={56}
          height={56}
          className="object-cover w-full h-full"
          unoptimized
          onError={(e) => { (e.target as HTMLImageElement).src = logoSrc; }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {pitcher.number && (
            <span className="text-[10px] text-slate-400 font-mono">#{pitcher.number}</span>
          )}
          <span className="text-sm font-bold text-slate-800 truncate">{pitcher.name}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {(isRHP || isLHP) && (
            <span className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded border',
              isLHP
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            )}>
              {isLHP ? 'LHP' : 'RHP'}
            </span>
          )}
          {pitcher.year && (
            <span className="text-[10px] text-slate-400 capitalize">{pitcher.year}</span>
          )}
        </div>
      </div>

      {/* Favorite star */}
      <button
        onClick={e => { e.stopPropagation(); onToggleFavorite(pitcher.pitcher_id); }}
        className="p-1 shrink-0 transition-colors"
      >
        <svg
          className={cn('w-4 h-4', isFavorite ? 'text-yellow-400 fill-current' : 'text-slate-300 hover:text-yellow-300')}
          fill={isFavorite ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </button>
    </div>
  );
}

export function RosterView() {
  const [pitchers, setPitchers] = useState<EnrichedPitcher[]>([]);
  const [teams, setTeams] = useState<CbbTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPitcher, setSelectedPitcher] = useState<EnrichedPitcher | null>(null);
  const [favorites, setFavorites] = useLocalStorage<string[]>('cbb-favorites', []);
  const [searchQuery, setSearchQuery] = useState('');
  const [conference, setConference] = useState('All');
  const [hand, setHand] = useState('All');
  const [showFavorites, setShowFavorites] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        const { data: teamsData, error: teamsError } = await supabase
          .from('cbb_teams')
          .select('*')
          .order('display_name', { ascending: true });
        if (teamsError) throw teamsError;

        const teamsMap: Record<string, CbbTeam> = {};
        (teamsData || []).forEach((t: CbbTeam) => { teamsMap[t.team_id] = t; });
        setTeams(teamsData || []);

        const allPitchers: CbbPitcher[] = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error: pitchersError } = await supabase
            .from('cbb_pitchers')
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1)
            .order('name', { ascending: true });
          if (pitchersError) throw pitchersError;
          if (!data || data.length === 0) break;
          allPitchers.push(...data);
          if (data.length < pageSize) break;
          page++;
        }

        const enriched: EnrichedPitcher[] = allPitchers
          .filter(p => teamsMap[p.team_id])
          .map(p => ({ ...p, team: teamsMap[p.team_id] }));

        setPitchers(enriched);
      } catch (err) {
        console.error('Error fetching roster:', err);
        setError('Failed to load roster. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleToggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  // Filtered pitchers (global filters)
  const filteredPitchers = useMemo(() => {
    let result = pitchers;

    if (conference !== 'All') {
      result = result.filter(p => getConfLabel(p.team.conference || '') === conference);
    }
    if (hand !== 'All') {
      result = result.filter(p => {
        const pos = (p.position || '').toUpperCase();
        if (hand === 'LHP') return pos.includes('LHP') || pos.includes('LEFT');
        if (hand === 'RHP') return pos.includes('RHP') || pos.includes('RIGHT');
        return true;
      });
    }
    if (showFavorites) {
      const favSet = new Set(favorites);
      result = result.filter(p => favSet.has(p.pitcher_id));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.display_name || '').toLowerCase().includes(q) ||
        p.team.display_name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [pitchers, conference, hand, showFavorites, favorites, searchQuery]);

  // Group filtered pitchers by team, maintaining team sort order
  const pitchersByTeam = useMemo(() => {
    const map: Record<string, EnrichedPitcher[]> = {};
    filteredPitchers.forEach(p => {
      if (!map[p.team_id]) map[p.team_id] = [];
      map[p.team_id].push(p);
    });
    return map;
  }, [filteredPitchers]);

  // Teams that have at least one pitcher after filtering
  const visibleTeams = useMemo(() => {
    return teams.filter(t => {
      // Conference filter at team level too
      if (conference !== 'All' && getConfLabel(t.conference || '') !== conference) return false;
      // Must have pitchers after filtering (or if searching by team name, show even if no pitchers match)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const teamNameMatch = t.display_name.toLowerCase().includes(q);
        if (teamNameMatch) return true; // show team if name matches, even if no pitchers match
        return (pitchersByTeam[t.team_id] || []).length > 0;
      }
      return (pitchersByTeam[t.team_id] || []).length > 0;
    });
  }, [teams, conference, pitchersByTeam, searchQuery]);

  // Conference counts for filter pills
  const conferenceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    pitchers.forEach(p => {
      const label = getConfLabel(p.team.conference || '');
      counts[label] = (counts[label] || 0) + 1;
    });
    return counts;
  }, [pitchers]);

  const handCounts = useMemo(() => {
    const counts = { All: pitchers.length, RHP: 0, LHP: 0 };
    pitchers.forEach(p => {
      const pos = (p.position || '').toUpperCase();
      if (pos.includes('LHP') || pos.includes('LEFT')) counts.LHP++;
      else if (pos.includes('RHP') || pos.includes('RIGHT')) counts.RHP++;
    });
    return counts;
  }, [pitchers]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading rosters...</p>
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
      {/* Filters bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-6 space-y-3">
        {/* Search + hand + favorites row */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search pitchers or teams..."
            className={cn(
              'flex-1 min-w-[200px] max-w-xs px-4 py-2 rounded-xl text-sm',
              'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500'
            )}
          />

          {/* Hand filter */}
          <div className="flex gap-1">
            {['All', 'RHP', 'LHP'].map(h => (
              <button
                key={h}
                onClick={() => setHand(h)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                  hand === h
                    ? 'bg-gradient-to-r from-[#1a73e8] to-[#ea4335] text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                )}
              >
                {h}
                {h !== 'All' && (
                  <span className="ml-1 text-[10px] opacity-70">{handCounts[h as keyof typeof handCounts]}</span>
                )}
              </button>
            ))}
          </div>

          {/* Favorites toggle */}
          <button
            onClick={() => setShowFavorites(prev => !prev)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
              showFavorites
                ? 'bg-gradient-to-r from-[#1a73e8] to-[#ea4335] text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
            )}
          >
            <svg className="w-3.5 h-3.5" fill={showFavorites ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            Favs Only
            {favorites.length > 0 && (
              <span className={cn(
                'text-[10px] px-1.5 rounded-full',
                showFavorites ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
              )}>
                {favorites.length}
              </span>
            )}
          </button>
        </div>

        {/* Conference filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
          {['All', ...CONFERENCES].map(conf => (
            <button
              key={conf}
              onClick={() => setConference(conf)}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                conference === conf
                  ? 'bg-gradient-to-r from-[#1a73e8] to-[#ea4335] text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              )}
            >
              {conf}
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full',
                conference === conf ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
              )}>
                {conf === 'All' ? pitchers.length : (conferenceCounts[conf] || 0)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary line */}
      <p className="text-sm text-slate-500 mb-5">
        <span className="font-semibold text-slate-700">{visibleTeams.length}</span> teams ·{' '}
        <span className="font-semibold text-slate-700">{filteredPitchers.length.toLocaleString()}</span> pitchers
        {favorites.length > 0 && (
          <span className="ml-2 text-yellow-600">· ★ {favorites.length} favorited</span>
        )}
      </p>

      {/* Team + pitcher list */}
      <div className="columns-1 md:columns-2 xl:columns-3 gap-4 space-y-4">
        {visibleTeams.map(team => {
          const teamPitchers = pitchersByTeam[team.team_id] || [];
          const favCount = teamPitchers.filter(p => favorites.includes(p.pitcher_id)).length;
          const logoSrc = team.logo || getEspnLogoUrl(team.team_id);

          return (
            <div key={team.team_id} className="break-inside-avoid bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-4">
              {/* Team header */}
              <div className="flex items-center gap-3 p-3 border-b border-slate-100 bg-slate-50">
                <div className="w-10 h-10 shrink-0">
                  <Image
                    src={logoSrc}
                    alt={team.display_name}
                    width={40}
                    height={40}
                    className="object-contain w-full h-full"
                    unoptimized
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{team.display_name}</p>
                  <p className="text-[10px] text-slate-400">{team.conference}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="text-xs font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                    {teamPitchers.length}P
                  </span>
                  {favCount > 0 && (
                    <span className="text-[10px] text-yellow-600">★ {favCount}</span>
                  )}
                </div>
              </div>

              {/* Pitchers */}
              <div className="divide-y divide-slate-50">
                {teamPitchers.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4">No pitchers match filters</p>
                ) : (
                  teamPitchers.map(pitcher => (
                    <PitcherRow
                      key={pitcher.pitcher_id}
                      pitcher={pitcher}
                      isFavorite={favorites.includes(pitcher.pitcher_id)}
                      onToggleFavorite={handleToggleFavorite}
                      onClick={() => setSelectedPitcher(pitcher)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {visibleTeams.length === 0 && (
        <div className="text-center py-16 text-slate-400">No pitchers found for this filter.</div>
      )}

      <PitcherModal
        pitcher={selectedPitcher}
        onClose={() => setSelectedPitcher(null)}
        isFavorite={selectedPitcher ? favorites.includes(selectedPitcher.pitcher_id) : false}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}
