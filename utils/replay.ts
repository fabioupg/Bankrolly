// Step-through replay model for a saved hand, in the style of PokerTracker /
// Hold'em Manager: the hand is rebuilt from the `TableState` snapshot stored on
// a hand note, one action at a time, with the board revealed street by street.
//
// Everything here is pure so it can be unit-tested; the replay screen just
// walks the returned steps.

import { STREETS, type Street } from '@/db/schema';
import { parseCards } from '@/utils/cards';
import {
  ACTION_LABELS,
  ACTION_NEEDS_SIZE,
  STREET_LABELS,
  seatLabel,
  type SeatActionEntry,
  type TableSeat,
  type TableState,
} from '@/utils/table';

export interface FlatAction extends SeatActionEntry {
  seatIndex: number;
}

export interface ReplayStep {
  kind: 'deal' | 'board' | 'action';
  street: Street;
  /** Seat acting on this step; null for deal/board steps. */
  actorSeat: number | null;
  /** Human-readable description, e.g. "Hero (BTN) raises 3bb". */
  label: string;
  /** Community cards visible after this step (0, 3, 4 or 5). */
  boardCount: number;
  /** Seat indexes that have folded up to and including this step. */
  folded: number[];
  /** All actions applied up to and including this step. */
  applied: FlatAction[];
}

const BOARD_COUNT: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };

const streetOrder = (s: Street) => STREETS.indexOf(s);

/** Parse the persisted tableState JSON; returns null for empty or invalid data. */
export function parseTableState(json: string): TableState | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as TableState;
    if (!v || typeof v !== 'object') return null;
    if (typeof v.playerCount !== 'number' || !Array.isArray(v.seats)) return null;
    if (v.seats.length === 0) return null;
    // The column is unvalidated JSON: a single malformed seat must send the
    // caller to the "no table data" fallback instead of crashing mid-replay.
    for (const seat of v.seats) {
      if (!seat || typeof seat !== 'object' || typeof seat.index !== 'number') return null;
      if (seat.actions != null && !Array.isArray(seat.actions)) return null;
    }
    return v;
  } catch {
    return null;
  }
}

/** All seat actions flattened and ordered by street, then by insertion order. */
export function flattenActions(state: TableState): FlatAction[] {
  const out: FlatAction[] = [];
  for (const seat of state.seats) {
    for (const a of seat.actions ?? []) out.push({ ...a, seatIndex: seat.index });
  }
  out.sort((a, b) => streetOrder(a.street) - streetOrder(b.street) || a.seq - b.seq);
  return out;
}

function actionLabel(seat: TableSeat | undefined, a: FlatAction): string {
  const who = seat ? seatLabel(seat) : `Seat ${a.seatIndex + 1}`;
  const verb = ACTION_LABELS[a.action] ?? a.action;
  const sized = ACTION_NEEDS_SIZE[a.action] && a.size ? ` ${a.size}` : '';
  return `${who} ${verb}${sized}`;
}

function boardLabel(street: Street, cards: string[]): string {
  const revealed =
    street === 'flop' ? cards.slice(0, 3) : street === 'turn' ? cards.slice(3, 4) : cards.slice(4, 5);
  return revealed.length > 0
    ? `${STREET_LABELS[street]}: ${revealed.join(' ')}`
    : STREET_LABELS[street];
}

/**
 * Build the ordered list of replay steps for a hand: a deal step, a board
 * reveal per street, and one step per seat action. If the saved board runs
 * deeper than the last betting street (e.g. all-in on the flop), the remaining
 * streets are dealt out at the end like a real replayer.
 */
export function buildReplaySteps(state: TableState, board: string): ReplayStep[] {
  const actions = flattenActions(state);
  const boardCards = parseCards(board).slice(0, 5);
  const boardCountFor = (s: Street) => Math.min(BOARD_COUNT[s], boardCards.length);

  const steps: ReplayStep[] = [];
  const folded: number[] = [];
  const applied: FlatAction[] = [];
  let street: Street = 'preflop';

  steps.push({
    kind: 'deal',
    street,
    actorSeat: null,
    label: `Cards dealt — ${state.playerCount} players`,
    boardCount: 0,
    folded: [],
    applied: [],
  });

  const advanceTo = (target: Street) => {
    while (streetOrder(street) < streetOrder(target)) {
      street = STREETS[streetOrder(street) + 1];
      steps.push({
        kind: 'board',
        street,
        actorSeat: null,
        label: boardLabel(street, boardCards),
        boardCount: boardCountFor(street),
        folded: [...folded],
        applied: [...applied],
      });
    }
  };

  for (const a of actions) {
    advanceTo(a.street);
    applied.push(a);
    if (a.action === 'fold' && !folded.includes(a.seatIndex)) folded.push(a.seatIndex);
    steps.push({
      kind: 'action',
      street,
      actorSeat: a.seatIndex,
      label: actionLabel(state.seats[a.seatIndex], a),
      boardCount: boardCountFor(street),
      folded: [...folded],
      applied: [...applied],
    });
  }

  // Run out any remaining saved board cards (all-in situations).
  while (streetOrder(street) < STREETS.length - 1 && boardCards.length > boardCountFor(street)) {
    advanceTo(STREETS[streetOrder(street) + 1]);
  }

  return steps;
}

/**
 * TableState as it looks at a given step: each seat only carries the actions
 * applied so far on the step's street, so the seat badge shows the player's
 * latest action of the current street (and nothing from future streets).
 */
export function stateAtStep(state: TableState, step: ReplayStep): TableState {
  return {
    ...state,
    seats: state.seats.map((seat) => ({
      ...seat,
      actions: step.applied.filter((a) => a.seatIndex === seat.index && a.street === step.street),
    })),
  };
}
