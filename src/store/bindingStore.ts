import { create } from 'zustand';
import type { BindingMap } from '../utils/lineIdentity';

interface BindingState {
  /** 目前監聽的空間。 */
  code: string | null;
  /** 這個 LINE 帳號在目前空間的 lineKey（SHA-256 雜湊）。 */
  myLineKey: string | null;
  /** memberId → 綁定。 */
  bindings: BindingMap;
  /** 綁定清單第一次從伺服器載入完成。 */
  ready: boolean;
  /** 本次工作階段手動切換過身分的空間：不再自動設回綁定的成員。 */
  overriddenCodes: Record<string, true>;
  /** 本次工作階段選了「這次先不綁定」的空間。 */
  skippedCodes: Record<string, true>;
  /** 一次性的提示訊息（例如「已用 LINE 自動辨識」）。 */
  notice: string | null;
  /** 主帳本（名單）已載入的空間；與綁定清單都到齊才決定身分。 */
  rosterReadyCode: string | null;

  reset: (code: string | null, myLineKey: string | null) => void;
  setRosterReady: (code: string | null) => void;
  setBindings: (bindings: BindingMap) => void;
  setOverridden: (code: string) => void;
  setSkipped: (code: string) => void;
  setNotice: (notice: string | null) => void;
}

// 不 persist：綁定以 Firestore 為準，工作階段旗標只在這次開啟有效。
export const useBindingStore = create<BindingState>()((set) => ({
  code: null,
  myLineKey: null,
  bindings: {},
  ready: false,
  overriddenCodes: {},
  skippedCodes: {},
  notice: null,
  rosterReadyCode: null,
  reset: (code, myLineKey) => set({ code, myLineKey, bindings: {}, ready: false }),
  setRosterReady: (code) => set({ rosterReadyCode: code }),
  setBindings: (bindings) => set({ bindings, ready: true }),
  setOverridden: (code) => set((s) => ({ overriddenCodes: { ...s.overriddenCodes, [code]: true } })),
  setSkipped: (code) => set((s) => ({ skippedCodes: { ...s.skippedCodes, [code]: true } })),
  setNotice: (notice) => set({ notice }),
}));
