// Format detection and row extraction for CSVs exported by other poker apps.
//
// Only PBT is parsed against a verified spec — it is the one format whose header
// is officially documented and whose sample file we can check our arithmetic
// against. Everything else goes through the fuzzy header mapper, because the
// other vendors publish no format at all: hard-coding a parser against a guessed
// header would look like support and break on the first real export.

import {
  normalizeKey,
  parseCsv,
  parseDateTime,
  parseDuration,
  parseNum,
  repairRow,
  type DateOrder,
} from './parse';

export type RowKind =
  | 'cash'
  | 'tournament'
  | 'deposit'
  | 'withdrawal'
  | 'expense'
  | 'bonus'
  | 'other';

/** One source row, normalised. Money stays in the file's own currency. */
export interface CanonRow {
  sourceRow: number;
  kind: RowKind;
  startedAt: Date | null;
  durationMinutes: number | null;
  venue: string;
  venueKind: string;
  game: string;
  limitType: string;
  stakes: string;
  currency: string;
  buyIn: number | null;
  rebuyCost: number;
  addOnCost: number;
  cashOut: number | null;
  bountyWon: number;
  bountyCost: number;
  expenses: number;
  expensesFromStack: number;
  sharesIn: number;
  sharesOut: number;
  tournamentName: string;
  place: number | null;
  entrants: number | null;
  /** Profit as the source app declared it, when it ships such a column. */
  declaredProfit: number | null;
  note: string;
  warnings: string[];
}

export interface ExtractResult {
  sourceApp: string;
  rows: CanonRow[];
  skipped: { row: number; reason: string }[];
  /** Slash dates whose day/month order the file itself does not settle. */
  ambiguousDates: number;
  mapped: { column: string; field: string }[];
  unmapped: string[];
  warnings: string[];
}

const PBT_FINGERPRINT = '---PBT Bankroll Export---';

const PBT_KIND: Record<string, RowKind> = {
  'cash game': 'cash',
  tournament: 'tournament',
  'casino games': 'other',
  'jackpot/bonus': 'bonus',
  costs: 'expense',
  'deposit/payout': 'deposit', // flips to a withdrawal when the amount is negative
};

const num = (v: string | undefined) => parseNum(v) ?? 0;

function emptyRow(sourceRow: number): CanonRow {
  return {
    sourceRow,
    kind: 'cash',
    startedAt: null,
    durationMinutes: null,
    venue: '',
    venueKind: '',
    game: '',
    limitType: '',
    stakes: '',
    currency: '',
    buyIn: null,
    rebuyCost: 0,
    addOnCost: 0,
    cashOut: null,
    bountyWon: 0,
    bountyCost: 0,
    expenses: 0,
    expensesFromStack: 0,
    sharesIn: 0,
    sharesOut: 0,
    tournamentName: '',
    place: null,
    entrants: null,
    declaredProfit: null,
    note: '',
    warnings: [],
  };
}

/**
 * The net result of a row, computed from its parts rather than read off the
 * file's own profit column.
 *
 * Checked against every row of PBT's official sample:
 *   680 - (105+100)         = 475   (their netprofit column: 475)
 *   230 - (200+150)         = -120  (-120)
 *   0 - 130 + 13 sharesIn   = -117  (-117)
 *
 * expensesFromStack (a tip taken out of the chips) is deliberately absent: it is
 * already gone from cashOut. PBT's grossprofit column adds it back, which is
 * exactly why their gross and net differ by the size of the tip.
 */
export function netOf(r: CanonRow): number {
  const invested = (r.buyIn ?? 0) + r.rebuyCost + r.addOnCost;
  return (r.cashOut ?? 0) + r.bountyWon - invested - r.expenses + r.sharesIn - r.sharesOut;
}

// ---------------------------------------------------------------- PBT

