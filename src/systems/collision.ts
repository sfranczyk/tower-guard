import type { Vec2 } from '../types';
import { clamp } from '../utils/math';

export interface AxisBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Slab test of the segment `start → start + travel` against an axis-aligned box.
 * Returns the normalized entry time in [0, 1], or undefined when the segment misses.
 */
export const segmentHitTime = (start: Vec2, travel: Vec2, box: AxisBounds): number | undefined => {
  let entry = 0;
  let exit = 1;
  const axes: Array<[number, number, number, number]> = [
    [start.x, travel.x, box.left, box.right],
    [start.y, travel.y, box.top, box.bottom],
  ];

  for (const [origin, delta, minimum, maximum] of axes) {
    if (Math.abs(delta) < Number.EPSILON) {
      if (origin < minimum || origin > maximum) {
        return undefined;
      }
      continue;
    }
    let near = (minimum - origin) / delta;
    let far = (maximum - origin) / delta;
    if (near > far) {
      [near, far] = [far, near];
    }
    entry = Math.max(entry, near);
    exit = Math.min(exit, far);
  }

  return entry <= exit && Number.isFinite(entry) ? clamp(entry, 0, 1) : undefined;
};
