import { describe, expect, it } from 'vitest';
import { WIND_SHIFT } from '../config';
import { rollWind, shiftedStep, stepOfWind, windOfStep, WindShifts } from './windShift';

/** Plays back the given numbers, then repeats the last. */
const sequence = (...values: number[]): (() => number) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};

const { stepChance, bigChance, wildChance } = WIND_SHIFT;
const stepRoll = stepChance / 2;
const bigRoll = stepChance + bigChance / 2;
const wildRoll = stepChance + bigChance + wildChance / 2;
const calmRoll = (stepChance + bigChance + wildChance + 1) / 2;

describe('wind', () => {
  it('comes in steps from three leftwards to three rightwards, calm between', () => {
    expect(windOfStep(-3, 300)).toBe(-300);
    expect(windOfStep(2, 300)).toBe(200);
    expect(stepOfWind(-100, 300)).toBe(-1);
    expect(rollWind(300, () => 0)).toBe(-300);
    expect(rollWind(300, () => 0.5)).toBe(0);
    expect(rollWind(300, () => 0.99)).toBe(300);
  });

  it('changes by one step, by two, wildly, or not at all', () => {
    // 2 left: one step is 3 or 1 left.
    expect(shiftedStep(-2, sequence(stepRoll, 0))).toBe(-3);
    expect(shiftedStep(-2, sequence(stepRoll, 0.99))).toBe(-1);
    // 1 left: two steps is 3 left or 1 right.
    expect(shiftedStep(-1, sequence(bigRoll, 0))).toBe(-3);
    expect(shiftedStep(-1, sequence(bigRoll, 0.99))).toBe(1);
    // Wildly: three or more steps away (from 1 left: 2 or 3 right).
    expect(shiftedStep(-1, sequence(wildRoll, 0))).toBe(2);
    expect(shiftedStep(-1, sequence(wildRoll, 0.99))).toBe(3);
    expect(shiftedStep(-1, () => calmRoll)).toBeUndefined();
  });

  it('turns back at the end of the scale', () => {
    expect(shiftedStep(3, sequence(stepRoll, 0))).toBe(2);
    expect(shiftedStep(3, sequence(stepRoll, 0.99))).toBe(2);
  });

  it('has a change chance once every WIND_SHIFT.everyMs, never on a calm map', () => {
    const shifts = new WindShifts(300, sequence(stepRoll, 0));
    expect(shifts.update(WIND_SHIFT.everyMs - 1, -200)).toBeUndefined();
    expect(shifts.update(1, -200)).toBe(-300);
    expect(new WindShifts(0, () => 0).update(WIND_SHIFT.everyMs * 2, 0)).toBeUndefined();
  });
});
