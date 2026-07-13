import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { Group, GroupExpense, Member, Settlement, SplitType, SplitEntry } from '../types';

interface GroupState {
  groups: Group[];
  expenses: GroupExpense[];
  settlements: Settlement[];

  addGroup: (name: string, icon: string, memberNames: string[]) => string;
  updateGroup: (id: string, name: string, icon: string) => void;
  deleteGroup: (id: string) => void;

  addMember: (groupId: string, name: string) => void;
  removeMember: (groupId: string, memberId: string) => void;

  addExpense: (expense: Omit<GroupExpense, 'id'>) => void;
  updateExpense: (id: string, expense: Omit<GroupExpense, 'id'>) => void;
  deleteExpense: (id: string) => void;

  addSettlement: (settlement: Omit<Settlement, 'id'>) => void;
  deleteSettlement: (id: string) => void;
}

export const useGroupStore = create<GroupState>()(
  (set) => ({
      groups: [],
      expenses: [],
      settlements: [],

      addGroup: (name, icon, memberNames) => {
        const id = uuid();
        const members: Member[] = memberNames
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => ({ id: uuid(), name: n }));
        set((state) => ({
          groups: [
            ...state.groups,
            { id, name, icon, members, createdAt: new Date().toISOString() },
          ],
        }));
        return id;
      },

      updateGroup: (id, name, icon) =>
        set((state) => ({
          groups: state.groups.map((g) => (g.id === id ? { ...g, name, icon } : g)),
        })),

      deleteGroup: (id) =>
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== id),
          expenses: state.expenses.filter((e) => e.groupId !== id),
          settlements: state.settlements.filter((s) => s.groupId !== id),
        })),

      addMember: (groupId, name) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId
              ? { ...g, members: [...g.members, { id: uuid(), name: name.trim() }] }
              : g,
          ),
        })),

      removeMember: (groupId, memberId) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId
              ? { ...g, members: g.members.filter((m) => m.id !== memberId) }
              : g,
          ),
        })),

      addExpense: (expense) =>
        set((state) => ({
          expenses: [{ ...expense, id: uuid() }, ...state.expenses],
        })),

      updateExpense: (id, expense) =>
        set((state) => ({
          expenses: state.expenses.map((e) => (e.id === id ? { ...expense, id } : e)),
        })),

      deleteExpense: (id) =>
        set((state) => ({
          expenses: state.expenses.filter((e) => e.id !== id),
        })),

      addSettlement: (settlement) =>
        set((state) => ({
          settlements: [{ ...settlement, id: uuid() }, ...state.settlements],
        })),

      deleteSettlement: (id) =>
        set((state) => ({
          settlements: state.settlements.filter((s) => s.id !== id),
        })),
  }),
);

/** Compute each member's net balance in a group: positive = should receive money. */
export function computeGroupBalances(
  groupId: string,
  members: Member[],
  expenses: GroupExpense[],
  settlements: Settlement[],
): Record<string, number> {
  const balances: Record<string, number> = {};
  members.forEach((m) => (balances[m.id] = 0));

  expenses
    .filter((e) => e.groupId === groupId)
    .forEach((e) => {
      balances[e.payerId] = (balances[e.payerId] ?? 0) + e.amount;
      e.splits.forEach((s) => {
        balances[s.memberId] = (balances[s.memberId] ?? 0) - s.amount;
      });
    });

  settlements
    .filter((s) => s.groupId === groupId)
    .forEach((s) => {
      balances[s.fromMemberId] = (balances[s.fromMemberId] ?? 0) + s.amount;
      balances[s.toMemberId] = (balances[s.toMemberId] ?? 0) - s.amount;
    });

  return balances;
}

/** Build split entries for an expense given a split type and raw inputs. */
export function buildSplits(
  memberIds: string[],
  amount: number,
  splitType: SplitType,
  rawValues: Record<string, number>,
): SplitEntry[] {
  if (splitType === 'equal') {
    const n = memberIds.length;
    const base = Math.floor((amount / n) * 100) / 100;
    let remainder = Math.round((amount - base * n) * 100) / 100;
    return memberIds.map((id) => {
      let amt = base;
      if (remainder > 0) {
        amt = Math.round((amt + 0.01) * 100) / 100;
        remainder = Math.round((remainder - 0.01) * 100) / 100;
      }
      return { memberId: id, amount: amt };
    });
  }

  if (splitType === 'percentage') {
    return memberIds.map((id) => ({
      memberId: id,
      amount: Math.round(amount * (rawValues[id] ?? 0) * 100) / 10000,
      rawValue: rawValues[id] ?? 0,
    }));
  }

  if (splitType === 'shares') {
    const totalShares = memberIds.reduce((sum, id) => sum + (rawValues[id] ?? 0), 0) || 1;
    return memberIds.map((id) => ({
      memberId: id,
      amount: Math.round((amount * (rawValues[id] ?? 0) * 100) / totalShares) / 100,
      rawValue: rawValues[id] ?? 0,
    }));
  }

  // exact
  return memberIds.map((id) => ({
    memberId: id,
    amount: Math.round((rawValues[id] ?? 0) * 100) / 100,
  }));
}
