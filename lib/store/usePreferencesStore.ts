import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
      addRecentSearch: (search) =>
        set((state) => ({
          recentSearches: [
            search,
            ...state.recentSearches.filter((s) => s !== search),
          ].slice(0, 5),
        })),
      clearRecentSearches: () => set({ recentSearches: [] }),
      dismissKeyboardHints: () => set({ showKeyboardHints: false }),
    }),
    { name: 'cbb-preferences' }
  )
);
