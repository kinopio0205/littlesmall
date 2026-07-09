import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { useIdentityStore } from '../store/identityStore';

const navItems = [
  { to: '/', label: '總覽', icon: '🏠', end: true },
  { to: '/records', label: '我的紀錄', icon: '📝' },
  { to: '/reports', label: '報表', icon: '📊' },
  { to: '/groups', label: '分帳群組', icon: '🤝' },
];

export default function Layout() {
  const identity = useIdentityStore((s) => s.name);
  const clearIdentity = useIdentityStore((s) => s.clearIdentity);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-bold text-lg text-indigo-600">
            <span>💸</span>
            <span>小呆記帳</span>
          </div>
          <button
            onClick={() => {
              if (confirm(`切換身分？目前身分為「${identity}」。`)) clearIdentity();
            }}
            className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-full px-3 py-1.5 hover:border-indigo-300 hover:text-indigo-600"
          >
            <span>👤</span>
            <span>{identity}</span>
            <span className="text-gray-300">切換</span>
          </button>
        </div>
        <nav className="max-w-4xl mx-auto flex overflow-x-auto px-2 border-t border-gray-100">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  isActive
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800',
                )
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
