import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../types';
import { DRAGON_FLAP_MS, getDragonPose } from './dragon';

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

describe('getDragonPose', () => {
  it('loops every wing beat', () => {
    const start = getDragonPose(0);
    const next = getDragonPose(DRAGON_FLAP_MS);
    expect(distance(start.nearWing.tip, next.nearWing.tip)).toBeLessThan(1e-6);
    expect(distance(start.head, next.head)).toBeLessThan(1e-6);
    expect(start.bob).toBeCloseTo(next.bob, 9);
  });

  it('beats the wings up and down and bobs the body', () => {
    const tips = Array.from({ length: 36 }, (_, index) => getDragonPose((index / 36) * DRAGON_FLAP_MS));
    const heights = tips.map((pose) => pose.nearWing.tip.y);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(60);
    const bobs = tips.map((pose) => pose.bob);
    expect(Math.max(...bobs) - Math.min(...bobs)).toBeGreaterThan(10);
  });

  it('keeps the rider in the saddle, limbs at full length, and moves smoothly', () => {
    let previous = getDragonPose(0);
    for (let time = 10; time <= DRAGON_FLAP_MS; time += 10) {
      const pose = getDragonPose(time);
      expect(distance(pose.rider.hip, pose.saddle)).toBeLessThan(1e-9);
      expect(distance(pose.rider.shoulder, pose.rider.frontElbow)).toBeCloseTo(21, 6);
      expect(distance(pose.rider.frontElbow, pose.rider.frontHand)).toBeCloseTo(21, 6);
      expect(distance(pose.rider.hip, pose.rider.frontKnee)).toBeCloseTo(30, 6);
      expect(distance(pose.nearWing.tip, previous.nearWing.tip)).toBeLessThan(12);
      expect(distance(pose.head, previous.head)).toBeLessThan(4);
      previous = pose;
    }
  });
});
