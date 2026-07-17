# Bankrolly (Pokerapp)

Personal poker bankroll tracker. Expo (React Native) app, iOS-first, all data in local SQLite.

## Commands

- `npm run typecheck` — TypeScript check (must pass before every commit)
- `npm test` — Vitest unit tests (utils/__tests__/)
- `npm start` — Expo dev server
- `npm run db:generate` / `db:migrate` — drizzle schema migrations

## Architecture

- `app/` — expo-router screens; every screen is registered in app/_layout.tsx
- `components/` — forms follow the StakingDealForm pattern (mode create/edit, save via store)
- `store/` — one zustand store per table; hydrate() reads SQLite, add/update/remove write through
- `db/schema.ts` — drizzle tables, single source of truth for types
- `utils/` — pure logic (calculations, staking, import, backup crypto); keep pure, it is unit-tested
- `theme/colors.ts` — colors/spacing/typography; never hardcode colors in screens

## Conventions

- Money is signed: deposits positive, withdrawals negative; bankroll = session profit + transactionsNet
- Transactions never count into win rate or hourly
- Dates are ISO strings (YYYY-MM-DD), compared lexicographically
- User-facing text is English
- New table checklist: schema.ts → migration in db/index.ts → store → screens → backup.ts → csvExport.ts
- Pro features gate with <ProGate>; entry limits via useCanAdd

## Gotchas

- runtimeVersion policy is "appVersion": bump version in app.json whenever native modules change
- Expo modules cannot run in vitest — stub them in test/stubs/ via vitest.config.ts aliases
- Playing cards render natively in components/PlayingCard.tsx (no sprite sheet)
