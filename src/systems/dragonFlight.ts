import { DRAGON_ALTITUDE, DRAGON_HOVER_OFFSET, WORLD_WIDTH } from '../config';

/**
 * Dragon archer flight as pure functions (objects/DragonEnemy.ts uses them): where it hovers, how it
 * flies there, and how a killed dragon falls out of the sky.
 */

/** Keep at least this far in front of the bowman, and this far inside the right edge of the world. */
const MIN_HOVER_GAP = 170;
const RIGHT_MARGIN = 70;

/** Where the dragon wants to hover: DRAGON_HOVER_OFFSET in front of (right of) its target. */
export const hoverX = (targetX: number): number =>
  Math.min(WORLD_WIDTH - RIGHT_MARGIN, Math.max(targetX + MIN_HOVER_GAP, targetX + DRAGON_HOVER_OFFSET));

/** Cruising height with a slow drift up and down (y, smaller = higher). */
export const cruiseAltitude = (timeMs: number): number => DRAGON_ALTITUDE + Math.sin(timeMs / 1300) * 12;

/** Moves `current` towards `target` at `speed` px/s without overshooting. */
export const flyTowards = (current: number, target: number, speed: number, deltaMs: number): number => {
  const step = (speed * deltaMs) / 1000;
  const gap = target - current;
  return Math.abs(gap) <= step ? target : current + Math.sign(gap) * step;
};

export interface FallState {
  y: number;
  vy: number;
  /** Nose-down tilt in radians. */
  rotation: number;
  landed: boolean;
}

const FALL_GRAVITY = 900;
/** Tilt it ends up with, lying on the ground. */
const LANDED_TILT = 0.32;

/** One step of a killed dragon falling: accelerates down, tips nose-down, comes to rest at `groundY`. */
export const fallStep = (state: FallState, groundY: number, deltaMs: number): FallState => {
  if (state.landed) {
    return state;
  }
  const dt = deltaMs / 1000;
  const vy = state.vy + FALL_GRAVITY * dt;
  const y = state.y + vy * dt;
  if (y >= groundY) {
    return { y: groundY, vy: 0, rotation: LANDED_TILT, landed: true };
  }
  return { y, vy, rotation: Math.min(0.9, state.rotation + dt * 1.6), landed: false };
};
