// CSV import for cash sessions and tournaments. Accepts exactly the files
// `csvExport.ts` produces (same headers, same escaping), so an export can be
// re-imported on a new device or after a reset. Computed columns (profit,
// invested, net, roi_percent) are ignored — they are re-derived from the raw
// numbers. Rows whose id already exists locally are skipped as duplicates.

import { db } from '@/db';
import {
  cashSessions,
  tournaments,
  type NewCashSession,
  type NewTournament,
} from '@/db/schema';
import { newId } from './id';

// --- CSV text parsing (RFC 4180-style) ---------------------------------------

/**
 * Parse CSV text into rows of cells. Handles quoted cells, escaped quotes
 * (""), commas and newlines inside quotes, and CRLF/LF line endings.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let sawAny = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      sawAny = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
      sawAny = true;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      sawAny = false;
    } else {
      cell += ch;
      sawAny = true;
    }
  }
  if (sawAny || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop fully empty trailing rows (a final newline produces one).
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/**
 * Undo the spreadsheet formula-injection guard the export applies: a leading
 * apostrophe added in front of = + - @ (or tab/CR) is stripped again so the
 * original value round-trips.
 */
function unescapeCell(value: string): string {
  if (value.startsWith("'") && /^[=+\-@\t\r]/.test(value.slice(1))) {
    return value.slice(1);
  }
  return value;
}

// --- Header detection ---------------------------------------------------------

export type CsvKind = 'cash' | 'tournament' | 'hands';

const CASH_REQUIRED = ['date', 'venue', 'game_type', 'stakes', 'buy_in', 'cash_out', 'duration_minutes'];
const TOURNAMENT_REQUIRED = ['date', 'name', 'venue', 'format', 'buy_in'];
const HANDS_MARKERS = ['hero_cards', 'action_line', 'session_type'];

/** Identify which export file this header row belongs to, or null. */
export function detectCsvKind(headers: string[]): CsvKind | null {
  const set = new Set(headers.map((h) => h.trim().toLowerCase()));
  if (HANDS_MARKERS.every((h) => set.has(h))) return 'hands';
  if (CASH_REQUIRED.every((h) => set.has(h))) return 'cash';
  if (TOURNAMENT_REQUIRED.every((h) => set.has(h)) && set.has('finish_position')) return 'tournament';
  return null;
}

// --- Row conversion -----------------------------------------------------------

export interface RowError {
  /** 1-based line number in the file (header = line 1). */
  line: number;
  reason: string;
}

interface ParsedFile<T> {
  rows: T[];
  duplicates: number;
  errors: RowError[];
}

function indexHeaders(headerRow: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    idx[h.trim().toLowerCase()] = i;
  });
  return idx;
}

function cellAt(row: string[], idx: Record<string, number>, name: string): string {
  const i = idx[name];
  if (i === undefined || i >= row.length) return '';
  return unescapeCell(row[i]).trim();
}

/** Required finite number; null marks the row invalid. */
function requiredNumber(raw: string): number | null {
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Optional number; empty/garbage falls back to 0. */
function optionalNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Accept YYYY-MM-DD (possibly with time suffix) or anything Date can parse. */
function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  const isoPrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) return isoPrefix[1];
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

function normalizeCreatedAt(raw: string): string {
  if (raw && !Number.isNaN(Date.parse(raw))) return raw;
  return new Date().toISOString();
}

/** Re-use the exported id when it is fresh; otherwise mint a new one. */
function resolveId(raw: string, existing: Set<string>): string | null {
  if (raw && existing.has(raw)) return null; // duplicate
  return raw || newId();
}

function parseCashRows(rows: string[][], existingIds: Set<string>): ParsedFile<NewCashSession> {
  const idx = indexHeaders(rows[0]);
  const out: ParsedFile<NewCashSession> = { rows: [], duplicates: 0, errors: [] };
  const seen = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const line = r + 1;
    const row = rows[r];
    const date = normalizeDate(cellAt(row, idx, 'date'));
    const buyIn = requiredNumber(cellAt(row, idx, 'buy_in'));
    const cashOut = requiredNumber(cellAt(row, idx, 'cash_out'));
    if (!date) {
      out.errors.push({ line, reason: 'invalid or missing date' });
      continue;
    }
    if (buyIn === null || cashOut === null) {
      out.errors.push({ line, reason: 'buy_in/cash_out is not a number' });
      continue;
    }
    const rawId = cellAt(row, idx, 'id');
    const id = resolveId(rawId, existingIds);
    if (id === null || seen.has(id)) {
      out.duplicates++;
      continue;
    }
    seen.add(id);
    out.rows.push({
      id,
      date,
      venue: cellAt(row, idx, 'venue'),
      gameType: cellAt(row, idx, 'game_type') || 'NLH',
      stakes: cellAt(row, idx, 'stakes'),
      buyIn,
      cashOut,
      durationMinutes: Math.max(0, Math.round(optionalNumber(cellAt(row, idx, 'duration_minutes')))),
      notes: cellAt(row, idx, 'notes'),
      createdAt: normalizeCreatedAt(cellAt(row, idx, 'created_at')),
    });
  }
  return out;
}

