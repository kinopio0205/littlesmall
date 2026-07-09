import { useMemo, useState } from 'react';
import Modal from './Modal';
import { useGroupStore, buildSplits } from '../store/groupStore';
import { todayISO, formatCurrency } from '../utils/format';
import type { GroupExpense, Group, SplitType } from '../types';

interface Props {
  group: Group;
  onClose: () => void;
  editing?: GroupExpense | null;
}

const ICONS = ['🍽️', '🚕', '🏨', '🎟️', '🛒', '☕', '🍺', '📦'];

export default function ExpenseModal({ group, onClose, editing }: Props) {
  const addExpense = useGroupStore((s) => s.addExpense);
  const updateExpense = useGroupStore((s) => s.updateExpense);
  const deleteExpense = useGroupStore((s) => s.deleteExpense);

  const [description, setDescription] = useState(editing?.description ?? '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [payerId, setPayerId] = useState(editing?.payerId ?? group.members[0]?.id ?? '');
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [icon, setIcon] = useState(editing?.icon ?? ICONS[0]);
  const [splitType, setSplitType] = useState<SplitType>(editing?.splitType ?? 'equal');
  const [participants, setParticipants] = useState<string[]>(
    editing ? editing.splits.map((s) => s.memberId) : group.members.map((m) => m.id),
  );
  const [rawValues, setRawValues] = useState<Record<string, number>>(() => {
    if (editing) {
      const map: Record<string, number> = {};
      editing.splits.forEach((s) => (map[s.memberId] = s.rawValue ?? s.amount));
      return map;
    }
    return {};
  });

  const amt = parseFloat(amount) || 0;

  function toggleParticipant(id: string) {
    setParticipants((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  const preview = useMemo(() => {
    if (participants.length === 0 || amt <= 0) return [];
    return buildSplits(participants, amt, splitType, rawValues);
  }, [participants, amt, splitType, rawValues]);

  const previewSum = preview.reduce((s, p) => s + p.amount, 0);
  const rawSum = participants.reduce((s, id) => s + (rawValues[id] ?? 0), 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || amt <= 0 || !payerId || participants.length === 0) return;
    if (splitType === 'exact' && Math.abs(rawSum - amt) > 0.01) return;
    if (splitType === 'percentage' && Math.abs(rawSum - 100) > 0.5) return;

    const splits = buildSplits(participants, amt, splitType, rawValues);
    const payload = {
      groupId: group.id,
      description: description.trim(),
      amount: amt,
      payerId,
      date,
      splitType,
      splits,
      icon,
    };
    if (editing) {
      updateExpense(editing.id, payload);
    } else {
      addExpense(payload);
    }
    onClose();
  }

  return (
    <Modal title={editing ? '編輯支出' : '新增支出'} onClose={onClose} wide>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">項目</label>
          <div className="flex gap-2">
            <div className="flex gap-1">
              {ICONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setIcon(e)}
                  className={`text-lg px-2 py-1.5 rounded-lg border ${icon === e ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例：晚餐、計程車"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-2"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">金額</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-lg font-semibold"
              required
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">誰付的錢</label>
          <select
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            {group.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">分帳方式</label>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
            {(
              [
                ['equal', '均分'],
                ['percentage', '百分比'],
                ['exact', '自訂金額'],
                ['shares', '比例份數'],
              ] as [SplitType, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                onClick={() => setSplitType(t)}
                className={`flex-1 py-2 font-medium ${splitType === t ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            參與分帳成員
            {splitType === 'exact' && ` (合計需為 ${formatCurrency(amt)}，目前 ${formatCurrency(rawSum)})`}
            {splitType === 'percentage' && ` (合計需為 100%，目前 ${rawSum}%)`}
          </label>
          <div className="flex flex-col gap-2">
            {group.members.map((m) => {
              const included = participants.includes(m.id);
              const splitEntry = preview.find((p) => p.memberId === m.id);
              return (
                <div
                  key={m.id}
                  className={`flex items-center gap-2 border rounded-lg px-3 py-2 ${included ? 'border-gray-200' : 'border-gray-100 opacity-50'}`}
                >
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={() => toggleParticipant(m.id)}
                    className="shrink-0"
                  />
                  <span className="text-sm text-gray-700 flex-1">{m.name}</span>
                  {included && splitType !== 'equal' && (
                    <input
                      type="number"
                      step="0.01"
                      value={rawValues[m.id] ?? ''}
                      onChange={(e) =>
                        setRawValues((v) => ({ ...v, [m.id]: parseFloat(e.target.value) || 0 }))
                      }
                      placeholder={splitType === 'percentage' ? '%' : splitType === 'shares' ? '份數' : '金額'}
                      className="w-20 border border-gray-200 rounded px-2 py-1 text-sm text-right"
                    />
                  )}
                  {included && (
                    <span className="text-xs text-gray-400 w-16 text-right">
                      {splitEntry ? formatCurrency(splitEntry.amount) : ''}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {amt > 0 && Math.abs(previewSum - amt) > 0.02 && splitType !== 'exact' && (
            <div className="text-xs text-amber-500 mt-1">分配總額 {formatCurrency(previewSum)} 與總金額有落差</div>
          )}
        </div>

        <div className="flex gap-2">
          {editing && (
            <button
              type="button"
              onClick={() => {
                if (confirm('刪除這筆支出？')) {
                  deleteExpense(editing.id);
                  onClose();
                }
              }}
              className="flex-1 py-2.5 rounded-lg border border-rose-200 text-rose-500 text-sm font-medium hover:bg-rose-50"
            >
              刪除
            </button>
          )}
          <button
            type="submit"
            className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
          >
            {editing ? '儲存' : '新增支出'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
