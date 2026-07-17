// Full-device backup: every table, the currency setting, and the note photos.
//
// This is the "new phone / new iCloud account" path — the CSV export covers
// three tables and loses photos, live sessions, players, trips and table states.
//
// The container is written frame by frame (see backupCrypto.ts) so a library
// with hundreds of photos never has to exist in memory as one buffer: each
// photo is read, sealed and flushed on its own.
//
// Read backupCrypto.ts before assuming the file is protected. It is obfuscated,
// not secured.

import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ne } from 'drizzle-orm';
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils';
import { db, resetDatabase } from '@/db';
import {
  bankrollTransactions,
  cashSessions,
  handNotes,
  liveSessions,
  onlineSessions,
  playerHands,
  players,
  stakingDeals,
  tournaments,
  tripExpenses,
  trips,
} from '@/db/schema';
import {
  BackupFormatError,
  FORMAT_VERSION,
  HEADER_BYTES,
  LENGTH_BYTES,
  buildHeader,
  deriveKey,
  frameLength,
  openFrame,
  randomSalt,
  readHeader,
  sealFrame,
} from '@/utils/backupCrypto';
import { parseLiveNotes, serializeLiveNotes } from '@/utils/liveSession';
import { PHOTO_DIR } from '@/utils/photos';
import { useHandStore } from '@/store/useHandStore';
import { useLiveSessionStore } from '@/store/useLiveSessionStore';
import { useOnlineSessionStore } from '@/store/useOnlineSessionStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useSettingsStore } from '@/store/useStatsStore';
import { useStakingStore } from '@/store/useStakingStore';
import { useTournamentStore } from '@/store/useTournamentStore';
import { useTransactionStore } from '@/store/useTransactionStore';
import { useTripStore } from '@/store/useTripStore';

type Row = Record<string, unknown>;
type Handle = ReturnType<File['open']>;
type AnyTable = Parameters<typeof db.insert>[0];

/** Insert order — parents before the rows that point at them. */
const TABLES = [
  { key: 'trips', table: trips },
  { key: 'tripExpenses', table: tripExpenses },
  { key: 'cashSessions', table: cashSessions },
  { key: 'tournaments', table: tournaments },
  { key: 'onlineSessions', table: onlineSessions },
  { key: 'liveSessions', table: liveSessions },
  { key: 'handNotes', table: handNotes },
  { key: 'players', table: players },
  { key: 'playerHands', table: playerHands },
  { key: 'bankrollTransactions', table: bankrollTransactions },
  { key: 'stakingDeals', table: stakingDeals },
] as const;

type TableKey = (typeof TABLES)[number]['key'];

interface Payload {
  v: number;
  createdAt: string;
  app: string;
  currency: string;
  /** Monthly goal settings; absent in backups written before goals existed. */
  goals?: { profit: number; hours: number };
  /** Photo file names. Frame i+1 of the file carries the bytes of photos[i]. */
  photos: string[];
  tables: Record<TableKey, Row[]>;
}

// SQLite caps the bound parameters one statement may carry (999 by default).
// The widest table here has 14 columns, so 40 rows per statement stays inside it.
const INSERT_CHUNK = 40;

export type ImportMode = 'replace' | 'merge';

export interface ExportResult {
  fileName: string;
  rows: number;
  photos: number;
  bytes: number;
}

export interface ImportResult {
  rows: number;
  skipped: number;
  photos: number;
  /** A running session in the backup that could not be merged in — see below. */
  liveSessionSkipped: boolean;
}

/** Strip any path from a name so a crafted backup cannot write outside PHOTO_DIR. */
function safeName(name: unknown): string {
  const base = String(name ?? '')
    .split(/[/\\]/)
    .pop();
  if (!base || base === '.' || base === '..') {
    throw new BackupFormatError('Backup file is damaged and cannot be restored.');
  }
  return base;
}

/** Read one frame body (nonce ‖ ciphertext) from the handle's current offset. */
function readBody(handle: Handle): Uint8Array {
  const len = frameLength(handle.readBytes(LENGTH_BYTES));
  if (len <= 0) throw new BackupFormatError('Backup file is damaged and cannot be restored.');
  const body = handle.readBytes(len);
  if (body.length !== len) throw new BackupFormatError('Backup file is truncated.');
  return body;
}

async function insertChunked(table: AnyTable, rows: Row[]): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    await db.insert(table).values(rows.slice(i, i + INSERT_CHUNK) as never);
  }
}

function backupFileName(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  return `Bankrolly-${stamp}.bankrolly`;
}

/** A backup written by a future or hand-edited build could carry anything here. */
function asRows(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return value.filter((r): r is Row => !!r && typeof r === 'object');
}

/**
 * Write every table plus the note photos into an encrypted container and hand it
 * to the share sheet, so the user can drop it into Files, iCloud, AirDrop or mail.
 */
