import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { CashSession, HandNote, Tournament } from '@/db/schema';
import { cashProfit, tournamentInvested, tournamentNet, tournamentROI } from './calculations';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
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

export interface ExportInput {
  cash: CashSession[];
  tourneys: Tournament[];
  hands: HandNote[];
}

export async function exportAllAsCsv({ cash, tourneys, hands }: ExportInput): Promise<string[]> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new Error('No writable directory available');

  const files = [
    { name: `bankrolly-cash-${stamp}.csv`, body: buildCashCsv(cash) },
    { name: `bankrolly-tournaments-${stamp}.csv`, body: buildTournamentCsv(tourneys) },
    { name: `bankrolly-hands-${stamp}.csv`, body: buildHandsCsv(hands) },
  ];

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
