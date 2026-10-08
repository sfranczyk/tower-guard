import { describe, expect, it } from 'vitest';
import { KEEP_BASE, KEEP_TURRET, keepHitParts } from './keep';

const covers = (parts: ReturnType<typeof keepHitParts>, x: number, y: number): boolean =>
  parts.some((part) => x >= part.left && x <= part.right && y >= part.top && y <= part.bottom);

describe('keepHitParts', () => {
  const parts = keepHitParts();

  it('covers the tower, its top, the gatehouse, the walls and the plinth', () => {
    expect(covers(parts, 100, 30)).toBe(true); // top merlons
    expect(covers(parts, 100, 150)).toBe(true); // shaft
    expect(covers(parts, 100, 330)).toBe(true); // gate
    expect(covers(parts, 30, 330)).toBe(true); // left wall
    expect(covers(parts, 165, 330)).toBe(true); // right wall
    expect(covers(parts, KEEP_BASE.x, KEEP_BASE.y - 5)).toBe(true); // plinth
  });

  it('leaves the open sky beside the tower above the walls', () => {
    expect(covers(parts, 25, 150)).toBe(false);
    expect(covers(parts, 175, 150)).toBe(false);
    expect(covers(parts, 175, 250)).toBe(false);
    expect(covers(parts, 100, 5)).toBe(false);
  });

  it('adds the lower second tower in co-op', () => {
    const twin = keepHitParts(true);
    const middle = (KEEP_TURRET.left + KEEP_TURRET.right) / 2;
    expect(covers(twin, middle, 250)).toBe(true);
    expect(covers(parts, middle, 250)).toBe(false);
    expect(covers(twin, middle, KEEP_TURRET.cornice - 30)).toBe(false);
  });
});