export async function exportBackup(
  onProgress?: (done: number, total: number) => void,
): Promise<ExportResult> {
  const [cash, tourneys, online, live, hands, playerRows, playerHandRows, tripRows, expenses, txRows, stakingRows] =
    await Promise.all([
      db.select().from(cashSessions),
      db.select().from(tournaments),
      db.select().from(onlineSessions),
      db.select().from(liveSessions),
      db.select().from(handNotes),
      db.select().from(players),
      db.select().from(playerHands),
      db.select().from(trips),
      db.select().from(tripExpenses),
      db.select().from(bankrollTransactions),
      db.select().from(stakingDeals),
    ]);

  // Photos go in by file name, never by absolute path: iOS hands the app
  // container a fresh UUID on every install, so the absolute URIs stored in the
  // notes are already dead by the time the backup is opened on another phone.
  const photos = new Map<string, string>(); // file name -> current absolute uri
  const liveOut = live.map((session) => {
    const notes = parseLiveNotes(session.notes);
    if (!notes.some((n) => n.photo)) return session;
    const rewritten = notes.map((note) => {
      if (!note.photo) return note;
      // A photo the user deleted off disk would leave a frame we cannot fill, so
      // drop the dead reference rather than export a broken one.
      if (!new File(note.photo).exists) return { ...note, photo: '' };
      const name = safeName(note.photo);
      photos.set(name, note.photo);
      return { ...note, photo: name };
    });
    return { ...session, notes: serializeLiveNotes(rewritten) };
  });

  const tables: Record<TableKey, Row[]> = {
    trips: tripRows,
    tripExpenses: expenses,
    cashSessions: cash,
    tournaments: tourneys,
    onlineSessions: online,
    liveSessions: liveOut,
    handNotes: hands,
    players: playerRows,
    playerHands: playerHandRows,
    bankrollTransactions: txRows,
    stakingDeals: stakingRows,
  };

  const payload: Payload = {
    v: FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    app: Constants.expoConfig?.version ?? '',
    currency: useSettingsStore.getState().currency,
    goals: {
      profit: useSettingsStore.getState().monthlyProfitTarget,
      hours: useSettingsStore.getState().monthlyHoursTarget,
    },
    photos: [...photos.keys()],
    tables,
  };

  const salt = randomSalt();
  const key = deriveKey(salt);
  const fileName = backupFileName();
  const out = new File(Paths.cache, fileName);
  if (out.exists) out.delete();
  out.create();

  const handle = out.open();
  try {
    handle.writeBytes(buildHeader(salt));
    handle.writeBytes(sealFrame(key, 0, utf8ToBytes(JSON.stringify(payload))));
    let frame = 1;
    for (const uri of photos.values()) {
      handle.writeBytes(sealFrame(key, frame, await new File(uri).bytes()));
      onProgress?.(frame, photos.size);
      frame++;
    }
  } finally {
    handle.close();
  }

  const rows = Object.values(tables).reduce((sum, list) => sum + list.length, 0);
  const result: ExportResult = { fileName, rows, photos: photos.size, bytes: out.size };

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(out.uri, {
      mimeType: 'application/octet-stream',
      UTI: 'public.data',
      dialogTitle: 'Save your Bankrolly backup',
    });
  }
  return result;
}

/**
 * Restore a container.
 *
 * 'replace' makes the device match the backup exactly (what you want on a new
 * phone); 'merge' adds what is missing and keeps everything already here.
 *
 * Nothing is deleted until the whole file has decrypted and verified: the photos
 * are staged in the cache first, so a truncated or tampered file fails before it
 * can take the user's data down with it.
 */
export async function importBackup(
  uri: string,
  mode: ImportMode,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const staging = new Directory(Paths.cache, `bankrolly-restore-${Date.now()}`);
  let payload: Payload;

  const handle = new File(uri).open();
  try {
    const key = deriveKey(readHeader(handle.readBytes(HEADER_BYTES)));
    payload = JSON.parse(bytesToUtf8(openFrame(key, 0, readBody(handle)))) as Payload;
    if (!payload?.tables || typeof payload.tables !== 'object') {
      throw new BackupFormatError('Backup file is damaged and cannot be restored.');
    }

    const names = Array.isArray(payload.photos) ? payload.photos : [];
    staging.create({ intermediates: true });
    for (let i = 0; i < names.length; i++) {
      const bytes = openFrame(key, i + 1, readBody(handle));
      const target = new File(staging, safeName(names[i]));
      target.create();
      target.write(bytes);
      onProgress?.(i + 1, names.length);
    }
  } catch (err) {
    if (staging.exists) staging.delete();
    throw err;
  } finally {
    handle.close();
  }

  try {
    return await applyPayload(payload, mode, staging);
  } finally {
    if (staging.exists) staging.delete();
  }
}

