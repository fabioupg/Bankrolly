import { create } from 'zustand';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  players,
  playerHands,
  type NewPlayer,
  type NewPlayerHand,
  type Player,
  type PlayerHand,
} from '@/db/schema';
import { newId } from '@/utils/id';

interface PlayerState {
  ownerId: string;
  players: Player[];
  hands: PlayerHand[];
  loading: boolean;
  error: string | null;
  setOwner: (ownerId: string) => Promise<void>;
  hydrate: () => Promise<void>;
  addPlayer: (input: Omit<NewPlayer, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => Promise<Player>;
  updatePlayer: (id: string, patch: Partial<NewPlayer>) => Promise<void>;
  removePlayer: (id: string) => Promise<void>;
  addHand: (input: Omit<NewPlayerHand, 'id' | 'createdAt'>) => Promise<PlayerHand>;
  updateHand: (id: string, patch: Partial<NewPlayerHand>) => Promise<void>;
  removeHand: (id: string) => Promise<void>;
}

const nowIso = () => new Date().toISOString();

export const usePlayerStore = create<PlayerState>((set, get) => ({
  ownerId: '',
  players: [],
  hands: [],
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
      set({ players: [], hands: [] });
      return;
    }
    set({ loading: true, error: null });
    try {
      const playerRows = await db
        .select()
        .from(players)
        .where(eq(players.ownerId, ownerId))
        .orderBy(desc(players.updatedAt));
      const handRows = await db.select().from(playerHands).orderBy(desc(playerHands.createdAt));
      const ownIds = new Set(playerRows.map((p) => p.id));
      const ownHands = handRows.filter((h) => ownIds.has(h.playerId));
      set({ players: playerRows, hands: ownHands, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  addPlayer: async (input) => {
    const ownerId = get().ownerId;
    const row: NewPlayer = {
      ...input,
      id: newId(),
      ownerId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await db.insert(players).values(row);
    const inserted = row as Player;
    set({ players: [inserted, ...get().players] });
    return inserted;
  },

  updatePlayer: async (id, patch) => {
    const updated = { ...patch, updatedAt: nowIso() };
    await db.update(players).set(updated).where(eq(players.id, id));
    set({
      players: get()
        .players.map((p) => (p.id === id ? ({ ...p, ...updated } as Player) : p))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    });
  },

  removePlayer: async (id) => {
    const ownerId = get().ownerId;
    await db.delete(players).where(and(eq(players.id, id), eq(players.ownerId, ownerId)));
    await db.delete(playerHands).where(eq(playerHands.playerId, id));
    set({
      players: get().players.filter((p) => p.id !== id),
      hands: get().hands.filter((h) => h.playerId !== id),
    });
  },

  addHand: async (input) => {
    const row: NewPlayerHand = {
      ...input,
      id: newId(),
      createdAt: nowIso(),
    };
    await db.insert(playerHands).values(row);
    const inserted = row as PlayerHand;
    set({ hands: [inserted, ...get().hands] });
    if (input.playerId) {
      await get().updatePlayer(input.playerId, {});
    }
    return inserted;
  },

  updateHand: async (id, patch) => {
    await db.update(playerHands).set(patch).where(eq(playerHands.id, id));
    set({
      hands: get().hands.map((h) => (h.id === id ? ({ ...h, ...patch } as PlayerHand) : h)),
    });
  },

  removeHand: async (id) => {
    await db.delete(playerHands).where(eq(playerHands.id, id));
    set({ hands: get().hands.filter((h) => h.id !== id) });
  },
}));
