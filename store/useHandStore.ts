import { create } from 'zustand';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { handNotes, type HandNote, type NewHandNote } from '@/db/schema';
import { newId } from '@/utils/id';

interface HandState {
  hands: HandNote[];
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  add: (input: Omit<NewHandNote, 'id' | 'createdAt'>) => Promise<HandNote>;
  update: (id: string, patch: Partial<NewHandNote>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  forSession: (sessionId: string) => HandNote[];
}

export const useHandStore = create<HandState>((set, get) => ({
  hands: [],
  loading: false,
  error: null,
  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const rows = await db.select().from(handNotes).orderBy(desc(handNotes.createdAt));
      set({ hands: rows, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },
  add: async (input) => {
    const row: NewHandNote = {
      ...input,
      id: newId(),
      createdAt: new Date().toISOString(),
    };
    await db.insert(handNotes).values(row);
    const inserted = row as HandNote;
    set({ hands: [inserted, ...get().hands] });
    return inserted;
  },
  update: async (id, patch) => {
    await db.update(handNotes).set(patch).where(eq(handNotes.id, id));
    set({
      hands: get().hands.map((h) => (h.id === id ? { ...h, ...patch } as HandNote : h)),
    });
  },
  remove: async (id) => {
    await db.delete(handNotes).where(eq(handNotes.id, id));
    set({ hands: get().hands.filter((h) => h.id !== id) });
  },
  forSession: (sessionId) => get().hands.filter((h) => h.sessionId === sessionId),
}));
