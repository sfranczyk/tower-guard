import { describe, expect, it } from 'vitest';
import { leftoverAlpha, leftoverGone } from './leftovers';

describe('leftovers', () => {
  it('shows a leftover fully, then fades it over its last moments', () => {
    expect(leftoverAlpha(0, 20000, 1000)).toBe(1);
    expect(leftoverAlpha(19000, 20000, 1000)).toBe(1);
    expect(leftoverAlpha(19500, 20000, 1000)).toBeCloseTo(0.5);
    expect(leftoverAlpha(20000, 20000, 1000)).toBe(0);
    expect(leftoverAlpha(500, 1000, 0)).toBe(1);
  });

  it('is gone once its life is over', () => {
    expect(leftoverGone(19999, 20000)).toBe(false);
    expect(leftoverGone(20000, 20000)).toBe(true);
  });
});
