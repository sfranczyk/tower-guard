import { describe, expect, it } from 'vitest';
import { WIND_SHIFT } from '../config';
import { rollWind, shiftedWind, WindShifts } from './windShift';

/** Plays back the given numbers, then repeats the last. */
const sequence = (...values: number[]): (() => number) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};

describe('wind', () => {
  it('rolls between minus and plus the strongest wind', () => {
    expect(rollWind(300, () => 0)).toBe(-300);
    expect(rollWind(300, () => 1)).toBe(300);
    expect(rollWind(300, () => 0.5)).toBe(0);
  });

  it('shifts to a noticeably different wind', () => {
    // First roll (+30) is too close to +60, the second (−240) is far enough.
    const next = shiftedWind(60, 300, sequence(0.55, 0.1));
    expect(next).toBe(-240);
    expect(Math.abs(next - 60)).toBeGreaterThanOrEqual(WIND_SHIFT.minChange * 300);
  });

  it('may change only once every WIND_SHIFT.everyMs, at WIND_SHIFT.chance', () => {
    const always = new WindShifts(300, sequence(0, 0.9));
    expect(always.update(WIND_SHIFT.everyMs - 1, 0)).toBeUndefined();
    expect(always.update(1, 0)).toBe(240);
    const never = new WindShifts(300, () => 0.99);
    expect(never.update(WIND_SHIFT.everyMs * 3, 0)).toBeUndefined();
  });

  it('never changes on a calm map', () => {
    expect(new WindShifts(0, () => 0).update(WIND_SHIFT.everyMs * 2, 0)).toBeUndefined();
  });
});
