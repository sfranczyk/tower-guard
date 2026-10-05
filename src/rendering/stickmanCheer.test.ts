import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../types';
import { CHEER_FOOT_Y, CHEER_KINDS, CHEER_PERIOD_MS, getCheerPose } from './stickmanCheer';
import type { JointPose } from './stickmanPose';

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
const JOINTS = ['hip', 'shoulder', 'head', 'frontKnee', 'frontFoot', 'rearKnee', 'rearFoot', 'frontElbow', 'frontHand', 'rearElbow', 'rearHand'] as const;
const framesOf = (kind: (typeof CHEER_KINDS)[number], step = 4): JointPose[] =>
  Array.from({ length: Math.ceil(CHEER_PERIOD_MS[kind] / step) + 1 }, (_, index) => getCheerPose(kind, index * step));

describe('cheer animations', () => {
  CHEER_KINDS.forEach((kind) => {
    describe(kind, () => {
      const frames = framesOf(kind);

      it('keeps every limb its length', () => {
        frames.forEach((pose) => {
          expect(distance(pose.hip, pose.frontKnee)).toBeCloseTo(30, 5);
          expect(distance(pose.frontKnee, pose.frontFoot)).toBeCloseTo(30, 5);
          expect(distance(pose.hip, pose.rearKnee)).toBeCloseTo(30, 5);
          expect(distance(pose.rearKnee, pose.rearFoot)).toBeCloseTo(30, 5);
          expect(distance(pose.shoulder, pose.frontElbow)).toBeCloseTo(21, 5);
          expect(distance(pose.frontElbow, pose.frontHand)).toBeCloseTo(21, 5);
          expect(distance(pose.shoulder, pose.rearElbow)).toBeCloseTo(21, 5);
          expect(distance(pose.rearElbow, pose.rearHand)).toBeCloseTo(21, 5);
        });
      });

      it('never puts a foot below the ground or bends a knee backwards', () => {
        frames.forEach((pose) => {
          expect(pose.frontFoot.y).toBeLessThanOrEqual(CHEER_FOOT_Y + 0.5);
          expect(pose.rearFoot.y).toBeLessThanOrEqual(CHEER_FOOT_Y + 0.5);
          // Knees in front of the hip→foot line.
          [[pose.frontKnee, pose.frontFoot], [pose.rearKnee, pose.rearFoot]].forEach(([knee, foot]) => {
            const cross = (foot.x - pose.hip.x) * (knee.y - pose.hip.y) - (foot.y - pose.hip.y) * (knee.x - pose.hip.x);
            expect(cross).toBeLessThanOrEqual(0.01);
          });
        });
      });

      it('raises a hand above the head', () => {
        expect(frames.some((pose) => Math.min(pose.frontHand.y, pose.rearHand.y) < pose.head.y)).toBe(true);
      });

      it('loops and moves smoothly', () => {
        const first = getCheerPose(kind, 0);
        const wrapped = getCheerPose(kind, CHEER_PERIOD_MS[kind]);
        JOINTS.forEach((key) => expect(distance(first[key], wrapped[key])).toBeLessThan(0.01));
        for (let index = 1; index < frames.length; index += 1) {
          JOINTS.forEach((key) => expect(distance(frames[index - 1][key], frames[index][key])).toBeLessThan(6));
        }
      });
    });
  });

  it('keeps feet planted for the standing cheers and leaves the ground in the jump', () => {
    (['cheerFist', 'cheerWave'] as const).forEach((kind) => {
      framesOf(kind).forEach((pose) => {
        expect(pose.frontFoot.y).toBeCloseTo(CHEER_FOOT_Y, 1);
        expect(pose.rearFoot.y).toBeCloseTo(CHEER_FOOT_Y, 1);
      });
    });
    const highest = Math.min(...framesOf('cheerJump').map((pose) => Math.max(pose.frontFoot.y, pose.rearFoot.y)));
    expect(highest).toBeLessThan(CHEER_FOOT_Y - 15);
  });
});
