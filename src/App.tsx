import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import SyncGate from './components/SyncGate';
import IdentitySelect from './components/IdentitySelect';
import Dashboard from './pages/Dashboard';
import Records from './pages/Records';
import Reports from './pages/Reports';
import Balances from './pages/Balances';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import { useMyMember } from './hooks/useMyMember';
import { useLineSpacesSync } from './hooks/useLineSpacesSync';
import { applyLegacyIdentityMigration } from './utils/identityMigration';
import { useSyncStore } from './store/syncStore';
import { connectSync, disconnectSync } from './sync/firestoreSync';
import { useLiffStore } from './store/liffStore';
import { useRecentSpacesStore } from './store/lastSpaceStore';
import { useBindingStore } from './store/bindingStore';
import { useGroupStore } from './store/groupStore';
import { connectLineBindings, disconnectLineBindings } from './sync/lineBindingSync';
import { computeLineKey, isLockedForMe, mustBindLine } from './utils/lineIdentity';
import { applyLineResolution } from './utils/lineResolution';

export default function App() {
  useLineSpacesSync();
  const myMember = useMyMember();
  const code = useSyncStore((s) => s.code);
  const clearCode = useSyncStore((s) => s.clearCode);
  const lineUserId = useLiffStore((s) => s.profile?.userId);
  const bindingsReady = useBindingStore((s) => s.ready && s.code === code);
  const bindings = useBindingStore((s) => s.bindings);
  const myLineKey = useBindingStore((s) => s.myLineKey);
  // 已登入 LINE 但讀不到個人資料（getProfile 失敗）：無法判斷是不是本人，先不鎖定，避免把本人鎖在外面。
  const liffMode = useLiffStore((s) => s.mode);
  const lineProfileMissing = (liffMode === 'client' || liffMode === 'external-loggedin') && !lineUserId;
  const myMemberLocked =
    !!myMember && bindingsReady && !lineProfileMissing && isLockedForMe(myMember.id, bindings, myLineKey);
  // 用 LINE 進入、但這個 LINE 帳號在此空間還沒綁定任何成員：一律先綁定（選未綁定的成員或用 LINE 名稱加入）。
  const bindFailed = useBindingStore((s) => (code ? !!s.bindFailedCodes[code] : false));
  // 綁定清單讀取失敗時不知道有沒有綁定，不強制（避免要求已綁定的人重新綁定）。
  const bindingsError = useBindingStore((s) => s.error);
  const mustBind = bindingsReady && !bindingsError && !!lineUserId && mustBindLine(bindings, myLineKey, bindFailed);

  // 身分鎖定：本機記住的身分已綁定 LINE、但這次不是用那個 LINE 帳號開啟（或沒登入 LINE），畫面上視為沒有身分並提示。
  // 不清除本機記住的身分：同一個瀏覽器的其他分頁（例如已登入 LINE 的分頁）共用這份資料，清掉會把它們也踢出去。
  useEffect(() => {
    if (!code || !myMemberLocked || !myMember) return;
    useBindingStore
      .getState()
      .setNotice(
        `「${myMember.name}」已綁定 LINE，請從 LINE 開啟或用 LINE 登入才能使用這個身分。若綁錯了，請綁定者在右上角「LINE ✓」解除綁定。`,
      );
  }, [code, myMemberLocked, myMember]);
  const [syncReady, setSyncReady] = useState(false);
  const [syncError, setSyncError] = useState('');

  // 監聽這個空間的綁定清單（沒登入 LINE 也要讀：用來鎖定已綁定的成員）；清單更新後重新依綁定決定身分。
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    (lineUserId ? computeLineKey(code, lineUserId) : Promise.resolve(null))
      .then((key) => {
        if (!cancelled) connectLineBindings(code, key, () => applyLineResolution(code));
      })
      .catch((error) => {
        console.error('無法計算 LINE 識別碼：', error);
        if (!cancelled) {
          useBindingStore.getState().reset(code, null);
          useBindingStore.getState().setBindingsError();
        }
      });
    // 名單變動（例如被其他裝置整份覆寫、少了綁定的成員）時也重新決定身分，必要時補回成員。
    // 延到下一個 microtask：遠端資料套用中不會回寫，補回的成員要在套用結束後才會同步上雲端。
    const unsubRoster = useGroupStore.subscribe((state, prev) => {
      if (state.members !== prev.members) queueMicrotask(() => applyLineResolution(code));
    });
    return () => {
      cancelled = true;
      unsubRoster();
      disconnectLineBindings();
      useBindingStore.getState().reset(null, null);
    };
  }, [code, lineUserId]);

  // 換到其他空間後，「回到上一個空間」的提示就不再適用。
  useEffect(() => {
    const { switched, setSwitched } = useLiffStore.getState();
    if (switched && switched.to !== code) setSwitched(null);
  }, [code]);

  // 選定身分後記住這個空間與名字：之後從別處切換（例如 LINE 連結）時，「返回上一個空間」能顯示名字。
  const myName = myMember?.name;
  useEffect(() => {
    if (code && myName) useRecentSpacesStore.getState().rememberSpace(code, myName);
  }, [code, myName]);

  useEffect(() => {
    if (!code) return;
    setSyncReady(false);
    setSyncError('');
    useBindingStore.getState().setRosterReady(null);
    connectSync(
      code,
      () => {
        // 名單已載入：先把舊版的名字身分換成這個空間的 memberId、再套用 LINE 綁定，最後才決定要不要顯示身分選擇。
        useBindingStore.getState().setRosterReady(code);
        applyLegacyIdentityMigration(code);
        applyLineResolution(code);
        setSyncReady(true);
      },
      (message) => setSyncError(message),
    );
    return () => disconnectSync();
  }, [code]);

  if (!code) return <SyncGate />;

  if (syncError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-rose-400 text-sm mb-3">連線失敗：{syncError}</div>
          <button
            onClick={clearCode}
            className="text-xs text-cyan-300 border border-cyan-400/30 rounded-full px-3 py-1.5 hover:bg-cyan-500/10"
          >
            重新輸入同步碼
          </button>
        </div>
      </div>
    );
  }

  // 也要等綁定清單載入：才知道要自動辨識、詢問身分，或哪些成員已鎖定（避免畫面先閃一下或選到被鎖定的身分）。
  if (!syncReady || !bindingsReady) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-slate-500 text-sm mb-3">連線中…</div>
          {/* 離線時會一直停在這裡等伺服器回應（不會用本機空資料進入），所以要給使用者離開的路。 */}
          <button
            onClick={clearCode}
            className="text-xs text-slate-500 border border-slate-700 rounded-full px-3 py-1.5 hover:text-cyan-300 hover:border-cyan-400/30"
          >
            重新輸入同步碼
          </button>
        </div>
      </div>
    );
  }

  // 目前身分已綁定別的（或需要登入的）LINE 帳號：不能沿用，回到身分選擇。
  if (!myMember || myMemberLocked || mustBind) return <IdentitySelect />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/records" element={<Records />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/balances" element={<Balances />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/groups/:groupId" element={<GroupDetail />} />
        {/* 不認得的路徑（例如殘留的 LINE 憑證 hash）一律回首頁，避免整頁空白 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
