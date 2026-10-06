import { describe, expect, it } from 'vitest';
import { getDragonPose } from './dragon';
import { thrownBow, thrownRider } from './dragonRiderFall';
import { STICKMAN_HEAD } from './stickman';
import { GIB_GROUND_Y } from './stickmanGibs';
import type { JointPose } from './stickmanPose';

const FLY_Y = -150;
const BONES = ['hip', 'shoulder', 'neckTop', 'frontKnee', 'frontFoot', 'rearKnee', 'rearFoot', 'frontElbow', 'frontHand', 'rearElbow', 'rearHand'] as const;
const dragon = getDragonPose(300, 'archer');
const seated = Object.fromEntries(Object.entries(dragon.rider).map(([key, value]) =>
  [key, typeof value === 'number' ? value : { x: value.x, y: value.y + FLY_Y }])) as unknown as JointPose;
const length = (pose: JointPose, a: keyof JointPose, b: keyof JointPose): number => {
  const p = pose[a] as { x: number; y: number };
  const q = pose[b] as { x: number; y: number };
  return Math.hypot(p.x - q.x, p.y - q.y);
};
const SEGMENTS: Array<[keyof JointPose, keyof JointPose]> = [
  ['hip', 'shoulder'], ['shoulder', 'frontElbow'], ['frontElbow', 'frontHand'], ['shoulder', 'rearElbow'], ['rearElbow', 'rearHand'],
  ['hip', 'frontKnee'], ['frontKnee', 'frontFoot'], ['hip', 'rearKnee'], ['rearKnee', 'rearFoot'],
];

describe('thrown dragon rider', () => {
  it('starts in the saddle, flings his limbs out and never sinks into the ground', () => {
    expect(thrownRider(seated, 0).pose.hip).toEqual(seated.hip);
    for (let time = 0; time <= 2500; time += 10) {
      const { pose } = thrownRider(seated, time);
      BONES.forEach((key) => expect(pose[key].y).toBeLessThanOrEqual(GIB_GROUND_Y));
      expect(pose.head.y + STICKMAN_HEAD.radius).toBeLessThanOrEqual(GIB_GROUND_Y + 0.01);
      SEGMENTS.forEach(([a, b]) => expect(length(pose, a, b)).toBeCloseTo(length(seated, a, b), 5));
    }
    const midAir = thrownRider(seated, 300);
    expect(midAir.sprawl).toBe(1);
    expect(midAir.landed).toBe(false);
  });

  it('ends lying flat on his back behind the dragon', () => {
    const end = thrownRider(seated, 2500);
    expect(end.landed).toBe(true);
    expect(end.flat).toBe(1);
    BONES.forEach((key) => expect(end.pose[key].y).toBeGreaterThan(GIB_GROUND_Y - 8));
    expect(end.pose.hip.x).toBeLessThan(seated.hip.x - 80);
    // On his back: head behind (−x), feet ahead.
    expect(end.pose.head.x).toBeLessThan(end.pose.hip.x);
    expect(end.pose.frontFoot.x).toBeGreaterThan(end.pose.hip.x);
  });

  it('throws the bow off to land flat', () => {
    const rig = dragon.bow!.rig;
    const lift = (point: { x: number; y: number }) => ({ x: point.x, y: point.y + FLY_Y });
    const bow = thrownBow({ ...rig, bowTop: lift(rig.bowTop), bowBottom: lift(rig.bowBottom), bowControl: lift(rig.bowControl) }, 2500);
    expect(Math.abs(bow.bowTop.y - bow.bowBottom.y)).toBeLessThan(0.5);
    expect(Math.max(bow.bowTop.y, bow.bowBottom.y)).toBeLessThanOrEqual(GIB_GROUND_Y);
    expect(Math.max(bow.bowTop.y, bow.bowBottom.y)).toBeGreaterThan(GIB_GROUND_Y - 12);
  });
});
