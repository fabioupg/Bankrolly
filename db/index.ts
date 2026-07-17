import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';
import * as schema from './schema';

const DB_NAME = 'pokerledger.db';

export const expoDb = SQLite.openDatabaseSync(DB_NAME);
export const db = drizzle(expoDb, { schema });

const PRAGMAS = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
`;

const CREATE_TABLES_SQL = `
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
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS online_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  site TEXT NOT NULL DEFAULT '',
  total_buy_in REAL NOT NULL DEFAULT 0,
  total_cash REAL NOT NULL DEFAULT 0,
  entries TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS live_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  started_at INTEGER NOT NULL,
  venue TEXT NOT NULL DEFAULT '',
  stakes TEXT NOT NULL DEFAULT '',
  game_type TEXT NOT NULL DEFAULT 'NLH',
  buy_in REAL NOT NULL DEFAULT 0,
  current_stack REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  paused_ms INTEGER NOT NULL DEFAULT 0,
  pause_started_at INTEGER,
  stack_history TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  activity_id TEXT NOT NULL DEFAULT '',
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
  table_state TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  nickname TEXT NOT NULL DEFAULT '',
  venue TEXT NOT NULL DEFAULT '',
  archetype TEXT NOT NULL DEFAULT '',
  preflop_tendencies TEXT NOT NULL DEFAULT '',
  postflop_tendencies TEXT NOT NULL DEFAULT '',
  bet_sizing TEXT NOT NULL DEFAULT '',
  bluff_frequency TEXT NOT NULL DEFAULT '',
  general_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_hands (
  id TEXT PRIMARY KEY NOT NULL,
  player_id TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT 'unknown',
  stakes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  destination TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staking_deals (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL DEFAULT 'backed',
  counterparty TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  buy_in REAL NOT NULL DEFAULT 0,
  percent REAL NOT NULL DEFAULT 0,
  markup REAL NOT NULL DEFAULT 1,
  makeup_before REAL NOT NULL DEFAULT 0,
  result REAL NOT NULL DEFAULT 0,
  settled INTEGER NOT NULL DEFAULT 0,
  settled_date TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bankroll_transactions (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other',
  amount REAL NOT NULL DEFAULT 0,
  venue TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trip_expenses (
  id TEXT PRIMARY KEY NOT NULL,
  trip_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

const CREATE_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_cash_date ON cash_sessions(date);
CREATE INDEX IF NOT EXISTS idx_tourney_date ON tournaments(date);
CREATE INDEX IF NOT EXISTS idx_online_date ON online_sessions(date);
CREATE INDEX IF NOT EXISTS idx_live_status ON live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_hand_session ON hand_notes(session_id);
CREATE INDEX IF NOT EXISTS idx_hand_tag ON hand_notes(tag);
CREATE INDEX IF NOT EXISTS idx_player_owner ON players(owner_id);
CREATE INDEX IF NOT EXISTS idx_player_name ON players(name);
CREATE INDEX IF NOT EXISTS idx_player_hand_player ON player_hands(player_id);
CREATE INDEX IF NOT EXISTS idx_trip_owner ON trips(owner_id);
CREATE INDEX IF NOT EXISTS idx_trip_dates ON trips(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_trip_expense_trip ON trip_expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_transaction_date ON bankroll_transactions(date);
CREATE INDEX IF NOT EXISTS idx_staking_owner ON staking_deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_cash_trip ON cash_sessions(trip_id);
CREATE INDEX IF NOT EXISTS idx_tourney_trip ON tournaments(trip_id);
`;

function ensureColumn(table: string, column: string, type: string) {
  const rows = expoDb.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
  const exists = rows.some((r) => r.name === column);
  if (!exists) {
    expoDb.execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

let initialized = false;
export function initDatabase() {
  if (initialized) return;
  expoDb.execSync(PRAGMAS);
  expoDb.execSync(CREATE_TABLES_SQL);
  ensureColumn('cash_sessions', 'trip_id', 'TEXT');
  ensureColumn('tournaments', 'trip_id', 'TEXT');
  ensureColumn('hand_notes', 'table_state', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('tournaments', 'duration_minutes', 'INTEGER NOT NULL DEFAULT 0');
  expoDb.execSync(CREATE_INDEXES_SQL);
  initialized = true;
}

export function resetDatabase() {
  expoDb.execSync(`
    DROP TABLE IF EXISTS cash_sessions;
    DROP TABLE IF EXISTS tournaments;
    DROP TABLE IF EXISTS online_sessions;
    DROP TABLE IF EXISTS live_sessions;
    DROP TABLE IF EXISTS hand_notes;
    DROP TABLE IF EXISTS players;
    DROP TABLE IF EXISTS player_hands;
    DROP TABLE IF EXISTS trips;
    DROP TABLE IF EXISTS trip_expenses;
    DROP TABLE IF EXISTS bankroll_transactions;
    DROP TABLE IF EXISTS staking_deals;
  `);
  initialized = false;
  initDatabase();
}

export { schema };
