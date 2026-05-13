import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useTournamentStore } from '@/store/useTournamentStore';
import { useHandStore } from '@/store/useHandStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useTripStore } from '@/store/useTripStore';
import { FREE_LIMITS, type LimitedKind } from '@/utils/limits';

export interface CanAddResult {
  canAdd: boolean;
  isPro: boolean;
  current: number;
  limit: number;
  remaining: number;
}

export function useCanAdd(kind: LimitedKind): CanAddResult {
  const isPro = useSubscriptionStore((s) => s.isPro);
  const cashCount = useSessionStore((s) => s.sessions.length);
  const tournamentCount = useTournamentStore((s) => s.tourneys.length);
  const handCount = useHandStore((s) => s.hands.length);
  const playerCount = usePlayerStore((s) => s.players.length);
  const tripCount = useTripStore((s) => s.trips.length);

  const current =
    kind === 'cash' ? cashCount
    : kind === 'tournament' ? tournamentCount
    : kind === 'hand' ? handCount
    : kind === 'player' ? playerCount
    : tripCount;

  const limit = FREE_LIMITS[kind];
  const canAdd = isPro || current < limit;
  const remaining = isPro ? Infinity : Math.max(0, limit - current);

  return { canAdd, isPro, current, limit, remaining };
}
