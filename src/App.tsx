import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import IdentitySelect from './components/IdentitySelect';
import Dashboard from './pages/Dashboard';
import Records from './pages/Records';
import Reports from './pages/Reports';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import { useIdentityStore } from './store/identityStore';

export default function App() {
  const identity = useIdentityStore((s) => s.name);

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
