// Poker-table model + geometry for the visual hand reviewer.
//
// A hand is described by a `TableState`: how many seats, where the dealer
// button sits, which seat is the hero, and the per-seat actions for each
// street. The table is an *input device* — `tableToActionLine()` turns the
// structured state into the same free-text format the ActionBuilder produces,
// so it stays compatible with the existing `handNotes.actionLine` field.

import { STREETS, type ActionType, type Street } from '@/db/schema';

// --- Position naming -------------------------------------------------------
// Listed clockwise starting at the button (BTN -> SB -> BB -> ... -> CO).
// CO is always the seat immediately to the button's right, so it comes last.
// Heads-up (2 players) is the special case where the button posts the SB.
const POSITION_SETS: Record<number, string[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'MP', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO'],
};

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 9;

/**
 * Assign a position label to every seat given the dealer button seat.
 * Seats are walked clockwise from the button so index math wraps the table.
 * Returns a map of seatIndex -> position label (e.g. "BTN", "UTG", "CO").
 */
export function assignPositions(playerCount: number, buttonSeat: number): Record<number, string> {
  const labels = POSITION_SETS[playerCount] ?? POSITION_SETS[MAX_PLAYERS];
  const out: Record<number, string> = {};
  for (let step = 0; step < playerCount; step++) {
    const seat = (buttonSeat + step) % playerCount;
    out[seat] = labels[step] ?? `Seat ${seat + 1}`;
  }
  return out;
}

// --- Seat geometry ---------------------------------------------------------
// Seats sit on an ellipse inside the table container. The hero seat is pinned
// to the bottom-center; the rest are spread evenly clockwise around the rim.
// Coordinates are returned as 0..1 fractions of the container so the component
// can scale them to whatever width/height it measures.

export interface SeatPoint {
  /** 0-based seat index (hero is always 0). */
  index: number;
  /** Horizontal center, 0 (left) .. 1 (right). */
  xPct: number;
  /** Vertical center, 0 (top) .. 1 (bottom). */
  yPct: number;
}

// Rim radii as a fraction of half the container. < 0.5 keeps seat chips from
// clipping the container edges.
// Pulled in far enough that a full seat (cards + circle + name + action badge,
// ~100pt tall) stays inside the table container even at the 6 and 12 o'clock
// positions — content outside the container renders but misses touches on Android.
const RIM_RX = 0.42;
const RIM_RY = 0.36;

/**
 * Positions for `count` seats around the table rim. Seat 0 (hero) is at the
 * bottom center; the remaining seats fan out clockwise.
 */
export function seatLayout(count: number): SeatPoint[] {
  const seats: SeatPoint[] = [];
  // Math angle 90deg points down in screen space (y grows downward), so the
  // hero (index 0) lands bottom-center; we step clockwise from there.
  const start = Math.PI / 2;
  for (let i = 0; i < count; i++) {
    const angle = start + (i * 2 * Math.PI) / count;
    seats.push({
      index: i,
      xPct: 0.5 + RIM_RX * Math.cos(angle),
      yPct: 0.5 + RIM_RY * Math.sin(angle),
    });
  }
  return seats;
}

// --- Table state -----------------------------------------------------------

export interface SeatActionEntry {
  street: Street;
  action: ActionType;
  /** Bet/raise sizing as entered (bb or chips), empty when not applicable. */
  size: string;
  /** Monotonic counter so we can replay actions in the order they were added. */
  seq: number;
}

export interface TableSeat {
  index: number;
  /** Linked saved player id, or null for an unnamed/anonymous seat. */
  playerId: string | null;
  /** Display name: a saved player's name, "Hero", or "" for an empty seat. */
  name: string;
  /** Assigned position label for this seat (derived from the button). */
  position: string;
  isHero: boolean;
  /** This seat's hole cards, space-separated (e.g. "Ah Kd"). Empty = unknown. */
  cards: string;
  actions: SeatActionEntry[];
}

export interface TableState {
  playerCount: number;
  buttonSeat: number;
  heroSeat: number;
  seats: TableSeat[];
}

