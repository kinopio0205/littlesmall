import { usePendingInviteStore } from '../store/pendingInviteStore';
import { useRecentSpacesStore } from '../store/lastSpaceStore';
import { useSyncStore } from '../store/syncStore';
import { useMyMember } from '../hooks/useMyMember';

/** 已在某個空間時開了別的空間的邀請連結：讓使用者決定要不要切換。主畫面與身分選擇畫面都會顯示。 */
export default function PendingInviteBanner({ className = '' }: { className?: string }) {
  const code = useSyncStore((s) => s.code);
  const setCode = useSyncStore((s) => s.setCode);
  const myMember = useMyMember();
  const rememberSpace = useRecentSpacesStore((s) => s.rememberSpace);
  const pendingCode = usePendingInviteStore((s) => s.pendingCode);
  const clearPendingInvite = usePendingInviteStore((s) => s.clearPending);

  if (!pendingCode || pendingCode === code) return null;

  function acceptInvite() {
    if (!pendingCode) return;
    // 身分依空間記在 identityStore.byCode，切換空間不需要清除；回來時會自動沿用。
    if (code) rememberSpace(code, myMember?.name);
    setCode(pendingCode);
    clearPendingInvite();
  }

  return (
    <div className={`bg-cyan-500/10 border-cyan-400/20 ${className}`}>
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
        <span className="text-cyan-200">
          有邀請連結想加入分帳空間 <span className="font-mono">{pendingCode}</span>
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={acceptInvite}
            className="text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-violet-600 text-white hover:from-cyan-400 hover:to-violet-500"
          >
            切換過去
          </button>
          <button
            onClick={clearPendingInvite}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:text-slate-200"
          >
            忽略
          </button>
        </div>
      </div>
    </div>
  );
}
