import { describe, expect, it } from 'vitest';
import { settleStaking, stakingTotals, type StakingInputs } from '@/utils/staking';

const deal = (over: Partial<StakingInputs> = {}): StakingInputs => ({
  direction: 'backed',
  buyIn: 1000,
  percent: 50,
  markup: 1,
  makeupBefore: 0,
  result: 0,
  ...over,
});

describe('settleStaking', () => {
  it('splits a win by the staked share', () => {
    const s = settleStaking(deal({ result: 400 }));
    expect(s.backerShare).toBe(200);
    expect(s.markupPremium).toBe(0);
    expect(s.backerPL).toBe(200);
    expect(s.makeupAfter).toBe(0);
    expect(s.distributable).toBe(200);
    expect(s.yourResult).toBe(-200);
  });

  it('charges the markup premium on the staked buy-in', () => {
    const s = settleStaking(deal({ markup: 1.2 }));
    expect(s.markupPremium).toBeCloseTo(100);
    expect(s.backerPL).toBeCloseTo(-100);
    // Being backed, the premium is money you keep.
    expect(s.yourResult).toBeCloseTo(100);
  });

  it('pays makeup down before releasing profit', () => {
    const s = settleStaking(deal({ percent: 100, makeupBefore: 300, result: 200 }));
    expect(s.backerPL).toBe(200);
    expect(s.makeupAfter).toBe(100);
    expect(s.distributable).toBe(0);
  });

  it('releases only the profit above the carried makeup', () => {
    const s = settleStaking(deal({ percent: 100, makeupBefore: 100, result: 250 }));
    expect(s.makeupAfter).toBe(0);
    expect(s.distributable).toBe(150);
  });

  it('adds a loss to the carried makeup', () => {
    const s = settleStaking(deal({ percent: 100, makeupBefore: 50, result: -150 }));
    expect(s.backerPL).toBe(-150);
    expect(s.makeupAfter).toBe(200);
    expect(s.distributable).toBe(0);
  });

  it('reports the backer perspective when backing', () => {
    const backed = settleStaking(deal({ result: 400 }));
    const backing = settleStaking(deal({ direction: 'backing', result: 400 }));
    expect(backing.yourResult).toBe(backed.backerPL);
    expect(backing.yourResult).toBe(-backed.yourResult);
  });

  it('clamps out-of-range inputs instead of trusting them', () => {
    expect(settleStaking(deal({ percent: 150, result: 100 })).backerShare).toBe(100);
    expect(settleStaking(deal({ percent: -20, result: 100 })).backerShare).toBe(0);
    expect(settleStaking(deal({ percent: NaN, result: 100 })).backerShare).toBe(0);
    // Markup below 1 collapses to "no markup" rather than a negative premium.
    expect(settleStaking(deal({ markup: 0.8 })).markupPremium).toBe(0);
    expect(settleStaking(deal({ buyIn: -500, markup: 2 })).markupPremium).toBe(0);
  });
});

describe('stakingTotals', () => {
  it('splits settled from open and buckets makeup by direction', () => {
    const totals = stakingTotals([
      // Settled, backed win of 400 at 50% → your result -200.
      { ...deal({ result: 400 }), settled: true },
      // Open backing win → your result +200, no makeup.
      { ...deal({ direction: 'backing', result: 400 }), settled: false },
      // Open backing loss at 100% → horse owes 100 makeup.
      { ...deal({ direction: 'backing', percent: 100, result: -100 }), settled: false },
      // Open backed loss at 100% → you owe 300 makeup.
      { ...deal({ percent: 100, result: -300 }), settled: false },
    ]);
    expect(totals.settledResult).toBe(-200);
    expect(totals.openResult).toBe(200 - 100 + 300);
    expect(totals.makeupOwedToYou).toBe(100);
    expect(totals.makeupYouOwe).toBe(300);
  });

  it('is all zeroes with no deals', () => {
    expect(stakingTotals([])).toEqual({
      settledResult: 0,
      openResult: 0,
      makeupOwedToYou: 0,
      makeupYouOwe: 0,
    });
  });
});
