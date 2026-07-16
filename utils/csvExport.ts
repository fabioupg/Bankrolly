import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type {
  BankrollTransaction,
  CashSession,
  HandNote,
  OnlineSession,
  StakingDeal,
  Tournament,
  Trip,
  TripExpense,
} from '@/db/schema';
import { cashProfit, tournamentInvested, tournamentNet, tournamentROI } from './calculations';
import { onlineNet } from './onlineSession';
import { settleStaking } from './staking';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Neutralize CSV/spreadsheet formula injection: a cell beginning with
  // = + - @ (or a tab/CR) is executed as a formula by Excel/Google Sheets.
  // Since these CSVs are exported and shared, a crafted note/venue/name could
  // run code on a recipient's machine. Genuine numeric values (e.g. a negative
  // profit "-50" or ROI "-15.00") are left intact so numeric columns stay numeric.
  if (/^[=+\-@\t\r]/.test(str) && !/^-?\d+(\.\d+)?$/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(headers: string[], rows: (string | number)[][]): string {
  const headerLine = headers.map(csvEscape).join(',');
  const lines = rows.map((r) => r.map(csvEscape).join(','));
  return [headerLine, ...lines].join('\n');
}

export function buildCashCsv(sessions: CashSession[]): string {
  const headers = [
    'id',
    'date',
    'venue',
    'game_type',
    'stakes',
    'buy_in',
    'cash_out',
    'profit',
    'duration_minutes',
    'notes',
    'created_at',
  ];
  const rows = sessions.map((s) => [
    s.id,
    s.date,
    s.venue,
    s.gameType,
    s.stakes,
    s.buyIn,
    s.cashOut,
    cashProfit(s),
    s.durationMinutes,
    s.notes,
    s.createdAt,
  ]);
  return rowsToCsv(headers, rows);
}

export function buildTournamentCsv(tourneys: Tournament[]): string {
  const headers = [
    'id',
    'date',
    'name',
    'venue',
    'format',
    'buy_in',
    'rebuys',
    'addon',
    'invested',
    'field_size',
    'finish_position',
    'prize',
    'bounties',
    'net',
    'roi_percent',
    'notes',
    'created_at',
  ];
  const rows = tourneys.map((t) => [
    t.id,
    t.date,
    t.name,
    t.venue,
    t.format,
    t.buyIn,
    t.rebuys,
    t.addon,
    tournamentInvested(t),
    t.fieldSize,
    t.finishPosition,
    t.prize,
    t.bounties,
    tournamentNet(t),
    tournamentROI(t).toFixed(2),
    t.notes,
    t.createdAt,
  ]);
  return rowsToCsv(headers, rows);
}

export function buildHandsCsv(hands: HandNote[]): string {
  const headers = [
    'id',
    'session_id',
    'session_type',
    'street',
    'position',
    'hero_cards',
    'board',
    'villain_range_notes',
    'action_line',
    'result',
    'tag',
    'notes',
    'created_at',
  ];
  const rows = hands.map((h) => [
    h.id,
    h.sessionId ?? '',
    h.sessionType,
    h.street,
    h.position,
    h.heroCards,
    h.board,
    h.villainRangeNotes,
    h.actionLine,
    h.result,
    h.tag,
    h.notes,
    h.createdAt,
  ]);
  return rowsToCsv(headers, rows);
}

export function buildOnlineCsv(sessions: OnlineSession[]): string {
  const headers = [
    'id',
    'date',
    'site',
    'total_buy_in',
    'total_cash',
    'net',
    'entries_json',
    'notes',
    'created_at',
  ];
  const rows = sessions.map((s) => [
    s.id,
    s.date,
    s.site,
    s.totalBuyIn,
    s.totalCash,
    onlineNet(s),
    s.entries,
    s.notes,
    s.createdAt,
  ]);
  return rowsToCsv(headers, rows);
}

export function buildStakingCsv(deals: StakingDeal[]): string {
  const headers = [
    'id',
    'date',
    'direction',
    'counterparty',
    'buy_in',
    'percent',
    'markup',
    'makeup_before',
    'result',
    'your_result',
    'makeup_after',
    'settled',
    'settled_date',
    'note',
    'created_at',
  ];
  const rows = deals.map((d) => {
    const s = settleStaking({
      direction: d.direction as 'backed' | 'backing',
      buyIn: d.buyIn,
      percent: d.percent,
      markup: d.markup,
      makeupBefore: d.makeupBefore,
      result: d.result,
    });
    return [
      d.id,
      d.date,
      d.direction,
      d.counterparty,
      d.buyIn,
      d.percent,
      d.markup,
      d.makeupBefore,
      d.result,
      s.yourResult,
      s.makeupAfter,
      d.settled ? 1 : 0,
      d.settledDate ?? '',
      d.note,
      d.createdAt,
    ];
  });
  return rowsToCsv(headers, rows);
}

export function buildTransactionsCsv(transactions: BankrollTransaction[]): string {
  const headers = ['id', 'date', 'kind', 'amount', 'venue', 'currency', 'notes', 'created_at'];
  const rows = transactions.map((t) => [
    t.id,
    t.date,
    t.kind,
    t.amount,
    t.venue,
    t.currency,
    t.notes,
    t.createdAt,
  ]);
  return rowsToCsv(headers, rows);
}

export function buildTripsCsv(trips: Trip[]): string {
  const headers = ['id', 'name', 'destination', 'start_date', 'end_date', 'notes', 'created_at'];
  const rows = trips.map((t) => [
    t.id,
    t.name,
    t.destination,
    t.startDate,
    t.endDate,
    t.notes,
    t.createdAt,
  ]);
  return rowsToCsv(headers, rows);
}

export function buildTripExpensesCsv(expenses: TripExpense[]): string {
  const headers = ['id', 'trip_id', 'category', 'description', 'amount', 'date', 'created_at'];
  const rows = expenses.map((e) => [
    e.id,
    e.tripId,
    e.category,
    e.description,
    e.amount,
    e.date,
    e.createdAt,
  ]);
  return rowsToCsv(headers, rows);
}

export interface ExportInput {
  cash: CashSession[];
  tourneys: Tournament[];
  hands: HandNote[];
  online?: OnlineSession[];
  staking?: StakingDeal[];
  transactions?: BankrollTransaction[];
  trips?: Trip[];
  tripExpenses?: TripExpense[];
}

export async function exportAllAsCsv({
  cash,
  tourneys,
  hands,
  online = [],
  staking = [],
  transactions = [],
  trips = [],
  tripExpenses = [],
}: ExportInput): Promise<string[]> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new Error('No writable directory available');

  const files = [
    { name: `bankrolly-cash-${stamp}.csv`, body: buildCashCsv(cash) },
    { name: `bankrolly-tournaments-${stamp}.csv`, body: buildTournamentCsv(tourneys) },
    { name: `bankrolly-hands-${stamp}.csv`, body: buildHandsCsv(hands) },
  ];
  // The extra datasets only produce a file when there is something in them, so
  // a user without staking or trips is not asked to share five empty CSVs.
  if (online.length) files.push({ name: `bankrolly-online-${stamp}.csv`, body: buildOnlineCsv(online) });
  if (staking.length) files.push({ name: `bankrolly-staking-${stamp}.csv`, body: buildStakingCsv(staking) });
  if (transactions.length)
    files.push({ name: `bankrolly-transactions-${stamp}.csv`, body: buildTransactionsCsv(transactions) });
  if (trips.length) files.push({ name: `bankrolly-trips-${stamp}.csv`, body: buildTripsCsv(trips) });
  if (tripExpenses.length)
    files.push({ name: `bankrolly-trip-expenses-${stamp}.csv`, body: buildTripExpensesCsv(tripExpenses) });

  const paths: string[] = [];
  for (const f of files) {
    const path = `${dir}${f.name}`;
    await FileSystem.writeAsStringAsync(path, f.body, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    paths.push(path);
  }

  if (await Sharing.isAvailableAsync()) {
    for (const p of paths) {
      await Sharing.shareAsync(p, { mimeType: 'text/csv' });
    }
  }
  return paths;
}
