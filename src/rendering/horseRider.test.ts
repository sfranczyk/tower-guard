import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../types';
import { mountedHitZones } from './horseHitZones';
import { HORSE_GROUND_Y, HORSE_LEG, gaitGroundSpeed, getHorsePose, type HorseGait, type HorsePose } from './horseRider';
import { LANCE, LANCE_IMPACT, RIDER_LIMBS } from './horseSeat';

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
const legs = (pose: HorsePose) => [pose.nearFore, pose.farFore, pose.nearHind, pose.farHind];
const GAITS: HorseGait[] = ['stand', 'walk', 'gallop'];
const CYCLE_MS: Record<HorseGait, number> = { stand: 2600, walk: 1200, gallop: 620 };
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

  it('stands with all four hooves still on the ground', () => {
    expect(gaitGroundSpeed('stand')).toBe(0);
    const first = getHorsePose(0, 'stand');
    frames('stand').forEach((timeMs) => legs(getHorsePose(timeMs, 'stand')).forEach(({ hoof }, index) => {
      expect(hoof.y).toBeCloseTo(HORSE_GROUND_Y, 6);
      expect(hoof.x).toBeCloseTo(legs(first)[index].hoof.x, 6);
    }));
  });

  it('gallops faster over the ground than it walks', () => {
    expect(gaitGroundSpeed('gallop')).toBeGreaterThan(gaitGroundSpeed('walk') * 3);
  });

  it('holds the lance in the near fist through the whole thrust, the arm keeping its length', () => {
    for (let i = 0; i <= 50; i += 1) {
      const { rider, lance } = getHorsePose(i * 37, 'stand', { thrust: i / 50 });
      expect(lance).toBeDefined();
      expect(distance(lance!.butt, rider.frontHand)).toBeCloseTo(LANCE.butt, 6);
      expect(distance(lance!.tip, rider.frontHand)).toBeCloseTo(LANCE.ahead, 6);
      expect(distance(rider.shoulder, rider.frontElbow)).toBeCloseTo(RIDER_LIMBS.upperArm, 3);
      expect(distance(rider.frontElbow, rider.frontHand)).toBeCloseTo(RIDER_LIMBS.forearm, 3);
    }
    expect(getHorsePose(0, 'walk').lance).toBeUndefined();
  });

  it('drives the point well past the horse\'s head and down to a man\'s chest at the strike, and starts and ends carried', () => {
    const carried = getHorsePose(0, 'stand', { thrust: 0 });
    const strike = getHorsePose(0, 'stand', { thrust: LANCE_IMPACT });
    expect(strike.lance!.tip.x).toBeGreaterThan(strike.muzzle.x + 40);
    expect(strike.lance!.tip.x).toBeGreaterThan(carried.lance!.tip.x + 10);
    // A standing man's chest is about 66 px above the ground in this sprite space.
    expect(strike.lance!.tip.y).toBeGreaterThan(HORSE_GROUND_Y - 80);
    expect(strike.lance!.tip.y).toBeLessThan(HORSE_GROUND_Y - 45);
    expect(distance(getHorsePose(0, 'stand', { thrust: 1 }).lance!.tip, carried.lance!.tip)).toBeLessThan(1e-6);
  });

  it('can be hit on the rider\'s head (a headshot), his torso and the horse, legs included, not between them', () => {
    const pose = getHorsePose(200, 'gallop', { thrust: 0 });
    const zones = mountedHitZones(pose);
    // The rider's head and the horse's head.
    expect(zones.filter((zone) => zone.headshot).map((zone) => zone.points[0])).toEqual([pose.rider.head, pose.poll]);
    expect(zones.filter((zone) => zone.part === 'rider').map((zone) => zone.points[0])).toEqual([pose.rider.head, pose.rider.hip]);
    const inside = (point: { x: number; y: number }): boolean => zones.some(({ points, padding }) =>
      point.x >= Math.min(...points.map((p) => p.x)) - padding && point.x <= Math.max(...points.map((p) => p.x)) + padding
      && point.y >= Math.min(...points.map((p) => p.y)) - padding && point.y <= Math.max(...points.map((p) => p.y)) + padding);
    [pose.rider.shoulder, pose.barrel.centre, pose.croup, pose.chest, pose.forehead].forEach((point) => expect(inside(point)).toBe(true));
    expect(inside({ x: pose.barrel.centre.x, y: HORSE_GROUND_Y - 8 })).toBe(false);
  });

  it.each(GAITS)('%s: every leg can be hit from the body down to just above the hoof (a zone each)', (gait) => {
    frames(gait).forEach((timeMs) => {
      const pose = getHorsePose(timeMs, gait);
      const legZones = mountedHitZones(pose).filter((zone) => zone.leg);
      expect(legZones).toHaveLength(4);
      const covered = (point: { x: number; y: number }): boolean => legZones.some(({ points, padding }) =>
        point.x >= Math.min(...points.map((p) => p.x)) - padding && point.x <= Math.max(...points.map((p) => p.x)) + padding
        && point.y >= Math.min(...points.map((p) => p.y)) - padding && point.y <= Math.max(...points.map((p) => p.y)) + padding);
      legs(pose).forEach(({ root, joint, hoof }) => {
        expect(covered(joint)).toBe(true);
        expect(covered({ x: (root.x + joint.x) / 2, y: (root.y + joint.y) / 2 })).toBe(true);
        expect(covered({ x: (joint.x + hoof.x) / 2, y: (joint.y + hoof.y) / 2 })).toBe(true);
      });
      // The zones end above the hooves.
      legZones.forEach(({ points, padding }) => expect(Math.max(...points.map((p) => p.y)) + padding).toBeLessThan(HORSE_GROUND_Y - 1));
    });
  });
});
