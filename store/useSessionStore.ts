import { create } from 'zustand';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { cashSessions, type CashSession, type NewCashSession } from '@/db/schema';
import { newId } from '@/utils/id';

interface CashSessionState {
  sessions: CashSession[];
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  add: (input: Omit<NewCashSession, 'id' | 'createdAt'>) => Promise<CashSession>;
  update: (id: string, patch: Partial<NewCashSession>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  byId: (id: string) => CashSession | undefined;
}

export const useSessionStore = create<CashSessionState>((set, get) => ({
  sessions: [],
  loading: false,
  error: null,
  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const rows = await db.select().from(cashSessions).orderBy(desc(cashSessions.date));
      set({ sessions: rows, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },
  add: async (input) => {
    const row: NewCashSession = {
      ...input,
      id: newId(),
      createdAt: new Date().toISOString(),
    };
    await db.insert(cashSessions).values(row);
    const inserted = row as CashSession;
    set({ sessions: [inserted, ...get().sessions] });
    return inserted;
  },
  update: async (id, patch) => {
    await db.update(cashSessions).set(patch).where(eq(cashSessions.id, id));
    set({
      sessions: get()
        .sessions.map((s) => (s.id === id ? { ...s, ...patch } as CashSession : s))
        .sort((a, b) => b.date.localeCompare(a.date)),
    });
  },
  remove: async (id) => {
    await db.delete(cashSessions).where(eq(cashSessions.id, id));
    set({ sessions: get().sessions.filter((s) => s.id !== id) });
  },
  byId: (id) => get().sessions.find((s) => s.id === id),
}));
