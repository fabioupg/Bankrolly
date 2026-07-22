// Step-through replay model for a saved hand, in the style of PokerTracker /
// Hold'em Manager: the hand is rebuilt from the `TableState` snapshot stored on
// a hand note, one action at a time, with the board revealed street by street.
//
// Everything here is pure so it can be unit-tested; the replay screen just
// walks the returned steps.

import { STREETS, type ActionType, type Street } from '@/db/schema';
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
  /**
   * Preformatted step label. Set for actions recovered from the free-text
   * action line, where the original phrase is better than re-deriving one.
   */
  phrase?: string;
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

// --- Action-line text fallback ---------------------------------------------
// Hands built with the ActionBuilder (or typed freely) carry their actions
// only as text in `handNotes.actionLine`, not as seat actions on the table.
// So the replayer can still step through them action by action, the text is
// parsed back into FlatActions here. Format produced by the app:
//   "Preflop: UTG opens 2.5, Hero (BTN) 3-bets 9, UTG calls"
//   "Flop (Js 9h 2c): UTG checks, Hero (BTN) bets 5"

const STREET_HEADER = /^\s*(preflop|flop|turn|river)\b[^:]*:\s*(.*)$/i;

// Ordered longest/most-specific first so "3-bets" wins over "bets" and
// "shoves all-in" over "shoves". Hyphens are optional to catch typed text.
const VERB_PATTERNS: readonly [RegExp, ActionType][] = [
  [/\bshoves?\s+all-?in\b/i, 'all-in'],
  [/\ball-?in\b/i, 'all-in'],
  [/\b5-?bets?\b/i, '5-bet'],
  [/\b4-?bets?\b/i, '4-bet'],
  [/\b3-?bets?\b/i, '3-bet'],
  [/\bshoves?\b/i, 'shove'],
  [/\bjams?\b/i, 'shove'],
  [/\bfolds?\b/i, 'fold'],
  [/\bchecks?\b/i, 'check'],
  [/\bcalls?\b/i, 'call'],
  [/\bopens?\b/i, 'open'],
  [/\blimps?\b/i, 'limp'],
  [/\braises?\b/i, 'raise'],
  [/\bbets?\b/i, 'bet'],
];

/** Match "Hero (BTN)" / "UTG" / a tagged villain name back to a seat index; -1 if unknown. */
function matchSeat(who: string, state: TableState): number {
  if (!who) return -1;
  const paren = /\(([^)]+)\)\s*$/.exec(who);
  const bare = who.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
  if (bare === 'hero') {
    const hero = state.seats.find((s) => s.isHero);
    if (hero) return hero.index;
  }
  const pos = (paren ? paren[1] : who).trim().toLowerCase();
  const byPos = state.seats.find((s) => s.position.toLowerCase() === pos);
  if (byPos) return byPos.index;
  const byName = state.seats.find((s) => s.name && s.name.toLowerCase() === bare);
  return byName ? byName.index : -1;
}

/**
 * Parse a free-text action line into ordered FlatActions. Lines starting with
 * a street header switch the current street; phrases are comma-separated.
 * Unrecognized phrases are skipped rather than failing the whole parse.
 */
export function parseActionLine(actionLine: string, state: TableState): FlatAction[] {
  if (!actionLine.trim()) return [];
  const out: FlatAction[] = [];
  let street: Street = 'preflop';
  let seq = 1;
  for (const rawLine of actionLine.split(/\r?\n/)) {
    let rest = rawLine;
    const header = STREET_HEADER.exec(rawLine);
    if (header) {
      street = header[1].toLowerCase() as Street;
      rest = header[2];
    }
    for (const chunk of rest.split(',')) {
      const p = chunk.trim();
      if (!p || p === '—') continue;
      let matched: { index: number; length: number; action: ActionType } | null = null;
      for (const [pattern, action] of VERB_PATTERNS) {
        const m = pattern.exec(p);
        if (m) {
          matched = { index: m.index, length: m[0].length, action };
          break;
        }
      }
      if (!matched) continue;
      const who = p.slice(0, matched.index).trim();
      const size = p.slice(matched.index + matched.length).trim();
      out.push({
        street,
        action: matched.action,
        size,
        seq: seq++,
        seatIndex: matchSeat(who, state),
        phrase: p,
      });
    }
  }
  // Free text may list streets out of order; the step builder only walks forward.
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
 *
 * When the table carries no seat actions (hand written via the ActionBuilder
 * or typed freely), the actions are recovered from `actionLine` text instead,
 * so those hands still replay action by action.
 */
export function buildReplaySteps(
  state: TableState,
  board: string,
  actionLine = '',
): ReplayStep[] {
  const tableActions = flattenActions(state);
  const actions = tableActions.length > 0 ? tableActions : parseActionLine(actionLine, state);
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
    // seatIndex is -1 for text-parsed actions whose actor couldn't be mapped
    // to a seat; those still get a step, just without seat highlight/fold dim.
    if (a.action === 'fold' && a.seatIndex >= 0 && !folded.includes(a.seatIndex)) {
      folded.push(a.seatIndex);
    }
    steps.push({
      kind: 'action',
      street,
      actorSeat: a.seatIndex >= 0 ? a.seatIndex : null,
      label: a.phrase ?? actionLabel(state.seats[a.seatIndex], a),
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
