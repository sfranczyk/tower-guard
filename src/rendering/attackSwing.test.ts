import { describe, expect, it } from 'vitest';
import { ATTACK_REST, getAttackPose, type AttackPose, type AttackStyle } from './attackSwing';

const KEYS: (keyof AttackPose)[] = ['armAngle', 'forearmBend', 'clubTilt', 'rearArmAngle', 'torsoLean', 'dip', 'step'];

describe('getAttackPose', () => {
  it('starts and ends exactly at the standing pose (no jump into or out of the swing)', () => {
    KEYS.forEach((key) => {
      expect(getAttackPose(0)[key]).toBeCloseTo(ATTACK_REST[key], 9);
      expect(getAttackPose(0.9999)[key]).toBeCloseTo(ATTACK_REST[key], 2);
    });
  });

  it('moves continuously: no frame-to-frame teleport', () => {
    const steps = 600;
    for (let index = 1; index <= steps; index += 1) {
      const a = getAttackPose((index - 1) / steps);
      const b = getAttackPose(index / steps);
      expect(Math.abs(b.armAngle - a.armAngle)).toBeLessThan(0.12);
      expect(Math.abs(b.forearmBend - a.forearmBend)).toBeLessThan(0.08);
      expect(Math.abs(b.step - a.step)).toBeLessThan(0.6);
    }
  });

  it('winds up behind the head, then strikes forward with the whole body', () => {
    const windUp = getAttackPose(0.34);
    const strike = getAttackPose(0.5);
    expect(windUp.armAngle).toBeGreaterThan(Math.PI);
    expect(windUp.torsoLean).toBeLessThan(0);
    expect(strike.armAngle).toBeLessThan(Math.PI / 2);
    expect(strike.torsoLean).toBeGreaterThan(0.2);
    expect(strike.step).toBeGreaterThan(5);
    expect(strike.dip).toBeGreaterThan(2);
  });

  it('swings the club down through the front, never back over the head on recovery', () => {
    for (let p = 0.5; p <= 1; p += 0.01) {
      expect(getAttackPose(p).armAngle).toBeLessThan(1.1);
    }
  });
});

describe('attack styles', () => {
  const styles: AttackStyle[] = ['overhead', 'twoHanded', 'uppercut'];

  it('all start and end at the standing pose and move without jumps', () => {
    styles.forEach((style) => {
      KEYS.forEach((key) => {
        expect(getAttackPose(0, style)[key]).toBeCloseTo(ATTACK_REST[key], 9);
        expect(getAttackPose(0.9999, style)[key]).toBeCloseTo(ATTACK_REST[key], 2);
      });
      for (let index = 1; index <= 600; index += 1) {
        const a = getAttackPose((index - 1) / 600, style);
        const b = getAttackPose(index / 600, style);
        expect(Math.abs(b.armAngle - a.armAngle)).toBeLessThan(0.15);
        expect(Math.abs(b.step - a.step)).toBeLessThan(0.7);
      }
    });
  });

  it('never bends the elbow the wrong way, and keeps the wrist in a natural range', () => {
    styles.forEach((style) => {
      for (let p = 0; p < 1; p += 0.005) {
        const pose = getAttackPose(p, style);
        expect(pose.forearmBend).toBeGreaterThanOrEqual(0);
        expect(pose.clubTilt).toBeGreaterThanOrEqual(0);
        expect(pose.clubTilt).toBeLessThanOrEqual(Math.PI / 2 + 0.1);
      }
    });
  });

  it('two-handed winds up further and lunges harder than one-handed', () => {
    expect(getAttackPose(0.38, 'twoHanded').armAngle).toBeGreaterThan(getAttackPose(0.34, 'overhead').armAngle);
    expect(getAttackPose(0.55, 'twoHanded').step).toBeGreaterThan(getAttackPose(0.5, 'overhead').step);
  });

  it('uppercut winds up low behind and strikes upwards', () => {
    expect(getAttackPose(0.3, 'uppercut').armAngle).toBeLessThan(0);
    expect(getAttackPose(0.48, 'uppercut').armAngle).toBeGreaterThan(Math.PI / 2);
  });
});
