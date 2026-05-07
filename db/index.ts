import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';
import * as schema from './schema';

const DB_NAME = 'pokerledger.db';

export const expoDb = SQLite.openDatabaseSync(DB_NAME);
export const db = drizzle(expoDb, { schema });

const INIT_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cash_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  venue TEXT NOT NULL,
  game_type TEXT NOT NULL,
  stakes TEXT NOT NULL,
  buy_in REAL NOT NULL,
  cash_out REAL NOT NULL,
  duration_minutes INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  venue TEXT NOT NULL,
  format TEXT NOT NULL,
  buy_in REAL NOT NULL,
  rebuys REAL NOT NULL DEFAULT 0,
  addon REAL NOT NULL DEFAULT 0,
  field_size INTEGER NOT NULL DEFAULT 0,
  finish_position INTEGER NOT NULL DEFAULT 0,
  prize REAL NOT NULL DEFAULT 0,
  bounties REAL NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hand_notes (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT,
  session_type TEXT NOT NULL,
  street TEXT NOT NULL,
  position TEXT NOT NULL,
  hero_cards TEXT NOT NULL DEFAULT '',
  board TEXT NOT NULL DEFAULT '',
  villain_range_notes TEXT NOT NULL DEFAULT '',
  action_line TEXT NOT NULL DEFAULT '',
  result REAL NOT NULL DEFAULT 0,
  tag TEXT NOT NULL DEFAULT 'review',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cash_date ON cash_sessions(date);
CREATE INDEX IF NOT EXISTS idx_tourney_date ON tournaments(date);
CREATE INDEX IF NOT EXISTS idx_hand_session ON hand_notes(session_id);
CREATE INDEX IF NOT EXISTS idx_hand_tag ON hand_notes(tag);
`;

let initialized = false;
export function initDatabase() {
  if (initialized) return;
  expoDb.execSync(INIT_SQL);
  initialized = true;
}

export function resetDatabase() {
  expoDb.execSync(`
    DROP TABLE IF EXISTS cash_sessions;
    DROP TABLE IF EXISTS tournaments;
    DROP TABLE IF EXISTS hand_notes;
  `);
  initialized = false;
  initDatabase();
}

export { schema };
