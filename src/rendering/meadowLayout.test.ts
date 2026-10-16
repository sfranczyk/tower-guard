import { describe, expect, it } from 'vitest';
import { MEADOW } from '../config';
import { layoutMeadow } from './meadowLayout';

describe('layoutMeadow', () => {
  const layout = layoutMeadow(-300, 2700, 7);

  it('is the same for the same seed and differs for another', () => {
    expect(layoutMeadow(-300, 2700, 7)).toEqual(layout);
    expect(layoutMeadow(-300, 2700, 8).trees).not.toEqual(layout.trees);
  });

  it('keeps everything within the scenery', () => {
    [...layout.trees, ...layout.rocks, ...layout.flowers].forEach(({ x }) => {
      expect(x).toBeGreaterThanOrEqual(-300);
      expect(x).toBeLessThan(2700);
    });
  });

  it('draws the back row first, smaller', () => {
    const firstFront = layout.trees.findIndex((tree) => !tree.far);
    expect(firstFront).toBeGreaterThan(0);
    expect(layout.trees.slice(firstFront).every((tree) => !tree.far)).toBe(true);
    const tallest = (far: boolean) => Math.max(...layout.trees.filter((tree) => tree.far === far).map((tree) => tree.height));
    expect(tallest(true)).toBeLessThan(tallest(false));
  });

  it('mixes all species and spaces the front row unevenly', () => {
    const front = layout.trees.filter((tree) => !tree.far);
    expect(new Set(front.map((tree) => tree.kind)).size).toBe(4);
    const gaps = front.slice(1).map((tree, index) => tree.x - front[index].x);
    expect(Math.min(...gaps)).toBeLessThan(MEADOW.gapMin);
    expect(Math.max(...gaps)).toBeGreaterThan(MEADOW.gapMax);
  });
});
