import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../types';
import { HORSE_GROUND_Y, HORSE_LEG, RIDER_LIMBS, getHorsePose, type HorseGait, type HorsePose } from './horseRider';

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
const legs = (pose: HorsePose) => [pose.nearFore, pose.farFore, pose.nearHind, pose.farHind];
const GAITS: HorseGait[] = ['walk', 'gallop'];
const CYCLE_MS: Record<HorseGait, number> = { walk: 1200, gallop: 620 };
const frames = (gait: HorseGait): number[] => Array.from({ length: 120 }, (_, i) => (i / 120) * CYCLE_MS[gait]);

describe('horse and rider', () => {
  it.each(GAITS)('%s: legs keep their length, hooves never go below the ground', (gait) => {
    frames(gait).forEach((timeMs) => {
      legs(getHorsePose(timeMs, gait)).forEach(({ root, joint, hoof }) => {
        expect(distance(root, joint)).toBeCloseTo(HORSE_LEG.upper, 3);
        expect(distance(joint, hoof)).toBeCloseTo(HORSE_LEG.lower, 3);
        expect(hoof.y).toBeLessThanOrEqual(HORSE_GROUND_Y + 1e-9);
      });
    });
  });

  it.each(GAITS)('%s: the rider keeps his proportions, in the saddle and above the stirrups', (gait) => {
    frames(gait).forEach((timeMs) => {
      const { rider } = getHorsePose(timeMs, gait);
      expect(distance(rider.hip, rider.frontKnee)).toBeCloseTo(RIDER_LIMBS.thigh, 3);
      expect(distance(rider.frontKnee, rider.frontFoot)).toBeCloseTo(RIDER_LIMBS.shin, 3);
      expect(distance(rider.shoulder, rider.frontElbow)).toBeCloseTo(RIDER_LIMBS.upperArm, 3);
      expect(distance(rider.frontElbow, rider.frontHand)).toBeCloseTo(RIDER_LIMBS.forearm, 3);
      expect(distance(rider.shoulder, rider.rearElbow)).toBeCloseTo(RIDER_LIMBS.upperArm, 3);
      expect(distance(rider.hip, rider.shoulder)).toBeCloseTo(35, 6);
      // Legs down the horse's side, the knee in front.
      expect(rider.frontFoot.y).toBeGreaterThan(rider.hip.y + 35);
      expect(rider.frontKnee.x).toBeGreaterThan(rider.hip.x);
    });
  });

  it('walks with at least two hooves always down, and gallops with a moment in the air', () => {
    const grounded = (pose: HorsePose): number => legs(pose).filter(({ hoof }) => hoof.y > HORSE_GROUND_Y - 0.5).length;
    frames('walk').forEach((timeMs) => expect(grounded(getHorsePose(timeMs, 'walk'))).toBeGreaterThanOrEqual(2));
    expect(frames('gallop').some((timeMs) => grounded(getHorsePose(timeMs, 'gallop')) === 0)).toBe(true);
  });

  it.each(GAITS)('%s: loops without a jump', (gait) => {
    const start = getHorsePose(0, gait);
    const end = getHorsePose(CYCLE_MS[gait], gait);
    legs(start).forEach((leg, index) => expect(distance(leg.hoof, legs(end)[index].hoof)).toBeLessThan(1e-6));
    expect(distance(start.rider.head, end.rider.head)).toBeLessThan(1e-6);
  });
});
