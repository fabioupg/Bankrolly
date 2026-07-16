import { create } from 'zustand';
import { eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import {
  liveSessions,
  type LiveSession,
  type NewLiveSession,
} from '@/db/schema';
import { newId } from '@/utils/id';
import {
  activeElapsedMs,
  compileNotesText,
  parseLiveNotes,
  parseStackHistory,
  serializeLiveNotes,
  serializeStackHistory,
  type LiveNote,
  type StackPoint,
} from '@/utils/liveSession';
import {
  startLiveActivity,
  stopLiveActivity,
  updateLiveActivity,
} from '@/lib/liveActivity';
import { deleteNotePhoto } from '@/utils/photos';
import { useHandStore } from './useHandStore';
import { useSessionStore } from './useSessionStore';
import { useSettingsStore } from './useStatsStore';

export interface StartLiveInput {
  venue: string;
  stakes: string;
  gameType: string;
  buyIn: number;
}

interface LiveSessionState {
  /** The one running/paused session, or null when nothing is live. */
  active: LiveSession | null;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  start: (input: StartLiveInput) => Promise<LiveSession>;
  /** Set the current stack and append a point to the chart history. */
  updateStack: (stack: number) => Promise<void>;
  /** Add to the buy-in (re-buy / top-up); the stack grows by the same amount. */
  addBuyIn: (amount: number) => Promise<void>;
  addNote: (text: string, photo: string) => Promise<void>;
  removeNote: (t: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  /** Finish the session and write it to the cash-session log. */
  end: () => Promise<void>;
  /** Throw the session away without logging it. */
  discard: () => Promise<void>;
}

const currency = () => useSettingsStore.getState().currency;

export const useLiveSessionStore = create<LiveSessionState>((set, get) => {
  /** Persist a patch, refresh the lock-screen card, and update local state. */
  const patch = async (changes: Partial<NewLiveSession>): Promise<LiveSession | null> => {
    const current = get().active;
    if (!current) return null;
    await db.update(liveSessions).set(changes).where(eq(liveSessions.id, current.id));
    const next = { ...current, ...changes } as LiveSession;
    set({ active: next });
    updateLiveActivity(next, currency());
    return next;
  };

  return {
    active: null,
    loading: false,
    error: null,

    hydrate: async () => {
      set({ loading: true, error: null });
      try {
        const rows = await db
          .select()
          .from(liveSessions)
          .where(ne(liveSessions.status, 'ended'));
        set({ active: rows[0] ?? null, loading: false });
      } catch (err) {
        set({ error: (err as Error).message, loading: false });
      }
    },

    start: async (input) => {
      if (get().active) throw new Error('A live session is already running.');
      const now = Date.now();
      const row: NewLiveSession = {
        id: newId(),
        startedAt: now,
        venue: input.venue,
        stakes: input.stakes,
        gameType: input.gameType,
        buyIn: input.buyIn,
        currentStack: input.buyIn,
        status: 'running',
        pausedMs: 0,
        pauseStartedAt: null,
        stackHistory: serializeStackHistory([{ t: now, stack: input.buyIn }]),
        notes: '',
        activityId: '',
        createdAt: new Date().toISOString(),
      };
      await db.insert(liveSessions).values(row);
      const session = row as LiveSession;

      // The lock-screen card can only be started once the session exists, so
      // its id is written back in a second step.
      const activityId = startLiveActivity(session, currency());
      if (activityId) {
        await db
          .update(liveSessions)
          .set({ activityId })
          .where(eq(liveSessions.id, session.id));
        session.activityId = activityId;
      }
      set({ active: session });
      return session;
    },

    updateStack: async (stack) => {
      const current = get().active;
      if (!current) return;
      const points: StackPoint[] = parseStackHistory(current.stackHistory);
      points.push({ t: Date.now(), stack });
      await patch({
        currentStack: stack,
        stackHistory: serializeStackHistory(points),
      });
    },

    addBuyIn: async (amount) => {
      const current = get().active;
      if (!current || !(amount > 0)) return;
      // A re-buy puts more chips on the table, so the stack moves with it.
      const stack = current.currentStack + amount;
      const points: StackPoint[] = parseStackHistory(current.stackHistory);
      points.push({ t: Date.now(), stack });
      await patch({
        buyIn: current.buyIn + amount,
        currentStack: stack,
        stackHistory: serializeStackHistory(points),
      });
    },

    addNote: async (text, photo) => {
      const current = get().active;
      if (!current) return;
      if (!text.trim() && !photo) return;
      const notes: LiveNote[] = parseLiveNotes(current.notes);
      notes.push({ t: Date.now(), text: text.trim(), photo });
      await patch({ notes: serializeLiveNotes(notes) });
    },

    removeNote: async (t) => {
      const current = get().active;
      if (!current) return;
      const all = parseLiveNotes(current.notes);
      const gone = all.find((n) => n.t === t);
      await patch({ notes: serializeLiveNotes(all.filter((n) => n.t !== t)) });
      if (gone?.photo) await deleteNotePhoto(gone.photo);
    },

    pause: async () => {
      const current = get().active;
      if (!current || current.status !== 'running') return;
      await patch({ status: 'paused', pauseStartedAt: Date.now() });
    },

    resume: async () => {
      const current = get().active;
      if (!current || current.status !== 'paused') return;
      // Fold the finished pause into the running total.
      const pausedFor = current.pauseStartedAt ? Date.now() - current.pauseStartedAt : 0;
      await patch({
        status: 'running',
        pausedMs: current.pausedMs + Math.max(0, pausedFor),
        pauseStartedAt: null,
      });
    },

    end: async () => {
      const current = get().active;
      if (!current) return;
      // A session ended while paused stops counting at the pause, not now.
      const playedMs = activeElapsedMs(current);
      const durationMinutes = Math.max(0, Math.round(playedMs / 60000));

      // The cash session keeps the live session's id so hand notes linked
      // during play stay attached to it.
      await useSessionStore.getState().add({
        id: current.id,
        date: new Date(current.startedAt).toISOString().slice(0, 10),
        venue: current.venue,
        gameType: current.gameType,
        stakes: current.stakes,
        buyIn: current.buyIn,
        cashOut: current.currentStack,
        durationMinutes,
        notes: compileNotesText(parseLiveNotes(current.notes)),
      });

      stopLiveActivity(current, currency());
      await db
        .update(liveSessions)
        .set({ status: 'ended', activityId: '' })
        .where(eq(liveSessions.id, current.id));
      set({ active: null });
    },

    discard: async () => {
      const current = get().active;
      if (!current) return;
      stopLiveActivity(current, currency());
      // Nothing is logged, so the attached photos are dead weight.
      for (const n of parseLiveNotes(current.notes)) {
        if (n.photo) await deleteNotePhoto(n.photo);
      }
      // Hands logged during the session outlive it — unlink them instead of
      // leaving them pointing at a session id that no longer exists.
      const handStore = useHandStore.getState();
      for (const hand of handStore.hands.filter((h) => h.sessionId === current.id)) {
        await handStore.update(hand.id, { sessionId: null });
      }
      await db.delete(liveSessions).where(eq(liveSessions.id, current.id));
      set({ active: null });
    },
  };
});
