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

/** Shareable link that auto-joins the sync space when opened fresh (no existing code). */
export function buildInviteUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}?code=${code}`;
}
