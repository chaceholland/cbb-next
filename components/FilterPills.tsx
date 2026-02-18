'use client';

import { cn } from '@/lib/utils';

interface PillProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}

function Pill({ label, count, active, onClick }: PillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200',
        'font-medium text-sm whitespace-nowrap',
        active
          ? 'bg-gradient-to-r from-[#1a73e8] to-[#ea4335] text-white shadow-lg shadow-blue-500/30'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
      )}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full border',
            active
              ? 'bg-white/20 text-white border-white/30'
              : 'bg-slate-200 text-slate-600 border-slate-300'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// Conferences for the 64 tracked teams
export const CONFERENCES = ['SEC', 'ACC', 'Big 12', 'Big Ten', 'Pac-12', 'American', 'Sun Belt', 'C-USA', 'Mountain West', 'MAC', 'Other'];

interface RosterFilterPillsProps {
  conference: string;
  hand: string;
  showFavorites: boolean;
  conferenceCounts: Record<string, number>;
  handCounts: Record<string, number>;
  totalCount: number;
  favoritesCount: number;
  onConferenceChange: (conf: string) => void;
  onHandChange: (hand: string) => void;
  onFavoritesToggle: () => void;
}

export function RosterFilterPills({
  conference,
  hand,
  showFavorites,
  conferenceCounts,
  handCounts,
  totalCount,
  favoritesCount,
  onConferenceChange,
  onHandChange,
  onFavoritesToggle,
}: RosterFilterPillsProps) {
  const conferenceOptions = ['All', ...CONFERENCES];

  return (
    <div className="space-y-4 py-4">
      {/* Conference Filter */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Conference</h3>
        <div className="flex gap-2 overflow-x-auto pb-2 flex-wrap">
          {conferenceOptions.map(conf => (
            <Pill
              key={conf}
              label={conf}
              count={conf === 'All' ? totalCount : conferenceCounts[conf]}
              active={conference === conf}
              onClick={() => onConferenceChange(conf)}
            />
          ))}
        </div>
      </div>

      {/* Hand Filter */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Throws</h3>
        <div className="flex gap-2">
          {['All', 'RHP', 'LHP'].map(h => (
            <Pill
              key={h}
              label={h}
              count={handCounts[h]}
              active={hand === h}
              onClick={() => onHandChange(h)}
            />
          ))}
        </div>
      </div>

      {/* Favorites Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onFavoritesToggle}
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
          Favorites
          {favoritesCount > 0 && (
            <span className={cn('text-xs px-2 py-0.5 rounded-full border', showFavorites ? 'bg-white/20 text-white border-white/30' : 'bg-slate-200 text-slate-600 border-slate-300')}>
              {favoritesCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

interface ScheduleFilterPillsProps {
  conference: string;
  conferenceCounts: Record<string, number>;
  totalCount: number;
  onConferenceChange: (conf: string) => void;
}

export function ScheduleFilterPills({
  conference,
  conferenceCounts,
  totalCount,
  onConferenceChange,
}: ScheduleFilterPillsProps) {
  const conferenceOptions = ['All', ...CONFERENCES];

  return (
    <div className="space-y-2 py-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Conference</h3>
      <div className="flex gap-2 overflow-x-auto pb-2 flex-wrap">
        {conferenceOptions.map(conf => (
          <Pill
            key={conf}
            label={conf}
            count={conf === 'All' ? totalCount : conferenceCounts[conf]}
            active={conference === conf}
            onClick={() => onConferenceChange(conf)}
          />
        ))}
      </div>
    </div>
  );
}
