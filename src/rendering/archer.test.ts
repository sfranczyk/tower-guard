import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../types';
import { ARCHER_NECK, getArcherRig, toArcherLocalAngle } from './archer';

const angleFromNeck = (point: Vec2): number => Math.atan2(point.y - ARCHER_NECK.y, point.x - ARCHER_NECK.x);

describe('getArcherRig', () => {
  const angles = [0, 0.7, -1.2, Math.PI / 2, 2.5];
  const tensions = [0, 0.4, 1];

  it('keeps both hands on the aim ray from the neck', () => {
    angles.forEach((angle) => tensions.forEach((tension) => {
      const rig = getArcherRig(angle, tension);
      expect(angleFromNeck(rig.woodHand)).toBeCloseTo(angle);
      if (tension < 1) {
        expect(angleFromNeck(rig.stringHand)).toBeCloseTo(angle);
      }
    }));
  });

  it('keeps the front hand on the bow grip (curve midpoint) at any tension', () => {
    angles.forEach((angle) => tensions.forEach((tension) => {
      const { bowTop, bowBottom, bowControl, woodHand } = getArcherRig(angle, tension);
      const midpoint = {
        x: 0.25 * bowTop.x + 0.5 * bowControl.x + 0.25 * bowBottom.x,
        y: 0.25 * bowTop.y + 0.5 * bowControl.y + 0.25 * bowBottom.y,
      };
      expect(midpoint.x).toBeCloseTo(woodHand.x);
      expect(midpoint.y).toBeCloseTo(woodHand.y);
    }));
  });

  it('rests the string hand on the straight string at zero tension', () => {
    const { bowTop, bowBottom, stringHand } = getArcherRig(0.3, 0);
    expect(stringHand.x).toBeCloseTo((bowTop.x + bowBottom.x) / 2);
    expect(stringHand.y).toBeCloseTo((bowTop.y + bowBottom.y) / 2);
  });

  it('pulls the string hand towards the neck as tension grows', () => {
    const distance = (tension: number): number => {
      const hand = getArcherRig(0, tension).stringHand;
      return Math.hypot(hand.x - ARCHER_NECK.x, hand.y - ARCHER_NECK.y);
    };
    expect(distance(0.5)).toBeLessThan(distance(0));
    expect(distance(1)).toBeLessThan(distance(0.5));
  });
});

describe('toArcherLocalAngle', () => {
  it('is the identity for an unrotated sprite facing right', () => {
    expect(toArcherLocalAngle(0.4, 0, 1)).toBeCloseTo(0.4);
  });

  it('mirrors the angle when facing left', () => {
    expect(toArcherLocalAngle(Math.PI, 0, -1)).toBeCloseTo(0);
    expect(toArcherLocalAngle(Math.PI - 0.3, 0, -1)).toBeCloseTo(0.3);
  });

  it('undoes the sprite lean', () => {
    expect(toArcherLocalAngle(0.5, 0.2, 1)).toBeCloseTo(0.3);
  });
});

describe('getArcherRig bow ready blend', () => {
  const freeArm = { elbow: { x: 3, y: -15 }, hand: { x: 9, y: 5 } };

  it('lowered: string arm is the free arm and the string is at rest even with tension', () => {
    const rig = getArcherRig(0, 1, 0, freeArm);
    expect(rig.stringHand).toEqual(freeArm.hand);
    expect(rig.stringElbow).toEqual(freeArm.elbow);
    expect(rig.stringNock.x).toBeCloseTo((rig.bowTop.x + rig.bowBottom.x) / 2);
    expect(rig.stringNock.y).toBeCloseTo((rig.bowTop.y + rig.bowBottom.y) / 2);
  });

  it('lowered: bow is held low, below the neck', () => {
    const rig = getArcherRig(-0.5, 0, 0, freeArm);
    expect(rig.woodHand.y).toBeGreaterThan(ARCHER_NECK.y + 30);
  });

  it('ready = 1 matches the aiming rig and puts the hand on the nock', () => {
    const ready = getArcherRig(0.3, 0.6, 1, freeArm);
    const aiming = getArcherRig(0.3, 0.6);
    expect(ready).toEqual(aiming);
    expect(ready.stringHand).toEqual(ready.stringNock);
  });

  it('moves continuously while raising the bow', () => {
    let previous = getArcherRig(0.2, 0, 0, freeArm);
    for (let step = 1; step <= 50; step += 1) {
      const rig = getArcherRig(0.2, 0, step / 50, freeArm);
      expect(Math.hypot(rig.woodHand.x - previous.woodHand.x, rig.woodHand.y - previous.woodHand.y)).toBeLessThan(4);
      expect(Math.hypot(rig.stringHand.x - previous.stringHand.x, rig.stringHand.y - previous.stringHand.y)).toBeLessThan(4);
      previous = rig;
    }
  });

  it('keeps the front hand on the bow grip throughout the blend', () => {
    [0, 0.25, 0.5, 0.75, 1].forEach((ready) => {
      const { bowTop, bowBottom, bowControl, woodHand } = getArcherRig(0.4, 0.5, ready, freeArm);
      expect(0.25 * bowTop.x + 0.5 * bowControl.x + 0.25 * bowBottom.x).toBeCloseTo(woodHand.x);
      expect(0.25 * bowTop.y + 0.5 * bowControl.y + 0.25 * bowBottom.y).toBeCloseTo(woodHand.y);
    });
  });
});
