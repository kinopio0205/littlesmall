import type { Liff } from '@line/liff';
import { LIFF_LOGIN_PENDING_KEY, buildCleanEntryUrl } from '../utils/invite';
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
    // 失敗時重試一次（網路或 LINE API 暫時性錯誤）。
    for (let attempt = 0; attempt < 2 && !profile; attempt++) {
      try {
        const p = await liff.getProfile();
        profile = { userId: p.userId, displayName: p.displayName };
      } catch (error) {
        console.warn(`LINE getProfile 失敗（第 ${attempt + 1} 次）：`, error);
      }
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

/**
 * 用 LINE 的「分享對象選擇器」傳送文字訊息。
 * 回傳 'sent'（已送出）或 'cancelled'（使用者關閉選擇器）；在選擇器出現前失敗則丟出錯誤，由呼叫端改用其他方式分享。
 */
export async function shareWithPicker(text: string): Promise<'sent' | 'cancelled'> {
  const liff = await initLiff();
  const result = await liff.shareTargetPicker([{ type: 'text', text }]);
  return result ? 'sent' : 'cancelled';
}

export const LIFF_LOGIN_REQUEST_KEY = 'liff-login-request';

/**
 * 從一般網址（沒有走 LINE 入口）要求用 LINE 登入：先轉到 LINE 入口網址（?src=liff&space=…），
 * 初始化後由 main.tsx 讀到這個旗標，自動呼叫 liff.login。
 * LINE 要求登入的回呼網址以 Endpoint URL 開頭，所以必須先回到入口網址再登入。
 */
export function startLineLoginFromBrowser(code: string) {
  try {
    sessionStorage.setItem(LIFF_LOGIN_REQUEST_KEY, '1');
  } catch {
    // 沒有 sessionStorage 時，轉過去後使用者再按一次「用 LINE 登入」即可
  }
  window.location.href = buildCleanEntryUrl(window.location.origin, import.meta.env.BASE_URL, code, true);
}

/** 讀取並清除「進入後自動 LINE 登入」的旗標。 */
export function consumeLoginRequest(): boolean {
  try {
    const requested = sessionStorage.getItem(LIFF_LOGIN_REQUEST_KEY) === '1';
    sessionStorage.removeItem(LIFF_LOGIN_REQUEST_KEY);
    return requested;
  } catch {
    return false;
  }
}
