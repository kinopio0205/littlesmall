import { useState } from 'react';
import Modal from './Modal';
import { usePersonalStore } from '../store/personalStore';
import { todayISO } from '../utils/format';
import type { Transaction, TxType } from '../types';

interface Props {
  onClose: () => void;
  editing?: Transaction | null;
}

export default function TransactionModal({ onClose, editing }: Props) {
  const categories = usePersonalStore((s) => s.categories);
  const addTransaction = usePersonalStore((s) => s.addTransaction);
  const updateTransaction = usePersonalStore((s) => s.updateTransaction);

  const [type, setType] = useState<TxType>(editing?.type ?? 'expense');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [categoryId, setCategoryId] = useState(
    editing?.categoryId ?? categories.find((c) => c.type === (editing?.type ?? 'expense'))?.id ?? '',
  );
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [note, setNote] = useState(editing?.note ?? '');
  const [account, setAccount] = useState(editing?.account ?? '現金');

  const filteredCategories = categories.filter((c) => c.type === type);

  function switchType(t: TxType) {
    setType(t);
    const first = categories.find((c) => c.type === t);
    setCategoryId(first?.id ?? '');
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !categoryId) return;
    const payload = { type, amount: amt, categoryId, date, note, account };
    if (editing) {
      updateTransaction(editing.id, payload);
    } else {
      addTransaction(payload);
    }
    onClose();
  }

  return (
    <Modal title={editing ? '編輯記錄' : '新增記錄'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          <button
            type="button"
            onClick={() => switchType('expense')}
            className={`flex-1 py-2 text-sm font-medium ${type === 'expense' ? 'bg-rose-500 text-white' : 'bg-gray-50 text-gray-500'}`}
          >
            支出
          </button>
          <button
            type="button"
            onClick={() => switchType('income')}
            className={`flex-1 py-2 text-sm font-medium ${type === 'income' ? 'bg-emerald-500 text-white' : 'bg-gray-50 text-gray-500'}`}
          >
            收入
          </button>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">金額</label>
          <input
            autoFocus
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xl font-semibold"
            required
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">分類</label>
          <div className="grid grid-cols-4 gap-2">
            {filteredCategories.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`flex flex-col items-center gap-1 py-2 rounded-lg text-xs border ${
                  categoryId === c.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                    : 'border-gray-100 text-gray-600'
                }`}
              >
                <span className="text-lg">{c.icon}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">帳戶</label>
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="現金 / 信用卡"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">備註</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="選填"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          className="mt-2 w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
        >
          {editing ? '儲存' : '新增'}
        </button>
      </form>
    </Modal>
  );
}
