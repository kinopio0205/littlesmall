import type { Liff } from '@line/liff';
import { LIFF_LOGIN_PENDING_KEY } from '../utils/invite';
import type { LiffMode, LineProfile } from '../store/liffStore';

// 整個 app 只有這個檔案載入 @line/liff；只在從 LINE 進來時才動態載入，一般瀏覽不會下載 SDK。
export const LIFF_ID: string | undefined = import.meta.env.VITE_LIFF_ID || undefined;

let liffPromise: Promise<Liff> | null = null;

/** 只 init 一次（StrictMode 或重複呼叫都共用同一個 Promise）。 */
export function initLiff(): Promise<Liff> {
  if (!LIFF_ID) return Promise.reject(new Error('LIFF ID 未設定'));
  if (!liffPromise) {
    liffPromise = import('@line/liff').then(async ({ default: liff }) => {
      await liff.init({ liffId: LIFF_ID, withLoginOnExternalBrowser: false });
      return liff;
    });
  }
  return liffPromise;
}

export interface LiffSnapshot {
  mode: LiffMode;
  profile: LineProfile | null;
  canShare: boolean;
}

/** init 完成後讀出目前的 LINE 狀態；個人資料只回傳 userId 與顯示名稱，不保存其他欄位。 */
export async function readLiffState(liff: Liff): Promise<LiffSnapshot> {
  const inClient = liff.isInClient();
  const loggedIn = liff.isLoggedIn();
  let profile: LineProfile | null = null;
  if (loggedIn) {
    try {
      const p = await liff.getProfile();
      profile = { userId: p.userId, displayName: p.displayName };
    } catch (error) {
      console.warn('LINE getProfile 失敗：', error);
    }
  }
  let canShare = false;
  try {
    canShare = liff.isApiAvailable('shareTargetPicker');
  } catch {
    canShare = false;
  }
  return {
    mode: inClient ? 'client' : loggedIn ? 'external-loggedin' : 'external-guest',
    profile,
    canShare,
  };
}

/** 一般瀏覽器中按「用 LINE 登入」；登入後會回到目前網址，由 init 完成登入。 */
export async function loginWithLine() {
  const liff = await initLiff();
  try {
    sessionStorage.setItem(LIFF_LOGIN_PENDING_KEY, '1');
  } catch {
    // sessionStorage 不可用時仍嘗試登入；回來時靠網址上的 liffClientId 判斷
  }
  liff.login({ redirectUri: window.location.href });
}

export function clearLoginPending() {
  try {
    sessionStorage.removeItem(LIFF_LOGIN_PENDING_KEY);
  } catch {
    // 忽略
  }
}

export function readLoginPending(): boolean {
  try {
    return sessionStorage.getItem(LIFF_LOGIN_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}
