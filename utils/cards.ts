// Card model + sprite-sheet geometry for the visual card picker.
// The sheet (assets/cards.png) is a 13-column x 4-row grid:
//   columns = ranks  A K Q J T 9 8 7 6 5 4 3 2  (left -> right)
//   rows    = suits  spades, hearts, diamonds, clubs  (top -> bottom)
// A card is encoded as `${rank}${suit}` with suit in lowercase, e.g. "Ah", "Td".

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export const SUITS = ['s', 'h', 'd', 'c'] as const;
export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

// --- Game variants -----------------------------------------------------------
// Hold'em heroes get 2 hole cards; Omaha variants get 4, 5 or 6. Omaha hands
// must use exactly 2 hole cards + 3 board cards, which the equity code honors.

export const GAME_VARIANTS = ['NLH', 'PLO4', 'PLO5', 'PLO6'] as const;
export type GameVariant = (typeof GAME_VARIANTS)[number];

export const VARIANT_HOLE_CARDS: Record<GameVariant, number> = {
  NLH: 2,
  PLO4: 4,
  PLO5: 5,
  PLO6: 6,
};

export const VARIANT_LABELS: Record<GameVariant, string> = {
  NLH: "Hold'em",
  PLO4: 'PLO',
  PLO5: 'PLO5',
  PLO6: 'PLO6',
};

/**
 * Infer the game variant from a saved hero-card count so editing an existing
 * Omaha hand re-opens with the right picker limit. 3 cards is treated as an
 * unfinished PLO4 selection.
 */
export function variantForCardCount(count: number): GameVariant {
  if (count >= 6) return 'PLO6';
  if (count === 5) return 'PLO5';
  if (count >= 3) return 'PLO4';
  return 'NLH';
}

// Pixel geometry of assets/cards.png.
export const SHEET = { width: 3160, height: 1320, cols: 13, rows: 4 } as const;
export const CELL_W = SHEET.width / SHEET.cols; // 243.08
export const CELL_H = SHEET.height / SHEET.rows; // 330
export const CARD_ASPECT = CELL_W / CELL_H; // ~0.7366 (w/h)

const SUIT_ROW: Record<string, number> = { s: 0, h: 1, d: 2, c: 3 };

export interface SpritePos {
  row: number;
  col: number;
}

/** Normalize a loose token ("ah", "10H", "Td") to canonical "Ah"/"Th", or null. */
export function normalizeCard(raw: string): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (t.length < 2) return null;
  let r = t[0].toUpperCase();
  if (r === '1') r = 'T'; // accept "10x"
  const s = t[t.length - 1].toLowerCase();
  if (!RANKS.includes(r as Rank)) return null;
  if (!(s in SUIT_ROW)) return null;
  return `${r}${s}`;
}

/** Row/column of a card in the sprite sheet, or null if unparseable. */
export function cardSpritePos(card: string): SpritePos | null {
  const c = normalizeCard(card);
  if (!c) return null;
  const col = RANKS.indexOf(c[0] as Rank);
  const row = SUIT_ROW[c[1]];
  if (col < 0 || row === undefined) return null;
  return { row, col };
}

/** Parse a stored card string ("Ah Kd", legacy "Js 9h 2c | Th | 4s") into card codes. */
export function parseCards(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .replace(/\|/g, ' ')
    .split(/[\s,]+/)
    .map(normalizeCard)
    .filter((c): c is string => Boolean(c));
}

export function serializeCards(cards: string[]): string {
  return cards.join(' ');
}
