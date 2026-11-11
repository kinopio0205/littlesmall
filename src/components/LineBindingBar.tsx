import { useEffect, useState } from 'react';
import { useBindingStore } from '../store/bindingStore';
import { useIdentityStore } from '../store/identityStore';
import { useLiffStore } from '../store/liffStore';
import { useSyncStore } from '../store/syncStore';
import { useMyMember } from '../hooks/useMyMember';
import { BindingTakenError, bindMember } from '../sync/lineBindingSync';
import { findMyBinding } from '../utils/lineIdentity';

const NOTICE_MS = 5000;

/** 主畫面上方的 LINE 提示：一次性訊息，以及「要把 LINE 綁定到目前身分嗎？」的建議。 */
export default function LineBindingBar() {
  const code = useSyncStore((s) => s.code);
  const myMember = useMyMember();
  const lineProfile = useLiffStore((s) => s.profile);
  const myLineKey = useBindingStore((s) => (s.code === code && s.ready ? s.myLineKey : null));
  const bindings = useBindingStore((s) => s.bindings);
  const skipped = useBindingStore((s) => (code ? !!s.skippedCodes[code] : false));
  const setSkipped = useBindingStore((s) => s.setSkipped);
  const notice = useBindingStore((s) => s.notice);
  const setNotice = useBindingStore((s) => s.setNotice);
  const noLineAsk = useIdentityStore((s) => (code ? !!s.noLineAskByCode?.[code] : false));
  const setNoLineAsk = useIdentityStore((s) => s.setNoLineAsk);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);

  const mine = findMyBinding(bindings, myLineKey);
  const suggest =
    !!code &&
    !!lineProfile &&
    !!myLineKey &&
    !!myMember &&
    !mine &&
    !bindings[myMember.id] &&
    !noLineAsk &&
    !skipped;

  async function bindCurrent() {
    if (!code || !myMember || !myLineKey) return;
    setBusy(true);
    try {
      await bindMember(code, myMember.id, myMember.name, myLineKey);
      setNotice(`已綁定 LINE：${myMember.name}，下次從 LINE 開啟會自動辨識`);
    } catch (e) {
      setNotice(
        e instanceof BindingTakenError ? `「${myMember.name}」已被其他 LINE 帳號綁定` : 'LINE 綁定未儲存，請稍後再試',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!notice && !suggest) return null;

  return (
    <div className="bg-emerald-500/10 border-b border-emerald-400/20">
      {notice && (
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 px-4 py-2 text-sm">
          <span className="text-emerald-200">{notice}</span>
          <button onClick={() => setNotice(null)} className="text-xs text-slate-400 hover:text-slate-200" aria-label="關閉">
            ✕
          </button>
        </div>
      )}
      {suggest && myMember && (
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
          <span className="text-emerald-200">要把這個 LINE 帳號綁定到「{myMember.name}」嗎？下次從 LINE 開啟會自動辨識。</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              disabled={busy}
              onClick={() => void bindCurrent()}
              className="text-xs px-3 py-1.5 rounded-full bg-[#06C755] text-white hover:brightness-110 disabled:opacity-40"
            >
              綁定
            </button>
            <button
              onClick={() => code && setNoLineAsk(code)}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:text-slate-200"
            >
              不再詢問
            </button>
            <button
              onClick={() => code && setSkipped(code)}
              className="text-xs text-slate-400 hover:text-slate-200"
              aria-label="這次先不要"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
