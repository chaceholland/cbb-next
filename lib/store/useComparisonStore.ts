import { create } from 'zustand';

interface Pitcher {
  pitcher_id: string;
  name: string;
  team_id: string;
}

interface ComparisonState {
  selectedPitchers: Pitcher[];
  addPitcher: (pitcher: Pitcher) => void;
  removePitcher: (pitcherId: string) => void;
  clearSelection: () => void;
  canAddMore: () => boolean;
}

export const useComparisonStore = create<ComparisonState>((set, get) => ({
  selectedPitchers: [],
  addPitcher: (pitcher) =>
    set((state) => {
      if (state.selectedPitchers.length >= 3) return state;
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
  clearSelection: () => set({ selectedPitchers: [] }),
  canAddMore: () => get().selectedPitchers.length < 3,
}));
