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
