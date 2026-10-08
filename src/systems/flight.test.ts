import { describe, expect, it } from 'vitest';
import { THROW_GRAVITY } from '../config';
import { landingRotation, stepFlight, type Flight } from './flight';

const flat = (): number => 400;

const fly = (start: Flight): { path: Flight[]; impactSpeed: number } => {
  let flight = start;
  const path: Flight[] = [];
  for (let frame = 0; frame < 1000; frame += 1) {
    const step = stepFlight(flight, 16, flat, 0, 5000);
    flight = step.flight;
    path.push(flight);
    if (step.landed) {
      return { path, impactSpeed: step.impactSpeed };
    }
  }
  throw new Error('never landed');
};

describe('stepFlight', () => {
  it('flies a ballistic arc and lands on the ground, as fast as it fell', () => {
    const { path, impactSpeed } = fly({ x: 100, y: 270, vx: 200, vy: -400, rotation: 0, spin: 10, timeMs: 0 });
    const last = path[path.length - 1];
    expect(last.y).toBe(400);
    expect(last.x).toBeGreaterThan(100);
    expect(Math.min(...path.map((point) => point.y))).toBeLessThan(270 - 60);
    // Up 400 px/s from 130 px up: v² = 400² + 2g·130.
    expect(impactSpeed).toBeCloseTo(Math.sqrt(400 ** 2 + 2 * THROW_GRAVITY * 130), -2);
  });

  it('lands lying on its back the way it flies, whatever it tumbled', () => {
    const right = fly({ x: 100, y: 270, vx: 200, vy: -400, rotation: 0, spin: 13, timeMs: 0 }).path;
    expect(right[right.length - 1].rotation).toBe(landingRotation(200));
    const left = fly({ x: 900, y: 270, vx: -200, vy: -400, rotation: 0, spin: -9, timeMs: 0 }).path;
    expect(left[left.length - 1].rotation).toBe(landingRotation(-200));
    // Just before landing it has nearly turned to it already (no snap).
    const before = right[right.length - 2].rotation;
    const turns = Math.round((before - landingRotation(200)) / (2 * Math.PI));
    expect(Math.abs(before - turns * 2 * Math.PI - landingRotation(200))).toBeLessThan(0.5);
  });

  it('stays inside the world', () => {
    const { path } = fly({ x: 10, y: 380, vx: -300, vy: -200, rotation: 0, spin: 0, timeMs: 0 });
    path.forEach((point) => expect(point.x).toBeGreaterThanOrEqual(0));
  });
});
