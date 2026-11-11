import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { useIdentityStore } from '../store/identityStore';
import { useSyncStore } from '../store/syncStore';
import { useRecentSpacesStore } from '../store/lastSpaceStore';
import { useMyMember } from '../hooks/useMyMember';
import PendingInviteBanner from './PendingInviteBanner';
import LineBindingBar from './LineBindingBar';
import ShareToLineButton from './ShareToLineButton';
import { useBindingStore } from '../store/bindingStore';
import { unbindMine } from '../sync/lineBindingSync';
import { findMyBinding } from '../utils/lineIdentity';
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
  const myLineKey = useBindingStore((s) => (s.code === code && s.ready ? s.myLineKey : null));
  const bindings = useBindingStore((s) => s.bindings);
  const setNotice = useBindingStore((s) => s.setNotice);
  const setSkipped = useBindingStore((s) => s.setSkipped);
  const myBinding = findMyBinding(bindings, myLineKey);
  const myBoundHere = !!myBinding && myBinding.memberId === myMember?.id;

  async function unbindLine() {
    if (!code || !myLineKey || !myMember) return;
    if (!confirm(`解除這個 LINE 帳號與「${myMember.name}」的綁定？\n解除後需要重新選擇你是哪一位（在 LINE 裡會立刻回到選擇畫面）。`)) return;
    // 使用者剛表示不要綁定：這次開啟期間不再建議綁回目前身分。
    setSkipped(code);
    try {
      await unbindMine(code, myLineKey);
      setNotice('已解除 LINE 綁定');
    } catch (e) {
      console.error('解除 LINE 綁定失敗：', e);
      setNotice('解除 LINE 綁定失敗，請稍後再試');
    }
  }

  async function switchIdentity() {
    setNotice(null); // 先清掉舊提示（例如「已用 LINE 自動辨識」），避免在選身分畫面誤導
    if (!code) return;
    if (myBinding && myLineKey) {
      // LINE 內的身分跟著綁定走：要換身分，必須先解除目前的 LINE 綁定，之後會回到綁定畫面重新選擇。
      if (
        !confirm(
          `這個 LINE 帳號目前綁定為「${myBinding.binding.memberName}」。
要切換身分，需要先解除這個綁定，之後再選擇你是哪一位。確定要解除嗎？`,
        )
      )
        return;
      try {
        await unbindMine(code, myLineKey);
      } catch (e) {
        console.error("解除 LINE 綁定失敗：", e);
        setNotice("解除 LINE 綁定失敗，請稍後再試");
        return;
      }
      clearMember(code);
      return;
    }
    if (!confirm(`切換身分？目前身分為「${myMember?.name}」。`)) return;
    clearMember(code);
  }

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
            <span className="hidden sm:inline bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-transparent">
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
              {code && <ShareToLineButton code={code} />}
            </div>
            {myBoundHere && (
              <button
                onClick={() => void unbindLine()}
                className="text-[11px] text-emerald-300 border border-emerald-400/30 bg-emerald-500/10 rounded-full px-2 py-1 hover:bg-emerald-500/20 whitespace-nowrap"
                title="這個 LINE 帳號已綁定此身分；點擊可解除"
                aria-label="已綁定 LINE，點擊可解除"
              >
                <span className="hidden sm:inline">LINE </span>✓
              </button>
            )}
            <button
              onClick={() => void switchIdentity()}
              className="flex items-center gap-1.5 text-xs text-slate-300 border border-slate-700 bg-slate-800/60 rounded-full px-3 py-1.5 hover:border-cyan-400/50 hover:text-cyan-300 whitespace-nowrap"
            >
              <span>👤</span>
              <span>{myMember?.name}</span>
              <span className="hidden sm:inline text-slate-500">切換</span>
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
      <LineBindingBar />
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
