import { describe, expect, it } from 'vitest';
import { simulateTrajectory } from '../systems/ballistics';
import type { ProjectileType } from '../types';
import { PROJECTILE_PHYSICS, flightParams, launchSpeed } from './projectiles';

const GRAVITY = 700;
const WORLD = { groundY: 490, minX: -1e6, maxX: 1e6 };

/** Landing distance and apex height of a shot at `angleDeg` above horizontal. */
const shoot = (type: ProjectileType, angleDeg: number, power = 1): { range: number; apex: number } => {
  const angle = (-angleDeg * Math.PI) / 180;
  const speed = launchSpeed(type, power);
  const start = { x: 0, y: 450 };
  const points = simulateTrajectory(start, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }, flightParams(type, GRAVITY), WORLD);
  return { range: points[points.length - 1].x, apex: start.y - Math.min(...points.map((point) => point.y)) };
};

describe('projectile physics', () => {
  it('gives lighter arrows a faster launch from the same draw', () => {
    expect(launchSpeed('piercing', 1)).toBeGreaterThan(launchSpeed('normal', 1));
    expect(launchSpeed('normal', 1)).toBeGreaterThan(launchSpeed('explosive', 1));
  });

  it('keeps the normal arrow unchanged', () => {
    expect(PROJECTILE_PHYSICS.normal).toEqual({ mass: 1, dragMultiplier: 1 });
  });

  it('carries piercing furthest and explosive shortest', () => {
    [10, 25, 40].forEach((angle) => {
      expect(shoot('piercing', angle).range).toBeGreaterThan(shoot('normal', angle).range);
      expect(shoot('normal', angle).range).toBeGreaterThan(shoot('explosive', angle).range);
    });
  });

  it('flies piercing flatter: to reach the same spot it needs a lower arc', () => {
    const target = shoot('explosive', 30).range;
    // Find the angle at which piercing lands at the same distance (low solution).
    let angle = 1;
    while (shoot('piercing', angle).range < target) {
      angle += 0.5;
    }
    expect(shoot('piercing', angle).apex).toBeLessThan(shoot('explosive', 30).apex);
  });
});
