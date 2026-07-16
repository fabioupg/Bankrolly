// Helpers for the online session tracker.
//
// An online session records the total buy-ins and total cashes for a batch of
// online play, and can optionally itemise the individual tournaments that make
// it up. Those items are stored as a JSON string on `online_sessions.entries`;
// when present, the totals are derived from them.

import type { OnlineSession } from '@/db/schema';

export interface OnlineEntry {
  name: string;
  buyIn: number;
  cash: number;
}

/** Parse the stored JSON entries string into a typed array (never throws). */
export function parseEntries(raw: string | null | undefined): OnlineEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e === 'object')
      .map((e) => ({
        name: typeof e.name === 'string' ? e.name : '',
        buyIn: Number(e.buyIn) || 0,
        cash: Number(e.cash) || 0,
      }));
  } catch {
    return [];
  }
}

export function serializeEntries(entries: OnlineEntry[]): string {
  return entries.length ? JSON.stringify(entries) : '';
}

/** Sum buy-ins and cashes across the itemised tournaments. */
export function entriesTotals(entries: OnlineEntry[]): { buyIn: number; cash: number } {
  return entries.reduce(
    (acc, e) => ({ buyIn: acc.buyIn + e.buyIn, cash: acc.cash + e.cash }),
    { buyIn: 0, cash: 0 },
  );
}

/** Net result of a session (cashes minus buy-ins). */
export function onlineNet(s: Pick<OnlineSession, 'totalBuyIn' | 'totalCash'>): number {
  return s.totalCash - s.totalBuyIn;
}

/** ROI as a percentage of what was invested; 0 when nothing was staked. */
export function onlineRoi(s: Pick<OnlineSession, 'totalBuyIn' | 'totalCash'>): number {
  if (s.totalBuyIn <= 0) return 0;
  return (onlineNet(s) / s.totalBuyIn) * 100;
}