function parseTournamentRows(rows: string[][], existingIds: Set<string>): ParsedFile<NewTournament> {
  const idx = indexHeaders(rows[0]);
  const out: ParsedFile<NewTournament> = { rows: [], duplicates: 0, errors: [] };
  const seen = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const line = r + 1;
    const row = rows[r];
    const date = normalizeDate(cellAt(row, idx, 'date'));
    const buyIn = requiredNumber(cellAt(row, idx, 'buy_in'));
    if (!date) {
      out.errors.push({ line, reason: 'invalid or missing date' });
      continue;
    }
    if (buyIn === null) {
      out.errors.push({ line, reason: 'buy_in is not a number' });
      continue;
    }
    const rawId = cellAt(row, idx, 'id');
    const id = resolveId(rawId, existingIds);
    if (id === null || seen.has(id)) {
      out.duplicates++;
      continue;
    }
    seen.add(id);
    out.rows.push({
      id,
      date,
      name: cellAt(row, idx, 'name'),
      venue: cellAt(row, idx, 'venue'),
      format: cellAt(row, idx, 'format') || 'MTT',
      buyIn,
      rebuys: optionalNumber(cellAt(row, idx, 'rebuys')),
      addon: optionalNumber(cellAt(row, idx, 'addon')),
      fieldSize: Math.max(0, Math.round(optionalNumber(cellAt(row, idx, 'field_size')))),
      finishPosition: Math.max(0, Math.round(optionalNumber(cellAt(row, idx, 'finish_position')))),
      prize: optionalNumber(cellAt(row, idx, 'prize')),
      bounties: optionalNumber(cellAt(row, idx, 'bounties')),
      durationMinutes: Math.max(0, Math.round(optionalNumber(cellAt(row, idx, 'duration_minutes')))),
      notes: cellAt(row, idx, 'notes'),
      createdAt: normalizeCreatedAt(cellAt(row, idx, 'created_at')),
    });
  }
  return out;
}

// --- Import entry point ---------------------------------------------------------

export interface ImportResult {
  kind: CsvKind;
  imported: number;
  duplicates: number;
  errors: RowError[];
}

// Guard against absurdly large files locking the JS thread.
const MAX_CSV_BYTES = 5 * 1024 * 1024;
const INSERT_CHUNK = 40;

/**
 * Parse one CSV file (in the export format) and insert its rows. `existingIds`
 * must hold the ids already present locally so duplicates are skipped; ids of
 * newly inserted rows are added to the set, so the same set can be shared
 * across multiple files in one import run.
 */
export async function importSessionsCsv(
  text: string,
  existingIds: { cash: Set<string>; tournament: Set<string> },
): Promise<ImportResult> {
  if (text.length > MAX_CSV_BYTES) {
    throw new Error('File is too large (max 5 MB).');
  }
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error('The file is empty.');

  const kind = detectCsvKind(rows[0]);
  if (kind === null) {
    throw new Error(
      'Unrecognized columns. Use a file exported by Bankrolly (cash sessions or tournaments).',
    );
  }
  if (kind === 'hands') {
    throw new Error('This is a hand-notes export — only cash session and tournament CSVs can be imported.');
  }

  if (kind === 'cash') {
    const parsed = parseCashRows(rows, existingIds.cash);
    for (let i = 0; i < parsed.rows.length; i += INSERT_CHUNK) {
      await db.insert(cashSessions).values(parsed.rows.slice(i, i + INSERT_CHUNK));
    }
    for (const r of parsed.rows) existingIds.cash.add(r.id);
    return { kind, imported: parsed.rows.length, duplicates: parsed.duplicates, errors: parsed.errors };
  }

  const parsed = parseTournamentRows(rows, existingIds.tournament);
  for (let i = 0; i < parsed.rows.length; i += INSERT_CHUNK) {
    await db.insert(tournaments).values(parsed.rows.slice(i, i + INSERT_CHUNK));
  }
  for (const r of parsed.rows) existingIds.tournament.add(r.id);
  return { kind, imported: parsed.rows.length, duplicates: parsed.duplicates, errors: parsed.errors };
}
