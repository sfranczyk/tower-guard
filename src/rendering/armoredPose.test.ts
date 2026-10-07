import { describe, expect, it } from 'vitest';
import { LOWERED_ELBOW, LOWERED_GRIP } from './archer';
import { armoredFallPose } from './armoredPose';
import { getFallPose } from './stickmanFall';

describe('armoredFallPose', () => {
  it('is the plain fall pose while falling and early in getting up', () => {
    expect(armoredFallPose('knockback', 0.5)).toEqual(getFallPose('knockback', 0.5));
    expect(armoredFallPose('getUp', 0.5)).toEqual(getFallPose('getUp', 0.5));
  });

  it('ends getting up with the bow arm where the standing archer carries the bow (relative to the hip)', () => {
    const end = armoredFallPose('getUp', 1);
    expect(end.rearHand.x - end.hip.x).toBeCloseTo(LOWERED_GRIP.x);
    expect(end.rearHand.y - end.hip.y).toBeCloseTo(LOWERED_GRIP.y);
    expect(end.rearElbow.x - end.hip.x).toBeCloseTo(LOWERED_ELBOW.x);
    expect(end.rearElbow.y - end.hip.y).toBeCloseTo(LOWERED_ELBOW.y);
  });

  it('never stretches the bow arm (upper arm and forearm stay about 21 long)', () => {
    for (let progress = 0; progress <= 1; progress += 0.02) {
      const pose = armoredFallPose('getUp', progress);
      const upper = Math.hypot(pose.rearElbow.x - pose.shoulder.x, pose.rearElbow.y - pose.shoulder.y);
      const fore = Math.hypot(pose.rearHand.x - pose.rearElbow.x, pose.rearHand.y - pose.rearElbow.y);
      expect(upper).toBeGreaterThan(16);
      expect(upper).toBeLessThan(23);
      expect(fore).toBeGreaterThan(18);
      expect(fore).toBeLessThan(23);
    }
  });

  it('moves the bow arm there without a jump', () => {
    for (let progress = 0.6; progress < 1; progress += 0.01) {
      const a = armoredFallPose('getUp', progress).rearHand;
      const b = armoredFallPose('getUp', progress + 0.01).rearHand;
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(3);
    }
  });
});
