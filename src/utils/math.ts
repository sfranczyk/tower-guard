import type { Bounds, Vec2 } from '../types';

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

/** Small seeded PRNG (mulberry32): the same seed always gives the same sequence in 0..1. */
export const createRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** The box around `points`, grown by `padding` on every side. */
export const boundsAround = (points: readonly Vec2[], padding: number): Bounds => {
  const left = Math.min(...points.map((point) => point.x)) - padding;
  const right = Math.max(...points.map((point) => point.x)) + padding;
  const top = Math.min(...points.map((point) => point.y)) - padding;
  const bottom = Math.max(...points.map((point) => point.y)) + padding;
  return { x: left, y: top, width: right - left, height: bottom - top, left, right, top, bottom };
};

/** `point` rotated by `angle` (radians) about `about`. */
export const rotateAbout = (point: Vec2, about: Vec2, angle: number): Vec2 => {
  const dx = point.x - about.x;
  const dy = point.y - about.y;
  return { x: about.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: about.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
};
