import { ARROW_BASE_SPEED, ARROW_DRAG, ARROW_FORCE_SPEED, ARROW_SPEED_FACTOR, SHRAPNEL_FRAGMENTS, SHRAPNEL_SPEED_FACTOR, SHRAPNEL_SPREAD } from '../config';
import type { FlightParams } from '../systems/ballistics';
import type { ProjectileType, Vec2 } from '../types';

/**
 * Per-projectile physics. The bow gives every arrow the same energy, so launch speed scales with
 * 1/√mass; air drag scales with the head's drag and inversely with mass (heavier = slows less).
 */
export interface ProjectilePhysics {
  /** Relative to a normal arrow (1). */
  mass: number;
  /** Relative drag of the head/shape (1 = normal broadhead). */
  dragMultiplier: number;
  /** Extra launch speed tuning on top of the mass rule (1 = none). */
  speedMultiplier: number;
}

export const PROJECTILE_PHYSICS: Readonly<Record<ProjectileType, ProjectilePhysics>> = {
  normal: { mass: 1, dragMultiplier: 1, speedMultiplier: 1.1 },
  // Light, slim bodkin point: 120% of the normal arrow's speed (mass 1/1.2²), flat and carries furthest.
  piercing: { mass: 1 / 1.2 ** 2, dragMultiplier: 0.665, speedMultiplier: 1.1 },
  // Heavy charge with a bulky head: slow, short high arc.
  explosive: { mass: 1.8, dragMultiplier: 1.6, speedMultiplier: 1 },
  // A canister of small heads: a bit heavier than a normal arrow until it bursts.
  shrapnel: { mass: 1.15, dragMultiplier: 1.1, speedMultiplier: 1.1 },
  // The small arrows a shrapnel burst releases (never launched from the bow).
  fragment: { mass: 0.45, dragMultiplier: 0.8, speedMultiplier: 1 },
};

/**
 * Velocities of the fragments a shrapnel arrow bursts into: SHRAPNEL_FRAGMENTS directions fanned
 * SHRAPNEL_SPREAD apart, centred on the current heading, a little faster than the arrow was.
 */
export const shrapnelBurst = (velocity: Vec2): Vec2[] => {
  const heading = Math.atan2(velocity.y, velocity.x);
  const speed = Math.hypot(velocity.x, velocity.y) * SHRAPNEL_SPEED_FACTOR;
  return Array.from({ length: SHRAPNEL_FRAGMENTS }, (_, index) => {
    const angle = heading + (index - (SHRAPNEL_FRAGMENTS - 1) / 2) * SHRAPNEL_SPREAD;
    return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  });
};

/** Speed (px/s) the bow gives a mass-1 arrow at a draw power of 0..1 (enemy archers shoot with this). */
export const bowSpeed = (power: number): number => (ARROW_BASE_SPEED + power * ARROW_FORCE_SPEED) * ARROW_SPEED_FACTOR;

/** Launch speed (px/s) of the player's projectile at a draw power of 0..1. */
export const launchSpeed = (type: ProjectileType, power: number): number => {
  const { mass, speedMultiplier } = PROJECTILE_PHYSICS[type];
  return (bowSpeed(power) * speedMultiplier) / Math.sqrt(mass);
};

/**
 * Flight parameters for a projectile under the given gravity and wind (px/s² for a normal arrow).
 * Wind pushes like drag does: more on light, draggy projectiles, less on heavy ones.
 */
export const flightParams = (type: ProjectileType, gravity: number, wind = 0): FlightParams => {
  const { mass, dragMultiplier } = PROJECTILE_PHYSICS[type];
  return { gravity, drag: (ARROW_DRAG * dragMultiplier) / mass, wind: (wind * dragMultiplier) / mass };
};
