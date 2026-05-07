import { create } from 'zustand';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { tournaments, type NewTournament, type Tournament } from '@/db/schema';
import { newId } from '@/utils/id';

interface TournamentState {
  tourneys: Tournament[];
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  add: (input: Omit<NewTournament, 'id' | 'createdAt'>) => Promise<Tournament>;
  update: (id: string, patch: Partial<NewTournament>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  byId: (id: string) => Tournament | undefined;
}

export const useTournamentStore = create<TournamentState>((set, get) => ({
  tourneys: [],
  loading: false,
  error: null,
  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const rows = await db.select().from(tournaments).orderBy(desc(tournaments.date));
      set({ tourneys: rows, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },
  add: async (input) => {
    const row: NewTournament = {
      ...input,
      id: newId(),
      createdAt: new Date().toISOString(),
    };
    await db.insert(tournaments).values(row);
    const inserted = row as Tournament;
    set({ tourneys: [inserted, ...get().tourneys] });
    return inserted;
  },
  update: async (id, patch) => {
    await db.update(tournaments).set(patch).where(eq(tournaments.id, id));
    set({
      tourneys: get()
        .tourneys.map((t) => (t.id === id ? { ...t, ...patch } as Tournament : t))
        .sort((a, b) => b.date.localeCompare(a.date)),
    });
  },
  remove: async (id) => {
    await db.delete(tournaments).where(eq(tournaments.id, id));
    set({ tourneys: get().tourneys.filter((t) => t.id !== id) });
  },
  byId: (id) => get().tourneys.find((t) => t.id === id),
}));
