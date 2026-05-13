export type LimitedKind = 'cash' | 'tournament' | 'hand' | 'player' | 'trip';

export const FREE_LIMITS: Record<LimitedKind, number> = {
  cash: 30,
  tournament: 30,
  hand: 5,
  player: 3,
  trip: 1,
};

export const LIMIT_LABELS: Record<LimitedKind, string> = {
  cash: 'cash sessions',
  tournament: 'tournaments',
  hand: 'hand notes',
  player: 'player notes',
  trip: 'trips',
};

export function nearLimit(current: number, limit: number, threshold = 0.85): boolean {
  if (limit <= 0) return false;
  return current >= Math.floor(limit * threshold);
}
