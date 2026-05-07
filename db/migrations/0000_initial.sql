CREATE TABLE `cash_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `date` text NOT NULL,
  `venue` text NOT NULL,
  `game_type` text NOT NULL,
  `stakes` text NOT NULL,
  `buy_in` real NOT NULL,
  `cash_out` real NOT NULL,
  `duration_minutes` integer NOT NULL,
  `notes` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tournaments` (
  `id` text PRIMARY KEY NOT NULL,
  `date` text NOT NULL,
  `name` text NOT NULL,
  `venue` text NOT NULL,
  `format` text NOT NULL,
  `buy_in` real NOT NULL,
  `rebuys` real DEFAULT 0 NOT NULL,
  `addon` real DEFAULT 0 NOT NULL,
  `field_size` integer DEFAULT 0 NOT NULL,
  `finish_position` integer DEFAULT 0 NOT NULL,
  `prize` real DEFAULT 0 NOT NULL,
  `bounties` real DEFAULT 0 NOT NULL,
  `notes` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hand_notes` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text,
  `session_type` text NOT NULL,
  `street` text NOT NULL,
  `position` text NOT NULL,
  `hero_cards` text DEFAULT '' NOT NULL,
  `board` text DEFAULT '' NOT NULL,
  `villain_range_notes` text DEFAULT '' NOT NULL,
  `action_line` text DEFAULT '' NOT NULL,
  `result` real DEFAULT 0 NOT NULL,
  `tag` text DEFAULT 'review' NOT NULL,
  `notes` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_cash_date` ON `cash_sessions` (`date`);
--> statement-breakpoint
CREATE INDEX `idx_tourney_date` ON `tournaments` (`date`);
--> statement-breakpoint
CREATE INDEX `idx_hand_session` ON `hand_notes` (`session_id`);
--> statement-breakpoint
CREATE INDEX `idx_hand_tag` ON `hand_notes` (`tag`);
