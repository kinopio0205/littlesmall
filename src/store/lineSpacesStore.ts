import { create } from 'zustand';
import type { LineSpaceMap } from '../sync/lineSpacesSync';

/** 規則限制清單最多 100 個空間；超過就不再新增（避免本機顯示已加入、雲端卻被拒絕）。 */
export const MAX_LINE_SPACES = 100;

interface LineSpacesState {
  /** 目前 LINE 帳號的清單文件 id（SHA-256），沒登入 LINE 時為 null。 */
  key: string | null;
  loaded: boolean;
  /** 讀取清單失敗（離線、規則未設定等）。仍可新增空間，但畫面要提示並可重試。 */
  failed: boolean;
  /** 每次要求重新讀取時遞增。 */
  retryToken: number;
  spaces: LineSpaceMap;
  setLoaded: (key: string, spaces: LineSpaceMap) => void;
  setFailed: (key: string | null) => void;
  retry: () => void;
  setEntry: (code: string, memberName: string) => void;
  removeEntry: (code: string) => void;
  reset: () => void;
}

// 不 persist：以雲端為準，每次登入 LINE 後重新讀取。
export const useLineSpacesStore = create<LineSpacesState>()((set) => ({
  key: null,
  loaded: false,
  failed: false,
  retryToken: 0,
  spaces: {},
  setLoaded: (key, spaces) => set({ key, spaces, loaded: true, failed: false }),
  setFailed: (key) => set({ key, loaded: false, failed: true }),
  retry: () => set((s) => ({ failed: false, retryToken: s.retryToken + 1 })),
  setEntry: (code, memberName) =>
    set((s) => ({ spaces: { ...s.spaces, [code]: { memberName, updatedAt: new Date().toISOString() } } })),
  removeEntry: (code) =>
    set((s) => {
      const spaces = { ...s.spaces };
      delete spaces[code];
      return { spaces };
    }),
  reset: () => set({ key: null, loaded: false, failed: false, spaces: {} }),
}));
