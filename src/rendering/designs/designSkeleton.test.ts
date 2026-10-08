import { describe, expect, it } from 'vitest';
import { DESIGN_GAITS, DESIGN_GROUND_Y, footAt, solveJoint, walkPose } from './designSkeleton';
import type { Vec2 } from '../../types';

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

describe('design skeletons', () => {
  it('moves a foot without jumps and never below the ground', () => {
    for (let p = 0; p < 1; p += 0.005) {
      const foot = footAt(p, 12, 8);
      expect(foot.y).toBeLessThanOrEqual(DESIGN_GROUND_Y);
      expect(distance(foot, footAt(p + 0.005, 12, 8))).toBeLessThan(1.5);
    }
  });

  it('solves a knee that keeps both bone lengths and bends forward', () => {
    const hip = { x: 0, y: 0 };
    const knee = solveJoint(hip, { x: 5, y: 50 }, 30, 30, 1);
    expect(distance(hip, knee)).toBeCloseTo(30);
    expect(distance(knee, { x: 5, y: 50 })).toBeCloseTo(30);
    expect(knee.x).toBeGreaterThan(5);
  });

  it.each(Object.entries(DESIGN_GAITS))('%s: feet stay in reach, knees bend forward, the cycle loops', (_, gait) => {
    for (let p = 0; p <= 1; p += 0.01) {
      const pose = walkPose(p, gait);
      for (const [knee, foot] of [[pose.frontKnee, pose.frontFoot], [pose.rearKnee, pose.rearFoot]]) {
        expect(distance(pose.hip, knee)).toBeCloseTo(gait.thigh, 3);
        expect(distance(knee, foot)).toBeCloseTo(gait.shin, 3);
        // In front of the hip–foot line: never bent backwards.
        const cross = (foot.x - pose.hip.x) * (knee.y - pose.hip.y) - (foot.y - pose.hip.y) * (knee.x - pose.hip.x);
        expect(cross).toBeLessThan(0);
      }
    }
    const start = walkPose(0, gait);
    const end = walkPose(1, gait);
    expect(distance(start.frontFoot, end.frontFoot)).toBeLessThan(1e-6);
    expect(distance(start.hip, end.hip)).toBeLessThan(1e-6);
  });
});