async function applyPayload(
  payload: Payload,
  mode: ImportMode,
  staging: Directory,
): Promise<ImportResult> {
  const tables = payload.tables;

  // Players and trips are scoped to the signed-in Clerk user. Restoring them
  // under the id from the old account would bury them behind a filter that never
  // matches, so they are re-homed onto whoever is signed in now — which is the
  // entire point of restoring onto a new account.
  const rehome = (rows: Row[], ownerId: string): Row[] =>
    ownerId ? rows.map((r) => ({ ...r, ownerId })) : rows;

  const prepared: Record<TableKey, Row[]> = {
    trips: rehome(asRows(tables.trips), useTripStore.getState().ownerId),
    tripExpenses: asRows(tables.tripExpenses),
    cashSessions: asRows(tables.cashSessions),
    tournaments: asRows(tables.tournaments),
    onlineSessions: asRows(tables.onlineSessions),
    liveSessions: asRows(tables.liveSessions).map((s) => ({
      ...s,
      // The lock-screen card belonged to the phone that wrote the backup.
      activityId: '',
      notes: serializeLiveNotes(
        parseLiveNotes(String(s.notes ?? '')).map((n) =>
          n.photo ? { ...n, photo: `${PHOTO_DIR}${safeName(n.photo)}` } : n,
        ),
      ),
    })),
    handNotes: asRows(tables.handNotes),
    players: rehome(asRows(tables.players), usePlayerStore.getState().ownerId),
    playerHands: asRows(tables.playerHands),
    bankrollTransactions: asRows(tables.bankrollTransactions),
    // Staking is scoped to the signed-in user, same as players and trips.
    stakingDeals: rehome(asRows(tables.stakingDeals), useStakingStore.getState().ownerId),
  };

  let liveSessionSkipped = false;

  if (mode === 'replace') {
    // The file is fully decrypted and staged by now, so it is safe to drop what
    // is here. discard() dismisses the Live Activity before its table goes away.
    await useLiveSessionStore.getState().discard();
    resetDatabase();
    const dir = new Directory(PHOTO_DIR);
    if (dir.exists) dir.delete();
  } else {
    // Only one non-ended live session may exist. If the user is sitting at a
    // table right now, the backup's running session cannot come along — dropping
    // it keeps the session they are actually playing.
    const active = await db.select().from(liveSessions).where(ne(liveSessions.status, 'ended'));
    if (active.length) {
      const endedOnly = prepared.liveSessions.filter((s) => s.status === 'ended');
      liveSessionSkipped = endedOnly.length !== prepared.liveSessions.length;
      prepared.liveSessions = endedOnly;
    }
  }

  let inserted = 0;
  let skipped = 0;
  for (const { key, table } of TABLES) {
    const rows = prepared[key];
    if (!rows.length) continue;
    let toInsert = rows;
    if (mode === 'merge') {
      const existing = new Set(
        (await db.select().from(table)).map((r) => (r as { id: string }).id),
      );
      toInsert = rows.filter((r) => !existing.has(String(r.id)));
      skipped += rows.length - toInsert.length;
    }
    await insertChunked(table, toInsert);
    inserted += toInsert.length;
  }

  // Photos last: a row pointing at a photo that failed to land is a broken
  // thumbnail, but a photo with no row is invisible litter.
  const photoDir = new Directory(PHOTO_DIR);
  if (!photoDir.exists) photoDir.create({ intermediates: true });
  let restoredPhotos = 0;
  for (const entry of staging.list()) {
    if (!(entry instanceof File)) continue;
    const dest = new File(photoDir, entry.name);
    if (dest.exists) {
      // Same file name already on the device — merge keeps what is here.
      if (mode === 'merge') continue;
      dest.delete();
    }
    entry.copy(dest);
    restoredPhotos++;
  }

  if (mode === 'replace' && typeof payload.currency === 'string' && payload.currency) {
    useSettingsStore.getState().setCurrency(payload.currency);
  }
  if (mode === 'replace' && payload.goals) {
    useSettingsStore.getState().setMonthlyProfitTarget(Number(payload.goals.profit) || 0);
    useSettingsStore.getState().setMonthlyHoursTarget(Number(payload.goals.hours) || 0);
  }

  await Promise.all([
    useSessionStore.getState().hydrate(),
    useTournamentStore.getState().hydrate(),
    useOnlineSessionStore.getState().hydrate(),
    useHandStore.getState().hydrate(),
    useLiveSessionStore.getState().hydrate(),
    usePlayerStore.getState().hydrate(),
    useTripStore.getState().hydrate(),
    useStakingStore.getState().hydrate(),
    useTransactionStore.getState().hydrate(),
  ]);

  return { rows: inserted, skipped, photos: restoredPhotos, liveSessionSkipped };
}
