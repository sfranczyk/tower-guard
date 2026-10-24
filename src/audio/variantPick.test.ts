import { describe, expect, it } from 'vitest';
import { pickVariant, variantShares } from './variantPick';

describe('pickVariant', () => {
  it('splits equal weights evenly', () => {
    expect(pickVariant([1, 1, 1, 1], undefined, 0)).toBe(0);
    expect(pickVariant([1, 1, 1, 1], undefined, 0.3)).toBe(1);
    expect(pickVariant([1, 1, 1, 1], undefined, 0.99)).toBe(3);
  });

  it('follows the weights', () => {
    expect(pickVariant([3, 1], undefined, 0.74)).toBe(0);
    expect(pickVariant([3, 1], undefined, 0.76)).toBe(1);
  });

  it('never picks a zero weight', () => {
    for (let random = 0; random < 1; random += 0.05) {
      expect(pickVariant([0, 2, 0, 1], undefined, random)).not.toBe(0);
      expect(pickVariant([0, 2, 0, 1], undefined, random)).not.toBe(2);
    }
  });

  it('skips the last variant while another has weight', () => {
    for (let random = 0; random < 1; random += 0.05) {
      expect(pickVariant([1, 1, 1], 1, random)).not.toBe(1);
    }
    expect(pickVariant([0, 1, 0], 1, 0.5)).toBe(1);
  });

  it('is silent when every weight is 0', () => {
    expect(pickVariant([0, 0], undefined, 0.5)).toBe(-1);
    expect(pickVariant([], undefined, 0.5)).toBe(-1);
  });
});

describe('variantShares', () => {
  it('gives each weight its share', () => {
    expect(variantShares([1, 3])).toEqual([0.25, 0.75]);
    expect(variantShares([0, 0])).toEqual([0, 0]);
  });
});
