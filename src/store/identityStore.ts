import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface IdentityState {
  name: string | null;
  setIdentity: (name: string) => void;
  clearIdentity: () => void;
}

export const useIdentityStore = create<IdentityState>()(
  persist(
    (set) => ({
      name: null,
      setIdentity: (name) => set({ name: name.trim() }),
      clearIdentity: () => set({ name: null }),
    }),
    { name: 'ledger-identity' },
  ),
);
