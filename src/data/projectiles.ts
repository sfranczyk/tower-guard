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
}

export const PROJECTILE_PHYSICS: Readonly<Record<ProjectileType, ProjectilePhysics>> = {
  normal: { mass: 1, dragMultiplier: 1 },
  // Light, slim bodkin point: launches at 120% speed (mass 1/1.2²), flat and carries furthest.
  piercing: { mass: 1 / 1.2 ** 2, dragMultiplier: 0.7 },
  // Heavy charge with a bulky head: slow, short high arc.
  explosive: { mass: 1.8, dragMultiplier: 1.6 },
};

/** Launch speed (px/s) for a projectile at a draw power of 0..1. */
export const launchSpeed = (type: ProjectileType, power: number): number =>
  ((ARROW_BASE_SPEED + power * ARROW_FORCE_SPEED) * ARROW_SPEED_FACTOR) / Math.sqrt(PROJECTILE_PHYSICS[type].mass);

/** Flight parameters for a projectile under the given gravity. */
export const flightParams = (type: ProjectileType, gravity: number): FlightParams => {
  const { mass, dragMultiplier } = PROJECTILE_PHYSICS[type];
  return { gravity, drag: (ARROW_DRAG * dragMultiplier) / mass };
};
