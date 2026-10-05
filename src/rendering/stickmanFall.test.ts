import { describe, expect, it } from 'vitest';
import { STICKMAN_HEAD } from './stickman';
import { bodyLandingProgress, getFallPose, type FallKind, type FallPose } from './stickmanFall';

const GROUND_Y = 58;
const KINDS: FallKind[] = ['death', 'deathCrumple', 'deathStiff', 'knockback', 'getUp'];
const FALLS: FallKind[] = ['death', 'deathCrumple', 'deathStiff', 'knockback'];
const samples = Array.from({ length: 41 }, (_, index) => index / 40);

const lowestPoint = (pose: FallPose): number => Math.max(
  pose.frontFoot.y, pose.rearFoot.y, pose.frontKnee.y, pose.rearKnee.y,
  pose.frontHand.y, pose.rearHand.y, pose.head.y + STICKMAN_HEAD.radius,
);

describe('getFallPose', () => {
  it.each(FALLS)('%s starts standing upright', (kind) => {
    const pose = getFallPose(kind, 0);
    expect(pose.hip.x).toBeCloseTo(0);
    expect(pose.hip.y).toBeCloseTo(0);
    expect(pose.head.y).toBeLessThan(pose.shoulder.y);
    expect(pose.shoulder.y).toBeLessThan(pose.hip.y);
  });

  it.each(KINDS)('%s never sinks noticeably below the ground', (kind) => {
    samples.forEach((progress) => {
      expect(lowestPoint(getFallPose(kind, progress))).toBeLessThanOrEqual(GROUND_Y + 4);
    });
  });

  it.each(FALLS)('%s ends lying on the ground', (kind) => {
    const pose = getFallPose(kind, 1);
    expect(Math.abs(pose.head.y - pose.hip.y)).toBeLessThan(10);
    expect(pose.hip.y).toBeGreaterThan(40);
    expect(lowestPoint(pose)).toBeGreaterThan(GROUND_Y - 6);
  });

  it('death collapses forward, roughly where it stood', () => {
    const pose = getFallPose('death', 1);
    expect(Math.abs(pose.hip.x)).toBeLessThan(15);
    expect(pose.head.x).toBeGreaterThan(pose.hip.x);
  });

  it('knockback throws the body backwards and lands it on its back', () => {
    const pose = getFallPose('knockback', 1);
    expect(pose.hip.x).toBeLessThan(-50);
    expect(pose.head.x).toBeLessThan(pose.hip.x);
  });

  it('knockback lifts the body off the ground mid-flight', () => {
    expect(getFallPose('knockback', 0.35).hip.y).toBeLessThan(-10);
  });

  it('clamps progress outside 0..1', () => {
    expect(getFallPose('death', -1)).toEqual(getFallPose('death', 0));
    expect(getFallPose('death', 2)).toEqual(getFallPose('death', 1));
  });

  it('getUp starts exactly where knockback ends', () => {
    expect(getFallPose('getUp', 0)).toEqual(getFallPose('knockback', 1));
  });

  it('getUp ends standing upright', () => {
    const pose = getFallPose('getUp', 1);
    expect(pose.hip.y).toBeCloseTo(0);
    expect(pose.head.y).toBeLessThan(pose.shoulder.y);
    expect(pose.shoulder.y).toBeLessThan(pose.hip.y);
  });

  it.each(['deathCrumple', 'deathStiff'] as FallKind[])('%s falls backwards onto its back', (kind) => {
    const pose = getFallPose(kind, 1);
    expect(pose.head.x).toBeLessThan(pose.hip.x);
  });

  it('deathStiff keeps the feet planted while it topples', () => {
    // After the initial snap (feet move from the standing stance together).
    const start = getFallPose('deathStiff', 0.1);
    [0.3, 0.6, 0.8].forEach((progress) => {
      const pose = getFallPose('deathStiff', progress);
      expect(Math.abs(pose.frontFoot.x - start.frontFoot.x)).toBeLessThan(8);
    });
  });
});

describe('bodyLandingProgress', () => {
  it('lands partway through every fall to the ground, and never while getting up', () => {
    const kinds = ['death', 'deathCrumple', 'deathStiff', 'knockback'] as const;
    kinds.forEach((kind) => {
      const progress = bodyLandingProgress(kind);
      expect(progress).toBeGreaterThan(0.2);
      expect(progress).toBeLessThan(1);
    });
    expect(bodyLandingProgress('getUp')).toBeUndefined();
  });
});
