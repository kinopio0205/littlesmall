const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Human-friendly random code (avoids ambiguous chars like 0/O, 1/I/L). */
export function generateSyncCode(length = 8): string {
  let code = '';
  for (let i = 0; i < length; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

export function normalizeSyncCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * 分享用的邀請網址。固定用網站根路徑（不受目前頁面路徑影響）。
 * 參數改名為 space；過渡期同時帶舊的 code，讓還在用舊版網頁的人也能加入。
 */
export function buildInviteUrl(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}?space=${code}&code=${code}`;
}
