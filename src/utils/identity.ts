import type { Group, GroupExpense, Settlement } from '../types';
import { computeGroupBalances } from '../store/groupStore';

export function getAllMemberNames(groups: Group[]): string[] {
  const names = new Set<string>();
  groups.forEach((g) => g.members.forEach((m) => names.add(m.name)));
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
}

export function getMemberInGroup(group: Group, identityName: string) {
  return group.members.find((m) => m.name === identityName);
}

export function getGroupsForIdentity(groups: Group[], identityName: string): Group[] {
  return groups.filter((g) => getMemberInGroup(g, identityName));
}

export interface IdentityExpenseLine {
  group: Group;
  expense: GroupExpense;
  share: number;
  isPayer: boolean;
  paidAmount: number;
}

/** All expense line items across groups that involve this identity, newest first. */
export function getIdentityExpenseLines(
  identityName: string,
  groups: Group[],
  expenses: GroupExpense[],
): IdentityExpenseLine[] {
  const lines: IdentityExpenseLine[] = [];
  groups.forEach((g) => {
    const member = getMemberInGroup(g, identityName);
    if (!member) return;
    expenses
      .filter((e) => e.groupId === g.id)
      .forEach((e) => {
        const isPayer = e.payerId === member.id;
        const splitEntry = e.splits.find((s) => s.memberId === member.id);
        if (!isPayer && !splitEntry) return;
        lines.push({
          group: g,
          expense: e,
          share: splitEntry?.amount ?? 0,
          isPayer,
          paidAmount: isPayer ? e.amount : 0,
        });
      });
  });
  return lines.sort((a, b) => (a.expense.date < b.expense.date ? 1 : -1));
}

/** This identity's net balance (positive = should receive) within each group they belong to. */
export function getIdentityGroupBalances(
  identityName: string,
  groups: Group[],
  expenses: GroupExpense[],
  settlements: Settlement[],
): { group: Group; balance: number }[] {
  return getGroupsForIdentity(groups, identityName).map((g) => {
    const member = getMemberInGroup(g, identityName)!;
    const balances = computeGroupBalances(g.id, g.members, expenses, settlements);
    return { group: g, balance: balances[member.id] ?? 0 };
  });
}

export function getIdentityTotalBalance(
  identityName: string,
  groups: Group[],
  expenses: GroupExpense[],
  settlements: Settlement[],
): number {
  return getIdentityGroupBalances(identityName, groups, expenses, settlements).reduce(
    (sum, g) => sum + g.balance,
    0,
  );
}
