/** 從 LINE 開啟的邀請連結（LINE MINI App）：點開即可加入空間，並能用 LINE 自動辨識身分。 */
export function buildLiffInviteUrl(liffId: string, code: string): string {
  return `https://miniapp.line.me/${liffId}?space=${encodeURIComponent(code)}`;
}

export function buildShareText(inviteUrl: string): string {
  return `來「小呆記帳」一起分帳吧！點連結加入分帳空間：\n${inviteUrl}`;
}

/** LINE 官方的分享網址：在一般瀏覽器或不能用 shareTargetPicker 時，開啟 LINE 選擇要傳給誰。 */
export function buildLineShareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}

/** line.me/R/share 只支援 iOS／Android 的 LINE；桌機（含 LINE PC 版）會被導到 LINE 首頁、分享內容遺失。 */
export function isMobileDevice(userAgent: string, maxTouchPoints: number): boolean {
  if (/Android|iPhone|iPad|iPod/i.test(userAgent)) return true;
  // iPadOS 預設用桌面版 UA（Macintosh），以觸控點數辨識。
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}
