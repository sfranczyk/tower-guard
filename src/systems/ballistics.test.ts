import { describe, expect, it } from 'vitest';
import { advanceProjectile, simulateTrajectory, solveLaunchAngle, stepProjectile, type FlightParams } from './ballistics';

const GRAVITY = 700;
const NO_DRAG: FlightParams = { gravity: GRAVITY, drag: 0 };
const DRAG: FlightParams = { gravity: GRAVITY, drag: 0.0005 };
const WORLD = { groundY: 490, minX: -1e6, maxX: 1e6 };

describe('stepProjectile', () => {
  it('without drag keeps horizontal speed and applies gravity', () => {
    const state = stepProjectile({ x: 0, y: 0, vx: 300, vy: -200 }, 0.1, NO_DRAG);
    expect(state.vx).toBe(300);
    expect(state.vy).toBeCloseTo(-200 + GRAVITY * 0.1);
  });

  it('drag slows the projectile along its velocity', () => {
    const state = stepProjectile({ x: 0, y: 0, vx: 800, vy: 0 }, 0.01, { gravity: 0, drag: 0.0005 });
    expect(state.vx).toBeLessThan(800);
    expect(state.vy).toBe(0);
  });
});

describe('advanceProjectile', () => {
  it('without drag follows the analytic parabola closely', () => {
    const state = { x: 0, y: 0, vx: 400, vy: -500 };
    for (let frame = 0; frame < 60; frame += 1) {
      advanceProjectile(state, 1 / 60, NO_DRAG);
    }
    expect(state.x).toBeCloseTo(400, 6);
    // Semi-implicit Euler drifts slightly from the exact parabola (~g·dt/2 per second of flight).
    expect(Math.abs(state.y - (-500 + 0.5 * GRAVITY))).toBeLessThan(4);
  });

  it('a full-power shot loses roughly 30% speed in its first second', () => {
    const state = { x: 0, y: 0, vx: 1008, vy: 0 };
    for (let frame = 0; frame < 60; frame += 1) {
      advanceProjectile(state, 1 / 60, { gravity: 0, drag: 0.0005 });
    }
    const loss = 1 - Math.hypot(state.vx, state.vy) / 1008;
    expect(loss).toBeGreaterThan(0.25);
    expect(loss).toBeLessThan(0.4);
  });

  it('falling speed approaches but never exceeds the terminal velocity', () => {
    const terminal = Math.sqrt(GRAVITY / DRAG.drag);
    const state = { x: 0, y: 0, vx: 0, vy: 0 };
    for (let frame = 0; frame < 60 * 30; frame += 1) {
      advanceProjectile(state, 1 / 60, DRAG);
      expect(state.vy).toBeLessThanOrEqual(terminal + 1e-6);
    }
    expect(state.vy).toBeGreaterThan(terminal * 0.99);
  });
});

describe('simulateTrajectory', () => {
  const start = { x: 0, y: 400 };
  const velocity = { x: 700, y: -500 };

  it('ends on the ground', () => {
    const points = simulateTrajectory(start, velocity, DRAG, WORLD);
    expect(points[points.length - 1].y).toBe(WORLD.groundY);
  });

  it('drag shortens the range and steepens the descent', () => {
    const plain = simulateTrajectory(start, velocity, NO_DRAG, WORLD);
    const dragged = simulateTrajectory(start, velocity, DRAG, WORLD);
    expect(dragged[dragged.length - 1].x).toBeLessThan(plain[plain.length - 1].x);

    const slope = (points: typeof plain): number => {
      const [a, b] = points.slice(-2);
      return (b.y - a.y) / (b.x - a.x);
    };
    expect(slope(dragged)).toBeGreaterThan(slope(plain));
  });

  it('stops when leaving the world horizontally', () => {
    const points = simulateTrajectory(start, velocity, DRAG, { ...WORLD, maxX: 300 });
    expect(points.every((point) => point.x <= 300)).toBe(true);
  });
});

describe('solveLaunchAngle', () => {
  const hitsTarget = (start: { x: number; y: number }, target: { x: number; y: number }, speed: number, angle: number): boolean => {
    const points = simulateTrajectory(start, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }, DRAG, { ...WORLD, groundY: 600 });
    return points.some((point) => Math.hypot(point.x - target.x, point.y - target.y) < 12);
  };

  it('finds a shot that passes through a target to the left', () => {
    const start = { x: 800, y: 455 };
    const target = { x: 480, y: 470 };
    const angle = solveLaunchAngle(start, target, 700, DRAG, 600);
    expect(Math.cos(angle)).toBeLessThan(0);
    expect(hitsTarget(start, target, 700, angle)).toBe(true);
  });

  it('finds a shot to the right and up (e.g. onto a tower)', () => {
    const start = { x: 300, y: 460 };
    const target = { x: 120, y: 330 };
    const angle = solveLaunchAngle(start, target, 800, DRAG, 600);
    expect(hitsTarget(start, target, 800, angle)).toBe(true);
  });

  it('prefers the flatter of the two possible arcs', () => {
    const angle = solveLaunchAngle({ x: 0, y: 450 }, { x: 300, y: 450 }, 800, DRAG, 600);
    expect(-angle).toBeLessThan(Math.PI / 4);
  });
});
