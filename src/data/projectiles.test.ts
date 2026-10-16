import { describe, expect, it } from 'vitest';
import { simulateTrajectory } from '../systems/ballistics';
import type { ProjectileType } from '../types';
import { ARROWS, MIN_SHOT_POWER, SHRAPNEL_FRAGMENTS, SHRAPNEL_SPEED_FACTOR, SHRAPNEL_SPREAD } from '../config';
import { bowSpeed, drawSpeedShare, flightParams, launchSpeed, shrapnelBurst } from './projectiles';

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

  it('launches piercing at 120% of the normal arrow speed', () => {
    expect(launchSpeed('piercing', 0.6) / launchSpeed('normal', 0.6)).toBeCloseTo(1.2);
  });

  it('launches the player normal arrow 10% faster than the plain bow speed (enemy archers)', () => {
    expect(launchSpeed('normal', 1) / bowSpeed(1)).toBeCloseTo(1.1);
    expect(launchSpeed('explosive', 1)).toBeLessThan(bowSpeed(1));
  });

  it('maps the draw to range: from minSpeedFrac at the shortest shot to the full speed, range growing evenly', () => {
    expect(drawSpeedShare(MIN_SHOT_POWER)).toBeCloseTo(ARROWS.minSpeedFrac);
    expect(drawSpeedShare(0)).toBeCloseTo(ARROWS.minSpeedFrac);
    expect(drawSpeedShare(1)).toBeCloseTo(1);
    const rangeShare = (power: number): number => drawSpeedShare(power) ** 2;
    const step = (from: number): number => rangeShare(from + 0.2) - rangeShare(from);
    expect(step(0.2)).toBeCloseTo(step(0.6));
  });

  it('lets the shortest shot land close by', () => {
    expect(shoot('normal', 45, MIN_SHOT_POWER).range).toBeLessThan(60);
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

describe('shrapnelBurst', () => {
  const velocity = { x: 600, y: -200 };
  const fragments = shrapnelBurst(velocity);
  const heading = Math.atan2(velocity.y, velocity.x);

  it('fans the fragments evenly around the heading', () => {
    expect(fragments).toHaveLength(SHRAPNEL_FRAGMENTS);
    const angles = fragments.map((fragment) => Math.atan2(fragment.y, fragment.x) - heading);
    expect(angles[0]).toBeCloseTo(-SHRAPNEL_SPREAD);
    expect(angles[1]).toBeCloseTo(0);
    expect(angles[2]).toBeCloseTo(SHRAPNEL_SPREAD);
  });

  it('keeps the speed (a little boost from the burst)', () => {
    fragments.forEach((fragment) => {
      expect(Math.hypot(fragment.x, fragment.y)).toBeCloseTo(Math.hypot(velocity.x, velocity.y) * SHRAPNEL_SPEED_FACTOR);
    });
  });
});

describe('wind per projectile', () => {
  it('pushes light, draggy projectiles more than heavy ones', () => {
    const wind = (type: 'normal' | 'explosive' | 'fragment'): number => flightParams(type, 700, 100).wind ?? 0;
    expect(wind('normal')).toBeCloseTo(100);
    expect(wind('fragment')).toBeGreaterThan(wind('normal'));
    expect(wind('explosive')).toBeLessThan(wind('normal'));
  });
});
