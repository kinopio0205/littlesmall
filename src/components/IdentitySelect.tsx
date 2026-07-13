import { useState } from 'react';
import { useGroupStore } from '../store/groupStore';
import { useIdentityStore } from '../store/identityStore';
import { getAllMemberNames } from '../utils/identity';
import Logo from './Logo';

export default function IdentitySelect() {
  const roster = useGroupStore((s) => s.members);
  const setIdentity = useIdentityStore((s) => s.setIdentity);
  const [name, setName] = useState('');

  const knownNames = getAllMemberNames(roster);

  function confirm(n: string) {
    if (n.trim()) setIdentity(n.trim());
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
          <p className="text-sm text-slate-500 mt-1">請選擇你的身分，開始分帳</p>
        </div>

        {knownNames.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-slate-500 mb-2">選擇已知成員</div>
            <div className="flex flex-wrap gap-2">
              {knownNames.map((n) => (
                <button
                  key={n}
                  onClick={() => confirm(n)}
                  className="px-3 py-1.5 rounded-full border border-slate-700 bg-slate-800/60 text-sm text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirm(name);
          }}
          className="flex flex-col gap-3"
        >
          <div>
            <label className="text-xs text-slate-500 mb-1 block">或輸入新的暱稱</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="你的暱稱"
              className="w-full border border-slate-700 bg-slate-800/60 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/60"
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:from-cyan-400 hover:to-violet-500 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            開始使用
          </button>
        </form>
      </div>
    </div>
  );
}
