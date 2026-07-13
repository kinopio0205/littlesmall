import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGroupStore } from '../store/groupStore';
import { useIdentityStore } from '../store/identityStore';
import { getIdentityExpenseLines, getIdentityGroupBalances } from '../utils/identity';
import { formatCurrency, formatDate } from '../utils/format';
import Modal from '../components/Modal';

export default function Dashboard() {
  const identity = useIdentityStore((s) => s.name)!;
  const groups = useGroupStore((s) => s.groups);
  const roster = useGroupStore((s) => s.members);
  const expenses = useGroupStore((s) => s.expenses);
  const settlements = useGroupStore((s) => s.settlements);
  const navigate = useNavigate();
  const [showGroupPicker, setShowGroupPicker] = useState(false);

  const groupBalances = useMemo(
    () => getIdentityGroupBalances(identity, groups, roster, expenses, settlements),
    [identity, groups, roster, expenses, settlements],
  );
  const totalReceivable = groupBalances.reduce((s, g) => s + Math.max(g.balance, 0), 0);
  const totalPayable = groupBalances.reduce((s, g) => s + Math.max(-g.balance, 0), 0);

  const lines = useMemo(
    () => getIdentityExpenseLines(identity, groups, roster, expenses).slice(0, 6),
    [identity, groups, roster, expenses],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">哈囉，{identity} 👋</h1>
        <p className="text-sm text-gray-400 mt-0.5">這是你目前的分帳狀況</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-xs text-gray-400">應收</div>
          <div className="text-lg font-semibold text-emerald-500 mt-1">{formatCurrency(totalReceivable)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-xs text-gray-400">應付</div>
          <div className="text-lg font-semibold text-rose-500 mt-1">{formatCurrency(totalPayable)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-xs text-gray-400">淨額</div>
          <div className="text-lg font-semibold text-gray-800 mt-1">
            {formatCurrency(totalReceivable - totalPayable)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
          <div className="font-medium text-gray-800">我的群組</div>
          <Link to="/groups" className="text-xs text-indigo-500">
            管理群組
          </Link>
        </div>
        {groupBalances.length === 0 ? (
          <div className="text-sm text-gray-400 py-8 text-center">
            你還沒有加入任何群組，前往「分帳群組」建立一個吧
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {groupBalances.map(({ group, balance }) => (
              <button
                key={group.id}
                onClick={() => navigate(`/groups/${group.id}`)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{group.icon}</span>
                  <span className="text-sm text-gray-800">{group.name}</span>
                </div>
                <span
                  className={`text-sm font-medium ${
                    balance > 0.01 ? 'text-emerald-500' : balance < -0.01 ? 'text-rose-500' : 'text-gray-400'
                  }`}
                >
                  {balance > 0.01
                    ? `應收 ${formatCurrency(balance)}`
                    : balance < -0.01
                      ? `應付 ${formatCurrency(-balance)}`
                      : '已結清'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
          <div className="font-medium text-gray-800">最近紀錄</div>
          <Link to="/records" className="text-xs text-indigo-500">
            查看全部
          </Link>
        </div>
        {lines.length === 0 ? (
          <div className="text-sm text-gray-400 py-8 text-center">尚無跟你相關的支出紀錄</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {lines.map(({ group, expense, share, isPayer }) => (
              <div key={expense.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{expense.icon}</span>
                  <div className="text-left">
                    <div className="text-sm text-gray-800">{expense.description}</div>
                    <div className="text-xs text-gray-400">
                      {group.icon} {group.name} · {formatDate(expense.date)}
                      {isPayer && ' · 你付款'}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-800">{formatCurrency(share)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => (groups.length === 1 ? navigate(`/groups/${groups[0].id}?add=1`) : setShowGroupPicker(true))}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-indigo-600 text-white text-2xl shadow-lg hover:bg-indigo-700 flex items-center justify-center"
        aria-label="新增支出"
      >
        +
      </button>

      {showGroupPicker && (
        <Modal title="在哪個群組新增支出？" onClose={() => setShowGroupPicker(false)}>
          {groups.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-4">
              尚無群組，
              <Link to="/groups" className="text-indigo-500">
                先建立一個群組
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => navigate(`/groups/${g.id}?add=1`)}
                  className="flex items-center gap-2.5 border border-gray-100 rounded-lg px-3 py-2.5 hover:border-indigo-300 text-left"
                >
                  <span className="text-xl">{g.icon}</span>
                  <span className="text-sm text-gray-700">{g.name}</span>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
