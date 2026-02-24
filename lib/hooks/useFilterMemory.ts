'use client';

import { useEffect, useState } from 'react';

export type FilterState = Record<string, any>;

interface UseFilterMemoryOptions {
  key: string; // Storage key (e.g., 'schedule-filters', 'roster-filters')
  defaultFilters: FilterState;
}

export function useFilterMemory({ key, defaultFilters }: UseFilterMemoryOptions) {
  const [filters, setFiltersState] = useState<FilterState>(defaultFilters);
  const [isRestored, setIsRestored] = useState(false);

  // Load filters from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`cbb-${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setFiltersState(parsed);
        setIsRestored(true);
        // Auto-dismiss restored notification after 3 seconds
        setTimeout(() => setIsRestored(false), 3000);
      }
    } catch (error) {
      console.error('Failed to load filters from localStorage:', error);
    }
  }, [key]);

  // Save filters to localStorage whenever they change
  const setFilters = (newFilters: FilterState | ((prev: FilterState) => FilterState)) => {
    setFiltersState((prev) => {
      const updated = typeof newFilters === 'function' ? newFilters(prev) : newFilters;
      try {
        localStorage.setItem(`cbb-${key}`, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save filters to localStorage:', error);
      }
      return updated;
    });
  };

  // Clear filters and storage
  const clearFilters = () => {
    setFiltersState(defaultFilters);
    try {
      localStorage.removeItem(`cbb-${key}`);
    } catch (error) {
      console.error('Failed to clear filters from localStorage:', error);
    }
  };

  return {
    filters,
    setFilters,
    clearFilters,
    isRestored,
    dismissRestored: () => setIsRestored(false),
  };
}
