import { create } from 'zustand';

interface PendingInviteState {
  pendingCode: string | null;
  setPending: (code: string) => void;
  clearPending: () => void;
}

/** Not persisted: an invite link opened while already in another space, waiting on a user decision. */
export const usePendingInviteStore = create<PendingInviteState>()((set) => ({
  pendingCode: null,
  setPending: (code) => set({ pendingCode: code }),
  clearPending: () => set({ pendingCode: null }),
}));
