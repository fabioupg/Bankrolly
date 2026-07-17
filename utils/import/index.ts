// Importing a CSV exported by another poker app.
//
// Two passes, always. previewImport() reads the file and works out exactly what
// would happen; the user sees that and confirms; commitImport() then writes the
// plan it was shown. Nothing is written before the confirmation — these files
// come from apps we do not control, and the user's history is what is at stake.

import { db } from '@/db';
import {
  bankrollTransactions,
  cashSessions,
  tournaments,
  type GameType,
  type NewBankrollTransaction,
  type NewCashSession,
  type NewTournament,
  type TournamentFormat,
  type TransactionKind,
} from '@/db/schema';
import { useSessionStore } from '@/store/useSessionStore';
import { useTournamentStore } from '@/store/useTournamentStore';
import { useTransactionStore } from '@/store/useTransactionStore';
import { extract, netOf, type CanonRow, type ExtractResult } from './formats';
import { toLocalDateString, type DateOrder } from './parse';

export type { DateOrder } from './parse';

export interface RowIssue {
  row: number;
  message: string;
}

export interface ImportPreview {
  sourceApp: string;
  order: DateOrder;
  /** The file uses slash dates that do not say which number is the day. */
  datesAmbiguous: boolean;
  cashCount: number;
  tournamentCount: number;
  transactionCount: number;
  duplicateCount: number;
  /** Net result of the sessions — what this import moves the win rate by. */
  sessionsNet: number;
  /** Net of deposits/withdrawals/costs — bankroll only, never the win rate. */
  transactionsNet: number;
  currencies: string[];
  mapped: { column: string; field: string }[];
  unmapped: string[];
  warnings: string[];
  issues: RowIssue[];
  skipped: RowIssue[];
  plan: {
    cash: NewCashSession[];
    tourneys: NewTournament[];
    transactions: NewBankrollTransaction[];
  };
}

export interface ImportResult {
  cash: number;
  tournaments: number;
  transactions: number;
}

/**
 * A row's identity is what it *is*, not where it sat in the file: same date,
 * same venue, same money means the same session. Re-importing the same export —
 * the normal case, because people export again after a few more sessions — then
 * lands on the same ids and skips itself.
 */
function stableId(prefix: string, parts: (string | number)[]): string {
  const key = parts.join('|');
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b + c, 0x85ebca6b) ^ (b >>> 13);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return `${prefix}_${hex(a)}${hex(b)}`;
}

function toGameType(game: string, limit: string): GameType {
  const g = game.toLowerCase();
  if (g.includes('omaha') || g.includes('plo')) return 'PLO';
  if (g.includes('hold')) {
    const l = `${limit} ${game}`.toLowerCase();
    // Hold'em with no stated limit means no-limit in every one of these apps.
    return !l.includes('pot limit') && !l.includes('fixed') ? 'NLH' : 'Mixed';
  }
  return 'Mixed';
}

function toFormat(r: CanonRow): TournamentFormat {
  if (r.bountyWon > 0 || r.bountyCost > 0) return 'Bounty';
  if (r.venueKind.toLowerCase().includes('online')) return 'Online';
  return 'MTT';
}

const TX_KINDS: Record<string, TransactionKind> = {
  deposit: 'deposit',
  withdrawal: 'withdrawal',
  expense: 'expense',
  bonus: 'bonus',
  other: 'other',
};

