import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../types';
import { BODY_FOOT_Y, archerBody, attackBody, bowmanBody, castBody, runBody, standBody, walkBody, type BodyPose } from './bodyPoses';

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

  it('marches (the knights), with the foot lifted much higher than in the walk', () => {
    for (const p of progressSteps) {
      expectStickmanProportions(walkBody(p, { style: 'march' }));
      expectStickmanProportions(walkBody(p, { style: 'march', club: 'twoHanded' }), false);
    }
    const highest = (style: 'walk' | 'march'): number =>
      Math.max(...progressSteps.map((p) => BODY_FOOT_Y - Math.min(walkBody(p, { style }).frontFoot.y, walkBody(p, { style }).rearFoot.y)));
    expect(highest('march')).toBeGreaterThan(15);
    expect(highest('walk')).toBeLessThan(10);
  });

  it('walks with the knees never bent backwards and a foot always on the ground', () => {
    for (const p of progressSteps) {
      const pose = walkBody(p);
      for (const [knee, foot] of [[pose.frontKnee, pose.frontFoot], [pose.rearKnee, pose.rearFoot]]) {
        // The knee is in front of the line from the hip to the foot.
        const cross = (foot.x - pose.hip.x) * (knee.y - pose.hip.y) - (foot.y - pose.hip.y) * (knee.x - pose.hip.x);
        expect(cross).toBeLessThanOrEqual(1e-6);
      }
      // A foot is always down: flat or on its heel, or up on the ball of the foot (8 px ahead of the ankle, toe down).
      const lowest = (foot: Vec2, pitch: number): number => foot.y + 8 * Math.max(0, Math.sin(-pitch));
      expect(Math.max(lowest(pose.frontFoot, pose.frontShinAngle), lowest(pose.rearFoot, pose.rearShinAngle))).toBeCloseTo(BODY_FOOT_Y, 6);
    }
  });

  it('runs with a flight phase', () => {
    const airborne = progressSteps.filter((p) => {
      const pose = runBody(p);
      return pose.frontFoot.y < BODY_FOOT_Y - 0.5 && pose.rearFoot.y < BODY_FOOT_Y - 0.5;
    });
    expect(airborne.length).toBeGreaterThan(0);
    progressSteps.forEach((p) => expectStickmanProportions(runBody(p, 'uppercut')));
  });

  it.each(['overhead', 'twoHanded', 'uppercut', 'swordRise', 'thrust', 'grab'] as const)('%s: swings with the club in the fist and the feet planted', (style) => {
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

  it('casts with the scepter raised high, starting and ending in the standing pose', () => {
    for (const p of progressSteps) {
      const pose = castBody(p);
      expectStickmanProportions(pose);
      expect(pose.frontFoot.y).toBeCloseTo(BODY_FOOT_Y);
      expect(pose.rearFoot.y).toBeCloseTo(BODY_FOOT_Y);
    }
    const stand = standBody('overhead');
    for (const end of [castBody(0), castBody(1)]) {
      expect(distance(end.frontHand, stand.frontHand)).toBeLessThan(1e-6);
      expect(distance(end.club!.tip, stand.club!.tip)).toBeLessThan(1e-6);
    }
    // Held up: the scepter's tip is above the head.
    const raised = castBody(0.5);
    expect(raised.club!.tip.y).toBeLessThan(raised.head.y);
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
