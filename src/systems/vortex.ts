import {
  DRAGON_BUFFET,
  DRAGON_TURBULENCE_MS,
  FALL_DAMAGE,
  VORTEX_FLING,
  VORTEX_LEVITATE_HEAVY,
  VORTEX_LEVITATE_HEIGHT,
  VORTEX_LEVITATE_MAX,
  VORTEX_LEVITATE_SPEED,
  VORTEX_MS,
  VORTEX_PULL_SPEED,
  VORTEX_RADIUS,
  VORTEX_RISE_SPEED,
  VORTEX_THROW,
  VORTEX_TOP,
} from '../config';
import { enemyTraits } from '../data/enemyKinds';
import type { EnemyType, Vec2 } from '../types';

/**
 * The vortex arrow's vortex (pure, tested): it pulls ground enemies to its centre, lifts them up the funnel
 * circling round it, throws them out at the top and, when it dies away, flings out those still being pulled in.
 * Thrown enemies take damage from the landing.
 */

/** The vortex winds up over this share of its life. */
const RAMP_UP = 0.12;
/** Within this many px of the centre an enemy is caught by the funnel and starts going up. */
export const VORTEX_CORE = 12;
/** Radius (px) the lifted circle at the bottom and at the top of the funnel (it widens as they rise). */
const ORBIT = { bottom: 8, top: 58 };
/** How fast the lifted ones go round (radians/s). */
export const VORTEX_SPIN = 7;

/** How strongly the vortex pulls `ageMs` into its life: winds up, then holds until it's gone. */
export const vortexStrength = (ageMs: number): number => {
  const t = ageMs / VORTEX_MS;
  return t <= 0 || t >= 1 ? 0 : Math.min(1, t / RAMP_UP);
};

/** Heavy ones (ogres: their traits) are too heavy for a vortex to catch (it only slows them, see VORTEX_HEAVY_WALK). */
export const resistsVortex = (type: EnemyType): boolean => enemyTraits(type).heavy;

/**
 * One frame of the pull on an enemy `dx` (its x − the centre) away: how far (px) it's dragged towards the centre,
 * never past it; nothing out of reach.
 */
export const vortexPull = (dx: number, ageMs: number, deltaMs: number): number => {
  const distance = Math.abs(dx);
  const strength = vortexStrength(ageMs);
  if (distance > VORTEX_RADIUS || strength === 0) {
    return 0;
  }
  const closeness = 1 - distance / VORTEX_RADIUS;
  const speed = VORTEX_PULL_SPEED * strength * (0.45 + 0.55 * Math.sqrt(closeness));
  return -Math.sign(dx) * Math.min(distance, (speed * deltaMs) / 1000);
};

/** How far (px) an enemy in the funnel rises in `deltaMs`. */
export const vortexRise = (deltaMs: number): number => (VORTEX_RISE_SPEED * deltaMs) / 1000;

/** Where a lifted enemy is: circling `angle` round the funnel, `height` px up (side view: x swings, y a little). */
export const funnelPosition = (centre: Vec2, height: number, angle: number): Vec2 => {
  const radius = ORBIT.bottom + (ORBIT.top - ORBIT.bottom) * Math.min(1, height / VORTEX_TOP);
  return { x: centre.x + Math.cos(angle) * radius, y: centre.y - height + Math.sin(angle) * radius * 0.15 };
};

/** Random number in a [min, max] range, `roll` 0..1. */
const within = ([min, max]: readonly [number, number], roll: number): number => min + (max - min) * roll;

/** Thrown out of the top towards `side` (±1): up hard and out (`rollUp`, `rollSide` 0..1). */
export const throwVelocity = (side: number, rollUp: number, rollSide: number): Vec2 =>
  ({ x: Math.sign(side || 1) * within(VORTEX_THROW.side, rollSide), y: -within(VORTEX_THROW.up, rollUp) });

/**
 * Flung out as the vortex dies: away from the centre (`dx` = its x − the centre), a lower arc. One already going
 * up the funnel also gets the speed it had rising.
 */
export const flingVelocity = (dx: number, rising: boolean, rollUp: number, rollSide: number): Vec2 =>
  ({ x: Math.sign(dx || 1) * within(VORTEX_FLING.side, rollSide), y: -within(VORTEX_FLING.up, rollUp) - (rising ? VORTEX_RISE_SPEED : 0) });

/**
 * How high (px) the enemy a vortex arrow hit has levitated `ageMs` after: straight up at VORTEX_LEVITATE_SPEED,
 * easing off towards VORTEX_LEVITATE_HEIGHT, with a gentle bob; `boost` px higher for every further hit (see
 * VORTEX_LEVITATE_BOOST), never above VORTEX_LEVITATE_MAX. A brute only rises VORTEX_LEVITATE_HEAVY as high.
 */
export const levitateHeight = (ageMs: number, type: EnemyType = 'basic', boost = 0): number => {
  if (ageMs <= 0) {
    return 0;
  }
  const rise = VORTEX_LEVITATE_HEIGHT * (1 - Math.exp((-VORTEX_LEVITATE_SPEED * ageMs) / 1000 / VORTEX_LEVITATE_HEIGHT));
  const bob = Math.sin(ageMs / 260) * 4 * Math.min(1, ageMs / 600);
  return Math.min(VORTEX_LEVITATE_MAX, (rise + boost + bob) * (resistsVortex(type) ? VORTEX_LEVITATE_HEAVY : 1));
};

/** Damage from hitting the ground at `speed` px/s (straight down): none up to a safe speed, then more the harder. */
export const fallDamage = (speed: number): number => Math.max(0, speed - FALL_DAMAGE.safeSpeed) * FALL_DAMAGE.perSpeed;

/** Turbulence round a dragon fades in over this long and out over the last FADE_OUT (ms). */
const TURBULENCE_FADE = { in: 300, out: 700 };

/** How strong the turbulence round a dragon is with `msLeft` of it left (0..1). */
export const turbulenceStrength = (msLeft: number): number => {
  if (msLeft <= 0) {
    return 0;
  }
  const elapsed = DRAGON_TURBULENCE_MS - msLeft;
  return Math.min(1, Math.max(0, elapsed) / TURBULENCE_FADE.in, msLeft / TURBULENCE_FADE.out);
};

/**
 * How far a buffeted dragon is thrown about at `timeMs` (`strength` 0..1): px sideways and up and down, and a tilt.
 * Uneven gusts (sums of out-of-step waves), smooth over time.
 */
export const buffetOffset = (timeMs: number, strength: number): { x: number; y: number; tilt: number } => {
  const t = timeMs / 1000;
  const gust = (a: number, b: number, c: number): number => (Math.sin(t * a) * 0.6 + Math.sin(t * b + 1.3) * 0.3 + Math.sin(t * c + 2.1) * 0.1);
  return {
    x: DRAGON_BUFFET.x * strength * gust(3.1, 7.3, 13.7),
    y: DRAGON_BUFFET.y * strength * gust(4.3, 9.1, 15.9),
    tilt: DRAGON_BUFFET.tilt * strength * gust(3.7, 8.2, 12.1),
  };
};
