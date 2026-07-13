import { useState } from 'react';
import Modal from './Modal';
import { useGroupStore } from '../store/groupStore';
import { todayISO } from '../utils/format';
import type { Member } from '../types';

interface Props {
  groupId: string;
  members: Member[];
  onClose: () => void;
  defaultFrom?: string;
  defaultTo?: string;
  defaultAmount?: number;
}

export default function SettleModal({ groupId, members, onClose, defaultFrom, defaultTo, defaultAmount }: Props) {
  const addSettlement = useGroupStore((s) => s.addSettlement);

  const [fromMemberId, setFromMemberId] = useState(defaultFrom ?? members[0]?.id ?? '');
  const [toMemberId, setToMemberId] = useState(defaultTo ?? members[1]?.id ?? '');
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : '');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || fromMemberId === toMemberId) return;
    addSettlement({ groupId, fromMemberId, toMemberId, amount: amt, date, note });
    onClose();
  }

  return (
    <Modal title="記錄還款" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">付款人</label>
            <select
              value={fromMemberId}
              onChange={(e) => setFromMemberId(e.target.value)}
              className="w-full border border-slate-700 bg-slate-800/60 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/60"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">收款人</label>
            <select
              value={toMemberId}
              onChange={(e) => setToMemberId(e.target.value)}
              className="w-full border border-slate-700 bg-slate-800/60 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/60"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">金額</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-slate-700 bg-slate-800/60 rounded-lg px-3 py-2 text-lg font-semibold text-slate-100 focus:outline-none focus:border-cyan-400/60"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-slate-700 bg-slate-800/60 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/60"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">備註</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="選填"
              className="w-full border border-slate-700 bg-slate-800/60 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/60"
            />
          </div>
        </div>
        {fromMemberId === toMemberId && (
          <div className="text-xs text-rose-400">付款人與收款人不能相同</div>
        )}
        <button
          type="submit"
          className="mt-1 w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:from-cyan-400 hover:to-violet-500"
        >
          確認記錄
        </button>
      </form>
    </Modal>
  );
}
