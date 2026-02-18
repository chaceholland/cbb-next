'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { CbbPitcher, CbbTeam, EnrichedPitcher } from '@/lib/supabase/types';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { PitcherCard } from './PitcherCard';
import { PitcherModal } from './PitcherModal';
import { RosterFilterPills } from '@/components/FilterPills';
import { cn } from '@/lib/utils';

export function RosterView() {
  const [pitchers, setPitchers] = useState<EnrichedPitcher[]>([]);
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

        // Fetch all teams
        const { data: teamsData, error: teamsError } = await supabase
          .from('cbb_teams')
          .select('*');
        if (teamsError) throw teamsError;

        const teamsMap: Record<string, CbbTeam> = {};
        (teamsData || []).forEach((t: CbbTeam) => {
          teamsMap[t.team_id] = t;
        });

        // Fetch all pitchers in pages
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

        // Merge pitchers with their teams
        const enriched: EnrichedPitcher[] = allPitchers
          .filter(p => teamsMap[p.team_id]) // only pitchers with known teams
          .map(p => ({
            ...p,
            team: teamsMap[p.team_id],
          }));

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

  // Compute conference counts
  const conferenceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    pitchers.forEach(p => {
      const conf = p.team.conference;
      if (!conf) return;
      let label = 'Other';
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
      counts[label] = (counts[label] || 0) + 1;
    });
    return counts;
  }, [pitchers]);

  // Compute hand counts
  const handCounts = useMemo(() => {
    const counts: Record<string, number> = { All: pitchers.length, RHP: 0, LHP: 0 };
    pitchers.forEach(p => {
      const pos = (p.position || '').toUpperCase();
      if (pos.includes('LHP') || pos.includes('LEFT')) counts.LHP++;
      else if (pos.includes('RHP') || pos.includes('RIGHT')) counts.RHP++;
    });
    return counts;
  }, [pitchers]);

  // Filtered pitchers
  const filteredPitchers = useMemo(() => {
    let result = pitchers;

    // Favorites filter
    if (showFavorites) {
      const favSet = new Set(favorites);
      result = result.filter(p => favSet.has(p.pitcher_id));
    }

    // Conference filter
    if (conference !== 'All') {
      result = result.filter(p => {
        const conf = p.team.conference || '';
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
        return !['SEC', 'ACC', 'Big 12', 'Big Ten', 'Pac-12', 'American', 'Sun Belt', 'C-USA', 'Mountain West', 'MAC']
          .some(c => conf.includes(c));
      });
    }

    // Hand filter
    if (hand !== 'All') {
      result = result.filter(p => {
        const pos = (p.position || '').toUpperCase();
        if (hand === 'LHP') return pos.includes('LHP') || pos.includes('LEFT');
        if (hand === 'RHP') return pos.includes('RHP') || pos.includes('RIGHT');
        return true;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.display_name || '').toLowerCase().includes(q) ||
        p.team.name.toLowerCase().includes(q) ||
        p.team.display_name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [pitchers, conference, hand, searchQuery, showFavorites, favorites]);

  const handleToggleFavorite = (id: string) => {
    setFavorites(prev => {
      if (prev.includes(id)) return prev.filter(f => f !== id);
      return [...prev, id];
    });
  };

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
      {/* Search bar */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search pitchers by name or team..."
          className={cn(
            'w-full max-w-md px-4 py-2.5 rounded-xl text-sm',
            'bg-white border border-slate-300',
            'text-slate-900 placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500',
            'shadow-sm transition-all duration-200'
          )}
        />
      </div>

      {/* Filter pills */}
      <RosterFilterPills
        conference={conference}
        hand={hand}
        showFavorites={showFavorites}
        conferenceCounts={conferenceCounts}
        handCounts={handCounts}
        totalCount={pitchers.length}
        favoritesCount={favorites.length}
        onConferenceChange={setConference}
        onHandChange={setHand}
        onFavoritesToggle={() => setShowFavorites(prev => !prev)}
      />

      <p className="text-sm text-slate-500 mb-6">
        Showing <span className="font-semibold text-slate-700">{filteredPitchers.length.toLocaleString()}</span> of {pitchers.length.toLocaleString()} pitchers
      </p>

      {/* Grid */}
      {filteredPitchers.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          No pitchers found matching your filters.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {filteredPitchers.map((pitcher, i) => (
            <PitcherCard
              key={pitcher.pitcher_id}
              pitcher={pitcher}
              index={i}
              onClick={() => setSelectedPitcher(pitcher)}
              isFavorite={favorites.includes(pitcher.pitcher_id)}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <PitcherModal
        pitcher={selectedPitcher}
        onClose={() => setSelectedPitcher(null)}
        isFavorite={selectedPitcher ? favorites.includes(selectedPitcher.pitcher_id) : false}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}