/** Read the file and work out exactly what an import would do. Writes nothing. */
export async function previewImport(
  text: string,
  order: DateOrder = 'auto',
): Promise<ImportPreview> {
  const found: ExtractResult = extract(text, order);
  const now = new Date().toISOString();

  // Two genuinely identical rows in one file (same day, venue, money — say two
  // break-even sessions at the same table) are both real, and both must land.
  // Numbering repeat occurrences keeps their ids distinct without breaking
  // re-import idempotency: file order is stable, so occurrence n hashes to the
  // same id every time the same file is imported.
  const seen = new Map<string, number>();
  const planId = (parts: (string | number)[]): string => {
    const key = parts.join('|');
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return stableId('imp', n === 1 ? parts : [...parts, `#${n}`]);
  };

  const cash: NewCashSession[] = [];
  const tourneys: NewTournament[] = [];
  const transactions: NewBankrollTransaction[] = [];
  const issues: RowIssue[] = [];
  const currencies = new Set<string>();

  for (const r of found.rows) {
    const date = toLocalDateString(r.startedAt!);
    const net = netOf(r);
    if (r.currency) currencies.add(r.currency);

    for (const w of r.warnings) issues.push({ row: r.sourceRow, message: w });

    // The file's own profit column is a claim, not a fact. We compute the net
    // from the parts, and only tell the user when the two disagree.
    if (r.declaredProfit != null && Math.abs(net - r.declaredProfit) > 0.01) {
      issues.push({
        row: r.sourceRow,
        message: `The file claims a profit of ${r.declaredProfit}, but its own numbers add up to ${net.toFixed(2)}. Importing ${net.toFixed(2)}.`,
      });
    }

    if (r.kind === 'cash') {
      // Expenses and staking shares get folded in so the session's profit comes
      // out exactly as the source app showed it — a cash session in Bankrolly has
      // nowhere else to put them.
      if (r.expenses || r.sharesIn || r.sharesOut) {
        issues.push({
          row: r.sourceRow,
          message: 'Expenses/staking folded into the cash-out so the profit matches.',
        });
      }
      cash.push({
        id: planId([date, r.venue, r.buyIn ?? 0, r.cashOut ?? 0]),
        date,
        venue: r.venue || 'Imported',
        gameType: toGameType(r.game, r.limitType),
        stakes: r.stakes,
        buyIn: (r.buyIn ?? 0) + r.rebuyCost + r.addOnCost,
        cashOut: (r.cashOut ?? 0) + r.bountyWon - r.expenses + r.sharesIn - r.sharesOut,
        durationMinutes: r.durationMinutes ?? 0,
        notes: r.note,
        createdAt: now,
      });
      if (r.durationMinutes == null) {
        issues.push({
          row: r.sourceRow,
          message: 'No duration in the file — stored as 0, so it stays out of your hourly.',
        });
      }
      continue;
    }

    if (r.kind === 'tournament') {
      if (r.expenses || r.sharesIn || r.sharesOut) {
        issues.push({
          row: r.sourceRow,
          message: 'Expenses/staking folded into the prize so the profit matches.',
        });
      }
      tourneys.push({
        id: planId([date, r.venue, r.tournamentName, r.buyIn ?? 0, r.cashOut ?? 0]),
        date,
        name: r.tournamentName || r.venue || 'Tournament',
        venue: r.venue || 'Imported',
        format: toFormat(r),
        // A PKO buy-in already contains the bounty portion — adding bountyCost
        // on top would charge the user for it twice.
        buyIn: r.buyIn ?? 0,
        rebuys: r.rebuyCost,
        addon: r.addOnCost,
        fieldSize: r.entrants ?? 0,
        finishPosition: r.place ?? 0,
        prize: (r.cashOut ?? 0) - r.expenses + r.sharesIn - r.sharesOut,
        bounties: r.bountyWon,
        durationMinutes: r.durationMinutes ?? 0,
        notes: r.note,
        createdAt: now,
      });
      continue;
    }

    // Everything else moves the bankroll without being a session.
    const kind: TransactionKind =
      r.kind === 'deposit' && net < 0 ? 'withdrawal' : (TX_KINDS[r.kind] ?? 'other');
    transactions.push({
      id: planId([date, r.venue, kind, net]),
      date,
      kind,
      amount: net,
      venue: r.venue,
      currency: r.currency,
      notes: r.note,
      createdAt: now,
    });
  }

  // Anything already on the phone is left alone — re-imports are the norm.
  const [haveCash, haveTourneys, haveTx] = await Promise.all([
    db.select({ id: cashSessions.id }).from(cashSessions),
    db.select({ id: tournaments.id }).from(tournaments),
    db.select({ id: bankrollTransactions.id }).from(bankrollTransactions),
  ]);
  const known = new Set([
    ...haveCash.map((r) => r.id),
    ...haveTourneys.map((r) => r.id),
    ...haveTx.map((r) => r.id),
  ]);

  const total = cash.length + tourneys.length + transactions.length;
  const freshCash = cash.filter((r) => !known.has(r.id!));
  const freshTourneys = tourneys.filter((r) => !known.has(r.id!));
  const freshTx = transactions.filter((r) => !known.has(r.id!));
  const duplicateCount = total - (freshCash.length + freshTourneys.length + freshTx.length);

  const warnings = [...found.warnings];
  if (currencies.size > 1) {
    warnings.push(
      `The file mixes ${[...currencies].join(', ')}. Bankrolly keeps one currency, so amounts are imported as they stand, without conversion.`,
    );
  }

  return {
    sourceApp: found.sourceApp,
    order,
    datesAmbiguous: found.ambiguousDates > 0,
    cashCount: freshCash.length,
    tournamentCount: freshTourneys.length,
    transactionCount: freshTx.length,
    duplicateCount,
    sessionsNet:
      freshCash.reduce((s, c) => s + (c.cashOut ?? 0) - (c.buyIn ?? 0), 0) +
      freshTourneys.reduce(
        (s, t) =>
          s +
          (t.prize ?? 0) +
          (t.bounties ?? 0) -
          ((t.buyIn ?? 0) + (t.rebuys ?? 0) + (t.addon ?? 0)),
        0,
      ),
    transactionsNet: freshTx.reduce((s, t) => s + (t.amount ?? 0), 0),
    currencies: [...currencies],
    mapped: found.mapped,
    unmapped: found.unmapped,
    warnings,
    issues,
    skipped: found.skipped.map((s) => ({ row: s.row, message: s.reason })),
    plan: { cash: freshCash, tourneys: freshTourneys, transactions: freshTx },
  };
}

// SQLite caps the bound parameters per statement; the widest table here is 13.
const CHUNK = 40;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function insertAllSync<T>(tx: Tx, table: Parameters<typeof db.insert>[0], rows: T[]): void {
  for (let i = 0; i < rows.length; i += CHUNK) {
    tx.insert(table).values(rows.slice(i, i + CHUNK) as never).run();
  }
}

/** Write the plan the user just confirmed — all of it or none of it. */
export async function commitImport(preview: ImportPreview): Promise<ImportResult> {
  const { cash, tourneys, transactions } = preview.plan;
  // The expo-sqlite driver's transaction is synchronous: it COMMITs the moment
  // the callback returns, so the callback must not return a promise — an async
  // body would commit before a single row had landed. The .run() calls execute
  // on the spot, and any failure rolls the whole import back.
  db.transaction((tx) => {
    insertAllSync(tx, cashSessions, cash);
    insertAllSync(tx, tournaments, tourneys);
    insertAllSync(tx, bankrollTransactions, transactions);
  });

  await Promise.all([
    useSessionStore.getState().hydrate(),
    useTournamentStore.getState().hydrate(),
    useTransactionStore.getState().hydrate(),
  ]);

  return { cash: cash.length, tournaments: tourneys.length, transactions: transactions.length };
}
