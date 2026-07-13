import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useGroupStore, computeGroupBalances } from '../store/groupStore';
import { useIdentityStore } from '../store/identityStore';
import { simplifyDebts, computeDirectTransfers } from '../utils/debt';
import { getAllMemberNames } from '../utils/identity';
import { formatCurrency, formatDate } from '../utils/format';
import ExpenseModal from '../components/ExpenseModal';
import SettleModal from '../components/SettleModal';
import type { GroupExpense } from '../types';

type Tab = 'expenses' | 'balances' | 'members';

export default function GroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const identity = useIdentityStore((s) => s.name);
  const groups = useGroupStore((s) => s.groups);
  const expenses = useGroupStore((s) => s.expenses);
  const settlements = useGroupStore((s) => s.settlements);
  const addMember = useGroupStore((s) => s.addMember);
  const removeMember = useGroupStore((s) => s.removeMember);
  const deleteGroup = useGroupStore((s) => s.deleteGroup);
  const deleteSettlement = useGroupStore((s) => s.deleteSettlement);

  const group = groups.find((g) => g.id === groupId);

  const [tab, setTab] = useState<Tab>('expenses');
  const [showExpense, setShowExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<GroupExpense | null>(null);
  const [showSettle, setShowSettle] = useState(false);
  const [settleDefaults, setSettleDefaults] = useState<{ from?: string; to?: string; amount?: number }>({});
  const [newMemberName, setNewMemberName] = useState('');
  const [transferMode, setTransferMode] = useState<'simplified' | 'direct'>('simplified');

  useEffect(() => {
    if (!group) return;
    if (searchParams.get('add') === '1') {
      setEditingExpense(null);
      setShowExpense(true);
      setSearchParams({}, { replace: true });
    } else if (searchParams.get('edit')) {
      const target = expenses.find((e) => e.id === searchParams.get('edit'));
      if (target) {
        setEditingExpense(target);
        setShowExpense(true);
      }
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id]);

  const groupExpenses = useMemo(
    () => expenses.filter((e) => e.groupId === groupId).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [expenses, groupId],
  );
  const groupSettlements = useMemo(
    () => settlements.filter((s) => s.groupId === groupId).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [settlements, groupId],
  );

  const balances = useMemo(
    () => (group ? computeGroupBalances(group.id, group.members, expenses, settlements) : {}),
    [group, expenses, settlements],
  );
  const simplifiedTransfers = useMemo(() => simplifyDebts(balances), [balances]);
  const directTransfers = useMemo(
    () => (group ? computeDirectTransfers(group.members, groupExpenses, groupSettlements) : []),
    [group, groupExpenses, groupSettlements],
  );
  const transfers = transferMode === 'simplified' ? simplifiedTransfers : directTransfers;

  const otherKnownNames = useMemo(() => {
    if (!group) return [];
    const currentNames = new Set(group.members.map((m) => m.name));
    return getAllMemberNames(groups).filter((n) => !currentNames.has(n));
  }, [groups, group]);

  if (!group) {
    return (
      <div className="text-center py-16">
        <div className="text-gray-400 mb-3">找不到此群組</div>
        <button onClick={() => navigate('/groups')} className="text-indigo-500 text-sm">
          返回群組列表
        </button>
      </div>
    );
  }

  function memberName(id: string) {
    const name = group!.members.find((m) => m.id === id)?.name;
    if (!name) return '未知成員';
    return name === identity ? '你' : name;
  }

  function openSettle(from?: string, to?: string, amount?: number) {
    setSettleDefaults({ from, to, amount });
    setShowSettle(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/groups')} className="text-gray-400 hover:text-gray-700">
            ‹
          </button>
          <span className="text-2xl">{group.icon}</span>
          <h1 className="text-xl font-semibold text-gray-800">{group.name}</h1>
        </div>
        <button
          onClick={() => {
            if (confirm('刪除整個群組？此動作無法復原。')) {
              deleteGroup(group.id);
              navigate('/groups');
            }
          }}
          className="text-xs text-gray-400 hover:text-rose-500"
        >
          刪除群組
        </button>
      </div>

      <div className="flex rounded-lg overflow-hidden border border-gray-200 bg-white text-sm">
        {(
          [
            ['expenses', '支出'],
            ['balances', '餘額'],
            ['members', '成員'],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 font-medium ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'expenses' && (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              setEditingExpense(null);
              setShowExpense(true);
            }}
            className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            + 新增支出
          </button>
          {groupExpenses.length === 0 ? (
            <div className="text-sm text-gray-400 py-12 text-center bg-white rounded-xl shadow-sm">
              尚無支出記錄
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-50">
              {groupExpenses.map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    setEditingExpense(e);
                    setShowExpense(true);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{e.icon}</span>
                    <div>
                      <div className="text-sm text-gray-800">{e.description}</div>
                      <div className="text-xs text-gray-400">
                        {formatDate(e.date)} · {memberName(e.payerId)} 付款 · {e.splits.length} 人分攤
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-800">{formatCurrency(e.amount)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'balances' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-50">
            {group.members.map((m) => {
              const bal = balances[m.id] ?? 0;
              const isMe = m.name === identity;
              return (
                <div key={m.id} className={`flex items-center justify-between px-4 py-3 ${isMe ? 'bg-indigo-50/50' : ''}`}>
                  <span className={`text-sm ${isMe ? 'font-semibold text-indigo-700' : 'text-gray-700'}`}>
                    {m.name}
                    {isMe && <span className="ml-1.5 text-xs text-indigo-400">你</span>}
                  </span>
                  <span className={`text-sm font-medium ${bal > 0.01 ? 'text-emerald-500' : bal < -0.01 ? 'text-rose-500' : 'text-gray-400'}`}>
                    {bal > 0.01 ? `應收 ${formatCurrency(bal)}` : bal < -0.01 ? `應付 ${formatCurrency(-bal)}` : '已結清'}
                  </span>
                </div>
              );
            })}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-gray-800">建議轉帳</div>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                <button
                  onClick={() => setTransferMode('simplified')}
                  className={`px-2.5 py-1.5 font-medium ${transferMode === 'simplified' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}
                >
                  簡化轉帳
                </button>
                <button
                  onClick={() => setTransferMode('direct')}
                  className={`px-2.5 py-1.5 font-medium ${transferMode === 'direct' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}
                >
                  獨立轉帳
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-2">
              {transferMode === 'simplified'
                ? '轉帳筆數最少，但可能出現「A 欠 B、B 欠 C，所以改成 A 直接轉給 C」這種代轉情況'
                : '只在有實際共同支出的兩人之間互相結算，不會出現代轉，但轉帳筆數可能較多'}
            </p>
            {transfers.length === 0 ? (
              <div className="text-sm text-gray-400 py-6 text-center bg-white rounded-xl shadow-sm">
                目前所有人皆已結清 🎉
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-50">
                {transfers.map((t, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="text-sm text-gray-700">
                      {memberName(t.fromMemberId)} → {memberName(t.toMemberId)}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-800">{formatCurrency(t.amount)}</span>
                      <button
                        onClick={() => openSettle(t.fromMemberId, t.toMemberId, t.amount)}
                        className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                      >
                        標記已還款
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => openSettle()}
            className="w-full py-2.5 rounded-lg border border-indigo-200 text-indigo-600 text-sm font-medium hover:bg-indigo-50"
          >
            + 自訂記錄還款
          </button>

          {groupSettlements.length > 0 && (
            <div>
              <div className="font-medium text-gray-800 mb-2">還款紀錄</div>
              <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-50">
                {groupSettlements.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3">
                    <div className="text-sm text-gray-700">
                      {memberName(s.fromMemberId)} → {memberName(s.toMemberId)}
                      <span className="text-xs text-gray-400 ml-2">{formatDate(s.date)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-800">{formatCurrency(s.amount)}</span>
                      <button
                        onClick={() => {
                          if (confirm('刪除這筆還款紀錄？')) deleteSettlement(s.id);
                        }}
                        className="text-gray-300 hover:text-rose-500 text-sm"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'members' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-50">
            {group.members.map((m) => {
              const bal = balances[m.id] ?? 0;
              const canRemove = Math.abs(bal) < 0.01;
              const isMe = m.name === identity;
              return (
                <div key={m.id} className={`flex items-center justify-between px-4 py-3 ${isMe ? 'bg-indigo-50/50' : ''}`}>
                  <span className={`text-sm ${isMe ? 'font-semibold text-indigo-700' : 'text-gray-700'}`}>
                    {m.name}
                    {isMe && <span className="ml-1.5 text-xs text-indigo-400">你</span>}
                  </span>
                  <button
                    disabled={!canRemove}
                    onClick={() => {
                      if (confirm(`移除成員「${m.name}」？`)) removeMember(group.id, m.id);
                    }}
                    className={`text-xs px-2 py-1 rounded ${canRemove ? 'text-gray-400 hover:text-rose-500' : 'text-gray-200 cursor-not-allowed'}`}
                    title={canRemove ? '' : '尚有未結清餘額，無法移除'}
                  >
                    移除
                  </button>
                </div>
              );
            })}
          </div>

          {otherKnownNames.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1.5">從其他群組加入成員</div>
              <div className="flex flex-wrap gap-1.5">
                {otherKnownNames.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => addMember(group.id, n)}
                    className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                  >
                    + {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newMemberName.trim()) {
                addMember(group.id, newMemberName.trim());
                setNewMemberName('');
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="新成員暱稱"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              新增
            </button>
          </form>
        </div>
      )}

      {showExpense && (
        <ExpenseModal
          group={group}
          editing={editingExpense}
          onClose={() => {
            setShowExpense(false);
            setEditingExpense(null);
          }}
        />
      )}
      {showSettle && (
        <SettleModal
          group={group}
          defaultFrom={settleDefaults.from}
          defaultTo={settleDefaults.to}
          defaultAmount={settleDefaults.amount}
          onClose={() => setShowSettle(false)}
        />
      )}
    </div>
  );
}
