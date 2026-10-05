import { describe, expect, it } from 'vitest';
import { WALK_KNEE_MIN_BEND, walkKneeBend } from './walkCycle';

const samples = Array.from({ length: 101 }, (_, index) => index / 100);

describe('walkKneeBend', () => {
  it('never hyperextends the knee', () => {
    samples.forEach((progress) => {
      expect(walkKneeBend(progress, true)).toBeLessThan(0);
      expect(walkKneeBend(progress, false)).toBeLessThan(0);
    });
  });

  it('joins stance and swing without a jump', () => {
    expect(walkKneeBend(1, false)).toBeCloseTo(WALK_KNEE_MIN_BEND);
    expect(walkKneeBend(0, true)).toBeCloseTo(WALK_KNEE_MIN_BEND);
    expect(walkKneeBend(1, true)).toBeCloseTo(WALK_KNEE_MIN_BEND);
    expect(walkKneeBend(0, false)).toBeCloseTo(WALK_KNEE_MIN_BEND);
  });

  it('bends much more in the swing than in the stance', () => {
    expect(walkKneeBend(0.5, true)).toBeLessThan(walkKneeBend(0.5, false) - 0.4);
  });
});
