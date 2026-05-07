import { sql } from 'drizzle-orm';
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const cashSessions = sqliteTable('cash_sessions', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  venue: text('venue').notNull(),
  gameType: text('game_type').notNull(),
  stakes: text('stakes').notNull(),
  buyIn: real('buy_in').notNull(),
  cashOut: real('cash_out').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const tournaments = sqliteTable('tournaments', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  name: text('name').notNull(),
  venue: text('venue').notNull(),
  format: text('format').notNull(),
  buyIn: real('buy_in').notNull(),
  rebuys: real('rebuys').notNull().default(0),
  addon: real('addon').notNull().default(0),
  fieldSize: integer('field_size').notNull().default(0),
  finishPosition: integer('finish_position').notNull().default(0),
  prize: real('prize').notNull().default(0),
  bounties: real('bounties').notNull().default(0),
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const handNotes = sqliteTable('hand_notes', {
  id: text('id').primaryKey(),
  sessionId: text('session_id'),
  sessionType: text('session_type').notNull(),
  street: text('street').notNull(),
  position: text('position').notNull(),
  heroCards: text('hero_cards').notNull().default(''),
  board: text('board').notNull().default(''),
  villainRangeNotes: text('villain_range_notes').notNull().default(''),
  actionLine: text('action_line').notNull().default(''),
  result: real('result').notNull().default(0),
  tag: text('tag').notNull().default('review'),
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type CashSession = typeof cashSessions.$inferSelect;
export type NewCashSession = typeof cashSessions.$inferInsert;
export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
export type HandNote = typeof handNotes.$inferSelect;
export type NewHandNote = typeof handNotes.$inferInsert;

export const GAME_TYPES = ['NLH', 'PLO', 'Mixed'] as const;
export const STAKES_PRESETS = ['1/2', '2/5', '5/10', '10/20', '25/50'] as const;
export const TOURNAMENT_FORMATS = ['MTT', 'SNG', 'Bounty', 'Live', 'Online'] as const;
export const STREETS = ['preflop', 'flop', 'turn', 'river'] as const;
export const POSITIONS = ['BTN', 'CO', 'HJ', 'MP', 'UTG', 'BB', 'SB'] as const;
export const HAND_TAGS = ['hero_call', 'fold_spot', 'bluff', 'value', 'mistake', 'review'] as const;

export type GameType = (typeof GAME_TYPES)[number];
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];
export type Street = (typeof STREETS)[number];
export type Position = (typeof POSITIONS)[number];
export type HandTag = (typeof HAND_TAGS)[number];
export type SessionType = 'cash' | 'tournament';
