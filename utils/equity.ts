// Offline poker equity + pot-odds math for the hand reviewer.
//
// A compact 7-card evaluator scores the best 5-card hand out of 7, and a
// Monte-Carlo loop estimates hero equity vs a known villain hand or a random
// hand on a given (possibly incomplete) board. No native deps — pure TS that
// runs fast enough on-device for ~10k iterations.

import { RANKS, SUITS, normalizeCard, parseCards } from '@/utils/cards';

interface Card {
  /** 2..14 (T=10, J=11, Q=12, K=13, A=14). */
  r: number;
  /** 0..3 suit index. */
  s: number;
}

// RANKS is high->low: 'A','K',...,'2'. Index 0 ('A') maps to 14.
function rankValue(rankChar: string): number {
  const i = RANKS.indexOf(rankChar as (typeof RANKS)[number]);
  return i < 0 ? 0 : 14 - i;
}

function toCard(code: string): Card | null {
  const c = normalizeCard(code);
  if (!c) return null;
  const s = SUITS.indexOf(c[1] as (typeof SUITS)[number]);
  return { r: rankValue(c[0]), s };
}

/** Highest straight high-card from a set of ranks, or 0. Handles the wheel. */
function bestStraight(present: boolean[]): number {
  // present[1] doubles as the low ace for A-2-3-4-5.
  const has = present.slice();
  if (has[14]) has[1] = true;
  for (let high = 14; high >= 5; high--) {
    let ok = true;
    for (let r = high; r > high - 5; r--) {
      if (!has[r]) {
        ok = false;
        break;
      }
    }
    if (ok) return high;
  }
  return 0;
}

function score(category: number, tiebreaks: number[]): number {
  let s = category;
  for (let i = 0; i < 5; i++) s = s * 15 + (tiebreaks[i] ?? 0);
  return s;
}

/**
 * Score the best 5-card hand from 5..7 cards. Higher is stronger; only
 * comparable against other scores from this function.
 */
export function evaluate7(cards: Card[]): number {
  const rankCount = new Array(15).fill(0);
  const suitCount = new Array(4).fill(0);
  const bySuit: number[][] = [[], [], [], []];
  const present: boolean[] = new Array(15).fill(false);

  for (const c of cards) {
    rankCount[c.r]++;
    suitCount[c.s]++;
    bySuit[c.s].push(c.r);
    present[c.r] = true;
  }

  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (suitCount[s] >= 5) flushSuit = s;

  // Straight flush
  if (flushSuit >= 0) {
    const sfPresent: boolean[] = new Array(15).fill(false);
    for (const r of bySuit[flushSuit]) sfPresent[r] = true;
    const sf = bestStraight(sfPresent);
    if (sf) return score(9, [sf]);
  }

  // Group ranks by how many of each we hold.
  const quads: number[] = [];
  const trips: number[] = [];
  const pairs: number[] = [];
  const singles: number[] = [];
  for (let r = 14; r >= 2; r--) {
    if (rankCount[r] === 4) quads.push(r);
    else if (rankCount[r] === 3) trips.push(r);
    else if (rankCount[r] === 2) pairs.push(r);
    else if (rankCount[r] === 1) singles.push(r);
  }

  const kickers = (exclude: number[], n: number): number[] => {
    const out: number[] = [];
    for (let r = 14; r >= 2 && out.length < n; r--) {
      if (rankCount[r] > 0 && !exclude.includes(r)) out.push(r);
    }
    return out;
  };

  // Quads
  if (quads.length) {
    return score(8, [quads[0], ...kickers([quads[0]], 1)]);
  }

  // Full house (trips + pair, or two sets of trips)
  if (trips.length && (pairs.length || trips.length > 1)) {
    const t = trips[0];
    const pair = pairs[0] ?? trips[1];
    return score(7, [t, pair]);
  }

  // Flush
  if (flushSuit >= 0) {
    const top5 = bySuit[flushSuit].slice().sort((a, b) => b - a).slice(0, 5);
    return score(6, top5);
  }

  // Straight
  const st = bestStraight(present);
  if (st) return score(5, [st]);

  // Trips
  if (trips.length) {
    return score(4, [trips[0], ...kickers([trips[0]], 2)]);
  }

  // Two pair
  if (pairs.length >= 2) {
    const [p1, p2] = pairs;
    return score(3, [p1, p2, ...kickers([p1, p2], 1)]);
  }

  // One pair
  if (pairs.length === 1) {
    return score(2, [pairs[0], ...kickers([pairs[0]], 3)]);
  }

  // High card
  return score(1, singles.slice(0, 5));
}

// --- Omaha ------------------------------------------------------------------
// Omaha hands must use exactly 2 hole cards + 3 board cards. Best hand is the
// max over every (2-of-hole x 3-of-board) combination, scored with the same
// 5..7-card evaluator.

