import { describe, expect, it } from 'vitest';
import { createTableState, type TableState } from '../table';
import {
  buildReplaySteps,
  flattenActions,
  parseActionLine,
  parseTableState,
  stateAtStep,
} from '../replay';
import type { ActionType, Street } from '../../db/schema';

/** 3-handed table: seat 0 = Hero, button on seat 2. */
function fixture(): TableState {
  const state = createTableState(3);
  const add = (seat: number, street: Street, action: ActionType, size: string, seq: number) => {
    state.seats[seat].actions.push({ street, action, size, seq });
  };
  add(2, 'preflop', 'open', '3bb', 1);
  add(1, 'preflop', 'fold', '', 2);
  add(0, 'preflop', 'call', '', 3);
  add(0, 'flop', 'check', '', 4);
  add(2, 'flop', 'bet', '5bb', 5);
  add(0, 'flop', 'fold', '', 6);
  return state;
}

describe('parseTableState', () => {
  it('returns null for empty and invalid input', () => {
    expect(parseTableState('')).toBeNull();
    expect(parseTableState('not json')).toBeNull();
    expect(parseTableState('{"playerCount":3}')).toBeNull();
    expect(parseTableState('{"playerCount":3,"seats":[]}')).toBeNull();
  });

  it('rejects malformed seat entries', () => {
    expect(parseTableState('{"playerCount":2,"seats":[null,{}]}')).toBeNull();
    expect(parseTableState('{"playerCount":1,"seats":[{"actions":[]}]}')).toBeNull();
    expect(parseTableState('{"playerCount":1,"seats":[{"index":0,"actions":"x"}]}')).toBeNull();
    // A seat without an actions array is tolerated (flattenActions defaults it).
    expect(parseTableState('{"playerCount":1,"seats":[{"index":0}]}')).not.toBeNull();
  });

  it('round-trips a real table state', () => {
    const state = fixture();
    const parsed = parseTableState(JSON.stringify(state));
    expect(parsed?.playerCount).toBe(3);
    expect(parsed?.seats).toHaveLength(3);
  });
});

