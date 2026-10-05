export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/** Moves `current` towards `target` by at most `maxDelta`. */
export const approach = (current: number, target: number, maxDelta: number): number => {
  if (current < target) {
    return Math.min(current + maxDelta, target);
  }
  if (current > target) {
    return Math.max(current - maxDelta, target);
  }
  return target;
};
