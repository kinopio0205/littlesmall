import type { GroupExpense, Member, Settlement } from '../types';

export interface DebtTransfer {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

/**
 * Greedy debt simplification: repeatedly settle the largest debtor against
 * the largest creditor until all balances are ~0. Produces the minimum
 * practical number of transactions for a given balance sheet.
 */
export function simplifyDebts(balances: Record<string, number>): DebtTransfer[] {
  const EPS = 0.005;
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const [id, amount] of Object.entries(balances)) {
    if (amount > EPS) creditors.push({ id, amount });
    else if (amount < -EPS) debtors.push({ id, amount: -amount });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers: DebtTransfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > EPS) {
      transfers.push({
        fromMemberId: debtor.id,
        toMemberId: creditor.id,
        amount: Math.round(amount * 100) / 100,
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount <= EPS) i++;
    if (creditor.amount <= EPS) j++;
  }

  return transfers;
}

/**
 * Pairwise ("independent") transfers: only nets debts between two people who
 * actually shared an expense or settlement together — never routes A's debt
 * through B to reach C. Produces more transactions than simplifyDebts, but
 * every transfer traces back to a real shared expense between those two.
 */
export function computeDirectTransfers(
  members: Member[],
  expenses: GroupExpense[],
  settlements: Settlement[],
): DebtTransfer[] {
  const EPS = 0.005;
  const owe: Record<string, Record<string, number>> = {};

  function add(debtor: string, creditor: string, amount: number) {
    if (debtor === creditor || amount === 0) return;
    owe[debtor] ??= {};
    owe[debtor][creditor] = (owe[debtor][creditor] ?? 0) + amount;
  }

  expenses.forEach((e) => {
    e.splits.forEach((s) => {
      if (s.memberId !== e.payerId) add(s.memberId, e.payerId, s.amount);
    });
  });

  settlements.forEach((s) => {
    add(s.fromMemberId, s.toMemberId, -s.amount);
  });

  const transfers: DebtTransfer[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i].id;
      const b = members[j].id;
      const aOwesB = owe[a]?.[b] ?? 0;
      const bOwesA = owe[b]?.[a] ?? 0;
      const net = Math.round((aOwesB - bOwesA) * 100) / 100;

      if (net > EPS) transfers.push({ fromMemberId: a, toMemberId: b, amount: net });
      else if (net < -EPS) transfers.push({ fromMemberId: b, toMemberId: a, amount: -net });
    }
  }

  return transfers.sort((a, b) => b.amount - a.amount);
}
