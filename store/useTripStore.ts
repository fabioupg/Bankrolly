import { create } from 'zustand';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  trips,
  tripExpenses,
  type NewTrip,
  type NewTripExpense,
  type Trip,
  type TripExpense,
} from '@/db/schema';
import { newId } from '@/utils/id';

interface TripState {
  ownerId: string;
  trips: Trip[];
  expenses: TripExpense[];
  loading: boolean;
  error: string | null;
  setOwner: (ownerId: string) => Promise<void>;
  hydrate: () => Promise<void>;
  addTrip: (input: Omit<NewTrip, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => Promise<Trip>;
  updateTrip: (id: string, patch: Partial<NewTrip>) => Promise<void>;
  removeTrip: (id: string) => Promise<void>;
  addExpense: (input: Omit<NewTripExpense, 'id' | 'createdAt'>) => Promise<TripExpense>;
  updateExpense: (id: string, patch: Partial<NewTripExpense>) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
}

const nowIso = () => new Date().toISOString();

export const useTripStore = create<TripState>((set, get) => ({
  ownerId: '',
  trips: [],
  expenses: [],
  loading: false,
  error: null,

  setOwner: async (ownerId) => {
    if (ownerId === get().ownerId) return;
    set({ ownerId });
    await get().hydrate();
  },

  hydrate: async () => {
    const ownerId = get().ownerId;
    if (!ownerId) {
      set({ trips: [], expenses: [] });
      return;
    }
    set({ loading: true, error: null });
    try {
      const tripRows = await db
        .select()
        .from(trips)
        .where(eq(trips.ownerId, ownerId))
        .orderBy(desc(trips.startDate));
      const expenseRows = await db.select().from(tripExpenses).orderBy(desc(tripExpenses.date));
      const ownIds = new Set(tripRows.map((t) => t.id));
      const ownExpenses = expenseRows.filter((e) => ownIds.has(e.tripId));
      set({ trips: tripRows, expenses: ownExpenses, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  addTrip: async (input) => {
    const ownerId = get().ownerId;
    const row: NewTrip = {
      ...input,
      id: newId(),
      ownerId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await db.insert(trips).values(row);
    const inserted = row as Trip;
    set({ trips: [inserted, ...get().trips] });
    return inserted;
  },

  updateTrip: async (id, patch) => {
    const updated = { ...patch, updatedAt: nowIso() };
    await db.update(trips).set(updated).where(eq(trips.id, id));
    set({
      trips: get()
        .trips.map((t) => (t.id === id ? ({ ...t, ...updated } as Trip) : t))
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    });
  },

  removeTrip: async (id) => {
    const ownerId = get().ownerId;
    await db.delete(trips).where(and(eq(trips.id, id), eq(trips.ownerId, ownerId)));
    await db.delete(tripExpenses).where(eq(tripExpenses.tripId, id));
    set({
      trips: get().trips.filter((t) => t.id !== id),
      expenses: get().expenses.filter((e) => e.tripId !== id),
    });
  },

  addExpense: async (input) => {
    const row: NewTripExpense = {
      ...input,
      id: newId(),
      createdAt: nowIso(),
    };
    await db.insert(tripExpenses).values(row);
    const inserted = row as TripExpense;
    set({ expenses: [inserted, ...get().expenses] });
    if (input.tripId) {
      await get().updateTrip(input.tripId, {});
    }
    return inserted;
  },

  updateExpense: async (id, patch) => {
    await db.update(tripExpenses).set(patch).where(eq(tripExpenses.id, id));
    set({
      expenses: get().expenses.map((e) =>
        e.id === id ? ({ ...e, ...patch } as TripExpense) : e,
      ),
    });
  },

  removeExpense: async (id) => {
    await db.delete(tripExpenses).where(eq(tripExpenses.id, id));
    set({ expenses: get().expenses.filter((e) => e.id !== id) });
  },
}));
