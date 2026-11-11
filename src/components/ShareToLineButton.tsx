import { useState } from 'react';
import { useLiffStore } from '../store/liffStore';
import { useBindingStore } from '../store/bindingStore';
import { LIFF_ID, shareWithPicker } from '../liff/liffClient';
import { buildInviteUrl } from '../utils/syncCode';
import { buildLineShareUrl, buildLiffInviteUrl, buildShareText, isMobileDevice } from '../utils/share';

/**
 * 「分享到 LINE」：
 * - 在 LINE 內（或外部瀏覽器已登入 LINE）且可用時：開啟 LINE 的分享對象選擇器。
 * - 手機：開啟 LINE 的分享網址（line.me/R/share）。
 * - 桌機（含 LINE PC 版）：line.me/R/share 不支援，改為複製邀請訊息，請使用者貼到 LINE。
 * - 選擇器開不起來：同樣改為複製邀請訊息，不離開目前頁面。
 * 邀請連結優先用 LINE MINI App 連結，從 LINE 開啟可自動辨識身分。
 */
export default function ShareToLineButton({ code }: { code: string }) {
  const mode = useLiffStore((s) => s.mode);
  const canShare = useLiffStore((s) => s.canShare);
  const setNotice = useBindingStore((s) => s.setNotice);
  const [busy, setBusy] = useState(false);

  const inviteUrl = LIFF_ID ? buildLiffInviteUrl(LIFF_ID, code) : buildInviteUrl(code);
  const text = buildShareText(inviteUrl);
  const usePicker = canShare && (mode === 'client' || mode === 'external-loggedin');
  const mobile = isMobileDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0);

  async function copyMessage(prefix: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${prefix}已複製邀請訊息，請貼到 LINE 傳給朋友`);
    } catch {
      setNotice(`${prefix}請用旁邊的 🔗 複製邀請連結，貼到 LINE 傳給朋友`);
    }
  }

  async function share() {
    if (!usePicker) {
      if (mobile) {
        window.open(buildLineShareUrl(text), '_blank', 'noopener,noreferrer');
      } else {
        await copyMessage('');
      }
      return;
    }
    setBusy(true);
    try {
      const result = await shareWithPicker(text);
      if (result === 'sent') setNotice('已分享邀請到 LINE');
      // 使用者關閉選擇器：不顯示任何訊息。
    } catch (error) {
      console.warn('LINE 分享選擇器無法使用：', error);
      await copyMessage('無法開啟 LINE 分享，');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={() => void share()}
      disabled={busy}
      className="text-[11px] font-semibold text-white bg-[#06C755] rounded-full px-2 h-6 flex items-center hover:brightness-110 disabled:opacity-50"
      title={usePicker || mobile ? '分享邀請到 LINE' : '複製邀請訊息（貼到 LINE）'}
      aria-label="分享邀請到 LINE"
    >
      LINE
    </button>
  );
}
