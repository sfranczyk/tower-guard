import { describe, expect, it } from 'vitest';
import { BOWMAN_KNOCKBACK, SPRINT_MAX_MULTIPLIER } from '../config';
import { knockdownProgress, landedKnockdown, startKnockdown, stepKnockdown, walkSpeed } from './bowmanMotion';

const PACE = 120;
/** His speed after `seconds` of pushing `direction` from `speed`, in 16 ms steps. */
const after = (seconds: number, speed: number, direction: number, sprinting = false, pace = 1): number => {
  let current = speed;
  for (let t = 0; t < seconds; t += 0.016) {
    current = walkSpeed(current, direction, sprinting, 0.016, PACE, pace);
  }
  return current;
};

describe('walkSpeed', () => {
  it('speeds up to his pace, faster sprinting, slower chilled', () => {
    expect(after(2, 0, 1)).toBeCloseTo(PACE);
    expect(after(3, 0, 1, true)).toBeCloseTo(PACE * SPRINT_MAX_MULTIPLIER);
    expect(after(2, 0, -1, false, 0.45)).toBeCloseTo(-PACE * 0.45);
  });

  it('stops when let go and turns round', () => {
    expect(after(2, PACE, 0)).toBe(0);
    expect(after(2, PACE, -1)).toBeCloseTo(-PACE);
    expect(walkSpeed(50, 1, false, 0, PACE)).toBe(50);
  });
});

describe('knockdown', () => {
  it('slides the whole push away from the blast, lies, gets up', () => {
    let knockdown = startKnockdown(1);
    let slid = 0;
    let stoodUp = false;
    const kinds = new Set<string>();
    for (let t = 0; t < 5000 && !stoodUp; t += 16) {
      const step = stepKnockdown(knockdown, 16, true);
      slid += step.slide;
      stoodUp = step.stoodUp;
      if (step.knockdown) {
        knockdown = step.knockdown;
        kinds.add(knockdown.kind);
      }
    }
    expect(slid).toBeCloseTo(BOWMAN_KNOCKBACK.pushMax);
    expect(stoodUp).toBe(true);
    expect([...kinds]).toEqual(['knockback', 'getUp']);
  });

  it('keeps a dead bowman lying on his back', () => {
    let knockdown = startKnockdown(0.5);
    for (let t = 0; t < 5000; t += 16) {
      knockdown = stepKnockdown(knockdown, 16, false).knockdown!;
    }
    expect(knockdown.kind).toBe('knockback');
    expect(knockdownProgress(knockdown)).toBe(1);
  });

  it('lands a thrown bowman into the knockback, without a slide', () => {
    const landed = landedKnockdown(0.72);
    expect(knockdownProgress(landed)).toBeCloseTo(0.72);
    expect(landed.push).toBe(0);
    expect(startKnockdown(2).push).toBe(BOWMAN_KNOCKBACK.pushMax);
  });
});
