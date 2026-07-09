import { useMemo, useState } from 'react';
import { usePersonalStore } from '../store/personalStore';
import { useGroupStore, computeGroupBalances } from '../store/groupStore';
import { simplifyDebts } from '../utils/debt';
import { formatCurrency, formatDate, todayISO } from '../utils/format';
import TransactionModal from '../components/TransactionModal';
import { Link } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#f43f5e', '#84cc16'];

export default function Dashboard() {
  const transactions = usePersonalStore((s) => s.transactions);
  const categories = usePersonalStore((s) => s.categories);
  const groups = useGroupStore((s) => s.groups);
  const expenses = useGroupStore((s) => s.expenses);
  const settlements = useGroupStore((s) => s.settlements);
  const [showAdd, setShowAdd] = useState(false);

  const month = todayISO().slice(0, 7);

  const monthTx = useMemo(
    () => transactions.filter((t) => t.date.startsWith(month)),
    [transactions, month],
  );

  const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    monthTx
      .filter((t) => t.type === 'expense')
      .forEach((t) => map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount));
    return Array.from(map.entries())
      .map(([categoryId, value]) => {
        const cat = categories.find((c) => c.id === categoryId);
        return { name: cat ? `${cat.icon} ${cat.name}` : '未分類', value };
      })
      .sort((a, b) => b.value - a.value);
  }, [monthTx, categories]);

  const recent = transactions.slice(0, 6);

  const pendingTransfers = useMemo(() => {
    let count = 0;
    groups.forEach((g) => {
      const balances = computeGroupBalances(g.id, g.members, expenses, settlements);
      count += simplifyDebts(balances).length;
    });
    return count;
  }, [groups, expenses, settlements]);

  function catOf(id: string) {
    return categories.find((c) => c.id === id);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-xs text-gray-400">本月收入</div>
          <div className="text-lg font-semibold text-emerald-500 mt-1">{formatCurrency(income)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-xs text-gray-400">本月支出</div>
          <div className="text-lg font-semibold text-rose-500 mt-1">{formatCurrency(expense)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-xs text-gray-400">本月結餘</div>
          <div className="text-lg font-semibold text-gray-800 mt-1">{formatCurrency(income - expense)}</div>
        </div>
      </div>

      <Link
        to="/groups"
        className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤝</span>
          <div>
            <div className="font-medium text-gray-800">分帳群組</div>
            <div className="text-xs text-gray-400">
              共 {groups.length} 個群組
              {pendingTransfers > 0 ? `，${pendingTransfers} 筆待結清` : '，皆已結清'}
            </div>
          </div>
        </div>
        <span className="text-gray-300">›</span>
      </Link>

      {categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="font-medium text-gray-800 mb-2">本月支出分類</div>
          <div className="flex items-center">
            <div className="w-36 h-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="value" nameKey="name" innerRadius={35} outerRadius={60}>
                    {categoryBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 flex flex-col gap-1.5 pl-2">
              {categoryBreakdown.slice(0, 5).map((c, i) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {c.name}
                  </span>
                  <span className="text-gray-800 font-medium">{formatCurrency(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium text-gray-800">最近記錄</div>
          <Link to="/records" className="text-xs text-indigo-500">
            查看全部
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">尚無記錄，點右下角新增</div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-50">
            {recent.map((t) => {
              const c = catOf(t.categoryId);
              return (
                <div key={t.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{c?.icon ?? '❔'}</span>
                    <div className="text-left">
                      <div className="text-sm text-gray-800">{c?.name ?? '未分類'}</div>
                      <div className="text-xs text-gray-400">
                        {formatDate(t.date)} {t.note && `· ${t.note}`}
                      </div>
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {t.type === 'income' ? '+' : '-'}
                    {formatCurrency(t.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-indigo-600 text-white text-2xl shadow-lg hover:bg-indigo-700 flex items-center justify-center"
        aria-label="新增記錄"
      >
        +
      </button>

      {showAdd && <TransactionModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
