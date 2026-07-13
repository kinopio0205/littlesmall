import { useState } from 'react';
import { useGroupStore } from '../store/groupStore';
import { useIdentityStore } from '../store/identityStore';
import { getAllMemberNames } from '../utils/identity';

export default function IdentitySelect() {
  const roster = useGroupStore((s) => s.members);
  const setIdentity = useIdentityStore((s) => s.setIdentity);
  const [name, setName] = useState('');

  const knownNames = getAllMemberNames(roster);

  function confirm(n: string) {
    if (n.trim()) setIdentity(n.trim());
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm p-6">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">💸</div>
          <h1 className="text-lg font-semibold text-gray-800">小呆記帳</h1>
          <p className="text-sm text-gray-400 mt-1">請選擇你的身分，開始分帳</p>
        </div>

        {knownNames.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-gray-500 mb-2">選擇已知成員</div>
            <div className="flex flex-wrap gap-2">
              {knownNames.map((n) => (
                <button
                  key={n}
                  onClick={() => confirm(n)}
                  className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-gray-700 hover:border-indigo-400 hover:text-indigo-600"
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
            <label className="text-xs text-gray-500 mb-1 block">或輸入新的暱稱</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="你的暱稱"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            開始使用
          </button>
        </form>
      </div>
    </div>
  );
}
