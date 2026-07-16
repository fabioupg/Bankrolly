import { create } from 'zustand';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { onlineSessions, type NewOnlineSession, type OnlineSession } from '@/db/schema';
import { newId } from '@/utils/id';

interface OnlineSessionState {
  sessions: OnlineSession[];
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  add: (input: Omit<NewOnlineSession, 'id' | 'createdAt'>) => Promise<OnlineSession>;
  update: (id: string, patch: Partial<NewOnlineSession>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  byId: (id: string) => OnlineSession | undefined;
}

export const useOnlineSessionStore = create<OnlineSessionState>((set, get) => ({
  sessions: [],
  loading: false,
  error: null,
  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const rows = await db.select().from(onlineSessions).orderBy(desc(onlineSessions.date));
      set({ sessions: rows, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },
  add: async (input) => {
    const row: NewOnlineSession = {
      ...input,
      id: newId(),
      createdAt: new Date().toISOString(),
    };
    await db.insert(onlineSessions).values(row);
    const inserted = row as OnlineSession;
    set({ sessions: [inserted, ...get().sessions] });
    return inserted;
  },
  update: async (id, patch) => {
    await db.update(onlineSessions).set(patch).where(eq(onlineSessions.id, id));
    set({
      sessions: get()
        .sessions.map((s) => (s.id === id ? ({ ...s, ...patch } as OnlineSession) : s))
        .sort((a, b) => b.date.localeCompare(a.date)),
    });
  },
  remove: async (id) => {
    await db.delete(onlineSessions).where(eq(onlineSessions.id, id));
    set({ sessions: get().sessions.filter((s) => s.id !== id) });
  },
  byId: (id) => get().sessions.find((s) => s.id === id),
}));
