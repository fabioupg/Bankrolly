import { describe, expect, it } from 'vitest';
import {
  buildBankrollSeries,
  cashProfit,
  currentStreak,
  hourlyByStakes,
  hourlyRate,
  isLosingStreak,
  itmPercent,
  maxDrawdown,
  profitByWeekday,
  profitStdDev,
  tournamentInvested,
  tournamentNet,
  tournamentROI,
  unifySessions,
  type BankrollPoint,
  type SessionEntry,
} from '@/utils/calculations';
import type { CashSession, Tournament } from '@/db/schema';

const cashSession = (over: Partial<CashSession> = {}): CashSession => ({
  id: 'c1',
  date: '2026-07-13',
  venue: 'Test Casino',
  gameType: 'NLH',
  stakes: '1/2',
  buyIn: 200,
  cashOut: 350,
  durationMinutes: 120,
  notes: '',
  tripId: null,
  createdAt: '2026-07-13T12:00:00Z',
  ...over,
});

const tournament = (over: Partial<Tournament> = {}): Tournament => ({
  id: 't1',
  date: '2026-07-14',
  name: 'Test MTT',
  venue: 'Test Casino',
  format: 'MTT',
  buyIn: 100,
  rebuys: 50,
  addon: 25,
  fieldSize: 100,
  finishPosition: 3,
  prize: 500,
  bounties: 25,
  notes: '',
  tripId: null,
  createdAt: '2026-07-14T12:00:00Z',
  ...over,
});

const entry = (over: Partial<SessionEntry> = {}): SessionEntry => ({
  id: 'e1',
  date: '2026-07-13',
  label: 'Test',
  type: 'cash',
  profit: 0,
  ...over,
});

describe('basic profit maths', () => {
  it('cash profit is cash-out minus buy-in', () => {
    expect(cashProfit(cashSession())).toBe(150);
  });

  it('tournament invested, net and ROI include rebuys, addon and bounties', () => {
    const t = tournament();
    expect(tournamentInvested(t)).toBe(175);
    expect(tournamentNet(t)).toBe(350);
    expect(tournamentROI(t)).toBe(200);
    expect(tournamentROI(tournament({ buyIn: 0, rebuys: 0, addon: 0 }))).toBe(0);
  });

  it('hourly rate handles zero minutes', () => {
    expect(hourlyRate(60, 120)).toBe(30);
    expect(hourlyRate(100, 0)).toBe(0);
  });

  it('ITM is the share of tournaments with a prize', () => {
    expect(itmPercent([tournament(), tournament({ id: 't2', prize: 0, bounties: 0 })])).toBe(50);
    expect(itmPercent([])).toBe(0);
  });
});

describe('buildBankrollSeries', () => {
  it('sorts by date and accumulates the running total', () => {
    const series = buildBankrollSeries(
      [cashSession({ id: 'c2', date: '2026-07-15', buyIn: 100, cashOut: 50 })],
      [tournament()],
      [],
    );
    // Tournament (07-14, +350) comes before the cash loss (07-15, -50).
    expect(series.map((p) => p.type)).toEqual(['tournament', 'cash']);
    expect(series.map((p) => p.cumulative)).toEqual([350, 300]);
  });
});

describe('streaks', () => {
  it('reads the current streak from the end', () => {
    expect(currentStreak([-5, 10, 20])).toEqual({ length: 2, direction: 'win' });
    expect(currentStreak([10, -5, -1])).toEqual({ length: 2, direction: 'loss' });
    expect(currentStreak([])).toEqual({ length: 0, direction: 'none' });
    expect(currentStreak([10, 0])).toEqual({ length: 0, direction: 'none' });
  });

  it('flags a losing streak of the required length', () => {
    expect(isLosingStreak([-1, -2, -3, -4, -5], 5)).toBe(true);
    expect(isLosingStreak([1, -2, -3, -4, -5], 5)).toBe(false);
    expect(isLosingStreak([-1, -2], 5)).toBe(false);
  });
});

describe('variance stats', () => {
  it('std deviation uses the sample formula and needs 2+ sessions', () => {
    expect(profitStdDev([])).toBe(0);
    expect(profitStdDev([100])).toBe(0);
    expect(profitStdDev([-10, 10])).toBeCloseTo(Math.sqrt(200));
  });

  it('max drawdown is the biggest peak-to-trough drop', () => {
    const point = (cumulative: number): BankrollPoint => ({
      date: '2026-07-13',
      cumulative,
      delta: 0,
      type: 'cash',
      label: '',
    });
    expect(maxDrawdown([100, 50, 120, 30].map(point))).toBe(90);
    expect(maxDrawdown([10, 20, 30].map(point))).toBe(0);
    expect(maxDrawdown([])).toBe(0);
    // A start below zero draws down from the zero start, not from the first point.
    expect(maxDrawdown([-40].map(point))).toBe(40);
  });
});

describe('groupings', () => {
  it('hourly by stakes groups and rates per stakes level', () => {
    const stats = hourlyByStakes([
      cashSession(),
      cashSession({ id: 'c2', stakes: '2/5', buyIn: 500, cashOut: 380, durationMinutes: 60 }),
      cashSession({ id: 'c3', buyIn: 200, cashOut: 260, durationMinutes: 120 }),
    ]);
    const low = stats.find((s) => s.stakes === '1/2')!;
    expect(low.sessions).toBe(2);
    expect(low.profit).toBe(210);
    expect(low.rate).toBeCloseTo(52.5); // 210 over 4 hours
    expect(stats.find((s) => s.stakes === '2/5')!.profit).toBe(-120);
  });

  it('profit by weekday returns all 7 days, Monday first', () => {
    const days = profitByWeekday([
      entry({ date: '2026-07-13', profit: 100 }), // Monday
      entry({ id: 'e2', date: '2026-07-19', profit: -40 }), // Sunday
      entry({ id: 'e3', date: '2026-07-20', profit: 25 }), // next Monday
    ]);
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ label: 'Mon', profit: 125, sessions: 2 });
    expect(days[6]).toEqual({ label: 'Sun', profit: -40, sessions: 1 });
    expect(days[2].sessions).toBe(0);
  });

  it('unifySessions merges and sorts newest first', () => {
    const entries = unifySessions([cashSession()], [tournament()], []);
    expect(entries.map((e) => e.type)).toEqual(['tournament', 'cash']);
    expect(entries[0].profit).toBe(350);
  });
});
