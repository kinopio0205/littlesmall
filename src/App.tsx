import { Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import SyncGate from './components/SyncGate';
import IdentitySelect from './components/IdentitySelect';
import Dashboard from './pages/Dashboard';
import Records from './pages/Records';
import Reports from './pages/Reports';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import { useIdentityStore } from './store/identityStore';
import { useSyncStore } from './store/syncStore';
import { connectSync, disconnectSync } from './sync/firestoreSync';

export default function App() {
  const identity = useIdentityStore((s) => s.name);
  const code = useSyncStore((s) => s.code);
  const clearCode = useSyncStore((s) => s.clearCode);
  const [syncReady, setSyncReady] = useState(false);
  const [syncError, setSyncError] = useState('');

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
        <Route path="/groups" element={<Groups />} />
        <Route path="/groups/:groupId" element={<GroupDetail />} />
      </Route>
    </Routes>
  );
}
