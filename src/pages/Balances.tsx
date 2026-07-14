import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupStore } from '../store/groupStore';
import { useIdentityStore } from '../store/identityStore';
import { getPersonalLedger } from '../utils/identity';
import { formatCurrency } from '../utils/format';

export default function Balances() {
  const identity = useIdentityStore((s) => s.name)!;
  const groups = useGroupStore((s) => s.groups);
  const roster = useGroupStore((s) => s.members);
  const expenses = useGroupStore((s) => s.expenses);
  const settlements = useGroupStore((s) => s.settlements);
  const navigate = useNavigate();

  const ledger = useMemo(
    () => getPersonalLedger(identity, groups, roster, expenses, settlements),
    [identity, groups, roster, expenses, settlements],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">跟大家的餘額</h1>
        <p className="text-sm text-slate-500 mt-0.5">跨群組整合，點「標記已還款」會連到對應群組的建議轉帳</p>
      </div>

      {ledger.length === 0 ? (
        <div className="text-sm text-slate-500 py-16 text-center bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl">
          目前跟大家都已結清 🎉
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {ledger.map((person) => (
            <div key={person.otherName} className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <span className="text-sm font-medium text-slate-100">{person.otherName}</span>
                <span
                  className={`text-sm font-medium ${
                    person.net > 0.01 ? 'text-emerald-400' : person.net < -0.01 ? 'text-rose-400' : 'text-slate-500'
                  }`}
                >
                  {person.net > 0.01
                    ? `應收 ${formatCurrency(person.net)}`
                    : person.net < -0.01
                      ? `應付 ${formatCurrency(-person.net)}`
                      : '已結清'}
                </span>
              </div>
              <div className="divide-y divide-slate-800">
                {person.entries.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div className="text-xs text-slate-400">
                      {entry.group.icon} {entry.group.name} ·{' '}
                      {entry.youOwe ? `你 → ${person.otherName}` : `${person.otherName} → 你`}
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-sm font-medium text-slate-200">{formatCurrency(entry.amount)}</span>
                      <button
                        onClick={() =>
                          navigate(
                            `/groups/${entry.group.id}?settleFrom=${entry.fromMemberId}&settleTo=${entry.toMemberId}&settleAmount=${entry.amount}`,
                          )
                        }
                        className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 whitespace-nowrap"
                      >
                        標記已還款
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
