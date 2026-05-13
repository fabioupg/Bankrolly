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
  tripId: text('trip_id'),
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
  tripId: text('trip_id'),
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

export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().default(''),
  name: text('name').notNull(),
  nickname: text('nickname').notNull().default(''),
  venue: text('venue').notNull().default(''),
  archetype: text('archetype').notNull().default(''),
  preflopTendencies: text('preflop_tendencies').notNull().default(''),
  postflopTendencies: text('postflop_tendencies').notNull().default(''),
  betSizing: text('bet_sizing').notNull().default(''),
  bluffFrequency: text('bluff_frequency').notNull().default(''),
  generalNotes: text('general_notes').notNull().default(''),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const trips = sqliteTable('trips', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().default(''),
  name: text('name').notNull(),
  destination: text('destination').notNull().default(''),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const tripExpenses = sqliteTable('trip_expenses', {
  id: text('id').primaryKey(),
  tripId: text('trip_id').notNull(),
  category: text('category').notNull().default('other'),
  description: text('description').notNull().default(''),
  amount: real('amount').notNull().default(0),
  date: text('date').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const playerHands = sqliteTable('player_hands', {
  id: text('id').primaryKey(),
  playerId: text('player_id').notNull(),
  description: text('description').notNull().default(''),
  result: text('result').notNull().default('unknown'),
  stakes: text('stakes').notNull().default(''),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type CashSession = typeof cashSessions.$inferSelect;
export type NewCashSession = typeof cashSessions.$inferInsert;
export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
export type HandNote = typeof handNotes.$inferSelect;
export type NewHandNote = typeof handNotes.$inferInsert;
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type PlayerHand = typeof playerHands.$inferSelect;
export type NewPlayerHand = typeof playerHands.$inferInsert;
export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
export type TripExpense = typeof tripExpenses.$inferSelect;
export type NewTripExpense = typeof tripExpenses.$inferInsert;

export const GAME_TYPES = ['NLH', 'PLO', 'Mixed'] as const;
export const STAKES_PRESETS = ['1/2', '2/5', '5/10', '10/20', '25/50'] as const;
export const TOURNAMENT_FORMATS = ['MTT', 'SNG', 'Bounty', 'Live', 'Online'] as const;
export const STREETS = ['preflop', 'flop', 'turn', 'river'] as const;
export const POSITIONS = ['BTN', 'CO', 'HJ', 'MP', 'UTG', 'BB', 'SB'] as const;
export const HAND_TAGS = ['hero_call', 'fold_spot', 'bluff', 'value', 'mistake', 'review'] as const;
export const PLAYER_ARCHETYPES = [
  'TAG',
  'LAG',
  'Nit',
  'Maniac',
  'Calling Station',
  'Whale',
  'Reg',
  'Rec',
  'Balanced',
  'Unknown',
] as const;
export const BLUFF_FREQUENCIES = ['Never', 'Rare', 'Balanced', 'Often', 'Maniac'] as const;
export const PLAYER_HAND_RESULTS = ['hero_won', 'villain_won', 'split', 'unknown'] as const;
export const EXPENSE_CATEGORIES = [
  'hotel',
  'food',
  'drinks',
  'transport',
  'entrance',
  'tips',
  'shopping',
  'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const ACTIONS = [
  'fold',
  'check',
  'call',
  'open',
  'limp',
  'bet',
  'raise',
  '3-bet',
  '4-bet',
  '5-bet',
  'all-in',
  'shove',
] as const;

export type GameType = (typeof GAME_TYPES)[number];
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];
export type Street = (typeof STREETS)[number];
export type Position = (typeof POSITIONS)[number];
export type HandTag = (typeof HAND_TAGS)[number];
export type SessionType = 'cash' | 'tournament';
export type PlayerArchetype = (typeof PLAYER_ARCHETYPES)[number];
export type BluffFrequency = (typeof BLUFF_FREQUENCIES)[number];
export type PlayerHandResult = (typeof PLAYER_HAND_RESULTS)[number];
export type ActionType = (typeof ACTIONS)[number];
