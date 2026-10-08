import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../types';
import { BODY_FOOT_Y, archerBody, attackBody, bowmanBody, runBody, walkBody, type BodyPose } from './bodyPoses';

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Legs 30 + 30 and arms 21 + 21 like the stickman, feet never below the ground. */
const expectStickmanProportions = (pose: BodyPose, armsToo = true): void => {
  for (const [knee, foot] of [[pose.frontKnee, pose.frontFoot], [pose.rearKnee, pose.rearFoot]]) {
    expect(distance(pose.hip, knee)).toBeCloseTo(30, 3);
    expect(distance(knee, foot)).toBeCloseTo(30, 3);
    expect(foot.y).toBeLessThanOrEqual(BODY_FOOT_Y + 1e-9);
  }
  expect(distance(pose.hip, pose.shoulder)).toBeCloseTo(35, 6);
  if (armsToo) {
    for (const [elbow, hand] of [[pose.frontElbow, pose.frontHand], [pose.rearElbow, pose.rearHand]]) {
      expect(distance(pose.shoulder, elbow)).toBeCloseTo(21, 3);
      expect(distance(elbow, hand)).toBeCloseTo(21, 3);
    }
  }
};

const progressSteps = Array.from({ length: 101 }, (_, i) => i / 100);

describe('body poses for new looks', () => {
  it('walks, with and without a club, and as a zombie', () => {
    for (const p of progressSteps) {
      expectStickmanProportions(walkBody(p));
      expectStickmanProportions(walkBody(p, { zombie: true }));
      const armed = walkBody(p, { club: 'overhead' });
      expectStickmanProportions(armed);
      expect(armed.club).toBeDefined();
    }
    expect(distance(walkBody(0).frontFoot, walkBody(1).frontFoot)).toBeLessThan(1e-9);
  });

  it('runs with a flight phase', () => {
    const airborne = progressSteps.filter((p) => {
      const pose = runBody(p);
      return pose.frontFoot.y < BODY_FOOT_Y - 0.5 && pose.rearFoot.y < BODY_FOOT_Y - 0.5;
    });
    expect(airborne.length).toBeGreaterThan(0);
    progressSteps.forEach((p) => expectStickmanProportions(runBody(p, 'uppercut')));
  });

  it.each(['overhead', 'twoHanded', 'uppercut', 'grab'] as const)('%s: swings with the club in the fist and the feet planted', (style) => {
    for (const p of progressSteps) {
      const pose = attackBody(p, style);
      expectStickmanProportions(pose, style !== 'twoHanded');
      expect(pose.rearFoot.y).toBeCloseTo(BODY_FOOT_Y);
      if (pose.club) {
        // The fist is on the shaft, between butt and tip.
        const shaft = distance(pose.club.butt, pose.club.tip);
        expect(distance(pose.club.butt, pose.frontHand) + distance(pose.frontHand, pose.club.tip)).toBeCloseTo(shaft, 6);
      }
    }
  });

  it('holds the bow in the rear hand and draws with the front one', () => {
    for (const p of progressSteps) {
      const pose = archerBody(-0.2, p, 1, p);
      expect(pose.bow).toBeDefined();
      expect(distance(pose.rearHand, pose.bow!.rig.woodHand)).toBeLessThan(1e-9);
      expect(distance(pose.frontHand, pose.bow!.rig.stringHand)).toBeLessThan(1e-9);
      expectStickmanProportions(pose, false);
    }
  });

  it('blends the player between standing, walking and sprinting with legs of full length', () => {
    for (const idle of [0, 0.3, 0.7, 1]) {
      for (const running of [0, 0.5, 1]) {
        for (const p of progressSteps) {
          const pose = bowmanBody(p, idle, running, -0.2, 0.5, 1);
          expectStickmanProportions(pose, false);
          expect(distance(pose.rearHand, pose.bow!.rig.woodHand)).toBeLessThan(1e-9);
        }
      }
    }
    const standing = bowmanBody(0.37, 1, 0, 0, 0, 0);
    expect(standing.frontFoot.y).toBeCloseTo(BODY_FOOT_Y);
    expect(standing.rearFoot.y).toBeCloseTo(BODY_FOOT_Y);
  });
});
