# PokerLedger

Cross-platform mobile poker bankroll tracker for cash games and tournaments, with hand history logging. Built with Expo + React Native + TypeScript, all data stored locally in SQLite via Drizzle ORM.

## Features

- **Cash sessions** — venue, stakes, game type, buy-in / cash-out, duration. Auto-computed profit and hourly rate.
- **Tournaments** — MTT / SNG / Bounty / Live / Online. Buy-in, rebuys, add-on, prize, bounties. Auto-computed total invested, net P&L and ROI %.
- **Hand notes** — tag tough spots (hero call, fold spot, bluff, value, mistake, review). Linked to a session or standalone. Filterable by tag, position, street and session type.
- **Dashboard** — total bankroll, this-month P&L, hourly rate, MTT ROI, ITM %, current streak, last 5 sessions. Losing-streak warning when last 5 sessions are all in the red.
- **Analytics** — bankroll curve with 20-session moving-average overlay, hourly rate by venue, MTT ROI over time, biggest wins/losses.
- **Currency** — switch between USD / EUR / GBP / CHF. Persisted with AsyncStorage.
- **CSV export** — three CSV files (cash, tournaments, hands) shared via the system share sheet.
- **Reset database** — wipe all local data with confirmation.

## Tech stack

- Expo SDK 51 with Expo Router (file-based routing, typed routes off for flexibility)
- expo-sqlite + Drizzle ORM (`drizzle-orm/expo-sqlite`)
- Zustand for state, with `persist` middleware for settings
- victory-native v41 (Skia-based) for charts
- TypeScript strict mode
- Dark-mode-only design

## Setup

```bash
# Install
npm install

# Run the dev server
npx expo start

# (Optional) Regenerate Drizzle migration files after editing the schema
npx drizzle-kit generate

# (Optional) Apply migrations via drizzle-kit (the app also auto-creates tables on first launch)
npx drizzle-kit migrate
```

> **Note on database init.** The app auto-creates tables in `db/index.ts > initDatabase()` on every cold start. The Drizzle migration files in `db/migrations/` are also included for environments where you'd prefer to apply migrations explicitly.

### Asset placeholders

`app.json` does not reference an icon or splash image. Drop `assets/icon.png` (1024×1024) and `assets/splash.png` (1242×2436) and re-add `"icon": "./assets/icon.png"` and `"splash": { "image": "./assets/splash.png", … }` if you want custom branding.

## File layout

```
app/
  _layout.tsx              Stack with shared dark theming
  quick-add.tsx            Modal asking Cash / Tournament / Hand
  (tabs)/
    _layout.tsx            Bottom tab bar (Dashboard, Sessions, +, Analytics, Settings)
    index.tsx              Dashboard
    sessions.tsx           Cash | Tournaments tabs with edit / delete
    add.tsx                Redirect to /quick-add (tab placeholder)
    analytics.tsx          Charts and breakdowns
    settings.tsx           Currency / export / reset / about
  cash/
    new.tsx                New cash session
    [id].tsx               Edit + linked hands
  tournament/
    new.tsx
    [id].tsx
  hand/
    new.tsx                Add hand note (auto-links via ?sessionId=&sessionType=)
    index.tsx              Filterable hand history list

components/                SessionCard, HandNoteCard, BankrollChart, BarChart,
                           RoiChart, StatCard, Chip, FormField, DateField,
                           PrimaryButton, SectionTitle, ScreenContainer,
                           CashSessionForm, TournamentForm

db/
  schema.ts                Drizzle schema (cash_sessions, tournaments, hand_notes)
  index.ts                 Drizzle client + initDatabase / resetDatabase
  migrations/              0000_initial.sql + journal

store/
  useSessionStore.ts       Cash sessions CRUD
  useTournamentStore.ts    Tournament CRUD
  useHandStore.ts          Hand notes CRUD
  useStatsStore.ts         Settings (persisted) + useDerivedStats() hook

theme/colors.ts            Color tokens, spacing, radius, typography, pnlColor
utils/
  calculations.ts          profit, ROI, ITM, streaks, bankroll series, MA
  formatters.ts            money, percent, hours, dates, currency symbols
  csvExport.ts             CSV builders + share via expo-file-system + expo-sharing
  id.ts                    UUID generator (uses react-native-get-random-values)
```

## Computed stats (in `utils/calculations.ts` and `useDerivedStats`)

- `totalProfit` = Σ cash (cash_out − buy_in) + Σ tournaments (prize + bounties − buy_in − rebuys − addon)
- `hourlyRate` = totalCashProfit / totalCashMinutes × 60
- `tournamentROI` = (totalReturn − totalInvested) / totalInvested × 100
- `itmPercent` = tournaments with prize > 0 / total tournaments × 100
- `currentStreak` = consecutive winning or losing sessions ending at the most recent
- `losingStreakWarning` triggers when the last 5 sessions are all negative

## Data model

| Table          | Notes |
| -------------- | ----- |
| cash_sessions  | uuid PK; ISO date; numeric buy_in/cash_out/duration_minutes |
| tournaments    | uuid PK; rebuys/addon/prize/bounties default 0; ROI computed on read |
| hand_notes     | uuid PK; nullable `session_id` (standalone hands allowed); enum-like `street`, `position`, `tag` |

## Conventions

- Profit is **green**, loss is **red**, neutral is **gray** (see `theme/colors.ts > pnlColor`).
- All amounts are formatted via `utils/formatters.ts > formatMoney/formatPnL` — never hand-format currency.
- UUIDs are generated through `utils/id.ts > newId()`, which polyfills `crypto.getRandomValues`.
- Hand cards use plain text (e.g. `Ah Kd` for hero, `Js 9h 2c | Th | 4s` for board).
