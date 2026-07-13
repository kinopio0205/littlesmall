import { useMemo, useState } from 'react';
import { useGroupStore } from '../store/groupStore';
import { useIdentityStore } from '../store/identityStore';
import { getIdentityExpenseLines } from '../utils/identity';
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
  const identity = useIdentityStore((s) => s.name)!;
  const groups = useGroupStore((s) => s.groups);
  const roster = useGroupStore((s) => s.members);
  const expenses = useGroupStore((s) => s.expenses);
  const [month, setMonth] = useState(todayISO().slice(0, 7));

  const allLines = useMemo(
    () => getIdentityExpenseLines(identity, groups, roster, expenses),
    [identity, groups, roster, expenses],
  );

  const monthLines = useMemo(() => allLines.filter((l) => l.expense.date.startsWith(month)), [allLines, month]);
  const share = monthLines.reduce((s, l) => s + l.share, 0);
  const paid = monthLines.reduce((s, l) => s + l.paidAmount, 0);

  const groupBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    monthLines.forEach((l) => map.set(l.group.id, (map.get(l.group.id) ?? 0) + l.share));
    return Array.from(map.entries())
      .map(([groupId, value]) => {
        const g = groups.find((g) => g.id === groupId);
        return { name: g ? `${g.icon} ${g.name}` : '未知群組', value };
      })
      .sort((a, b) => b.value - a.value);
  }, [monthLines, groups]);

  const iconBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    monthLines.forEach((l) => map.set(l.expense.icon, (map.get(l.expense.icon) ?? 0) + l.share));
    return Array.from(map.entries())
      .map(([icon, value]) => ({ name: icon, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthLines]);

  const trend = useMemo(() => {
    const months: string[] = [];
    const base = new Date(`${month}-01T00:00:00`);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months.map((m) => {
      const list = allLines.filter((l) => l.expense.date.startsWith(m));
      return {
        month: m.slice(5),
        你的花費: list.reduce((s, l) => s + l.share, 0),
        你代墊: list.reduce((s, l) => s + l.paidAmount, 0),
      };
    });
  }, [allLines, month]);

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
          <div className="text-xs text-gray-400">你的花費</div>
          <div className="text-lg font-semibold text-rose-500 mt-1">{formatCurrency(share)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-xs text-gray-400">你代墊</div>
          <div className="text-lg font-semibold text-emerald-500 mt-1">{formatCurrency(paid)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-xs text-gray-400">淨額</div>
          <div className="text-lg font-semibold text-gray-800 mt-1">{formatCurrency(paid - share)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="font-medium text-gray-800 mb-2">近半年趨勢</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} width={40} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend />
              <Bar dataKey="你代墊" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="你的花費" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="font-medium text-gray-800 mb-2">各群組花費佔比</div>
        {groupBreakdown.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">本月尚無紀錄</div>
        ) : (
          <div className="flex items-center">
            <div className="w-40 h-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={groupBreakdown} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                    {groupBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 flex flex-col gap-1.5 pl-2">
              {groupBreakdown.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {c.name}
                  </span>
                  <span className="text-gray-800 font-medium">
                    {formatCurrency(c.value)}
                    <span className="text-gray-400 ml-1">({((c.value / share) * 100 || 0).toFixed(0)}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {iconBreakdown.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="font-medium text-gray-800 mb-2">依項目類型</div>
          <div className="flex flex-col gap-1.5">
            {iconBreakdown.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-sm">
                <span className="text-lg">{c.name}</span>
                <span className="text-gray-800 font-medium">{formatCurrency(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
