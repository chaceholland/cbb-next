import { create } from 'zustand';

const MAX_COMPARISON_PITCHERS = 3;

interface Pitcher {
  pitcher_id: string;
  name: string;
  team_id: string;
}

interface ComparisonState {
  selectedPitchers: Pitcher[];
  isComparing: boolean;
  addPitcher: (pitcher: Pitcher) => void;
  removePitcher: (pitcherId: string) => void;
  clearSelection: () => void;
  setComparing: (comparing: boolean) => void;
  canAddMore: () => boolean;
}

export const useComparisonStore = create<ComparisonState>((set, get) => ({
  selectedPitchers: [],
  isComparing: false,
  addPitcher: (pitcher) =>
    set((state) => {
      if (state.selectedPitchers.length >= MAX_COMPARISON_PITCHERS) return state;
      if (state.selectedPitchers.some((p) => p.pitcher_id === pitcher.pitcher_id))
        return state;
      return { selectedPitchers: [...state.selectedPitchers, pitcher] };
    }),
  removePitcher: (pitcherId) =>
    set((state) => ({
      selectedPitchers: state.selectedPitchers.filter(
        (p) => p.pitcher_id !== pitcherId
      ),
    })),
  clearSelection: () => set({ selectedPitchers: [], isComparing: false }),
  setComparing: (comparing) => set({ isComparing: comparing }),
  canAddMore: () => get().selectedPitchers.length < MAX_COMPARISON_PITCHERS,
}));
