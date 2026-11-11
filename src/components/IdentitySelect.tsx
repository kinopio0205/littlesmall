import { useState } from 'react';
import { useGroupStore } from '../store/groupStore';
import { useIdentityStore } from '../store/identityStore';
import { useSyncStore } from '../store/syncStore';
import Logo from './Logo';

export default function IdentitySelect() {
  const roster = useGroupStore((s) => s.members);
  const addRosterMemberStrict = useGroupStore((s) => s.addRosterMemberStrict);
  const code = useSyncStore((s) => s.code);
  const setMember = useIdentityStore((s) => s.setMember);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const knownMembers = [...roster].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));

  function choose(memberId: string) {
    if (code) setMember(code, memberId);
  }

  function joinAsNew(n: string) {
    if (!code || !n.trim()) return;
    const id = addRosterMemberStrict(n);
    if (!id) {
      setError(`「${n.trim()}」已經在名單上，如果是你，請直接點上方的名字。`);
      return;
    }
    setMember(code, id);
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

        {knownMembers.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-slate-500 mb-2">選擇已知成員</div>
            <div className="flex flex-wrap gap-2">
              {knownMembers.map((m) => (
                <button
                  key={m.id}
                  onClick={() => choose(m.id)}
                  className="px-3 py-1.5 rounded-full border border-slate-700 bg-slate-800/60 text-sm text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            joinAsNew(name);
          }}
          className="flex flex-col gap-3"
        >
          <div>
            <label className="text-xs text-slate-500 mb-1 block">或以新成員加入</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="你的暱稱"
              className="w-full border border-slate-700 bg-slate-800/60 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/60"
            />
            {error && <p className="text-xs text-rose-400 mt-1.5">{error}</p>}
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
