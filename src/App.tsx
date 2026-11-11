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
import { applyLegacyIdentityMigration } from './utils/identityMigration';
import { useSyncStore } from './store/syncStore';
import { connectSync, disconnectSync } from './sync/firestoreSync';
import { useLiffStore } from './store/liffStore';
import { useRecentSpacesStore } from './store/lastSpaceStore';
import { useBindingStore } from './store/bindingStore';
import { useGroupStore } from './store/groupStore';
import { connectLineBindings, disconnectLineBindings } from './sync/lineBindingSync';
import { computeLineKey } from './utils/lineIdentity';
import { applyLineResolution } from './utils/lineResolution';

export default function App() {
  const myMember = useMyMember();
  const code = useSyncStore((s) => s.code);
  const clearCode = useSyncStore((s) => s.clearCode);
  const lineUserId = useLiffStore((s) => s.profile?.userId);
  const bindingsReady = useBindingStore((s) => s.ready && s.code === code);
  const [syncReady, setSyncReady] = useState(false);
  const [syncError, setSyncError] = useState('');

  // 已登入 LINE 時監聽這個空間的綁定清單；清單更新後重新依綁定決定身分。
  useEffect(() => {
    if (!code || !lineUserId) return;
    let cancelled = false;
    computeLineKey(code, lineUserId)
      .then((key) => {
        if (!cancelled) connectLineBindings(code, key, () => applyLineResolution(code));
      })
      .catch((error) => {
        console.error('無法計算 LINE 識別碼：', error);
        if (!cancelled) {
          useBindingStore.getState().reset(code, null);
          useBindingStore.getState().setBindings({});
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

  // 已登入 LINE 時，也要等綁定清單載入，才知道要自動辨識還是詢問身分（避免畫面先閃一下身分選擇）。
  if (!syncReady || (lineUserId && !bindingsReady)) {
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

  if (!myMember) return <IdentitySelect />;

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