function extractPbt(rows: string[][], order: DateOrder): ExtractResult {
  const header = rows[1].map(normalizeKey);
  const at = (row: string[], key: string) => row[header.indexOf(key)] ?? '';

  const out: ExtractResult = {
    sourceApp: 'Poker Bankroll Tracker',
    rows: [],
    skipped: [],
    ambiguousDates: 0,
    mapped: [],
    unmapped: [],
    warnings: [],
  };

  for (let i = 2; i < rows.length; i++) {
    const line = i + 1;
    const row = repairRow(rows[i], header.length).row;
    const r = emptyRow(line);

    const variant = at(row, 'variant').trim().toLowerCase();
    const kind = PBT_KIND[variant];
    if (!kind) {
      out.skipped.push({ row: line, reason: `Unknown session type "${at(row, 'variant')}"` });
      continue;
    }

    const parsed = parseDateTime(at(row, 'starttime'), '', order);
    if (!parsed.date) {
      out.skipped.push({ row: line, reason: 'No usable start time' });
      continue;
    }
    if (parsed.ambiguous) out.ambiguousDates++;

    r.kind = kind;
    r.startedAt = parsed.date;
    r.venue = at(row, 'location').trim();
    r.venueKind = at(row, 'type').trim();
    r.game = at(row, 'game').trim();
    r.limitType = at(row, 'limit').trim();
    r.currency = at(row, 'currency').trim().toUpperCase();
    r.buyIn = parseNum(at(row, 'buyin'));
    r.cashOut = parseNum(at(row, 'cashout'));
    r.rebuyCost = num(at(row, 'rebuycosts'));
    r.addOnCost = num(at(row, 'addoncosts'));
    r.bountyWon = num(at(row, 'bounties'));
    r.bountyCost = num(at(row, 'bountycosts'));
    r.expenses = num(at(row, 'expenses'));
    r.expensesFromStack = num(at(row, 'expensesfromstack'));
    r.sharesIn = num(at(row, 'sharesincomings'));
    r.sharesOut = num(at(row, 'sharesoutgoings'));
    r.tournamentName = at(row, 'mttname').trim();
    r.place = parseNum(at(row, 'place'));
    r.entrants = parseNum(at(row, 'player'));
    r.declaredProfit = parseNum(at(row, 'netprofit'));
    r.note = at(row, 'sessionnote').trim();

    const sb = parseNum(at(row, 'smallblind'));
    const bb = parseNum(at(row, 'bigblind'));
    if (sb != null && bb != null && (sb > 0 || bb > 0)) r.stakes = `${sb}/${bb}`;

    // End time minus the break is the real playing time. PBT also ships a
    // playingminutes column, but it is redundant and not to be trusted.
    const end = parseDateTime(at(row, 'endtime'), '', order).date;
    if (end && end.getTime() > parsed.date.getTime()) {
      const gross = Math.round((end.getTime() - parsed.date.getTime()) / 60000);
      r.durationMinutes = Math.max(0, gross - num(at(row, 'breakminutes')));
    }

    out.rows.push(r);
  }
  return out;
}

// ---------------------------------------------------------------- fuzzy

type FuzzyField =
  | 'startedAt'
  | 'endedAt'
  | 'time'
  | 'endTime'
  | 'venue'
  | 'kind'
  | 'game'
  | 'limitType'
  | 'stakes'
  | 'buyIn'
  | 'cashOut'
  | 'profit'
  | 'currency'
  | 'smallBlind'
  | 'bigBlind'
  | 'expenses'
  | 'note'
  | 'tournamentName'
  | 'place'
  | 'entrants'
  | 'duration';

