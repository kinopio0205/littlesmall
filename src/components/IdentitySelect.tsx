import { useState } from 'react';
import clsx from 'clsx';
import { useGroupStore } from '../store/groupStore';
import { useIdentityStore } from '../store/identityStore';
import { useSyncStore } from '../store/syncStore';
import { useLiffStore } from '../store/liffStore';
import { useBindingStore } from '../store/bindingStore';
import { LIFF_ID, loginWithLine, startLineLoginFromBrowser } from '../liff/liffClient';
import { BindingTakenError, bindMember } from '../sync/lineBindingSync';
import { findMyBinding, isLockedForMe, suggestMemberForLineName } from '../utils/lineIdentity';
import Logo from './Logo';
import PendingInviteBanner from './PendingInviteBanner';

export default function IdentitySelect() {
  const roster = useGroupStore((s) => s.members);
  const addRosterMemberStrict = useGroupStore((s) => s.addRosterMemberStrict);
  const code = useSyncStore((s) => s.code);
  const setCode = useSyncStore((s) => s.setCode);
  const setMember = useIdentityStore((s) => s.setMember);
  const noLineAsk = useIdentityStore((s) => (code ? !!s.noLineAskByCode?.[code] : false));
  const setNoLineAsk = useIdentityStore((s) => s.setNoLineAsk);
  const switched = useLiffStore((s) => s.switched);
  const setSwitched = useLiffStore((s) => s.setSwitched);
  const switchedFrom = switched && switched.to === code ? switched.from : null;
  const liffMode = useLiffStore((s) => s.mode);
  const lineProfile = useLiffStore((s) => s.profile);
  const myLineKey = useBindingStore((s) => (s.code === code && s.ready ? s.myLineKey : null));
  const bindings = useBindingStore((s) => s.bindings);
  const skipped = useBindingStore((s) => (code ? !!s.skippedCodes[code] : false));
  const setSkipped = useBindingStore((s) => s.setSkipped);
  const setNotice = useBindingStore((s) => s.setNotice);
  const notice = useBindingStore((s) => s.notice);

  // 已登入 LINE、這個 LINE 帳號在此空間還沒綁定、也沒選「先不綁定／不再詢問」：選身分的同時綁定 LINE。
  // 已有綁定（例如手動切換身分但保留綁定）時只切換身分，不改綁。
  const alreadyBound = !!findMyBinding(bindings, myLineKey);
  const bindMode = !!lineProfile && !!myLineKey && !alreadyBound && !noLineAsk && !skipped;

  const [name, setName] = useState(() => (bindMode && lineProfile ? lineProfile.displayName : ''));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const knownMembers = [...roster].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  // 身分鎖定：已綁定 LINE、但不是綁在目前登入的 LINE 帳號（或沒登入 LINE）的成員，不能手動選。
  // 已登入 LINE 但讀不到個人資料時無法判斷是不是本人，先不鎖定（與 App 的判斷一致），並提示重新載入。
  const lineProfileMissing = (liffMode === 'client' || liffMode === 'external-loggedin') && !lineProfile;
  const locked = (memberId: string) => !lineProfileMissing && isLockedForMe(memberId, bindings, myLineKey);
  const anyLocked = roster.some((m) => locked(m.id));
  const suggested = bindMode && lineProfile ? suggestMemberForLineName(roster, bindings, lineProfile.displayName) : undefined;

  /** 綁定（在綁定模式下）後設定身分。綁定寫入失敗時仍讓使用者進入，只提示沒存到。 */
  async function enter(memberId: string, memberName: string) {
    if (!code) return;
    if (bindMode && myLineKey) {
      setBusy(true);
      try {
        await bindMember(code, memberId, memberName, myLineKey);
        setNotice(`已綁定 LINE：${memberName}，下次從 LINE 開啟會自動辨識`);
      } catch (e) {
        setBusy(false);
        if (e instanceof BindingTakenError) {
          setError(`「${memberName}」剛被其他 LINE 帳號綁定，請選擇其他成員。`);
          return;
        }
        console.error('LINE 綁定失敗：', e);
        setNotice('LINE 綁定未儲存，下次可能需要重新選擇身分');
      }
      setBusy(false);
    }
    setMember(code, memberId);
  }

  function joinAsNew(n: string) {
    if (!code || !n.trim() || busy) return;
    const id = addRosterMemberStrict(n);
    if (!id) {
      setError(`「${n.trim()}」已經在名單上，如果是你，請直接點上方的名字。`);
      return;
    }
    void enter(id, n.trim());
  }

  function skipBinding() {
    if (!code) return;
    if (dontAskAgain) setNoLineAsk(code);
    setSkipped(code);
    setName('');
    setError('');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl shadow-2xl shadow-black/50 p-6">
        <PendingInviteBanner className="border rounded-lg mb-4" />

        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <Logo size={36} />
          </div>
          <h1 className="text-lg font-semibold bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-transparent">
            小呆記帳
          </h1>
          {bindMode && lineProfile ? (
            <>
              <p className="text-sm text-slate-300 mt-2">LINE：{lineProfile.displayName}</p>
              <p className="text-sm text-slate-500 mt-1">在這個空間裡你是哪一位？選擇後，下次從 LINE 開啟會自動辨識。</p>
            </>
          ) : (
            <p className="text-sm text-slate-500 mt-1">請選擇你的身分，開始分帳</p>
          )}
        </div>

        {notice && <p className="mb-4 text-xs text-amber-300 text-center">{notice}</p>}

        {(liffMode === 'external-guest' || (liffMode === 'off' && !!LIFF_ID && anyLocked)) && (
          <button
            onClick={() => {
              if (liffMode === 'external-guest') {
                loginWithLine().catch((e) => console.error('LINE 登入失敗：', e));
              } else if (code) {
                // 一般網址開啟：先轉到 LINE 入口網址，初始化後自動進入 LINE 登入。
                startLineLoginFromBrowser(code);
              }
            }}
            className="w-full mb-4 py-2.5 rounded-lg bg-[#06C755] text-white font-medium hover:brightness-110"
          >
            用 LINE 登入，自動辨識身分
          </button>
        )}
        {lineProfileMissing && (
          <div className="mb-4 text-xs text-amber-300 text-center">
            無法讀取 LINE 個人資料，暫時無法自動辨識身分。
            <button onClick={() => window.location.reload()} className="ml-1 underline hover:text-amber-200">
              重新載入
            </button>
          </div>
        )}
        {anyLocked && (
          <p className="mb-4 text-xs text-slate-500 text-center">
            {lineProfile
              ? '🔒 已綁定其他 LINE 帳號的成員不能選。若綁錯了，請綁定者在右上角「LINE ✓」解除綁定。'
              : '🔒 已綁定 LINE 的成員，需從 LINE 開啟或用 LINE 登入才能使用。'}
          </p>
        )}
        {lineProfile && !bindMode && (
          <p className="mb-4 text-xs text-slate-500 text-center">已登入 LINE：{lineProfile.displayName}</p>
        )}

        {suggested && (
          <button
            disabled={busy}
            onClick={() => void enter(suggested.id, suggested.name)}
            className="w-full mb-4 py-2.5 rounded-lg border border-cyan-400/50 bg-cyan-500/10 text-cyan-200 font-medium hover:bg-cyan-500/20 disabled:opacity-40"
          >
            我是「{suggested.name}」
          </button>
        )}

        {knownMembers.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-slate-500 mb-2">選擇已知成員</div>
            <div className="flex flex-wrap gap-2">
              {knownMembers.map((m) => {
                const taken = locked(m.id);
                return (
                  <button
                    key={m.id}
                    disabled={busy || taken}
                    title={taken ? '已綁定 LINE：需從 LINE 開啟或用 LINE 登入' : undefined}
                    onClick={() => void enter(m.id, m.name)}
                    className={clsx(
                      'px-3 py-1.5 rounded-full border text-sm',
                      taken
                        ? 'border-slate-800 bg-slate-900 text-slate-600 cursor-not-allowed'
                        : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300',
                    )}
                  >
                    {m.name}
                    {taken && <span className="ml-1 text-[10px]">🔒 已綁定 LINE</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            joinAsNew(name);
          }}
          className="flex flex-col gap-3"
        >
          <div>
            <label className="text-xs text-slate-500 mb-1 block">或以新成員加入</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="你的暱稱"
              className="w-full border border-slate-700 bg-slate-800/60 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/60"
            />
            {error && <p className="text-xs text-rose-400 mt-1.5">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={!name.trim() || busy}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:from-cyan-400 hover:to-violet-500 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            開始使用
          </button>
        </form>

        {bindMode && (
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <input type="checkbox" checked={dontAskAgain} onChange={(e) => setDontAskAgain(e.target.checked)} />
              此空間不再詢問
            </label>
            <button onClick={skipBinding} className="text-xs text-slate-400 hover:text-cyan-300">
              這次先不綁定 →
            </button>
          </div>
        )}

        {switchedFrom && (
          // 從 LINE 連結直接切換過來、還沒選身分時，主畫面的「回到上一個空間」橫幅還看不到，這裡也提供返回。
          <button
            onClick={() => {
              setCode(switchedFrom);
              setSwitched(null);
            }}
            className="w-full mt-3 text-xs text-slate-500 hover:text-cyan-300"
          >
            ↩ 回到上一個空間（<span className="font-mono">{switchedFrom}</span>）
          </button>
        )}
      </div>
    </div>
  );
}
