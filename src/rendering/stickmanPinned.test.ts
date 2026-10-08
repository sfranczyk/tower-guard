import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../types';
import { PINNED_FOOT, PINNED_STRUGGLE_MS, getPinnedPose } from './stickmanPinned';

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
const frames = Array.from({ length: 141 }, (_, index) => (index / 140) * PINNED_STRUGGLE_MS);

describe('getPinnedPose', () => {
  it('never moves the stuck foot', () => {
    frames.forEach((time) => {
      const pose = getPinnedPose(time);
      expect(distance(pose.rearFoot, PINNED_FOOT)).toBeLessThan(1e-6);
    });
  });

  it('keeps every bone its length', () => {
    frames.forEach((time) => {
      const pose = getPinnedPose(time);
      expect(distance(pose.hip, pose.frontKnee)).toBeCloseTo(30, 6);
      expect(distance(pose.frontKnee, pose.frontFoot)).toBeCloseTo(30, 6);
      expect(distance(pose.hip, pose.rearKnee)).toBeCloseTo(30, 6);
      expect(distance(pose.rearKnee, pose.rearFoot)).toBeCloseTo(30, 6);
      expect(distance(pose.shoulder, pose.frontElbow)).toBeCloseTo(21, 6);
      expect(distance(pose.frontElbow, pose.frontHand)).toBeCloseTo(21, 6);
    });
  });

  it("keeps the free foot on or above the ground, and in front of the stuck one", () => {
    frames.forEach((time) => {
      const pose = getPinnedPose(time);
      expect(pose.frontFoot.y).toBeLessThanOrEqual(PINNED_FOOT.y + 1e-6);
      expect(pose.frontFoot.x).toBeGreaterThan(PINNED_FOOT.x);
    });
  });

  it('lunges forward, then gets yanked back', () => {
    const lunge = getPinnedPose(PINNED_STRUGGLE_MS * 0.28);
    const yank = getPinnedPose(PINNED_STRUGGLE_MS * 0.42);
    expect(lunge.shoulder.x).toBeGreaterThan(12);
    expect(yank.shoulder.x).toBeLessThan(lunge.shoulder.x - 10);
  });

  it('loops seamlessly and moves smoothly', () => {
    const start = getPinnedPose(0);
    const end = getPinnedPose(PINNED_STRUGGLE_MS - 1e-6);
    expect(distance(start.head, end.head)).toBeLessThan(0.5);
    expect(distance(start.frontFoot, end.frontFoot)).toBeLessThan(0.5);
    for (let time = 0; time < PINNED_STRUGGLE_MS; time += 10) {
      const a = getPinnedPose(time);
      const b = getPinnedPose(time + 10);
      expect(distance(a.head, b.head)).toBeLessThan(4);
      expect(distance(a.frontFoot, b.frontFoot)).toBeLessThan(4);
    }
  });
});
