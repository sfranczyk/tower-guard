import { ARROW_BASE_SPEED, ARROW_DRAG, ARROW_FORCE_SPEED, ARROW_SPEED_FACTOR } from '../config';
import type { FlightParams } from '../systems/ballistics';
import type { ProjectileType } from '../types';

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
};

/** Speed (px/s) the bow gives a mass-1 arrow at a draw power of 0..1 (enemy archers shoot with this). */
export const bowSpeed = (power: number): number => (ARROW_BASE_SPEED + power * ARROW_FORCE_SPEED) * ARROW_SPEED_FACTOR;

/** Launch speed (px/s) of the player's projectile at a draw power of 0..1. */
export const launchSpeed = (type: ProjectileType, power: number): number => {
  const { mass, speedMultiplier } = PROJECTILE_PHYSICS[type];
  return (bowSpeed(power) * speedMultiplier) / Math.sqrt(mass);
};

/** Flight parameters for a projectile under the given gravity. */
export const flightParams = (type: ProjectileType, gravity: number): FlightParams => {
  const { mass, dragMultiplier } = PROJECTILE_PHYSICS[type];
  return { gravity, drag: (ARROW_DRAG * dragMultiplier) / mass };
};
