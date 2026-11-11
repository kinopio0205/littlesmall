import { useSyncStore } from '../store/syncStore';
import { usePendingInviteStore } from '../store/pendingInviteStore';
import { useRecentSpacesStore } from '../store/lastSpaceStore';
import { useLiffStore } from '../store/liffStore';
import { normalizeSyncCode } from './syncCode';

const MIN_CODE_LENGTH = 4;

/** 把 search 拆成 [原始片段, 解碼後的 key]，保留原始字串以便不重新編碼。 */
function splitSearch(search: string): { raw: string; key: string }[] {
  const body = search.startsWith('?') ? search.slice(1) : search;
  if (!body) return [];
  return body.split('&').map((raw) => {
    const rawKey = raw.split('=')[0];
    let key = rawKey;
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    } catch {
      // 保留原始 key
    }
    return { raw, key };
  });
}

/** LINE 登入回呼或 LIFF 轉址時會出現的參數；有它們時，`code` 是 OAuth 授權碼而不是同步碼。 */
function hasLiffOrOAuthParams(params: URLSearchParams): boolean {
  for (const key of params.keys()) {
    if (key === 'state' || key === 'liffClientId' || key === 'liffRedirectUri' || key.startsWith('liff.')) return true;
  }
  return false;
}

function normalized(value: string | null): string | null {
  if (!value) return null;
  const code = normalizeSyncCode(value);
  return code.length >= MIN_CODE_LENGTH ? code : null;
}

/** 從網址讀出邀請的同步碼：優先 `space`；舊的 `code` 只在不是 LINE 登入回呼時才接受。 */
export function parseInvite(search: string): string | null {
  const params = new URLSearchParams(search);
  const space = normalized(params.get('space'));
  if (space) return space;
  if (hasLiffOrOAuthParams(params)) return null;
  return normalized(params.get('code'));
}

/** 略過 LINE 初始化時的後備：從 `liff.state`（LIFF URL 後面的路徑與參數）讀出 space。 */
export function parseInviteFromLiffState(search: string): string | null {
  const state = new URLSearchParams(search).get('liff.state');
  if (!state) return null;
  const queryIndex = state.indexOf('?');
  if (queryIndex < 0) return null;
  return normalized(new URLSearchParams(state.slice(queryIndex)).get('space'));
}

/**
 * 只刪掉自己的邀請參數（space，以及「不是 OAuth 回呼時」的 code），其他參數保持原本的順序與編碼。
 * LINE 的 redirectUri 必須以 Endpoint URL 開頭，重排或重新編碼可能讓之後的登入失敗。
 */
export function stripInviteParams(search: string): string {
  const keepOAuthCode = hasLiffOrOAuthParams(new URLSearchParams(search));
  const kept = splitSearch(search).filter(({ key }) => key !== 'space' && (keepOAuthCode || key !== 'code'));
  return kept.length ? `?${kept.map((p) => p.raw).join('&')}` : '';
}

/**
 * 重新進站用的乾淨網址：只留 space（以及要繼續走 LINE 時的 src=liff），
 * 丟掉 liff.*、OAuth 回呼參數與 hash 中的 LINE 憑證。
 */
export function buildCleanEntryUrl(origin: string, basePath: string, space: string | null, keepLiff: boolean): string {
  const params: string[] = [];
  if (keepLiff) params.push('src=liff');
  if (space) params.push(`space=${encodeURIComponent(space)}`);
  return `${origin}${basePath}${params.length ? `?${params.join('&')}` : ''}`;
}

/** LINE 登入被取消或失敗時的回呼（liff.init 會因此拋錯）。 */
export function hasOAuthError(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has('liffOAuth2Error') || params.has('error');
}

const LIFF_HASH_CREDENTIAL_KEYS = ['access_token', 'context_token', 'feature_token', 'id_token', 'client_id'];

/** LIFF 會把憑證放在 hash；init 沒完成就不會清掉，HashRouter 會把它誤當成路由。 */
export function hashHasLiffCredentials(hash: string): boolean {
  if (!hash || hash.startsWith('#/')) return false;
  const params = new URLSearchParams(hash.slice(1));
  return LIFF_HASH_CREDENTIAL_KEYS.some((key) => params.has(key));
}

export const LIFF_LOGIN_PENDING_KEY = 'liff-login-pending';

/** 這次載入是不是從 LINE（LIFF URL 或 LINE 登入回呼）進來的。init 之前只讀網址，不修改。 */
export function isLiffEntry(search: string, loginPending: boolean): boolean {
  if (loginPending) return true;
  const params = new URLSearchParams(search);
  if (params.get('src') === 'liff') return true;
  for (const key of params.keys()) {
    if (key === 'liffClientId' || key === 'liffRedirectUri' || key.startsWith('liff.')) return true;
  }
  return false;
}

/**
 * 套用邀請：
 * - 還沒有空間：直接加入。
 * - 是目前的空間：不做事。
 * - 是別的空間：從 LINE App 內點進來時直接切換（可在畫面上返回）；否則先跳確認橫幅。
 */
export function applyInvite(space: string, fromLine: boolean) {
  function apply() {
    const currentCode = useSyncStore.getState().code;
    if (!currentCode) {
      useSyncStore.getState().setCode(space);
    } else if (space !== currentCode) {
      // 從 LINE App 內點連結：直接切換，畫面上可返回。其他情況先跳確認橫幅（Layout 與身分選擇畫面都會顯示）。
      if (fromLine) {
        // 名單此時尚未載入；沿用最近空間清單中記住的名字（App 會在選定身分後隨時更新）。
        useRecentSpacesStore.getState().rememberSpace(currentCode);
        useLiffStore.getState().setSwitched({ from: currentCode, to: space });
        useSyncStore.getState().setCode(space);
      } else {
        usePendingInviteStore.getState().setPending(space);
      }
    }
  }

  // 等 localStorage 中的同步碼載入完成，才能判斷「是否已在某個空間」。
  if (useSyncStore.persist.hasHydrated()) {
    apply();
  } else {
    const unsub = useSyncStore.persist.onFinishHydration(() => {
      apply();
      unsub();
    });
  }
}
