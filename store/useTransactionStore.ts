import { create } from 'zustand';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  bankrollTransactions,
  type BankrollTransaction,
  type NewBankrollTransaction,
} from '@/db/schema';
import { newId } from '@/utils/id';

interface TransactionState {
  /** Deposits, withdrawals, expenses and bonuses — never sessions. */
  transactions: BankrollTransaction[];
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  add: (input: Omit<NewBankrollTransaction, 'id' | 'createdAt'>) => Promise<BankrollTransaction>;
  update: (id: string, patch: Partial<NewBankrollTransaction>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  loading: false,
  error: null,

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const rows = await db
        .select()
        .from(bankrollTransactions)
        .orderBy(desc(bankrollTransactions.date));
      set({ transactions: rows, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  add: async (input) => {
    const row: NewBankrollTransaction = {
      ...input,
      id: newId(),
      createdAt: new Date().toISOString(),
    };
    await db.insert(bankrollTransactions).values(row);
    const inserted = row as BankrollTransaction;
    set({
      transactions: [inserted, ...get().transactions].sort((a, b) => b.date.localeCompare(a.date)),
    });
    return inserted;
  },

  update: async (id, patch) => {
    await db.update(bankrollTransactions).set(patch).where(eq(bankrollTransactions.id, id));
    set({
      transactions: get()
        .transactions.map((t) => (t.id === id ? ({ ...t, ...patch } as BankrollTransaction) : t))
        .sort((a, b) => b.date.localeCompare(a.date)),
    });
  },

  remove: async (id) => {
    await db.delete(bankrollTransactions).where(eq(bankrollTransactions.id, id));
    set({ transactions: get().transactions.filter((t) => t.id !== id) });
  },
}));

/** What the transactions add to (or take from) the bankroll. */
export function transactionsNet(rows: BankrollTransaction[]): number {
  return rows.reduce((sum, t) => sum + t.amount, 0);
}
