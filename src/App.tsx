import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Records from './pages/Records';
import Reports from './pages/Reports';
import Categories from './pages/Categories';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/records" element={<Records />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/groups/:groupId" element={<GroupDetail />} />
      </Route>
    </Routes>
  );
}
