import { LIGHTNING_GROUND_CHANCE, LIGHTNING_INTERVAL_MS } from '../config';
import type { Vec2 } from '../types';
import { createRandom } from '../utils/math';

/**
 * Lightning as plain data (no Pixi) so it can be tested: bolt shapes, the strike schedule and who a
 * ground strike hits. systems/WeatherSystem.ts draws it and applies the damage.
 */

export interface Bolt {
  /** Main channel from the cloud to the end point (first point = start, last = end). */
  trunk: Vec2[];
  /** Shorter forks leaving the trunk. */
  branches: Vec2[][];
}

type Random = () => number;
const between = (random: Random, min: number, max: number): number => min + random() * (max - min);

/**
 * Jagged path from `start` to `end` by midpoint displacement: each pass splits every segment and
 * pushes the midpoint sideways by up to roughness[pass] × the segment length. Small early values keep
 * the overall direction; bigger late ones make the fine zigzag.
 */
const jaggedPath = (start: Vec2, end: Vec2, roughness: readonly number[], random: Random): Vec2[] => {
  let points = [start, end];
  for (let pass = 0; pass < roughness.length; pass += 1) {
    const next: Vec2[] = [points[0]];
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1];
      const b = points[index];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const normal = { x: -(b.y - a.y) / (length || 1), y: (b.x - a.x) / (length || 1) };
      const offset = between(random, -1, 1) * roughness[pass] * length;
      next.push({ x: (a.x + b.x) / 2 + normal.x * offset, y: (a.y + b.y) / 2 + normal.y * offset }, b);
    }
    points = next;
  }
  return points;
};

const TRUNK_ROUGHNESS = [0.14, 0.2, 0.32, 0.4, 0.4];
const FORK_ROUGHNESS = [0.2, 0.35, 0.4];

/** A bolt from `start` (under a cloud) to `end` (the ground, or another cloud for sky flashes). */
export const createBolt = (start: Vec2, end: Vec2, seed: number): Bolt => {
  const random = createRandom(seed);
  const trunk = jaggedPath(start, end, TRUNK_ROUGHNESS, random);
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const forks = 2 + Math.floor(random() * 3);
  const branches = Array.from({ length: forks }, () => {
    // Forks leave from the upper two thirds of the trunk and head down and outwards.
    const from = trunk[1 + Math.floor(random() * Math.floor(trunk.length * 0.66))];
    const angle = between(random, 0.35, 1.1) * (random() < 0.5 ? -1 : 1);
    const forkLength = length * between(random, 0.12, 0.3);
    const to = { x: from.x + Math.sin(angle) * forkLength, y: from.y + Math.cos(angle) * forkLength };
    return jaggedPath(from, to, FORK_ROUGHNESS, random);
  });
  return { trunk, branches };
};

export interface StrikePlan {
  /** Wait before this strike (ms). */
  delayMs: number;
  /** Ground strikes hurt; sky strikes only flash between clouds. */
  reachesGround: boolean;
}

/** The next strike: random delay in LIGHTNING_INTERVAL_MS, and whether it comes down to the ground. */
export const planStrike = (random: Random): StrikePlan => ({
  delayMs: between(random, LIGHTNING_INTERVAL_MS[0], LIGHTNING_INTERVAL_MS[1]),
  reachesGround: random() < LIGHTNING_GROUND_CHANCE,
});

/** Everything whose x is within `radius` of the strike point (lightning hits the ground, so x only). */
export const struckBy = <T extends { x: number }>(strikeX: number, radius: number, targets: readonly T[]): T[] =>
  targets.filter((target) => Math.abs(target.x - strikeX) <= radius);
