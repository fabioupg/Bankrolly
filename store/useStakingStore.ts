import { create } from 'zustand';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { stakingDeals, type NewStakingDeal, type StakingDeal } from '@/db/schema';
import { newId } from '@/utils/id';
import { settleStaking } from '@/utils/staking';

interface StakingState {
  ownerId: string;
  deals: StakingDeal[];
  loading: boolean;
  error: string | null;
  setOwner: (ownerId: string) => Promise<void>;
  hydrate: () => Promise<void>;
  add: (
    input: Omit<NewStakingDeal, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  ) => Promise<StakingDeal>;
  update: (id: string, patch: Partial<NewStakingDeal>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /**
   * Makeup a new deal with this counterparty should start from: the makeup left
   * over from their most recent deal in the same direction.
   */
  suggestMakeup: (counterparty: string, direction: string) => number;
}

const nowIso = () => new Date().toISOString();

export const useStakingStore = create<StakingState>((set, get) => ({
  ownerId: '',
  deals: [],
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
      set({ deals: [] });
      return;
    }
    set({ loading: true, error: null });
    try {
      const rows = await db
        .select()
        .from(stakingDeals)
        .where(eq(stakingDeals.ownerId, ownerId))
        .orderBy(desc(stakingDeals.date));
      set({ deals: rows, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  add: async (input) => {
    const row: NewStakingDeal = {
      ...input,
      id: newId(),
      ownerId: get().ownerId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await db.insert(stakingDeals).values(row);
    const inserted = row as StakingDeal;
    set({
      deals: [inserted, ...get().deals].sort((a, b) => b.date.localeCompare(a.date)),
    });
    return inserted;
  },

  update: async (id, patch) => {
    const updated = { ...patch, updatedAt: nowIso() };
    await db.update(stakingDeals).set(updated).where(eq(stakingDeals.id, id));
    set({
      deals: get()
        .deals.map((d) => (d.id === id ? ({ ...d, ...updated } as StakingDeal) : d))
        .sort((a, b) => b.date.localeCompare(a.date)),
    });
  },

  remove: async (id) => {
    const ownerId = get().ownerId;
    await db
      .delete(stakingDeals)
      .where(and(eq(stakingDeals.id, id), eq(stakingDeals.ownerId, ownerId)));
    set({ deals: get().deals.filter((d) => d.id !== id) });
  },

  suggestMakeup: (counterparty, direction) => {
    const name = counterparty.trim().toLowerCase();
    if (!name) return 0;
    // Deals are kept newest-first, so the first match is the most recent one
    // whose leftover makeup should roll into the next deal.
    const prior = get().deals.find(
      (d) => d.direction === direction && d.counterparty.trim().toLowerCase() === name,
    );
    return prior
      ? settleStaking({ ...prior, direction: prior.direction as 'backed' | 'backing' }).makeupAfter
      : 0;
  },
}));
