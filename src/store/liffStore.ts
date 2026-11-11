import { create } from 'zustand';

/**
 * - off：不是從 LINE 進來，或沒有設定 LIFF ID。
 * - client：在 LINE App 內開啟。
 * - external-guest：在一般瀏覽器開啟 LIFF 網址，尚未登入 LINE。
 * - external-loggedin：在一般瀏覽器開啟，已登入 LINE。
 */
export type LiffMode = 'off' | 'client' | 'external-guest' | 'external-loggedin';

export interface LineProfile {
  userId: string;
  displayName: string;
}

interface LiffState {
  mode: LiffMode;
  /** 只放在記憶體，不寫入 localStorage 或 Firestore。 */
  profile: LineProfile | null;
  canShare: boolean;
  /** 從 LINE 點邀請連結直接切換空間時的來源與目標（只在目標空間顯示「回到上一個空間」）。 */
  switched: { from: string; to: string } | null;
  setLiff: (state: { mode: LiffMode; profile: LineProfile | null; canShare: boolean }) => void;
  setSwitched: (switched: { from: string; to: string } | null) => void;
}

// 不 persist：LINE 狀態每次載入時由 liff.init 重新決定。
export const useLiffStore = create<LiffState>()((set) => ({
  mode: 'off',
  profile: null,
  canShare: false,
  switched: null,
  setLiff: (state) => set(state),
  setSwitched: (switched) => set({ switched }),
}));
