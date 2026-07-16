// Staking settlement maths: markup + makeup, in both directions.
//
// A deal is one staking arrangement over one action (a session or a set). The
// same formula covers both directions — you being backed and you backing
// someone — by flipping whose perspective the result is reported from.
//
// This module is deliberately pure and per-deal: makeup is carried in as an
// explicit number (`makeupBefore`) rather than recomputed across a chain of
// deals, so every value here can be checked in isolation. The store suggests
// `makeupBefore` from the counterparty's previous deal; the maths never reaches
// across rows on its own.
//
// Vocabulary, from the money's point of view:
//   B  buy-in of the action
//   p  fraction of the action that is staked (percent / 100)
//   m  markup, a premium multiplier on the staked buy-in (m >= 1; 1 = none)
//   R  the action's result, cashOut - B (signed)
//   K  makeup carried in — losses the backer has covered that must be recouped
//      from winnings before any profit is split (>= 0)

export type StakingDirection = 'backed' | 'backing';

export interface StakingInputs {
  direction: StakingDirection;
  buyIn: number;
  /** 0..100. */
  percent: number;
  /** >= 1. 1.1 means the backer pays a 10% premium on the staked buy-in. */
  markup: number;
  makeupBefore: number;
  result: number;
}

export interface StakingSettlement {
  /** The backer's slice of the raw result, p*R. */
  backerShare: number;
  /** Premium the backer pays the horse on top of the buy-in, p*B*(m-1). */
  markupPremium: number;
  /**
   * The backer's economic profit/loss for the deal: their share of the result
   * minus the markup premium they paid. Makeup does not enter here — this is the
   * economics of the deal, not the cash timing.
   */
  backerPL: number;
  /** Makeup carried out: losses raise it, the backer's profit pays it down. */
  makeupAfter: number;
  /**
   * Profit released to the backer if the deal is settled now: nothing until the
   * carried makeup is cleared. Cash, as opposed to economics.
   */
  distributable: number;
  /**
   * The result from *your* perspective. When you are backed, the backer's P/L is
   * money that leaves your side, so it is negated; when you are backing, their
   * P/L is yours.
   */
  yourResult: number;
}

/** Clamp a percent the UI might hand us out of range rather than trust it. */
function fraction(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(1, Math.max(0, percent / 100));
}

export function settleStaking(input: StakingInputs): StakingSettlement {
  const p = fraction(input.percent);
  const B = Math.max(0, input.buyIn || 0);
  // Markup is a premium, never a discount: anything below 1 is meaningless and
  // would flip the premium negative, so it collapses to "no markup".
  const m = Number.isFinite(input.markup) && input.markup >= 1 ? input.markup : 1;
  const K = Math.max(0, input.makeupBefore || 0);
  const R = input.result || 0;

  const backerShare = p * R;
  const markupPremium = p * B * (m - 1);
  const backerPL = backerShare - markupPremium;

  // A win pays makeup down first; a loss adds to it. Both fall out of one max().
  const makeupAfter = Math.max(0, K - backerPL);
  const distributable = Math.max(0, backerPL - K);

  const yourResult = input.direction === 'backing' ? backerPL : -backerPL;

  return { backerShare, markupPremium, backerPL, makeupAfter, distributable, yourResult };
}

export interface StakingTotals {
  /** Your economic result across settled deals. */
  settledResult: number;
  /** Your economic result still open (not yet settled). */
  openResult: number;
  /** You are backing: horses must recoup this makeup before they owe you profit. */
  makeupOwedToYou: number;
  /** You are backed: you must recoup this makeup before your backers see profit. */
  makeupYouOwe: number;
}

/** A deal as the store holds it, reduced to the fields the totals need. */
export interface DealLike extends StakingInputs {
  settled: boolean;
}

export function stakingTotals(deals: DealLike[]): StakingTotals {
  let settledResult = 0;
  let openResult = 0;
  let makeupOwedToYou = 0;
  let makeupYouOwe = 0;

  for (const d of deals) {
    const s = settleStaking(d);
    if (d.settled) {
      settledResult += s.yourResult;
    } else {
      openResult += s.yourResult;
      if (d.direction === 'backing') makeupOwedToYou += s.makeupAfter;
      else makeupYouOwe += s.makeupAfter;
    }
  }

  return { settledResult, openResult, makeupOwedToYou, makeupYouOwe };
}
