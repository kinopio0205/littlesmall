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