// Order matters twice over. Fields are claimed top-down, so the more specific
// field takes a shared column first ("tournament" before the generic "kind"),
// and inside each field the longest alias wins ("starttime" before "start").
const ALIASES: [FuzzyField, string[]][] = [
  // A full-date column wins over a bare clock: apps that split "Date" and
  // "Start Time" (Poker Income) must map the date here and the clock to `time`.
  // "starttime" stays last so a file whose only datetime column is called that
  // (PBT-style, though PBT has its own parser) still resolves.
  ['startedAt', ['startdate', 'sessiondate', 'datetime', 'datum', 'date', 'began', 'start', 'starttime']],
  ['endedAt', ['enddate', 'ended', 'finished', 'end']],
  ['time', ['starttime', 'timestarted', 'starttimeofday']],
  ['endTime', ['endtime', 'timeended']],
  ['tournamentName', ['tournamentname', 'mttname', 'eventname', 'tournament', 'event']],
  ['kind', ['sessiontype', 'gametype', 'variant', 'format', 'type']],
  ['game', ['gamename', 'game']],
  ['limitType', ['limittype', 'betting', 'limit']],
  ['stakes', ['stakes', 'blinds']],
  ['venue', ['location', 'venue', 'casino', 'room', 'site', 'where', 'ort', 'place']],
  ['buyIn', ['totalbuyin', 'buyins', 'buyin', 'einsatz']],
  ['cashOut', ['cashedout', 'cashout', 'cashed', 'endstack']],
  ['profit', ['netprofit', 'winloss', 'profit', 'result', 'net', 'gewinn', 'pl']],
  ['currency', ['currency', 'curr', 'ccy', 'waehrung']],
  ['smallBlind', ['smallblind', 'sb']],
  ['bigBlind', ['bigblind', 'bb']],
  ['expenses', ['expenses', 'expense', 'costs', 'tips', 'spesen']],
  ['note', ['sessionnote', 'description', 'comments', 'comment', 'notes', 'note', 'notiz']],
  ['place', ['finishposition', 'finish', 'position', 'rank', 'platz']],
  ['entrants', ['fieldsize', 'entrants', 'runners', 'players', 'field', 'player']],
  ['duration', ['playingminutes', 'durationhrs', 'duration', 'hours', 'length', 'dauer']],
];

/**
 * "place" means the venue in some exports and the finishing position in others.
 * Because a column can only be claimed once, a file carrying "location" as well
 * leaves "place" free for the finish, which is what it means there.
 */
function mapHeader(header: string[]): {
  index: Partial<Record<FuzzyField, number>>;
  unmapped: string[];
} {
  const keys = header.map(normalizeKey);
  const index: Partial<Record<FuzzyField, number>> = {};
  const taken = new Set<number>();

  for (const [field, aliases] of ALIASES) {
    for (const alias of aliases) {
      const i = keys.findIndex((k, idx) => !taken.has(idx) && k === alias);
      if (i > -1) {
        index[field] = i;
        taken.add(i);
        break;
      }
    }
  }
  return {
    index,
    unmapped: header.filter((h, i) => !taken.has(i) && h.trim() !== ''),
  };
}

function fuzzyKind(raw: string): RowKind {
  const k = raw.trim().toLowerCase();
  if (!k) return 'cash';
  if (k.includes('tourn') || k === 'mtt' || k === 'sng') return 'tournament';
  if (k.includes('deposit')) return 'deposit';
  if (k.includes('withdraw') || k.includes('payout')) return 'withdrawal';
  if (k.includes('bonus') || k.includes('jackpot') || k.includes('rakeback')) return 'bonus';
  if (k.includes('cost') || k.includes('expense')) return 'expense';
  return 'cash';
}

