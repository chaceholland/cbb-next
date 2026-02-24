import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_RECENT_SEARCHES = 5;

export type Theme = 'light' | 'dark' | 'system';
export type View = 'schedule' | 'rosters' | 'analytics';

interface PreferencesState {
  theme: Theme;
  defaultView: View;
  recentSearches: string[];
  showKeyboardHints: boolean;
  setTheme: (theme: Theme) => void;
  setDefaultView: (view: View) => void;
  addRecentSearch: (search: string) => void;
  clearRecentSearches: () => void;
  dismissKeyboardHints: () => void;
  setShowKeyboardHints: (show: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'light',
      defaultView: 'schedule',
      recentSearches: [],
      showKeyboardHints: true,
      setTheme: (theme) => set({ theme }),
      setDefaultView: (view) => set({ defaultView: view }),
      addRecentSearch: (search) => {
        if (!search || !search.trim()) return;
        set((state) => ({
          recentSearches: [
            search,
            ...state.recentSearches.filter((s) => s !== search),
          ].slice(0, MAX_RECENT_SEARCHES),
        }));
      },
      clearRecentSearches: () => set({ recentSearches: [] }),
      dismissKeyboardHints: () => set({ showKeyboardHints: false }),
      setShowKeyboardHints: (show) => set({ showKeyboardHints: show }),
    }),
    { name: 'cbb-preferences' }
  )
);
