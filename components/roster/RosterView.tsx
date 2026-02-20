'use client';

import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase/client';
import { CbbPitcher, CbbTeam, EnrichedPitcher } from '@/lib/supabase/types';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { PitcherCard } from './PitcherCard';
import { PitcherModal } from './PitcherModal';
import { RosterFilterPills } from '@/components/FilterPills';
import { cn, getEspnLogoUrl } from '@/lib/utils';

export type RosterPitcherDataQualityIssue = {
  pitcherKey: string; // team_id:pitcher_id
  pitcherName: string;
  teamName: string;
  issues: string[];
  customNote?: string;
};

export type TeamDataQualityIssue = {
  teamId: string;
  teamName: string;
  issues: string[];
  customNote?: string;
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

export function RosterView() {
  const [pitchers, setPitchers] = useState<EnrichedPitcher[]>([]);
  const [teams, setTeams] = useState<CbbTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedPitcher, setSelectedPitcher] = useState<EnrichedPitcher | null>(null);
  const [favorites, setFavorites] = useLocalStorage<string[]>('cbb-favorites', []);
  const [searchQuery, setSearchQuery] = useState('');
  const [conference, setConference] = useState('All');
  const [hand, setHand] = useState('All');
  const [showFavorites, setShowFavorites] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // Data quality issues
  const [pitcherDataQualityIssues, setPitcherDataQualityIssues] = useLocalStorage<RosterPitcherDataQualityIssue[]>('cbb-roster-pitcher-data-quality-issues', []);
  const [teamDataQualityIssues, setTeamDataQualityIssues] = useLocalStorage<TeamDataQualityIssue[]>('cbb-team-data-quality-issues', []);

  async function handleImportFavorites() {
    setImporting(true);
    setImportResult(null);
    try {
      const { data } = await supabase.from('favorites').select('pitchers').eq('tracker', 'cbb').eq('user_id', 'default').single();
      if (!data?.pitchers?.length) { setImportResult('No favorites found in old tracker.'); return; }
      const currentSet = new Set(pitchers.map(p => p.pitcher_id));
      const matched = (data.pitchers as string[]).filter(id => currentSet.has(id));
      const existing = new Set(favorites);
      const toAdd = matched.filter(id => !existing.has(id));
      if (toAdd.length === 0) { setImportResult('All matching favorites already imported.'); return; }
      setFavorites(prev => [...prev, ...toAdd]);
      setImportResult(`Imported ${toAdd.length} favorites (${data.pitchers.length - matched.length} unmatched from old tracker).`);
    } catch {
      setImportResult('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  }

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

  const pitchersByTeam = useMemo(() => {
    const map: Record<string, EnrichedPitcher[]> = {};
    pitchers.forEach(p => {
      if (!map[p.team_id]) map[p.team_id] = [];
      map[p.team_id].push(p);
    });
    return map;
  }, [pitchers]);

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

  // Teams visible in the tile grid
  const filteredTeams = useMemo(() => {
    return teams.filter(t => {
      if (conference === 'All') return true;
      return getConfLabel(t.conference || '') === conference;
    });
  }, [teams, conference]);

  // Pitchers shown in the drill-down view
  const teamPitchers = useMemo(() => {
    if (!selectedTeamId) return [];
    let result = pitchersByTeam[selectedTeamId] || [];
    if (showFavorites) {
      const favSet = new Set(favorites);
      result = result.filter(p => favSet.has(p.pitcher_id));
    }
    if (hand !== 'All') {
      result = result.filter(p => {
        const pos = (p.position || '').toUpperCase();
        if (hand === 'LHP') return pos.includes('LHP') || pos.includes('LEFT');
        if (hand === 'RHP') return pos.includes('RHP') || pos.includes('RIGHT');
        return true;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.display_name || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [selectedTeamId, pitchersByTeam, showFavorites, favorites, hand, searchQuery]);

  // Create maps for quick issue lookup
  const pitcherIssuesMap = useMemo(() => {
    const map = new Map<string, RosterPitcherDataQualityIssue>();
    pitcherDataQualityIssues.forEach(issue => {
      map.set(issue.pitcherKey, issue);
    });
    return map;
  }, [pitcherDataQualityIssues]);

  const teamIssuesMap = useMemo(() => {
    const map = new Map<string, TeamDataQualityIssue>();
    teamDataQualityIssues.forEach(issue => {
      map.set(issue.teamId, issue);
    });
    return map;
  }, [teamDataQualityIssues]);

  // Handler for pitcher data quality issues
  const handlePitcherIssueToggle = (
    pitcherId: string,
    pitcherName: string,
    teamId: string,
    teamName: string,
    selectedIssues: string[],
    customNote?: string
  ) => {
    const pitcherKey = `${teamId}:${pitcherId}`;

    setPitcherDataQualityIssues(prev => {
      const existing = prev.filter(issue => issue.pitcherKey !== pitcherKey);
      if (selectedIssues.length === 0) {
        return existing;
      }
      return [...existing, { pitcherKey, pitcherName, teamName, issues: selectedIssues, customNote }];
    });
  };

  // Handler for team data quality issues
  const handleTeamIssueToggle = (
    teamId: string,
    teamName: string,
    selectedIssues: string[],
    customNote?: string
  ) => {
    setTeamDataQualityIssues(prev => {
      const existing = prev.filter(issue => issue.teamId !== teamId);
      if (selectedIssues.length === 0) {
        return existing;
      }
      return [...existing, { teamId, teamName, issues: selectedIssues, customNote }];
    });
  };

  const handleToggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
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

  // ── Team drill-down view ──
  if (selectedTeamId) {
    const selectedTeam = teams.find(t => t.team_id === selectedTeamId);
    const logoSrc = selectedTeam?.logo || getEspnLogoUrl(selectedTeamId);

    return (
      <div>
        {/* Back button */}
        <button
          onClick={() => { setSelectedTeamId(null); setSearchQuery(''); }}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-5 group transition-colors"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Teams
        </button>

        {/* Team header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 shrink-0 flex items-center justify-center">
            <Image
              src={logoSrc}
              alt={selectedTeam?.display_name ?? ''}
              width={64}
              height={64}
              className="object-contain"
              unoptimized
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{selectedTeam?.display_name}</h2>
            <p className="text-sm text-slate-400">{selectedTeam?.conference}</p>
          </div>
          <span className="ml-auto text-sm font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {(pitchersByTeam[selectedTeamId] || []).length} pitchers
          </span>
          <TeamIssueButton
            teamId={selectedTeamId}
            teamName={selectedTeam?.display_name ?? 'Unknown'}
            hasIssue={teamIssuesMap.has(selectedTeamId)}
            issueData={teamIssuesMap.get(selectedTeamId)}
            onIssueToggle={handleTeamIssueToggle}
          />
        </div>

        {/* Search + hand filter */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search pitchers..."
            className={cn(
              'flex-1 max-w-xs px-4 py-2 rounded-xl text-sm',
              'bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 shadow-sm'
            )}
          />
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
            hideConference
          />
        </div>

        {teamPitchers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">No pitchers found.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {teamPitchers.map((pitcher, i) => (
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

        <PitcherModal
          pitcher={selectedPitcher}
          onClose={() => setSelectedPitcher(null)}
          isFavorite={selectedPitcher ? favorites.includes(selectedPitcher.pitcher_id) : false}
          onToggleFavorite={handleToggleFavorite}
          hasIssue={selectedPitcher ? pitcherIssuesMap.has(`${selectedPitcher.team_id}:${selectedPitcher.pitcher_id}`) : false}
          issueData={selectedPitcher ? pitcherIssuesMap.get(`${selectedPitcher.team_id}:${selectedPitcher.pitcher_id}`) : undefined}
          onIssueToggle={handlePitcherIssueToggle}
        />
      </div>
    );
  }

  // ── Team tiles grid ──
  return (
    <div>
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
        hideHand
      />

      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{filteredTeams.length}</span> teams ·{' '}
          <span className="font-semibold text-slate-700">{pitchers.length.toLocaleString()}</span> pitchers tracked
          {favorites.length > 0 && (
            <span className="ml-2 text-yellow-600">· ★ {favorites.length} favorited</span>
          )}
        </p>
        {favorites.length === 0 && (
          <button
            onClick={handleImportFavorites}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 transition-colors disabled:opacity-50"
          >
            {importing ? 'Importing...' : '↑ Import saved favorites'}
          </button>
        )}
        {importResult && (
          <p className="text-xs text-slate-500 italic">{importResult}</p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filteredTeams.map(team => {
          const count = (pitchersByTeam[team.team_id] || []).length;
          const favCount = (pitchersByTeam[team.team_id] || []).filter(p => favorites.includes(p.pitcher_id)).length;
          const logoSrc = team.logo || getEspnLogoUrl(team.team_id);
          return (
            <button
              key={team.team_id}
              onClick={() => setSelectedTeamId(team.team_id)}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer text-center group"
            >
              <div className="w-14 h-14 flex items-center justify-center">
                <Image
                  src={logoSrc}
                  alt={team.display_name}
                  width={56}
                  height={56}
                  className="object-contain"
                  unoptimized
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <div className="min-w-0 w-full">
                <p className="text-xs font-semibold text-slate-700 leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {team.display_name}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{count} pitchers</p>
                {favCount > 0 && (
                  <p className="text-[10px] text-yellow-600 mt-0.5">★ {favCount} fav</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Team Issue Button Component
function TeamIssueButton({
  teamId,
  teamName,
  hasIssue,
  issueData,
  onIssueToggle,
}: {
  teamId: string;
  teamName: string;
  hasIssue: boolean;
  issueData?: TeamDataQualityIssue;
  onIssueToggle: (
    teamId: string,
    teamName: string,
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
    'Missing team logo',
    'Incomplete roster',
    'Wrong conference',
    'Missing pitcher data',
    'Incorrect team name',
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
    onIssueToggle(teamId, teamName, selectedIssues, customNote);
    setShowMenu(false);
  };

  const handleClear = () => {
    setSelectedIssues([]);
    setCustomNote('');
    setShowCustomInput(false);
    onIssueToggle(teamId, teamName, [], '');
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
          'p-2 rounded-lg transition-all',
          hasIssue
            ? 'bg-orange-500 text-white hover:bg-orange-600'
            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
        )}
        aria-label="Report team data quality issue"
        type="button"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <h3 className="text-lg font-semibold text-slate-900">Team Data Quality Issues</h3>
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
              <p className="text-sm text-slate-600 mt-2">{teamName}</p>
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
