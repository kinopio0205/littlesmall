import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { useIdentityStore } from '../store/identityStore';
import { useSyncStore } from '../store/syncStore';
import { useRecentSpacesStore } from '../store/lastSpaceStore';
import { useMyMember } from '../hooks/useMyMember';
import PendingInviteBanner from './PendingInviteBanner';
import { useLiffStore } from '../store/liffStore';
import { buildInviteUrl } from '../utils/syncCode';
import Logo from './Logo';

const navItems = [
  { to: '/', label: '總覽', icon: '🏠', end: true },
  { to: '/records', label: '我的紀錄', icon: '📝' },
  { to: '/balances', label: '餘額', icon: '⚖️' },
  { to: '/reports', label: '報表', icon: '📊' },
  { to: '/groups', label: '分帳群組', icon: '🤝' },
];

export default function Layout() {
  const myMember = useMyMember();
  const clearMember = useIdentityStore((s) => s.clearMember);
  const code = useSyncStore((s) => s.code);
  const setCode = useSyncStore((s) => s.setCode);
  const clearCode = useSyncStore((s) => s.clearCode);
  const rememberSpace = useRecentSpacesStore((s) => s.rememberSpace);
  const switched = useLiffStore((s) => s.switched);
  const setSwitched = useLiffStore((s) => s.setSwitched);
  const switchedFrom = switched && switched.to === code ? switched.from : null;
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
    if (!code) return;
    if (confirm(`切換分帳空間？目前同步碼為「${code}」，切換後需要重新輸入同步碼。`)) {
      rememberSpace(code, myMember?.name);
      clearCode();
    }
  }

  function returnToSwitchedFrom() {
    if (!switchedFrom) return;
    if (code) rememberSpace(code, myMember?.name);
    setCode(switchedFrom);
    setSwitched(null);
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
                if (code && confirm(`切換身分？目前身分為「${myMember?.name}」。`)) clearMember(code);
              }}
              className="flex items-center gap-1.5 text-xs text-slate-300 border border-slate-700 bg-slate-800/60 rounded-full px-3 py-1.5 hover:border-cyan-400/50 hover:text-cyan-300 whitespace-nowrap"
            >
              <span>👤</span>
              <span>{myMember?.name}</span>
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
      <PendingInviteBanner className="border-b" />
      {switchedFrom && (
        <div className="bg-cyan-500/10 border-b border-cyan-400/20">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="text-cyan-200">
              已透過邀請連結切換到 <span className="font-mono">{code}</span>
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={returnToSwitchedFrom}
                className="text-xs px-3 py-1.5 rounded-full border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/10"
              >
                回到 <span className="font-mono">{switchedFrom}</span>
              </button>
              <button
                onClick={() => setSwitched(null)}
                className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:text-slate-200"
              >
                知道了
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
