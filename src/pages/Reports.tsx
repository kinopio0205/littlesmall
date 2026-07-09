import { useMemo, useState } from 'react';
import { usePersonalStore } from '../store/personalStore';
import { formatCurrency, todayISO } from '../utils/format';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
  CartesianGrid,
} from 'recharts';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#f43f5e', '#84cc16'];

export default function Reports() {
  const transactions = usePersonalStore((s) => s.transactions);
  const categories = usePersonalStore((s) => s.categories);
  const [month, setMonth] = useState(todayISO().slice(0, 7));

  const monthTx = useMemo(() => transactions.filter((t) => t.date.startsWith(month)), [transactions, month]);
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

  const trend = useMemo(() => {
    const months: string[] = [];
    const base = new Date(`${month}-01T00:00:00`);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months.map((m) => {
      const list = transactions.filter((t) => t.date.startsWith(m));
      return {
        month: m.slice(5),
        收入: list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        支出: list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      };
    });
  }, [transactions, month]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">報表</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-xs text-gray-400">收入</div>
          <div className="text-lg font-semibold text-emerald-500 mt-1">{formatCurrency(income)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-xs text-gray-400">支出</div>
          <div className="text-lg font-semibold text-rose-500 mt-1">{formatCurrency(expense)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-xs text-gray-400">結餘</div>
          <div className="text-lg font-semibold text-gray-800 mt-1">{formatCurrency(income - expense)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="font-medium text-gray-800 mb-2">近半年收支趨勢</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} width={40} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="收入" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="支出" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="font-medium text-gray-800 mb-2">支出分類佔比</div>
        {categoryBreakdown.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">本月尚無支出</div>
        ) : (
          <div className="flex items-center">
            <div className="w-40 h-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                    {categoryBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 flex flex-col gap-1.5 pl-2">
              {categoryBreakdown.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {c.name}
                  </span>
                  <span className="text-gray-800 font-medium">
                    {formatCurrency(c.value)}
                    <span className="text-gray-400 ml-1">({((c.value / expense) * 100 || 0).toFixed(0)}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
