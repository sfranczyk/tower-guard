import { describe, expect, it } from 'vitest';
import { REGEN_START, regenStep, type RegenState } from './regeneration';

const params = { perSecond: 6, tickMs: 500, afterBurnMs: 1500 };
const calm = { burning: false, paused: false };

const run = (state: RegenState, frames: number, deltaMs: number, status = calm): { state: RegenState; healed: number } => {
  let healed = 0;
  for (let i = 0; i < frames; i++) {
    const step = regenStep(state, deltaMs, status, params);
    state = step.state;
    healed += step.heal;
  }
  return { state, healed };
};

describe('regenStep', () => {
  it('heals perSecond in whole steps of tickMs', () => {
    expect(regenStep(REGEN_START, 400, calm, params).heal).toBe(0);
    expect(run(REGEN_START, 60, 1000 / 60).healed).toBeCloseTo(6);
    expect(regenStep(REGEN_START, 1000, calm, params).heal).toBe(6);
  });

  it('stops while burning and waits afterBurnMs once the fire is out', () => {
    expect(run(REGEN_START, 10, 100, { burning: true, paused: false }).healed).toBe(0);
    const burnt = regenStep(REGEN_START, 16, { burning: true, paused: false }, params).state;
    expect(run(burnt, 14, 100).healed).toBe(0);
    expect(run(burnt, 20, 100).healed).toBe(3);
  });

  it('holds the clock while paused', () => {
    const half = regenStep(REGEN_START, 300, calm, params).state;
    const frozen = run(half, 50, 100, { burning: false, paused: true });
    expect(frozen.healed).toBe(0);
    expect(frozen.state).toEqual(half);
    expect(regenStep(half, 200, calm, params).heal).toBe(3);
  });
});