describe('flattenActions', () => {
  it('orders actions by street then seq, regardless of seat order', () => {
    const flat = flattenActions(fixture());
    expect(flat.map((a) => a.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(flat[0].seatIndex).toBe(2);
    expect(flat[3].street).toBe('flop');
  });
});

describe('buildReplaySteps', () => {
  it('starts with a deal step and interleaves board reveals', () => {
    const steps = buildReplaySteps(fixture(), 'Ah 7d 2c');
    expect(steps[0].kind).toBe('deal');
    expect(steps[0].boardCount).toBe(0);
    // deal, 3 preflop actions, flop reveal, 3 flop actions
    expect(steps).toHaveLength(8);
    const flopReveal = steps[4];
    expect(flopReveal.kind).toBe('board');
    expect(flopReveal.label).toBe('Flop: Ah 7d 2c');
    expect(flopReveal.boardCount).toBe(3);
  });

  it('accumulates folded seats', () => {
    const steps = buildReplaySteps(fixture(), 'Ah 7d 2c');
    const last = steps[steps.length - 1];
    expect(last.folded).toEqual([1, 0]);
    // The fold lands on step 2 (deal, open, fold).
    expect(steps[2].folded).toEqual([1]);
    expect(steps[1].folded).toEqual([]);
  });

  it('runs out the remaining board after an early all-in', () => {
    const state = createTableState(2);
    state.seats[0].actions.push({ street: 'preflop', action: 'all-in', size: '', seq: 1 });
    state.seats[1].actions.push({ street: 'preflop', action: 'call', size: '', seq: 2 });
    const steps = buildReplaySteps(state, 'Ah 7d 2c Kd 9s');
    const kinds = steps.map((s) => s.kind);
    expect(kinds).toEqual(['deal', 'action', 'action', 'board', 'board', 'board']);
    expect(steps[steps.length - 1].boardCount).toBe(5);
    expect(steps[steps.length - 1].label).toBe('River: 9s');
  });

  it('caps board reveals at the cards actually saved', () => {
    const steps = buildReplaySteps(fixture(), 'Ah 7d'); // incomplete flop
    const flopReveal = steps.find((s) => s.kind === 'board');
    expect(flopReveal?.boardCount).toBe(2);
    expect(flopReveal?.label).toBe('Flop: Ah 7d');
  });

  it('handles a hand with no actions', () => {
    const steps = buildReplaySteps(createTableState(6), '');
    expect(steps).toHaveLength(1);
    expect(steps[0].kind).toBe('deal');
  });
});

describe('parseActionLine', () => {
  // createTableState(3) puts the button on seat 2: seat 0 = Hero (SB),
  // seat 1 = BB, seat 2 = BTN.
  const state = () => createTableState(3);

  it('parses app-formatted lines into ordered actions with seat mapping', () => {
    const text =
      'Preflop: BTN opens 2.5, Hero (SB) 3-bets 9, BTN calls\nFlop (Ah 7d 2c): Hero (SB) bets 5, BTN folds';
    const actions = parseActionLine(text, state());
    expect(actions.map((a) => a.action)).toEqual(['open', '3-bet', 'call', 'bet', 'fold']);
    expect(actions.map((a) => a.seatIndex)).toEqual([2, 0, 2, 0, 2]);
    expect(actions.map((a) => a.street)).toEqual(['preflop', 'preflop', 'preflop', 'flop', 'flop']);
    expect(actions[0].size).toBe('2.5');
    expect(actions[0].phrase).toBe('BTN opens 2.5');
  });

  it('tolerates free-typed text without hyphens and unknown actors', () => {
    const actions = parseActionLine('UTG opens 3bb, Hero 3bets 9bb, MP folds', state());
    expect(actions.map((a) => a.action)).toEqual(['open', '3-bet', 'fold']);
    // UTG/MP don't exist 3-handed: unmapped actors get seatIndex -1, hero maps.
    expect(actions.map((a) => a.seatIndex)).toEqual([-1, 0, -1]);
  });

  it('skips unparseable phrases and empty input', () => {
    expect(parseActionLine('', state())).toEqual([]);
    expect(parseActionLine('thinking about ranges here', state())).toEqual([]);
    expect(parseActionLine('Preflop: —', state())).toEqual([]);
  });
});

describe('buildReplaySteps action-line fallback', () => {
  it('replays text-only hands action by action', () => {
    const state = createTableState(3); // no seat actions on the table
    const text = 'Preflop: BTN opens 2.5, Hero (SB) 3-bets 9, BTN calls\nFlop: Hero (SB) bets 5, BTN folds';
    const steps = buildReplaySteps(state, 'Ah 7d 2c', text);
    // deal, 3 preflop actions, flop reveal, 2 flop actions
    expect(steps.map((s) => s.kind)).toEqual([
      'deal', 'action', 'action', 'action', 'board', 'action', 'action',
    ]);
    expect(steps[1].label).toBe('BTN opens 2.5');
    expect(steps[1].actorSeat).toBe(2);
    expect(steps[4].boardCount).toBe(3);
    expect(steps[steps.length - 1].folded).toEqual([2]);
  });

  it('prefers table actions over the action line when both exist', () => {
    const steps = buildReplaySteps(fixture(), 'Ah 7d 2c', 'Preflop: UTG opens 99');
    expect(steps.some((s) => s.label.includes('99'))).toBe(false);
    expect(steps).toHaveLength(8); // same as the table-only case
  });

  it('leaves unmapped actors without seat highlight or fold dim', () => {
    const steps = buildReplaySteps(createTableState(3), '', 'Preflop: UTG folds');
    const action = steps[1];
    expect(action.actorSeat).toBeNull();
    expect(action.folded).toEqual([]);
  });
});

describe('stateAtStep', () => {
  it('only exposes applied actions of the current street', () => {
    const state = fixture();
    const steps = buildReplaySteps(state, 'Ah 7d 2c');
    // Step 5 = first flop action (hero checks): preflop badges must be gone.
    const flopCheck = steps[5];
    expect(flopCheck.kind).toBe('action');
    const at = stateAtStep(state, flopCheck);
    expect(at.seats[0].actions).toHaveLength(1);
    expect(at.seats[0].actions[0].action).toBe('check');
    expect(at.seats[2].actions).toHaveLength(0); // BTN hasn't acted on the flop yet
    // Original state untouched.
    expect(state.seats[0].actions).toHaveLength(3);
  });
});
