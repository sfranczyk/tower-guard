import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../types';
import { getFlailPose } from './stickmanFlail';

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
const frames = Array.from({ length: 200 }, (_, index) => index * 10);

describe('getFlailPose', () => {
  it('keeps every bone its length', () => {
    frames.forEach((time) => {
      const pose = getFlailPose(time);
      expect(distance(pose.hip, pose.shoulder)).toBeCloseTo(35, 6);
      expect(distance(pose.hip, pose.frontKnee)).toBeCloseTo(30, 6);
      expect(distance(pose.frontKnee, pose.frontFoot)).toBeCloseTo(30, 6);
      expect(distance(pose.hip, pose.rearKnee)).toBeCloseTo(30, 6);
      expect(distance(pose.rearKnee, pose.rearFoot)).toBeCloseTo(30, 6);
      expect(distance(pose.shoulder, pose.frontElbow)).toBeCloseTo(21, 6);
      expect(distance(pose.frontElbow, pose.frontHand)).toBeCloseTo(21, 6);
      expect(distance(pose.shoulder, pose.rearElbow)).toBeCloseTo(21, 6);
      expect(distance(pose.rearElbow, pose.rearHand)).toBeCloseTo(21, 6);
    });
  });

  it('flails: the hands go all the way round and the feet swing, smoothly', () => {
    const handYs = frames.map((time) => getFlailPose(time).frontHand.y);
    expect(Math.max(...handYs) - Math.min(...handYs)).toBeGreaterThan(50);
    const footXs = frames.map((time) => getFlailPose(time).frontFoot.x);
    expect(Math.max(...footXs) - Math.min(...footXs)).toBeGreaterThan(30);
    frames.forEach((time) => {
      expect(distance(getFlailPose(time).frontHand, getFlailPose(time + 10).frontHand)).toBeLessThan(10);
      expect(distance(getFlailPose(time).head, getFlailPose(time + 10).head)).toBeLessThan(3);
    });
  });
});
