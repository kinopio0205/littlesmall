import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SyncState {
  code: string | null;
  setCode: (code: string) => void;
  clearCode: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      code: null,
      setCode: (code) => set({ code }),
      clearCode: () => set({ code: null }),
    }),
    { name: 'ledger-sync-code' },
  ),
);
