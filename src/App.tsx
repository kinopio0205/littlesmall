import { Routes, Route } from 'react-router-dom';
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
import { useIdentityStore } from './store/identityStore';
import { useSyncStore } from './store/syncStore';
import { usePendingInviteStore } from './store/pendingInviteStore';
import { connectSync, disconnectSync } from './sync/firestoreSync';
import { normalizeSyncCode } from './utils/syncCode';

export default function App() {
  const identity = useIdentityStore((s) => s.name);
  const code = useSyncStore((s) => s.code);
  const setCode = useSyncStore((s) => s.setCode);
  const clearCode = useSyncStore((s) => s.clearCode);
  const setPendingInvite = usePendingInviteStore((s) => s.setPending);
  const [syncReady, setSyncReady] = useState(false);
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invited = params.get('code');
    if (!invited) return;

    params.delete('code');
    const query = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);

    const normalized = normalizeSyncCode(invited);
    if (normalized.length < 4) return;

    // Wait for the persisted sync code to actually finish loading from localStorage
    // before deciding whether we're "already in a space" — reading getState() before
    // hydration completes would otherwise look like a fresh browser with no space yet.
    function apply() {
      const currentCode = useSyncStore.getState().code;
      if (!currentCode) {
        setCode(normalized);
      } else if (normalized !== currentCode) {
        setPendingInvite(normalized);
      }
    }

    if (useSyncStore.persist.hasHydrated()) {
      apply();
    } else {
      const unsub = useSyncStore.persist.onFinishHydration(() => {
        apply();
        unsub();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!code) return;
    setSyncReady(false);
    setSyncError('');
    connectSync(
      code,
      () => setSyncReady(true),
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

  if (!syncReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500 text-sm">連線中…</div>
      </div>
    );
  }

  if (!identity) return <IdentitySelect />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/records" element={<Records />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/balances" element={<Balances />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/groups/:groupId" element={<GroupDetail />} />
      </Route>
    </Routes>
  );
}
