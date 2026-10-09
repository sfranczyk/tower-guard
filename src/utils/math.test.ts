import { describe, expect, it } from 'vitest';
import { approach, clamp, rotateAbout } from './math';

describe('clamp', () => {
  it('limits values to the range', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe('approach', () => {
  it('moves towards the target without overshooting', () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(9, 10, 3)).toBe(10);
    expect(approach(10, 0, 4)).toBe(6);
    expect(approach(5, 5, 1)).toBe(5);
  });
});

describe('rotateAbout', () => {
  it('turns a point about another', () => {
    const turned = rotateAbout({ x: 2, y: 1 }, { x: 1, y: 1 }, Math.PI / 2);
    expect(turned.x).toBeCloseTo(1);
    expect(turned.y).toBeCloseTo(2);
  });
});
