import { useMemo, useState } from 'react';
import { usePersonalStore } from '../store/personalStore';
import { formatCurrency, formatDate } from '../utils/format';
import TransactionModal from '../components/TransactionModal';
import type { Transaction, TxType } from '../types';

export default function Records() {
  const transactions = usePersonalStore((s) => s.transactions);
  const categories = usePersonalStore((s) => s.categories);
  const deleteTransaction = usePersonalStore((s) => s.deleteTransaction);

  const [typeFilter, setTypeFilter] = useState<TxType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
      if (search && !t.note.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [transactions, typeFilter, categoryFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    filtered.forEach((t) => {
      const list = map.get(t.date) ?? [];
      list.push(t);
      map.set(t.date, list);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  function catOf(id: string) {
    return categories.find((c) => c.id === id);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">記錄</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
        >
          + 新增
        </button>
      </div>

      <div className="bg-white rounded-xl p-3 shadow-sm flex flex-col gap-2">
        <input
          type="text"
          placeholder="搜尋備註"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
        />
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TxType | 'all')}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm flex-1"
          >
            <option value="all">全部類型</option>
            <option value="expense">支出</option>
            <option value="income">收入</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm flex-1"
          >
            <option value="all">全部分類</option>
            {categories
              .filter((c) => typeFilter === 'all' || c.type === typeFilter)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="text-sm text-gray-400 py-16 text-center bg-white rounded-xl shadow-sm">
          找不到符合的記錄
        </div>
      ) : (
        grouped.map(([date, list]) => (
          <div key={date} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 font-medium">{date}</div>
            <div className="divide-y divide-gray-50">
              {list.map((t) => {
                const c = catOf(t.categoryId);
                return (
                  <button
                    key={t.id}
                    onClick={() => setEditing(t)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{c?.icon ?? '❔'}</span>
                      <div>
                        <div className="text-sm text-gray-800">{c?.name ?? '未分類'}</div>
                        {t.note && <div className="text-xs text-gray-400">{t.note}</div>}
                        {t.account && <div className="text-xs text-gray-300">{t.account}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`text-sm font-medium ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {t.type === 'income' ? '+' : '-'}
                        {formatCurrency(t.amount)}
                      </div>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('刪除這筆記錄？')) deleteTransaction(t.id);
                        }}
                        className="text-gray-300 hover:text-rose-500 text-sm px-1"
                      >
                        🗑
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-1.5 text-xs text-gray-400 flex justify-end">
              {formatDate(date)} 小計 {formatCurrency(list.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0))}
            </div>
          </div>
        ))
      )}

      {showAdd && <TransactionModal onClose={() => setShowAdd(false)} />}
      {editing && <TransactionModal editing={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
