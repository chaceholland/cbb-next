'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useFilterPresets, FilterPreset, WatchOrder, PitcherFilter } from '@/lib/hooks/useFilterPresets';
import { cn } from '@/lib/utils';
import { CONFERENCES } from '@/components/FilterPills';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Current filter state
  conference: string;
  teamSearch: string;
  showFavorites: boolean;
  showIssuesOnly: boolean;
  watchOrder: WatchOrder;
  pitcherFilter: PitcherFilter;
  // Callbacks to update filters
  onConferenceChange: (conf: string) => void;
  onTeamSearchChange: (search: string) => void;
  onShowFavoritesChange: (show: boolean) => void;
  onShowIssuesOnlyChange: (show: boolean) => void;
  onWatchOrderChange: (order: WatchOrder) => void;
  onPitcherFilterChange: (filter: PitcherFilter) => void;
}

export function FiltersModal({
  isOpen,
  onClose,
  conference,
  teamSearch,
  showFavorites,
  showIssuesOnly,
  watchOrder,
  pitcherFilter,
  onConferenceChange,
  onTeamSearchChange,
  onShowFavoritesChange,
  onShowIssuesOnlyChange,
  onWatchOrderChange,
  onPitcherFilterChange,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const { presets, savePreset, loadPreset, deletePreset } = useFilterPresets();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      alert('Please enter a preset name');
      return;
    }
    savePreset(presetName.trim(), {
      conference,
      teamSearch,
      showFavorites,
      showIssuesOnly,
      watchOrder,
      pitcherFilter,
    });
    setPresetName('');
    setShowSaveInput(false);
  };

  const handleLoadPreset = (id: string) => {
    const preset = loadPreset(id);
    if (preset) {
      onConferenceChange(preset.filters.conference);
      onTeamSearchChange(preset.filters.teamSearch);
      onShowFavoritesChange(preset.filters.showFavorites);
      onShowIssuesOnlyChange(preset.filters.showIssuesOnly);
      onWatchOrderChange(preset.filters.watchOrder);
      onPitcherFilterChange(preset.filters.pitcherFilter);
    }
  };

  const handleClearAllFilters = () => {
    onConferenceChange('All');
    onTeamSearchChange('');
    onShowFavoritesChange(false);
    onShowIssuesOnlyChange(false);
    onWatchOrderChange('all');
    onPitcherFilterChange('favorites-or-played');
  };

  if (!isOpen || !mounted) return null;

  const modal = createPortal(
    <AnimatePresence>
      {isOpen && (
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
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col pointer-events-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-800">Filters & Display Options</h2>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {/* Filter Presets */}
                <div className="mb-6 p-4 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-2xl border border-emerald-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      Filter Presets
                    </h3>
                    <button
                      onClick={() => setShowSaveInput(!showSaveInput)}
                      className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      Save Current
                    </button>
                  </div>

                  {showSaveInput && (
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={presetName}
                        onChange={e => setPresetName(e.target.value)}
                        placeholder="Preset name..."
                        className="flex-1 px-3 py-2 border border-emerald-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
                        autoFocus
                      />
                      <button
                        onClick={handleSavePreset}
                        className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setShowSaveInput(false); setPresetName(''); }}
                        className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {presets.length > 0 ? (
                    <div className="space-y-2">
                      {presets.map(preset => (
                        <div key={preset.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200">
                          <button
                            onClick={() => handleLoadPreset(preset.id)}
                            className="flex-1 text-left text-sm font-medium text-slate-700 hover:text-emerald-600 transition-colors"
                          >
                            {preset.name}
                          </button>
                          <button
                            onClick={() => deletePreset(preset.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Delete preset"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-emerald-600 italic text-center py-2">
                      No saved presets yet. Save your favorite filter combinations for quick access.
                    </p>
                  )}
                </div>

                {/* Watch Order */}
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Watch Order</h3>
                  <select
                    value={watchOrder}
                    onChange={e => onWatchOrderChange(e.target.value as WatchOrder)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="all">All games</option>
                    <option value="unwatched">Unwatched</option>
                    <option value="watched">Watched only</option>
                    <option value="finals">Finals Only</option>
                    <option value="upcoming">Upcoming Only</option>
                    <option value="favorites">Favorites Only</option>
                  </select>
                </div>

                {/* Pitcher Filter */}
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Pitchers</h3>
                  <select
                    value={pitcherFilter}
                    onChange={e => onPitcherFilterChange(e.target.value as PitcherFilter)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="favorites-or-played">Favorites or Played (Default)</option>
                    <option value="favorites-only">Favorites only</option>
                    <option value="played-only">Played only</option>
                    <option value="all">All pitchers</option>
                  </select>
                </div>

                {/* Quick Filters */}
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick Filters</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showFavorites}
                        onChange={e => onShowFavoritesChange(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700 font-medium">Show Favorites Only</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showIssuesOnly}
                        onChange={e => onShowIssuesOnlyChange(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm text-slate-700 font-medium">Show Issues Only</span>
                    </label>
                  </div>
                </div>

                {/* Team Search */}
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Search Teams</h3>
                  <input
                    type="text"
                    value={teamSearch}
                    onChange={e => onTeamSearchChange(e.target.value)}
                    placeholder="Search teams..."
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Conference Filter */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Conference</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onConferenceChange('All')}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => {
                          // Power 5: SEC, ACC, Big 12, Big Ten, Pac-12
                          const power5 = ['SEC', 'ACC', 'Big 12', 'Big Ten', 'Pac-12'];
                          if (power5.includes(conference)) {
                            onConferenceChange('All');
                          }
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Power 5
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {['All', ...CONFERENCES].map(conf => (
                      <button
                        key={conf}
                        onClick={() => onConferenceChange(conf)}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                          conference === conf
                            ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                        )}
                      >
                        {conf}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 shrink-0">
                <div className="flex gap-3">
                  <button
                    onClick={handleClearAllFilters}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Clear All Filters
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-600 transition-colors shadow-lg"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );

  return modal;
}
