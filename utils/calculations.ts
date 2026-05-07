import type { CashSession, Tournament } from '@/db/schema';

export function cashProfit(s: Pick<CashSession, 'cashOut' | 'buyIn'>): number {
  return s.cashOut - s.buyIn;
}

export function tournamentInvested(
  t: Pick<Tournament, 'buyIn' | 'rebuys' | 'addon'>,
): number {
  return t.buyIn + t.rebuys + t.addon;
}

export function tournamentNet(
  t: Pick<Tournament, 'buyIn' | 'rebuys' | 'addon' | 'prize' | 'bounties'>,
): number {
  return t.prize + t.bounties - tournamentInvested(t);
}

export function tournamentROI(
  t: Pick<Tournament, 'buyIn' | 'rebuys' | 'addon' | 'prize' | 'bounties'>,
): number {
  const invested = tournamentInvested(t);
  if (invested <= 0) return 0;
  return (tournamentNet(t) / invested) * 100;
}

export function hourlyRate(profit: number, minutes: number): number {
  if (minutes <= 0) return 0;
  return (profit / minutes) * 60;
}

export interface BankrollPoint {
  date: string;
  cumulative: number;
  delta: number;
  type: 'cash' | 'tournament';
  label: string;
}

export function buildBankrollSeries(
  cash: CashSession[],
  tourneys: Tournament[],
): BankrollPoint[] {
  const points: BankrollPoint[] = [];
  for (const c of cash) {
    points.push({
      date: c.date,
      cumulative: 0,
      delta: cashProfit(c),
      type: 'cash',
      label: `${c.venue} ${c.stakes}`,
    });
  }
  for (const t of tourneys) {
    points.push({
      date: t.date,
      cumulative: 0,
      delta: tournamentNet(t),
      type: 'tournament',
      label: t.name,
    });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  for (const p of points) {
    running += p.delta;
    p.cumulative = running;
  }
  return points;
}

export function movingAverage(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < window) {
      out.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += values[j];
    out.push(sum / window);
  }
  return out;
}

export interface VenueStat {
  venue: string;
  hours: number;
  profit: number;
  rate: number;
  sessions: number;
}

export function hourlyByVenue(cash: CashSession[]): VenueStat[] {
  const map = new Map<string, { minutes: number; profit: number; sessions: number }>();
  for (const c of cash) {
    const key = c.venue || 'Unknown';
    const cur = map.get(key) ?? { minutes: 0, profit: 0, sessions: 0 };
    cur.minutes += c.durationMinutes;
    cur.profit += cashProfit(c);
    cur.sessions += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([venue, v]) => ({
      venue,
      hours: v.minutes / 60,
      profit: v.profit,
      sessions: v.sessions,
      rate: hourlyRate(v.profit, v.minutes),
    }))
    .sort((a, b) => b.profit - a.profit);
}

export interface RoiPoint {
  date: string;
  cumulativeROI: number;
  cumulativeInvested: number;
  cumulativeNet: number;
}

export function tournamentRoiOverTime(tourneys: Tournament[]): RoiPoint[] {
  const sorted = [...tourneys].sort((a, b) => a.date.localeCompare(b.date));
  const out: RoiPoint[] = [];
  let invested = 0;
  let net = 0;
  for (const t of sorted) {
    invested += tournamentInvested(t);
    net += tournamentNet(t);
    out.push({
      date: t.date,
      cumulativeInvested: invested,
      cumulativeNet: net,
      cumulativeROI: invested > 0 ? (net / invested) * 100 : 0,
    });
  }
  return out;
}

export function itmPercent(tourneys: Tournament[]): number {
  if (!tourneys.length) return 0;
  const itm = tourneys.filter((t) => t.prize > 0).length;
  return (itm / tourneys.length) * 100;
}

export interface Streak {
  length: number;
  direction: 'win' | 'loss' | 'none';
}

export function currentStreak(values: number[]): Streak {
  if (!values.length) return { length: 0, direction: 'none' };
  const last = values[values.length - 1];
  if (last === 0) return { length: 0, direction: 'none' };
  const direction: 'win' | 'loss' = last > 0 ? 'win' : 'loss';
  let length = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if ((direction === 'win' && values[i] > 0) || (direction === 'loss' && values[i] < 0)) {
      length += 1;
    } else {
      break;
    }
  }
  return { length, direction };
}

export function isLosingStreak(values: number[], minLength = 5): boolean {
  if (values.length < minLength) return false;
  const recent = values.slice(-minLength);
  return recent.every((v) => v < 0);
}

export interface SessionEntry {
  id: string;
  date: string;
  label: string;
  type: 'cash' | 'tournament';
  profit: number;
  durationMinutes?: number;
}

export function unifySessions(
  cash: CashSession[],
  tourneys: Tournament[],
): SessionEntry[] {
  const out: SessionEntry[] = [];
  for (const c of cash) {
    out.push({
      id: c.id,
      date: c.date,
      label: `${c.venue} • ${c.stakes}`,
      type: 'cash',
      profit: cashProfit(c),
      durationMinutes: c.durationMinutes,
    });
  }
  for (const t of tourneys) {
    out.push({
      id: t.id,
      date: t.date,
      label: `${t.name} • ${t.format}`,
      type: 'tournament',
      profit: tournamentNet(t),
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function biggestWins(entries: SessionEntry[], n = 5): SessionEntry[] {
  return [...entries].sort((a, b) => b.profit - a.profit).slice(0, n);
}

export function biggestLosses(entries: SessionEntry[], n = 5): SessionEntry[] {
  return [...entries].sort((a, b) => a.profit - b.profit).slice(0, n);
}

export function profitInRange(entries: SessionEntry[], fromIso: string): number {
  return entries.filter((e) => e.date >= fromIso).reduce((s, e) => s + e.profit, 0);
}