/** Fresh table state with `count` seats, hero bottom-center, button to hero's right. */
export function createTableState(count: number, prev?: TableState): TableState {
  const clamped = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, count));
  const heroSeat = 0;
  // Default the button a couple of seats back so the hero is in late position;
  // for tiny tables just fall back to the last seat.
  const buttonSeat = prev ? Math.min(prev.buttonSeat, clamped - 1) : clamped - 1;
  const positions = assignPositions(clamped, buttonSeat);
  const seats: TableSeat[] = [];
  for (let i = 0; i < clamped; i++) {
    const carried = prev?.seats[i];
    seats.push({
      index: i,
      playerId: carried?.playerId ?? null,
      name: carried?.name ?? (i === heroSeat ? 'Hero' : ''),
      position: positions[i],
      isHero: i === heroSeat,
      cards: carried?.cards ?? '',
      actions: carried?.actions ?? [],
    });
  }
  return { playerCount: clamped, buttonSeat, heroSeat, seats };
}

/** Re-derive seat positions after the button (or seat count) changed. */
export function withButton(state: TableState, buttonSeat: number): TableState {
  const positions = assignPositions(state.playerCount, buttonSeat);
  return {
    ...state,
    buttonSeat,
    seats: state.seats.map((s) => ({ ...s, position: positions[s.index] })),
  };
}

/** Move the hero flag to a different seat. */
export function withHeroSeat(state: TableState, heroSeat: number): TableState {
  return {
    ...state,
    heroSeat,
    seats: state.seats.map((s) => ({
      ...s,
      isHero: s.index === heroSeat,
      name: s.index === heroSeat ? 'Hero' : s.name === 'Hero' ? '' : s.name,
    })),
  };
}

// --- Serialization to the free-text action line ----------------------------

const ACTION_NEEDS_SIZE: Record<ActionType, boolean> = {
  fold: false,
  check: false,
  call: false,
  open: true,
  limp: false,
  bet: true,
  raise: true,
  '3-bet': true,
  '4-bet': true,
  '5-bet': true,
  'all-in': false,
  shove: false,
};

const ACTION_LABELS: Record<ActionType, string> = {
  fold: 'folds',
  check: 'checks',
  call: 'calls',
  open: 'opens',
  limp: 'limps',
  bet: 'bets',
  raise: 'raises',
  '3-bet': '3-bets',
  '4-bet': '4-bets',
  '5-bet': '5-bets',
  'all-in': 'shoves all-in',
  shove: 'shoves',
};

const STREET_LABELS: Record<Street, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
};

export function seatLabel(seat: TableSeat): string {
  if (seat.isHero) return seat.position ? `Hero (${seat.position})` : 'Hero';
  if (seat.name) return seat.position ? `${seat.name} (${seat.position})` : seat.name;
  return seat.position || `Seat ${seat.index + 1}`;
}

function phrase(seat: TableSeat, a: SeatActionEntry): string {
  const verb = ACTION_LABELS[a.action];
  const sized = ACTION_NEEDS_SIZE[a.action] && a.size ? ` ${a.size}` : '';
  return `${seatLabel(seat)} ${verb}${sized}`;
}

/**
 * Render the table's per-seat actions into the same multi-line format the
 * ActionBuilder emits, grouped by street and ordered the way they were added.
 */
export function tableToActionLine(state: TableState): string {
  const lines: string[] = [];
  for (const street of STREETS) {
    const entries: { seat: TableSeat; action: SeatActionEntry }[] = [];
    for (const seat of state.seats) {
      for (const action of seat.actions) {
        if (action.street === street) entries.push({ seat, action });
      }
    }
    if (entries.length === 0) continue;
    entries.sort((a, b) => a.action.seq - b.action.seq);
    const body = entries.map((e) => phrase(e.seat, e.action)).join(', ');
    lines.push(`${STREET_LABELS[street]}: ${body}`);
  }
  return lines.join('\n');
}

export { ACTION_NEEDS_SIZE, ACTION_LABELS, STREET_LABELS };
