import { BURN_DAMAGE_PER_S, BURN_DURATION_MS } from '../config';
import type { Vec2 } from '../types';

/**
 * Fire that sets the bowman alight (pure, tested): whether a stream's flames touch his body, and the
 * burn itself, which deals BURN_DAMAGE_PER_S for BURN_DURATION_MS after the last touch.
 */

export interface Flame {
  center: Vec2;
  radius: number;
}

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Only the dense middle of a puff burns (its soft edge doesn't). */
const FLAME_CORE = 0.7;

/** Whether any flame's core overlaps the box. */
export const flamesTouch = (flames: readonly Flame[], box: Box): boolean => flames.some(({ center, radius }) => {
  const nearestX = Math.max(box.left, Math.min(box.right, center.x));
  const nearestY = Math.max(box.top, Math.min(box.bottom, center.y));
  return Math.hypot(center.x - nearestX, center.y - nearestY) <= radius * FLAME_CORE;
});

/** Burn time left after being touched again by fire (a fresh touch always relights it fully). */
export const relight = (): number => BURN_DURATION_MS;

/** Damage a burn deals over `deltaMs` while `remainingMs` of it is left (it stops when the burn runs out). */
export const burnDamage = (remainingMs: number, deltaMs: number): number =>
  (BURN_DAMAGE_PER_S * Math.max(0, Math.min(remainingMs, deltaMs))) / 1000;
