import { describe, expect, it } from 'vitest';
import { BANDAGE_KNEEL_MS, BANDAGE_LOOP_MS, bandageKneel } from './bandaging';

describe('bandageKneel', () => {
  it('kneels, stays down, gets up, and loops from standing', () => {
    expect(bandageKneel(0)).toBe(0);
    expect(bandageKneel(BANDAGE_KNEEL_MS / 2)).toBeCloseTo(0.5);
    expect(bandageKneel(BANDAGE_LOOP_MS / 2)).toBe(1);
    expect(bandageKneel(BANDAGE_LOOP_MS - 1)).toBeLessThan(0.01);
  });
});
