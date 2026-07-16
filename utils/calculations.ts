import type {
  CashSession,
  Tournament,
  Trip,
  TripExpense,
  ExpenseCategory,
  OnlineSession,
} from '@/db/schema';

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
  type: 'cash' | 'tournament' | 'online';
  label: string;
}

export function buildBankrollSeries(
  cash: CashSession[],
  tourneys: Tournament[],
  online: OnlineSession[] = [],
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
  for (const o of online) {
    points.push({
      date: o.date,
      cumulative: 0,
      delta: o.totalCash - o.totalBuyIn,
      type: 'online',
      label: o.site || 'Online session',
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

export interface StakesStat {
  stakes: string;
  hours: number;
  profit: number;
  rate: number;
  sessions: number;
}

export function hourlyByStakes(cash: CashSession[]): StakesStat[] {
  const map = new Map<string, { minutes: number; profit: number; sessions: number }>();
  for (const c of cash) {
    const key = c.stakes || 'Unknown';
    const cur = map.get(key) ?? { minutes: 0, profit: 0, sessions: 0 };
    cur.minutes += c.durationMinutes;
    cur.profit += cashProfit(c);
    cur.sessions += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([stakes, v]) => ({
      stakes,
      hours: v.minutes / 60,
      profit: v.profit,
      sessions: v.sessions,
      rate: hourlyRate(v.profit, v.minutes),
    }))
    .sort((a, b) => b.profit - a.profit);
}

export interface WeekdayStat {
  label: string;
  profit: number;
  sessions: number;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Net profit per weekday (Monday first). Always returns all 7 days. */
export function profitByWeekday(entries: SessionEntry[]): WeekdayStat[] {
  const out: WeekdayStat[] = WEEKDAY_LABELS.map((label) => ({ label, profit: 0, sessions: 0 }));
  for (const e of entries) {
    const d = new Date(e.date);
    if (Number.isNaN(d.getTime())) continue;
    const idx = (d.getDay() + 6) % 7;
    out[idx].profit += e.profit;
    out[idx].sessions += 1;
  }
  return out;
}

/** Sample standard deviation of per-session results. 0 with fewer than 2 sessions. */
export function profitStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Biggest peak-to-trough drop of the cumulative bankroll, as a positive number. */
export function maxDrawdown(series: BankrollPoint[]): number {
  let peak = 0;
  let worst = 0;
  for (const p of series) {
    if (p.cumulative > peak) peak = p.cumulative;
    const dd = peak - p.cumulative;
    if (dd > worst) worst = dd;
  }
  return worst;
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
  type: 'cash' | 'tournament' | 'online';
  profit: number;
  durationMinutes?: number;
}

export function unifySessions(
  cash: CashSession[],
  tourneys: Tournament[],
  online: OnlineSession[] = [],
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
  for (const o of online) {
    out.push({
      id: o.id,
      date: o.date,
      label: `${o.site || 'Online'} • online`,
      type: 'online',
      profit: o.totalCash - o.totalBuyIn,
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

export interface TripSummary {
  cashSessions: CashSession[];
  tournaments: Tournament[];
  expenses: TripExpense[];
  totalCashProfit: number;
  totalTournamentProfit: number;
  totalPokerProfit: number;
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  totalCashBuyIn: number;
  totalTournamentInvested: number;
  totalInvested: number;
  netResult: number;
  totalCashMinutes: number;
  daysSpan: number;
}

export function isTripActive(trip: Trip, today = new Date()): boolean {
  const t = new Date(today);
  t.setHours(12, 0, 0, 0);
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  return start <= t && t <= end;
}

export function isTripUpcoming(trip: Trip, today = new Date()): boolean {
  return new Date(trip.startDate) > today;
}

export function tripSummary(
  trip: Trip,
  cash: CashSession[],
  tourneys: Tournament[],
  expenses: TripExpense[],
): TripSummary {
  const tripCash = cash.filter((c) => c.tripId === trip.id);
  const tripTourneys = tourneys.filter((t) => t.tripId === trip.id);
  const tripExpensesList = expenses.filter((e) => e.tripId === trip.id);

  const totalCashProfit = tripCash.reduce((s, c) => s + cashProfit(c), 0);
  const totalCashBuyIn = tripCash.reduce((s, c) => s + c.buyIn, 0);
  const totalCashMinutes = tripCash.reduce((s, c) => s + c.durationMinutes, 0);
  const totalTournamentProfit = tripTourneys.reduce((s, t) => s + tournamentNet(t), 0);
  const totalTournamentInvested = tripTourneys.reduce((s, t) => s + tournamentInvested(t), 0);
  const totalExpenses = tripExpensesList.reduce((s, e) => s + e.amount, 0);

  const expensesByCategory: Record<string, number> = {};
  for (const e of tripExpensesList) {
    expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + e.amount;
  }

  const totalPokerProfit = totalCashProfit + totalTournamentProfit;
  const totalInvested = totalCashBuyIn + totalTournamentInvested;
  const netResult = totalPokerProfit - totalExpenses;

  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const daysSpan = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );

  return {
    cashSessions: tripCash,
    tournaments: tripTourneys,
    expenses: tripExpensesList,
    totalCashProfit,
    totalTournamentProfit,
    totalPokerProfit,
    totalExpenses,
    expensesByCategory,
    totalCashBuyIn,
    totalTournamentInvested,
    totalInvested,
    netResult,
    totalCashMinutes,
    daysSpan,
  };
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  hotel: 'Hotel',
  food: 'Food',
  drinks: 'Drinks',
  transport: 'Transport',
  entrance: 'Entrance / fees',
  tips: 'Tips',
  shopping: 'Shopping',
  other: 'Other',
};
