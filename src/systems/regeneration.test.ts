import { describe, expect, it } from 'vitest';
import { REGEN_START, regenStep, type RegenState } from './regeneration';

const params = { perSecond: 6, tickMs: 500, afterFireMs: 12000 };
const calm = { burnMs: 0, paused: false };

const run = (state: RegenState, frames: number, deltaMs: number, status = calm): { state: RegenState; healed: number } => {
  let healed = 0;
  for (let i = 0; i < frames; i++) {
    const step = regenStep(state, deltaMs, status, params);
    state = step.state;
    healed += step.heal;
  }
  return { state, healed };
};

/** Burns for `burnMs` from now, frame by frame, as the afflictions count it down. */
const burn = (state: RegenState, burnMs: number, deltaMs = 100): RegenState => {
  for (let left = burnMs; left > 0; left -= deltaMs) {
    state = regenStep(state, deltaMs, { burnMs: left, paused: false }, params).state;
  }
  return state;
};

describe('regenStep', () => {
  it('heals perSecond in whole steps of tickMs', () => {
    expect(regenStep(REGEN_START, 400, calm, params).heal).toBe(0);
    expect(run(REGEN_START, 60, 1000 / 60).healed).toBeCloseTo(6);
    expect(regenStep(REGEN_START, 1000, calm, params).heal).toBe(6);
  });

  it('stops for afterFireMs from being set alight', () => {
    const burnt = burn(REGEN_START, 7200);
    expect(run(burnt, 47, 100).healed).toBe(0);
    expect(run(burnt, 53, 100).healed).toBe(3);
  });

  it('stays off while a fire burns longer than afterFireMs', () => {
    const burnt = burn(REGEN_START, 15000);
    expect(regenStep(burnt, 500, calm, params).heal).toBe(3);
  });

  it('a re-hit while burning starts the lock again', () => {
    let state = regenStep(REGEN_START, 100, { burnMs: 7200, paused: false }, params).state;
    state = run(state, 50, 100, { burnMs: 2000, paused: false }).state;
    state = regenStep(state, 100, { burnMs: 7200, paused: false }, params).state;
    expect(state.lockMs).toBe(12000);
  });

  it('holds the clock while paused', () => {
    const half = regenStep(REGEN_START, 300, calm, params).state;
    const frozen = run(half, 50, 100, { burnMs: 0, paused: true });
    expect(frozen.healed).toBe(0);
    expect(frozen.state).toEqual(half);
    expect(regenStep(half, 200, calm, params).heal).toBe(3);
  });

  it('stops only while a fire no longer than minFireMs burns (a dragon\'s scorch)', () => {
    const scorchParams = { ...params, minFireMs: 500 };
    const lit = regenStep(REGEN_START, 16, { burnMs: 500, paused: false }, scorchParams);
    expect(lit.heal).toBe(0);
    const out = regenStep(lit.state, 16, calm, scorchParams);
    expect(out.state.lockMs).toBe(0);
    expect(regenStep(out.state, 600, calm, scorchParams).heal).toBeGreaterThan(0);
  });
});
