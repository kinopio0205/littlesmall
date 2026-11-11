import { create } from 'zustand';
import type { BindingMap } from '../utils/lineIdentity';

interface BindingState {
  /** 目前監聽的空間。 */
  code: string | null;
  /** 這個 LINE 帳號在目前空間的 lineKey（SHA-256 雜湊）。 */
  myLineKey: string | null;
  /** memberId → 綁定。 */
  bindings: BindingMap;
  /** 綁定清單第一次從伺服器載入完成（或讀取失敗、以空清單放行）。 */
  ready: boolean;
  /** 綁定清單讀取失敗（例如規則未設定）：bindings 為空但不代表「沒有綁定」，不能據此刪除或強制綁定。 */
  error: boolean;
  /** 本次工作階段手動切換過身分的空間：不再自動設回綁定的成員。 */
  overriddenCodes: Record<string, true>;
  /** 本次工作階段綁定寫入失敗的空間：允許暫時進入，不強制綁定。 */
  bindFailedCodes: Record<string, true>;
  /** 本次工作階段選了「這次先不綁定」的空間。 */
  skippedCodes: Record<string, true>;
  /** 一次性的提示訊息（例如「已用 LINE 自動辨識」）。 */
  notice: string | null;
  /** 主帳本（名單）已載入的空間；與綁定清單都到齊才決定身分。 */
  rosterReadyCode: string | null;

  reset: (code: string | null, myLineKey: string | null) => void;
  setRosterReady: (code: string | null) => void;
  setBindings: (bindings: BindingMap) => void;
  setBindingsError: () => void;
  setOverridden: (code: string) => void;
  setSkipped: (code: string) => void;
  setBindFailed: (code: string) => void;
  setNotice: (notice: string | null) => void;
}

// 不 persist：綁定以 Firestore 為準，工作階段旗標只在這次開啟有效。
export const useBindingStore = create<BindingState>()((set) => ({
  code: null,
  myLineKey: null,
  bindings: {},
  ready: false,
  error: false,
  overriddenCodes: {},
  skippedCodes: {},
  bindFailedCodes: {},
  notice: null,
  rosterReadyCode: null,
  reset: (code, myLineKey) => set({ code, myLineKey, bindings: {}, ready: false, error: false }),
  setRosterReady: (code) => set({ rosterReadyCode: code }),
  setBindings: (bindings) => set({ bindings, ready: true, error: false }),
  setBindingsError: () => set({ bindings: {}, ready: true, error: true }),
  setOverridden: (code) => set((s) => ({ overriddenCodes: { ...s.overriddenCodes, [code]: true } })),
  setSkipped: (code) => set((s) => ({ skippedCodes: { ...s.skippedCodes, [code]: true } })),
  setBindFailed: (code) => set((s) => ({ bindFailedCodes: { ...s.bindFailedCodes, [code]: true } })),
  setNotice: (notice) => set({ notice }),
}));
