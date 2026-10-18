import { describe, expect, it } from 'vitest';
import { BANNERS } from '../config';
import { BannerBreeze } from './bannerBreeze';

/** A fixed sequence of "random" numbers, repeated. */
const sequence = (values: number[]): (() => number) => {
  let index = 0;
  return () => values[index++ % values.length];
};

describe('BannerBreeze', () => {
  it('starts flying one way, stiffly', () => {
    const breeze = new BannerBreeze(sequence([0.9]));
    expect(breeze.direction).toBe(1);
    expect(breeze.strength).toBeCloseTo(0.8);
  });

  it('turns through a limp moment, never jumping', () => {
    // start right; then always flip (0 < flipChance), never a lull, full force.
    const breeze = new BannerBreeze(sequence([0.9, 0.5, 0, 0.99, 0.99]));
    let previous = breeze.lean;
    let limp = false;
    for (let t = 0; t < BANNERS.breezeChangeMaxMs * 2; t += 16) {
      breeze.update(16);
      expect(Math.abs(breeze.lean - previous)).toBeLessThanOrEqual((BANNERS.breezeEasePerS * 16) / 1000 + 1e-9);
      limp ||= breeze.strength < 0.05;
      previous = breeze.lean;
    }
    expect(limp).toBe(true);
    expect(breeze.direction).toBe(-1);
  });

  it('flies with the level\'s wind when there is one', () => {
    const breeze = new BannerBreeze(sequence([0.9, 0.5]));
    for (let t = 0; t < 10_000; t += 16) {
      breeze.update(16, -1);
    }
    expect(breeze.direction).toBe(-1);
  });
});
