import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupStore } from '../store/groupStore';
import { useIdentityStore } from '../store/identityStore';
import { getIdentityExpenseLines, getGroupsForIdentity, type IdentityExpenseLine } from '../utils/identity';
import { formatCurrency, formatDate } from '../utils/format';

export default function Records() {
  const identity = useIdentityStore((s) => s.name)!;
  const groups = useGroupStore((s) => s.groups);
  const roster = useGroupStore((s) => s.members);
  const expenses = useGroupStore((s) => s.expenses);
  const navigate = useNavigate();

  const [groupFilter, setGroupFilter] = useState('all');
  const [search, setSearch] = useState('');

  const myGroups = useMemo(() => getGroupsForIdentity(groups, roster, identity), [groups, roster, identity]);

  const allLines = useMemo(
    () => getIdentityExpenseLines(identity, groups, roster, expenses),
    [identity, groups, roster, expenses],
  );

  const filtered = useMemo(() => {
    return allLines.filter((l) => {
      if (groupFilter !== 'all' && l.group.id !== groupFilter) return false;
      if (search && !l.expense.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allLines, groupFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, IdentityExpenseLine[]>();
    filtered.forEach((l) => {
      const list = map.get(l.expense.date) ?? [];
      list.push(l);
      map.set(l.expense.date, list);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-slate-100">我的紀錄</h1>

      <div className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
        <input
          type="text"
          placeholder="搜尋項目"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-slate-700 bg-slate-800/60 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/60"
        />
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="w-full border border-slate-700 bg-slate-800/60 rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/60"
        >
          <option value="all">全部群組</option>
          {myGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.icon} {g.name}
            </option>
          ))}
        </select>
      </div>

      {grouped.length === 0 ? (
        <div className="text-sm text-slate-500 py-16 text-center bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl">
          找不到符合的紀錄
        </div>
      ) : (
        grouped.map(([date, list]) => (
          <div key={date} className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-800/60 text-xs text-slate-400 font-medium">{date}</div>
            <div className="divide-y divide-slate-800">
              {list.map(({ group, expense, share, isPayer }) => (
                <button
                  key={expense.id}
                  onClick={() => navigate(`/groups/${group.id}?edit=${expense.id}`)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/60 text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{expense.icon}</span>
                    <div>
                      <div className="text-sm text-slate-200">{expense.description}</div>
                      <div className="text-xs text-slate-500">
                        {group.icon} {group.name}
                        {isPayer && ' · 你付款'}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-slate-100">{formatCurrency(share)}</div>
                </button>
              ))}
            </div>
            <div className="px-4 py-1.5 text-xs text-slate-500 flex justify-end">
              {formatDate(date)} 小計 {formatCurrency(list.reduce((s, l) => s + l.share, 0))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