function extractFuzzy(rows: string[][], headerAt: number, order: DateOrder): ExtractResult {
  const header = rows[headerAt];
  const { index, unmapped } = mapHeader(header);

  const out: ExtractResult = {
    sourceApp: 'Unknown app',
    rows: [],
    skipped: [],
    ambiguousDates: 0,
    mapped: (Object.keys(index) as FuzzyField[]).map((f) => ({
      column: header[index[f]!],
      field: f,
    })),
    unmapped,
    warnings: [],
  };

  const cell = (row: string[], f: FuzzyField) =>
    index[f] === undefined ? '' : (row[index[f]!] ?? '');

  if (index.startedAt === undefined) {
    out.warnings.push('No date column found — nothing can be imported from this file.');
    return out;
  }
  if (index.kind === undefined) {
    out.warnings.push('No session-type column — every row is imported as a cash game.');
  }
  if (index.buyIn === undefined || index.cashOut === undefined) {
    out.warnings.push(
      'No buy-in/cash-out columns — sessions are rebuilt from their profit, so buy-ins show as 0.',
    );
  }

  for (let i = headerAt + 1; i < rows.length; i++) {
    const line = i + 1;
    const { row, repaired } = repairRow(rows[i], header.length);
    const r = emptyRow(line);
    if (repaired) r.warnings.push('Row repaired: an unquoted comma had split the note.');

    const parsed = parseDateTime(cell(row, 'startedAt'), cell(row, 'time'), order);
    if (!parsed.date) {
      out.skipped.push({ row: line, reason: 'No usable date' });
      continue;
    }
    if (parsed.ambiguous) out.ambiguousDates++;

    r.startedAt = parsed.date;
    r.kind = fuzzyKind(cell(row, 'kind'));
    r.venue = cell(row, 'venue').trim();
    r.game = cell(row, 'game').trim();
    r.limitType = cell(row, 'limitType').trim();
    r.stakes = cell(row, 'stakes').trim();
    r.currency = cell(row, 'currency').trim().toUpperCase();
    r.buyIn = parseNum(cell(row, 'buyIn'));
    r.cashOut = parseNum(cell(row, 'cashOut'));
    r.expenses = num(cell(row, 'expenses'));
    r.declaredProfit = parseNum(cell(row, 'profit'));
    r.tournamentName = cell(row, 'tournamentName').trim();
    r.place = parseNum(cell(row, 'place'));
    r.entrants = parseNum(cell(row, 'entrants'));
    r.note = cell(row, 'note').trim();

    if (!r.stakes) {
      const sb = parseNum(cell(row, 'smallBlind'));
      const bb = parseNum(cell(row, 'bigBlind'));
      if (sb != null && bb != null && (sb > 0 || bb > 0)) r.stakes = `${sb}/${bb}`;
    }

    // An explicit duration column wins; otherwise derive it from the end time.
    r.durationMinutes = parseDuration(cell(row, 'duration'));
    if (r.durationMinutes == null) {
      const end = parseDateTime(
        cell(row, 'endedAt') || cell(row, 'startedAt'),
        cell(row, 'endTime') || cell(row, 'endedAt'),
        order,
      ).date;
      if (end) {
        const startMs = parsed.date.getTime();
        let endMs = end.getTime();
        // A clock-only end time lands on the start date, so a session that ran
        // past midnight looks like it ended before it began. Anything earlier
        // by less than a day is that case, not garbage — roll it forward.
        // (Strictly earlier: an end equal to the start stays unknown, not 24h.)
        if (endMs < startMs && startMs - endMs < 24 * 3_600_000) endMs += 24 * 3_600_000;
        if (endMs > startMs) {
          r.durationMinutes = Math.round((endMs - startMs) / 60000);
        }
      }
    }

    // Profit-only exports (Pokerbase, plain spreadsheets) carry no buy-in and no
    // cash-out. Model the profit as a bare cash-out so the bankroll still lands
    // on the right number, even though the buy-in is lost.
    if (r.buyIn == null && r.cashOut == null && r.declaredProfit != null) {
      r.buyIn = 0;
      r.cashOut = r.declaredProfit;
      r.warnings.push('Only a profit column was available — buy-in recorded as 0.');
    }

    if (r.buyIn == null && r.cashOut == null && r.declaredProfit == null) {
      out.skipped.push({ row: line, reason: 'No money columns (buy-in, cash-out or profit)' });
      continue;
    }

    out.rows.push(r);
  }
  return out;
}

// ---------------------------------------------------------------- detection

/**
 * PBT announces itself on line 1. Everything else has to be sniffed: skip any
 * preamble — Poker Income mails the data with the message body above it — down
 * to the first line that looks like a header, then fuzzy-map it.
 */
export function extract(text: string, order: DateOrder = 'auto'): ExtractResult {
  const empty = (warning: string): ExtractResult => ({
    sourceApp: 'Unknown app',
    rows: [],
    skipped: [],
    ambiguousDates: 0,
    mapped: [],
    unmapped: [],
    warnings: [warning],
  });

  const rows = parseCsv(text);
  if (!rows.length) return empty('The file is empty.');

  if (rows[0][0]?.trim().startsWith(PBT_FINGERPRINT) && rows.length > 1) {
    return extractPbt(rows, order);
  }

  const headerAt = rows.findIndex((r) => r.filter((f) => f.trim() !== '').length >= 3);
  if (headerAt < 0) return empty('No header row found in this file.');
  return extractFuzzy(rows, headerAt, order);
}
