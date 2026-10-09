import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../types';
import { HORSE_DEATH_KINDS, HORSE_DEATH_MS, getHorseDeath, type HorseDeathKind } from './horseDeath';
import { HORSE_GROUND_Y, HORSE_LEG, getHorsePose, type HorsePose } from './horseRider';

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
const legs = (pose: HorsePose) => [pose.nearFore, pose.farFore, pose.nearHind, pose.farHind];
const frames = (kind: HorseDeathKind): number[] => Array.from({ length: 121 }, (_, i) => (i / 120) * (HORSE_DEATH_MS[kind] + 800));
/** The barrel's lowest point (its outline is an ellipse, tilted a little). */
const barrelBottom = ({ barrel }: HorsePose): number => barrel.centre.y + Math.hypot(barrel.rx * Math.sin(barrel.angle), barrel.ry * Math.cos(barrel.angle));

describe('horse death', () => {
  it.each(HORSE_DEATH_KINDS)('%s: starts from the standing horse with its rider in the saddle', (kind) => {
    const { horse, riderThrown } = getHorseDeath(kind, 0);
    const standing = getHorsePose(0, 'stand');
    expect(riderThrown).toBe(false);
    expect(horse.barrel.centre.y).toBeCloseTo(standing.barrel.centre.y, 0);
    expect(horse.nearFore.hoof.x).toBeCloseTo(standing.nearFore.hoof.x, 6);
  });

  it.each(HORSE_DEATH_KINDS)('%s: keeps the legs whole and nothing of the horse below the ground', (kind) => {
    frames(kind).forEach((timeMs) => {
      const { horse } = getHorseDeath(kind, timeMs);
      legs(horse).forEach(({ root, joint, hoof }) => {
        expect(distance(root, joint)).toBeCloseTo(HORSE_LEG.upper, 3);
        expect(distance(joint, hoof)).toBeCloseTo(HORSE_LEG.lower, 3);
        expect(hoof.y).toBeLessThanOrEqual(HORSE_GROUND_Y);
        expect(joint.y).toBeLessThanOrEqual(HORSE_GROUND_Y - 2);
      });
      expect(barrelBottom(horse)).toBeLessThanOrEqual(HORSE_GROUND_Y);
      [horse.muzzle, horse.nose, horse.chin, horse.poll, ...horse.tail].forEach((point) => expect(point.y).toBeLessThanOrEqual(HORSE_GROUND_Y));
    });
  });

  it.each(HORSE_DEATH_KINDS)('%s: ends lying on its side, the head down, and holds there', (kind) => {
    const { horse } = getHorseDeath(kind, HORSE_DEATH_MS[kind]);
    expect(barrelBottom(horse)).toBeGreaterThan(HORSE_GROUND_Y - 4);
    expect(horse.nose.y).toBeGreaterThan(HORSE_GROUND_Y - 5);
    // Legs stretched out: fore hooves well in front, hind well behind.
    expect(horse.nearFore.hoof.x).toBeGreaterThan(80);
    expect(horse.nearHind.hoof.x).toBeLessThan(-70);
    expect(getHorseDeath(kind, HORSE_DEATH_MS[kind] + 500).horse).toEqual(horse);
  });

  it.each([['lieDown', -1], ['drop', 1]] as const)('%s: throws the rider off (backwards or forwards), onto his back on the ground', (kind, way) => {
    const early = getHorseDeath(kind, 100);
    expect(early.riderThrown).toBe(false);
    expect(early.rider).toEqual(early.horse.rider);
    const { horse, rider, riderThrown } = getHorseDeath(kind, HORSE_DEATH_MS[kind] + 1000);
    expect(riderThrown).toBe(true);
    // He tumbles off the way it falls (back off its croup, forwards over its neck), not far: no further than the horse is long.
    const seat = early.rider.hip.x;
    expect((rider.hip.x - seat) * way).toBeGreaterThan(20);
    expect(Math.abs(rider.hip.x - seat)).toBeLessThan(horse.barrel.rx * 3);
    // Lying flat: hip, shoulder and head near the ground, the head behind the hip.
    [rider.hip, rider.shoulder].forEach((point) => expect(point.y).toBeGreaterThan(HORSE_GROUND_Y - 6));
    expect(rider.head.x).toBeLessThan(rider.hip.x);
  });
});
