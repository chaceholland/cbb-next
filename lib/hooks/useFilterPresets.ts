import { useState, useEffect } from 'react';

export type WatchOrder = 'all' | 'unwatched' | 'watched' | 'finals' | 'upcoming' | 'favorites';
export type PitcherFilter = 'favorites-or-played' | 'favorites-only' | 'played-only' | 'all';

export type FilterPreset = {
  id: string;
  name: string;
  timestamp: number;
  filters: {
    conference: string;
    teamSearch: string;
    showFavorites: boolean;
    showIssuesOnly: boolean;
    watchOrder: WatchOrder;
    pitcherFilter: PitcherFilter;
    selectedWeeks?: number[]; // Optional for backward compatibility
  };
};

const STORAGE_KEY = 'cbb-filter-presets';

export function useFilterPresets() {
  const [presets, setPresets] = useState<FilterPreset[]>([]);

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPresets(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load filter presets:', error);
    }
  }, []);

  // Save presets to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    } catch (error) {
      console.error('Failed to save filter presets:', error);
    }
  }, [presets]);

  const savePreset = (name: string, filters: FilterPreset['filters']) => {
    const newPreset: FilterPreset = {
      id: `preset-${Date.now()}`,
      name,
      timestamp: Date.now(),
      filters,
    };
    setPresets(prev => [...prev, newPreset]);
    return newPreset;
  };

  const loadPreset = (id: string) => {
    return presets.find(p => p.id === id);
  };

  const deletePreset = (id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id));
  };

  const renamePreset = (id: string, newName: string) => {
    setPresets(prev => prev.map(p =>
      p.id === id ? { ...p, name: newName } : p
    ));
  };

  return {
    presets,
    savePreset,
    loadPreset,
    deletePreset,
    renamePreset,
  };
}
