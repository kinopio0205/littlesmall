import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupStore, computeGroupBalances, resolveGroupMembers } from '../store/groupStore';
import { useIdentityStore } from '../store/identityStore';
import Modal from '../components/Modal';
import { formatCurrency } from '../utils/format';

const ICONS = ['🤝', '✈️', '🏖️', '🍽️', '🏠', '🎉', '🎓', '💼'];

export default function Groups() {
  const groups = useGroupStore((s) => s.groups);
  const roster = useGroupStore((s) => s.members);
  const expenses = useGroupStore((s) => s.expenses);
  const settlements = useGroupStore((s) => s.settlements);
  const addGroup = useGroupStore((s) => s.addGroup);
  const identity = useIdentityStore((s) => s.name) ?? '';
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(identity ? [identity] : []));
  const [newMemberName, setNewMemberName] = useState('');

  function toggleMember(memberName: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(memberName)) next.delete(memberName);
      else next.add(memberName);
      return next;
    });
  }

  function addNewMember() {
    const trimmed = newMemberName.trim();
    if (!trimmed) return;
    setSelected((s) => new Set(s).add(trimmed));
    setNewMemberName('');
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || selected.size === 0) return;
    const id = addGroup(name.trim(), icon, Array.from(selected));
    setShowCreate(false);
    setName('');
    setIcon(ICONS[0]);
    setSelected(new Set(identity ? [identity] : []));
    setNewMemberName('');
    navigate(`/groups/${id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">分帳群組</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
        >
          + 新增群組
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="text-sm text-gray-400 py-16 text-center bg-white rounded-xl shadow-sm">
          尚無群組，建立一個開始跟朋友分帳吧
        </div>
      ) : (
        <div className="grid gap-3">
          {groups.map((g) => {
            const total = expenses.filter((e) => e.groupId === g.id).reduce((s, e) => s + e.amount, 0);
            const groupMembers = resolveGroupMembers(g, roster);
            const balances = computeGroupBalances(g.id, groupMembers, expenses, settlements);
            const settled = Object.values(balances).every((v) => Math.abs(v) < 0.01);
            return (
              <button
                key={g.id}
                onClick={() => navigate(`/groups/${g.id}`)}
                className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between hover:bg-gray-50 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{g.icon}</span>
                  <div>
                    <div className="font-medium text-gray-800">{g.name}</div>
                    <div className="text-xs text-gray-400">
                      {g.memberIds.length} 位成員 · 總支出 {formatCurrency(total)}
                    </div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${settled ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                  {settled ? '已結清' : '未結清'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {showCreate && (
        <Modal title="新增群組" onClose={() => setShowCreate(false)}>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">群組名稱</label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：日本旅行"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">圖示</label>
              <div className="flex gap-2 flex-wrap">
                {ICONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setIcon(e)}
                    className={`text-lg py-1.5 px-2.5 rounded-lg border ${icon === e ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">成員（從名單中選擇，或新增新成員）</label>
              {roster.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {roster.map((m) => {
                    const checked = selected.has(m.name);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMember(m.name)}
                        className={`text-xs px-2.5 py-1 rounded-full border ${
                          checked
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                            : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                      >
                        {checked ? `✓ ${m.name}` : m.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addNewMember();
                    }
                  }}
                  placeholder="輸入新成員暱稱"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={addNewMember}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                >
                  加入
                </button>
              </div>
              {selected.size > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Array.from(selected).map((n) => (
                    <span
                      key={n}
                      className="flex items-center gap-1 text-xs pl-2.5 pr-1.5 py-1 rounded-full bg-indigo-50 text-indigo-600"
                    >
                      {n}
                      <button
                        type="button"
                        onClick={() => toggleMember(n)}
                        className="text-indigo-400 hover:text-rose-500"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              className="mt-1 w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
            >
              建立群組
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