const HOLE_PAIRS: Record<number, [number, number][]> = {};
function pairsFor(n: number): [number, number][] {
  let pairs = HOLE_PAIRS[n];
  if (!pairs) {
    pairs = [];
    for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
    HOLE_PAIRS[n] = pairs;
  }
  return pairs;
}

// All C(5,3) = 10 ways to pick 3 of the 5 board cards.
const BOARD_TRIPLES: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 4; j++)
      for (let k = j + 1; k < 5; k++) out.push([i, j, k]);
  return out;
})();

/** Best Omaha score for `hole` (4..6 cards) on a complete 5-card board. */
function bestOmahaScore(hole: Card[], board: Card[]): number {
  let best = 0;
  for (const [a, b] of pairsFor(hole.length)) {
    for (const [x, y, z] of BOARD_TRIPLES) {
      const s = evaluate7([hole[a], hole[b], board[x], board[y], board[z]]);
      if (s > best) best = s;
    }
  }
  return best;
}

export interface EquityResult {
  /** Hero win probability 0..1. */
  win: number;
  /** Tie/split probability 0..1. */
  tie: number;
  /** Hero loss probability 0..1. */
  lose: number;
  /** Combined equity = win + tie/2, 0..1. */
  equity: number;
  iterations: number;
}

function fullDeck(): string[] {
  const deck: string[] = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(`${r}${s}`);
  return deck;
}

/**
 * Monte-Carlo hero equity for Hold'em (2 hero cards) or Omaha (4/5/6 hero
 * cards, best 2-of-hole + 3-of-board). `villain` may be a full hand of the
 * same size for hand-vs-hand, or an empty/partial string for "vs a random
 * hand". The board may hold 0..5 cards.
 */
export function estimateEquity(
  heroStr: string,
  villainStr: string,
  boardStr: string,
  iterations = 8000,
): EquityResult {
  const hero = parseCards(heroStr).map(toCard).filter((c): c is Card => !!c);
  const villainKnown = parseCards(villainStr).map(toCard).filter((c): c is Card => !!c);
  const board = parseCards(boardStr).map(toCard).filter((c): c is Card => !!c);

  const holeCount = hero.length;
  const omaha = holeCount >= 4 && holeCount <= 6;
  if ((holeCount !== 2 && !omaha) || villainKnown.length > holeCount || board.length > 5) {
    return { win: 0, tie: 0, lose: 0, equity: 0, iterations: 0 };
  }

  const used = new Set<string>();
  for (const code of [...parseCards(heroStr), ...parseCards(villainStr), ...parseCards(boardStr)]) {
    used.add(code);
  }
  const deck = fullDeck().filter((c) => !used.has(c));

  const villainNeeds = holeCount - villainKnown.length;
  const boardNeeds = 5 - board.length;
  const draws = villainNeeds + boardNeeds;

  let win = 0;
  let tie = 0;
  let lose = 0;

  for (let it = 0; it < iterations; it++) {
    // Partial Fisher-Yates: pick `draws` distinct cards from the live deck.
    const picked: Card[] = [];
    for (let k = 0; k < draws; k++) {
      const j = k + Math.floor(Math.random() * (deck.length - k));
      const tmp = deck[k];
      deck[k] = deck[j];
      deck[j] = tmp;
      const card = toCard(deck[k]);
      if (card) picked.push(card);
    }

    const villain = villainKnown.concat(picked.slice(0, villainNeeds));
    const extraBoard = picked.slice(villainNeeds);
    const fullBoard = board.concat(extraBoard);

    const heroScore = omaha
      ? bestOmahaScore(hero, fullBoard)
      : evaluate7(hero.concat(fullBoard));
    const villScore = omaha
      ? bestOmahaScore(villain, fullBoard)
      : evaluate7(villain.concat(fullBoard));

    if (heroScore > villScore) win++;
    else if (heroScore < villScore) lose++;
    else tie++;
  }

  const total = win + tie + lose || 1;
  return {
    win: win / total,
    tie: tie / total,
    lose: lose / total,
    equity: (win + tie / 2) / total,
    iterations,
  };
}

export interface PotOdds {
  /** Equity (0..1) needed to break even on the call. */
  required: number;
  /** Pot odds expressed as "X.X : 1". */
  ratio: string;
}

/** Pot odds for calling `toCall` into a pot of `pot` (pot includes villain's bet). */
export function potOdds(pot: number, toCall: number): PotOdds | null {
  if (!(pot > 0) || !(toCall > 0)) return null;
  const required = toCall / (pot + toCall);
  const ratio = `${(pot / toCall).toFixed(1)} : 1`;
  return { required, ratio };
}
