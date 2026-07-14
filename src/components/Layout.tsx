import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { useIdentityStore } from '../store/identityStore';
import { useSyncStore } from '../store/syncStore';
import { useLastSpaceStore } from '../store/lastSpaceStore';
import { usePendingInviteStore } from '../store/pendingInviteStore';
import { buildInviteUrl } from '../utils/syncCode';
import Logo from './Logo';

const navItems = [
  { to: '/', label: '總覽', icon: '🏠', end: true },
  { to: '/records', label: '我的紀錄', icon: '📝' },
  { to: '/reports', label: '報表', icon: '📊' },
  { to: '/groups', label: '分帳群組', icon: '🤝' },
];

export default function Layout() {
  const identity = useIdentityStore((s) => s.name);
  const clearIdentity = useIdentityStore((s) => s.clearIdentity);
  const code = useSyncStore((s) => s.code);
  const setCode = useSyncStore((s) => s.setCode);
  const clearCode = useSyncStore((s) => s.clearCode);
  const setLastSpace = useLastSpaceStore((s) => s.setLastSpace);
  const pendingCode = usePendingInviteStore((s) => s.pendingCode);
  const clearPendingInvite = usePendingInviteStore((s) => s.clearPending);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function copyInviteLink() {
    if (!code) return;
    navigator.clipboard.writeText(buildInviteUrl(code)).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    });
  }

  function switchSpace() {
    if (!code || !identity) return;
    if (confirm(`切換分帳空間？目前同步碼為「${code}」，切換後需要重新輸入同步碼與身分。`)) {
      setLastSpace({ code, identity });
      clearIdentity();
      clearCode();
    }
  }

  function acceptInvite() {
    if (!pendingCode) return;
    if (code && identity) setLastSpace({ code, identity });
    clearIdentity();
    setCode(pendingCode);
    clearPendingInvite();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900/70 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3 gap-2">
          <div className="flex items-center gap-2 font-bold text-lg shrink-0">
            <Logo />
            <span className="bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-transparent">
              小呆記帳
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <div className="flex items-center rounded-full border border-slate-700 bg-slate-800/60 pl-3 pr-1 py-1 gap-1 whitespace-nowrap">
              <span className="text-cyan-400 text-xs">◈</span>
              <button
                onClick={switchSpace}
                className="font-mono text-xs text-slate-300 hover:text-cyan-300"
                title="切換分帳空間"
              >
                {code}
              </button>
              <button
                onClick={copyCode}
                className="text-xs text-slate-400 hover:text-cyan-300 rounded-full w-6 h-6 flex items-center justify-center hover:bg-slate-700/60"
                title="複製同步碼"
                aria-label="複製同步碼"
              >
                {copied ? '✓' : '⧉'}
              </button>
              <button
                onClick={copyInviteLink}
                className="text-xs text-slate-400 hover:text-cyan-300 rounded-full w-6 h-6 flex items-center justify-center hover:bg-slate-700/60"
                title="複製邀請網址"
                aria-label="複製邀請網址"
              >
                {linkCopied ? '✓' : '🔗'}
              </button>
            </div>
            <button
              onClick={() => {
                if (confirm(`切換身分？目前身分為「${identity}」。`)) clearIdentity();
              }}
              className="flex items-center gap-1.5 text-xs text-slate-300 border border-slate-700 bg-slate-800/60 rounded-full px-3 py-1.5 hover:border-cyan-400/50 hover:text-cyan-300 whitespace-nowrap"
            >
              <span>👤</span>
              <span>{identity}</span>
              <span className="text-slate-500">切換</span>
            </button>
          </div>
        </div>
        <nav className="max-w-4xl mx-auto flex overflow-x-auto px-2 border-t border-slate-800/80">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  isActive
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200',
                )
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      {pendingCode && pendingCode !== code && (
        <div className="bg-cyan-500/10 border-b border-cyan-400/20">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
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
      )}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
