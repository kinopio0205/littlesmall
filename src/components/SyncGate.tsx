import { useState } from 'react';
import { useSyncStore } from '../store/syncStore';
import { useRecentSpacesStore } from '../store/lastSpaceStore';
import { generateSyncCode, normalizeSyncCode, buildInviteUrl } from '../utils/syncCode';
import Logo from './Logo';
import { useLiffStore } from '../store/liffStore';
import { useLineSpacesStore } from '../store/lineSpacesStore';
import { LIFF_ID, loginWithLine, startLineLoginFromBrowser } from '../liff/liffClient';

export default function SyncGate() {
  const setCode = useSyncStore((s) => s.setCode);
  const lastSpace = useRecentSpacesStore((s) => s.recentSpaces[0]);
  const liffMode = useLiffStore((s) => s.mode);
  const lineProfile = useLiffStore((s) => s.profile);
  const lineSpaces = useLineSpacesStore((s) => s.spaces);
  const lineSpacesLoaded = useLineSpacesStore((s) => s.loaded);
  const lineSpacesFailed = useLineSpacesStore((s) => s.failed);
  const retryLineSpaces = useLineSpacesStore((s) => s.retry);
  // 依最近更新排序：最近用過的空間在最上面。
  const lineEntries = Object.entries(lineSpaces).sort((a, b) => (a[1].updatedAt < b[1].updatedAt ? 1 : -1));
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [newCode] = useState(() => generateSyncCode());
  const [joinInput, setJoinInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(newCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(buildInviteUrl(newCode)).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    });
  }

  function returnToLastSpace() {
    if (!lastSpace) return;
    setCode(lastSpace.code);
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeSyncCode(joinInput);
    if (normalized.length >= 4) setCode(normalized);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl shadow-2xl shadow-black/50 p-6">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <Logo size={36} />
          </div>
          <h1 className="text-lg font-semibold bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-transparent">
            小呆記帳
          </h1>
          <p className="text-sm text-slate-500 mt-1">建立或加入一個分帳空間</p>
        </div>

        {mode === 'choose' && (
          <div className="flex flex-col gap-3">
            {lineProfile && !lineSpacesLoaded && !lineSpacesFailed && (
              <p className="text-xs text-slate-500 text-center">讀取你的 LINE 分帳空間…</p>
            )}
            {lineProfile && lineSpacesFailed && (
              <p className="text-xs text-amber-300 text-center">
                無法讀取你的 LINE 分帳空間。
                <button onClick={retryLineSpaces} className="ml-1 underline hover:text-amber-200">
                  重試
                </button>
              </p>
            )}
            {lineEntries.length > 0 && (
              <div className="mb-1">
                <div className="text-xs text-slate-500 mb-2">你的 LINE 分帳空間（{lineProfile?.displayName}）</div>
                <div className="flex flex-col gap-2">
                  {lineEntries.map(([spaceCode, entry]) => (
                    <button
                      key={spaceCode}
                      onClick={() => setCode(spaceCode)}
                      className="w-full py-2.5 px-3 rounded-lg border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 text-sm hover:bg-emerald-500/20 flex items-center justify-between gap-2"
                    >
                      <span>{entry.memberName}</span>
                      <span className="font-mono text-xs text-emerald-300/80">{spaceCode}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {liffMode === 'off' && !!LIFF_ID && (
              <button
                onClick={() => startLineLoginFromBrowser(null)}
                className="w-full py-2.5 rounded-lg bg-[#06C755] text-white text-sm font-medium hover:brightness-110"
              >
                用 LINE 登入，列出你的分帳空間
              </button>
            )}
            {liffMode === 'external-guest' && (
              <button
                onClick={() => {
                  loginWithLine().catch((e) => console.error('LINE 登入失敗：', e));
                }}
                className="w-full py-2.5 rounded-lg bg-[#06C755] text-white text-sm font-medium hover:brightness-110"
              >
                用 LINE 登入，列出你的分帳空間
              </button>
            )}
            {lastSpace && !lineSpaces[lastSpace.code] && (
              <button
                onClick={returnToLastSpace}
                className="w-full py-3 rounded-lg border border-cyan-400/40 bg-cyan-500/10 text-cyan-300 font-medium hover:bg-cyan-500/20 flex items-center justify-center gap-2"
              >
                <span>↩</span>
                <span>
                  返回上一個空間（{lastSpace.memberName ? `${lastSpace.memberName} · ` : ''}<span className="font-mono">{lastSpace.code}</span>）
                </span>
              </button>
            )}
            <button
              onClick={() => setMode('create')}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:from-cyan-400 hover:to-violet-500"
            >
              建立新的分帳空間
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-3 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 font-medium hover:border-cyan-400/50 hover:text-cyan-300"
            >
              加入現有的分帳空間
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-xs text-slate-500 mb-1">你的同步碼</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 text-center text-2xl font-mono font-semibold tracking-widest border border-slate-700 bg-slate-950/60 rounded-lg py-3 text-cyan-300">
                  {newCode}
                </div>
                <button
                  onClick={copyCode}
                  className="shrink-0 text-xs px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-300"
                >
                  {copied ? '已複製' : '複製'}
                </button>
              </div>
              <button
                onClick={copyInviteLink}
                className="w-full mt-2 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-slate-700 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-300"
              >
                <span>🔗</span>
                <span>{linkCopied ? '邀請網址已複製' : '複製邀請網址'}</span>
              </button>
              <p className="text-xs text-slate-500 mt-2">
                把代碼或邀請網址分享給要一起分帳的朋友——網址開啟後會自動加入這個空間，不用手動輸入代碼。請先保存好這組代碼，之後要在其他裝置使用需要它。
              </p>
            </div>
            <button
              onClick={() => setCode(newCode)}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:from-cyan-400 hover:to-violet-500"
            >
              我已保存，開始使用
            </button>
            <button onClick={() => setMode('choose')} className="text-xs text-slate-500">
              返回
            </button>
          </div>
        )}

        {mode === 'join' && (
          <form onSubmit={join} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">輸入同步碼</label>
              <input
                autoFocus
                type="text"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                placeholder="例如 AB3D9F2K"
                className="w-full border border-slate-700 bg-slate-800/60 rounded-lg px-3 py-2 text-center text-lg font-mono tracking-widest uppercase text-slate-100 focus:outline-none focus:border-cyan-400/60"
              />
            </div>
            <button
              type="submit"
              disabled={normalizeSyncCode(joinInput).length < 4}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:from-cyan-400 hover:to-violet-500 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              加入
            </button>
            <button type="button" onClick={() => setMode('choose')} className="text-xs text-slate-500">
              返回
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
