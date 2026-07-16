import { describe, expect, it } from 'vitest';
import {
  buildCashCsv,
  buildStakingCsv,
  buildTransactionsCsv,
} from '@/utils/csvExport';
import type { BankrollTransaction, CashSession, StakingDeal } from '@/db/schema';

const cashSession = (over: Partial<CashSession> = {}): CashSession => ({
  id: 'c1',
  date: '2026-07-13',
  venue: 'Test Casino',
  gameType: 'NLH',
  stakes: '1/2',
  buyIn: 200,
  cashOut: 150,
  durationMinutes: 120,
  notes: '',
  tripId: null,
  createdAt: '2026-07-13T12:00:00Z',
  ...over,
});

describe('buildCashCsv', () => {
  it('neutralizes formula injection but keeps negative numbers numeric', () => {
    const csv = buildCashCsv([
      cashSession({ venue: '=HYPERLINK("http://evil.example")', notes: '@cmd' }),
    ]);
    const dataLine = csv.split('\n')[1];
    // The formula cell is defused with a leading apostrophe…
    expect(dataLine).toContain(`'=HYPERLINK`);
    expect(dataLine).toContain(`'@cmd`);
    // …while the genuine negative profit (150 - 200) stays a plain number.
    expect(dataLine).toContain(',-50,');
  });

  it('quotes fields containing commas and doubles inner quotes', () => {
    const csv = buildCashCsv([cashSession({ notes: 'ran KK into AA, said "gg"' })]);
    expect(csv.split('\n')[1]).toContain('"ran KK into AA, said ""gg"""');
  });
});

describe('buildStakingCsv', () => {
  it('includes the computed settlement columns', () => {
    const deal: StakingDeal = {
      id: 's1',
      ownerId: 'u1',
      direction: 'backed',
      counterparty: 'Alice',
      date: '2026-07-01',
      buyIn: 1000,
      percent: 50,
      markup: 1,
      makeupBefore: 0,
      result: 400,
      settled: 1,
      settledDate: '2026-07-02',
      note: '',
      createdAt: '2026-07-01T12:00:00Z',
      updatedAt: '2026-07-01T12:00:00Z',
    };
    const [headers, row] = buildStakingCsv([deal]).split('\n');
    expect(headers.split(',')).toContain('your_result');
    // Backed at 50% of a 400 win → the backer's 200 leaves your side.
    expect(row).toContain('-200');
  });
});

describe('buildTransactionsCsv', () => {
  it('writes one row per transaction with the signed amount', () => {
    const tx: BankrollTransaction = {
      id: 'tx1',
      date: '2026-07-10',
      kind: 'withdrawal',
      amount: -500,
      venue: 'Test Casino',
      currency: '',
      notes: '',
      createdAt: '2026-07-10T12:00:00Z',
    };
    const lines = buildTransactionsCsv([tx]).split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('id,date,kind,amount,venue,currency,notes,created_at');
    expect(lines[1]).toContain('withdrawal,-500');
  });
});
