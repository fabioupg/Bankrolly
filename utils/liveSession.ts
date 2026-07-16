// Helpers for the live session tracker.
//
// A live session is a single running cash game: buy-in, current stack, a
// history of stack updates (for the in-session chart), timestamped notes with
// optional photos, and pause bookkeeping. Exactly one non-ended live session
// exists at a time; ending it converts it into a regular cash session that
// keeps the same id so hand notes linked during play stay attached.

import type { LiveSession } from '@/db/schema';

export interface StackPoint {
  /** Epoch ms of the update. */
  t: number;
  stack: number;
}

export interface LiveNote {
  /** Epoch ms when the note was taken. */
  t: number;
  text: string;
  /** Local file URI of an attached photo, '' when none. */
  photo: string;
}

/** Parse the stored stack-history JSON (never throws). */
export function parseStackHistory(raw: string | null | undefined): StackPoint[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && typeof p === 'object')
      .map((p) => ({ t: Number(p.t) || 0, stack: Number(p.stack) || 0 }))
      .filter((p) => p.t > 0);
  } catch {
    return [];
  }
}

export function serializeStackHistory(points: StackPoint[]): string {
  return points.length ? JSON.stringify(points) : '';
}

/** Parse the stored notes JSON (never throws). */
export function parseLiveNotes(raw: string | null | undefined): LiveNote[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((n) => n && typeof n === 'object')
      .map((n) => ({
        t: Number(n.t) || 0,
        text: typeof n.text === 'string' ? n.text : '',
        photo: typeof n.photo === 'string' ? n.photo : '',
      }))
      .filter((n) => n.t > 0 && (n.text !== '' || n.photo !== ''));
  } catch {
    return [];
  }
}

export function serializeLiveNotes(notes: LiveNote[]): string {
  return notes.length ? JSON.stringify(notes) : '';
}

/**
 * Time actually played (ms): wall time since start minus completed pauses,
 * and minus the currently running pause when the session is paused.
 */
export function activeElapsedMs(
  s: Pick<LiveSession, 'startedAt' | 'pausedMs' | 'pauseStartedAt' | 'status'>,
  now = Date.now(),
): number {
  const end = s.status === 'paused' && s.pauseStartedAt ? s.pauseStartedAt : now;
  return Math.max(0, end - s.startedAt - s.pausedMs);
}

export function liveProfit(s: Pick<LiveSession, 'buyIn' | 'currentStack'>): number {
  return s.currentStack - s.buyIn;
}

/** "3h 24m" / "48m" for headers and the lock-screen subtitle. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

/** "18:42" clock label for note timestamps and chart axis. */
export function formatClock(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/** Compile timestamped text notes into the notes field of the final cash session. */
export function compileNotesText(notes: LiveNote[]): string {
  return notes
    .filter((n) => n.text.trim() !== '')
    .map((n) => `[${formatClock(n.t)}] ${n.text.trim()}`)
    .join('\n');
}
