import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import type { Category, Transaction, TxType } from '../types';

const defaultCategories: Category[] = [
  { id: 'c-food', name: '餐飲', icon: '🍚', type: 'expense' },
  { id: 'c-transport', name: '交通', icon: '🚗', type: 'expense' },
  { id: 'c-shopping', name: '購物', icon: '🛍️', type: 'expense' },
  { id: 'c-entertainment', name: '娛樂', icon: '🎮', type: 'expense' },
  { id: 'c-home', name: '居家', icon: '🏠', type: 'expense' },
  { id: 'c-medical', name: '醫療', icon: '💊', type: 'expense' },
  { id: 'c-edu', name: '教育', icon: '📚', type: 'expense' },
  { id: 'c-other-e', name: '其他支出', icon: '📦', type: 'expense' },
  { id: 'c-salary', name: '薪資', icon: '💰', type: 'income' },
  { id: 'c-bonus', name: '獎金', icon: '🎁', type: 'income' },
  { id: 'c-invest', name: '投資', icon: '📈', type: 'income' },
  { id: 'c-other-i', name: '其他收入', icon: '🧾', type: 'income' },
];

interface PersonalState {
  categories: Category[];
  transactions: Transaction[];
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, tx: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  addCategory: (name: string, icon: string, type: TxType) => void;
  updateCategory: (id: string, name: string, icon: string) => void;
  deleteCategory: (id: string) => void;
}

export const usePersonalStore = create<PersonalState>()(
  persist(
    (set) => ({
      categories: defaultCategories,
      transactions: [],
      addTransaction: (tx) =>
        set((state) => ({
          transactions: [{ ...tx, id: uuid() }, ...state.transactions],
        })),
      updateTransaction: (id, tx) =>
        set((state) => ({
          transactions: state.transactions.map((t) => (t.id === id ? { ...tx, id } : t)),
        })),
      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
        })),
      addCategory: (name, icon, type) =>
        set((state) => ({
          categories: [...state.categories, { id: uuid(), name, icon, type }],
        })),
      updateCategory: (id, name, icon) =>
        set((state) => ({
          categories: state.categories.map((c) => (c.id === id ? { ...c, name, icon } : c)),
        })),
      deleteCategory: (id) =>
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
        })),
    }),
    { name: 'ledger-personal' },
  ),
);
