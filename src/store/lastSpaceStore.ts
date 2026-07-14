import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LastSpace {
  code: string;
  identity: string;
}

interface LastSpaceState {
  lastSpace: LastSpace | null;
  setLastSpace: (space: LastSpace) => void;
  clearLastSpace: () => void;
}

export const useLastSpaceStore = create<LastSpaceState>()(
  persist(
    (set) => ({
      lastSpace: null,
      setLastSpace: (space) => set({ lastSpace: space }),
      clearLastSpace: () => set({ lastSpace: null }),
    }),
    { name: 'ledger-last-space' },
  ),
);
