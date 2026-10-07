import { DRAGON_ALTITUDE, DRAGON_HOVER_OFFSET, WORLD_WIDTH } from '../config';

/**
 * Dragon flight as pure functions (objects/DragonEnemy.ts uses them): where it hovers, how it
 * flies there (a killed dragon's fall is rendering/dragonDeath.ts).
 */

/** Keep at least this far in front of the bowman, and this far inside the right edge of the world. */
const MIN_HOVER_GAP = 170;
const RIGHT_MARGIN = 70;

/** Where the dragon wants to hover: `offset` (default DRAGON_HOVER_OFFSET) in front of (right of) its target. */
export const hoverX = (targetX: number, offset = DRAGON_HOVER_OFFSET): number =>
  Math.min(WORLD_WIDTH - RIGHT_MARGIN, Math.max(targetX + MIN_HOVER_GAP, targetX + offset));

/** Cruising height (default DRAGON_ALTITUDE) with a slow drift up and down (y, smaller = higher). */
export const cruiseAltitude = (timeMs: number, altitude = DRAGON_ALTITUDE): number => altitude + Math.sin(timeMs / 1300) * 12;

/** Moves `current` towards `target` at `speed` px/s without overshooting. */
export const flyTowards = (current: number, target: number, speed: number, deltaMs: number): number => {
  const step = (speed * deltaMs) / 1000;
  const gap = target - current;
  return Math.abs(gap) <= step ? target : current + Math.sign(gap) * step;
};
